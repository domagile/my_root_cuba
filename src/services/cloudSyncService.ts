import type { Person } from '../types';
import { captureDirtySnapshot, isQuotaExceededToday, useCloudSyncStore } from '../stores/useCloudSyncStore';

// All outbox drains share one FIFO, including the 600ms person-delta path.
let syncTail: Promise<unknown> = Promise.resolve();
export function queueCloudSync<T>(operation: () => Promise<T>): Promise<T> {
  const result = syncTail.then(operation);
  syncTail = result.then(() => undefined, () => undefined);
  return result;
}

const entityTypes = ['persons', 'families', 'events', 'sources', 'places'] as const;
const researchTypes = ['metricRecords', 'documents', 'tasks', 'findings', 'hypotheses', 'requests', 'matrixEntries'] as const;
type CollectionName = typeof entityTypes[number] | typeof researchTypes[number];
type ProjectPayload = Partial<Record<CollectionName, any[]>> & {
  lastUpdated?: string;
  counts?: { personsCount: number; familiesCount: number; metricRecordsCount: number;
    documentsCount: number; hypothesesCount: number };
};

export interface ProjectSyncData {
  persons: Person[];
  families: Record<string, any>;
  events: Record<string, any>;
  sources: Record<string, any>;
  places: Record<string, any>;
  metricRecords: any[];
  documents: any[];
  tasks: any[];
  findings: any[];
  hypotheses: any[];
  requests: any[];
  matrixEntries: any[];
  trashPersons?: Person[];
}

export interface CloudSyncApi {
  savePersonDoc: (person: Person) => Promise<boolean>;
  savePersonDeltaDoc: (id: string, delta: Partial<Person>) => Promise<boolean>;
  batchDeleteEntities: (type: string, ids: string[], projectId?: string, allowManual?: boolean) => Promise<boolean>;
  saveProjectDataToCloud: (data: ProjectPayload) => Promise<boolean>;
}

export interface SyncResult { success: boolean; message: string; }
interface Operation { run: () => Promise<boolean>; }
interface SyncOptions {
  manual?: boolean;
  forceFull?: boolean;
  beforeUpload?: (data: ProjectSyncData) => Promise<unknown>;
}

const quotaMessage = 'Квоту Firestore вичерпано. Зміни ще не вивантажено і залишаються в черзі для повторної спроби.';
const errorMessage = 'Не вдалося підтвердити вивантаження всіх змін. Вони залишаються в черзі для повторної спроби.';

function preserveProjectRetry(full: boolean): void {
  const state = useCloudSyncStore.getState();
  if (full) {
    if (state.untrackedChangesCount === 0) state.markUnsavedChange();
  } else {
    state.markProjectUploadPending();
  }
}

async function checkOperations(operations: Operation[]): Promise<boolean> {
  // Invoke inside a promise so synchronous exceptions are also treated as failures.
  const results = await Promise.allSettled(operations.map(operation => Promise.resolve().then(operation.run)));
  return results.every(result => result.status === 'fulfilled' && result.value === true);
}

export function synchronizeProject(
  getData: () => ProjectSyncData, api: CloudSyncApi, options: SyncOptions = {}
): Promise<SyncResult> {
  return queueCloudSync(async () => {
    const store = useCloudSyncStore.getState();
    const manual = options.manual !== false;
    if (!manual && store.syncMode !== 'auto') return { success: false, message: 'Автоматичне вивантаження вимкнено.' };
    if (!options.forceFull && !store.hasUnsavedChanges) {
      return { success: store.pendingWritesCount === 0 && store.status !== 'error', message: 'Немає нових змін для вивантаження.' };
    }
    const snapshot = captureDirtySnapshot();
    const data = getData();
    // Untracked changes (e.g. a bulk import) require a full snapshot.
    const full = options.forceFull || store.untrackedChangesCount > 0;
    const tracker = snapshot.tracker;
    if (manual) store.setIsManualPushing(true);
    store.setStatus('syncing');
    try {
      if (options.beforeUpload) {
        try { await options.beforeUpload(data); }
        catch { /* A local backup failure must never be presented as a cloud success. */ }
      }
      if (useCloudSyncStore.getState().isQuotaExceeded || isQuotaExceededToday()) {
        preserveProjectRetry(Boolean(full));
        store.setStatus('offline');
        return { success: false, message: quotaMessage };
      }
      const deletions: Operation[] = [];
      for (const type of entityTypes) {
        const key = ('deleted' + type[0].toUpperCase() + type.slice(1)) as keyof typeof tracker;
        const ids = Array.from(new Set([
          ...tracker[key], ...(full && type === 'persons' ? (data.trashPersons || []).map(person => person.id) : [])
        ]));
        if (ids.length) deletions.push({ run: () => api.batchDeleteEntities(type, ids, undefined, manual) });
      }

      const writes: Operation[] = [];
      const payload: ProjectPayload = { lastUpdated: new Date().toISOString(), counts: {
        personsCount: data.persons.length, familiesCount: Object.keys(data.families).length,
        metricRecordsCount: data.metricRecords.length, documentsCount: data.documents.length,
        hypothesesCount: data.hypotheses.length
      } };
      if (full) {
        payload.persons = data.persons;
      } else {
        for (const id of tracker.persons) {
          const delta = snapshot.personDeltas[id];
          const person = data.persons.find(item => item.id === id);
          // A missing local entity is not proof that its queued write succeeded.
          writes.push({ run: () => delta && Object.keys(delta).length
            ? api.savePersonDeltaDoc(id, delta) : person ? api.savePersonDoc(person) : Promise.resolve(false) });
        }
      }
      for (const type of ['families', 'events', 'sources', 'places'] as const) {
        const ids = tracker[type];
        if (full) payload[type] = Object.values(data[type]);
        else if (ids.length) {
          const rows = ids.map(id => data[type][id]);
          if (rows.some(row => !row)) writes.push({ run: () => Promise.resolve(false) });
          payload[type] = rows.filter(Boolean);
        }
      }
      for (const type of researchTypes) {
        if (full || tracker.research.includes(type)) payload[type] = data[type];
      }
      if (tracker.research.some(type => !researchTypes.includes(type as typeof researchTypes[number]))) {
        writes.push({ run: () => Promise.resolve(false) });
      }
      writes.push({ run: () => api.saveProjectDataToCloud(payload) });

      // Keep deletes before writes, including restoration/replacement of a person.
      const deleted = await checkOperations(deletions);
      const written = await checkOperations(writes);
      if (!deleted || !written) {
        preserveProjectRetry(Boolean(full));
        const quota = useCloudSyncStore.getState().isQuotaExceeded || isQuotaExceededToday();
        store.setStatus(quota ? 'offline' : 'error', quota ? quotaMessage : errorMessage);
        return { success: false, message: quota ? quotaMessage : errorMessage };
      }
      // Retain the entire batch on a partial failure. Repeating these merge/delete
      // operations is idempotent; discarding an unconfirmed operation is not safe.
      if (!store.clearDirtyIfUnchanged(snapshot.revision)) {
        store.setStatus('pending');
        return { success: false, message: 'Під час вивантаження з’явилися нові зміни. Вони залишилися в черзі; повторіть вивантаження перед оновленням з хмари.' };
      }
      store.setStatus('synced');
      return { success: true, message: full ? 'Повний знімок підтверджено у Firestore.' : 'Усі зміни підтверджено у Firestore.' };
    } catch {
      preserveProjectRetry(Boolean(full));
      const quota = useCloudSyncStore.getState().isQuotaExceeded || isQuotaExceededToday();
      store.setStatus(quota ? 'offline' : 'error', quota ? quotaMessage : errorMessage);
      return { success: false, message: quota ? quotaMessage : errorMessage };
    } finally {
      if (manual) store.setIsManualPushing(false);
    }
  });
}

export function synchronizePersonDeltas(
  ids: string[], writeDelta: CloudSyncApi['savePersonDeltaDoc']
): Promise<void> {
  return queueCloudSync(async () => {
    for (const id of ids) {
      const state = useCloudSyncStore.getState();
      if (state.syncMode !== 'auto' || state.isQuotaExceeded || isQuotaExceededToday()) return;
      const snapshot = captureDirtySnapshot();
      const delta = snapshot.personDeltas[id];
      if (!delta || !snapshot.tracker.persons.includes(id)) continue;
      try {
        // Send the full accumulated delta, including any previously failed fields.
        if (await writeDelta(id, delta) === true) state.clearPersonDirtyDelta(id, snapshot);
        else state.setStatus(useCloudSyncStore.getState().isQuotaExceeded ? 'offline' : 'error', errorMessage);
      } catch {
        state.setStatus(useCloudSyncStore.getState().isQuotaExceeded ? 'offline' : 'error', errorMessage);
      }
    }
  });
}
