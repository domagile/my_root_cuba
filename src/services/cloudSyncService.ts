import { getPendingDeletionChanges, acknowledgeDeletionChanges, getDeletionStateRevision } from '../utils/personDeletionState';
import { flushPendingLocalWrites } from '../utils/indexedDbStorage';
import { getPendingIgnoredDuplicateChanges, acknowledgeIgnoredDuplicateChanges } from '../utils/ignoredDuplicateState';
import { getPendingMergedPersonChanges, acknowledgeMergedPersonChanges, type MergedPersonSnapshot } from '../utils/mergedPersonState';
import type { IgnoredDuplicateChange, IgnoredDuplicateSnapshot } from '../utils/ignoredDuplicateKeys';
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
  updatePersonDeletionMarkers?: (changes: Record<string, boolean>) => Promise<string[] | null>;
  updateIgnoredDuplicatePairs?: (changes: IgnoredDuplicateChange[]) => Promise<IgnoredDuplicateSnapshot | null>;
  updateMergedPersons?: (changes: Record<string, string | null>) => Promise<MergedPersonSnapshot | null>;
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
    const deletionChanges = getPendingDeletionChanges();
    const ignoredChanges = getPendingIgnoredDuplicateChanges();
    const mergedChanges = getPendingMergedPersonChanges();
    if (!options.forceFull && !store.hasUnsavedChanges && Object.keys(deletionChanges).length === 0 && Object.keys(ignoredChanges).length === 0 && Object.keys(mergedChanges).length === 0) {
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
      await flushPendingLocalWrites();
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
          ...tracker[key],
          ...(type === 'persons' ? Object.entries(deletionChanges).filter(([, change]) => change.deleted).map(([id]) => id) : []),
          ...(full && type === 'persons' ? (data.trashPersons || []).map(person => person.id) : [])
        ]));
        if (ids.length) deletions.push({ run: () => api.batchDeleteEntities(type, ids, undefined, manual) });
      }

      const writes: Operation[] = [];
      const payload: ProjectPayload = { lastUpdated: new Date().toISOString(), counts: {
        personsCount: data.persons.length, familiesCount: Object.keys(data.families).length,
        metricRecordsCount: data.metricRecords.length, documentsCount: data.documents.length,
        hypothesesCount: data.hypotheses.length
      } };
      const restoredIds = Object.entries(deletionChanges).filter(([, change]) => !change.deleted).map(([id]) => id);
      const personIds = new Set([...tracker.persons, ...restoredIds]);
      // A one-person edit avoids building an index. Bulk work performs one scan,
      // retaining the same first-record choice as Array.find for legacy duplicates.
      let personIndex: Map<string, Person> | undefined;
      if ((full ? 0 : personIds.size) + restoredIds.length >= 8) {
        personIndex = new Map();
        for (const person of data.persons) if (!personIndex.has(person.id)) personIndex.set(person.id, person);
      }
      const findPerson = (id: string) => personIndex ? personIndex.get(id) : data.persons.find(person => person.id === id);
      if (full) {
        payload.persons = data.persons;
      } else {
        for (const id of personIds) {
          const delta = deletionChanges[id]?.deleted === false ? undefined : snapshot.personDeltas[id];
          const person = findPerson(id);
          writes.push({ run: () => delta && Object.keys(delta).length
            ? api.savePersonDeltaDoc(id, delta) : person ? api.savePersonDoc(person) : Promise.resolve(false) });
        }
      }
      if (restoredIds.some(id => {
        const person = findPerson(id);
        return !person || person.isDeleted;
      })) writes.push({ run: () => Promise.resolve(false) });
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
      if (Object.keys(deletionChanges).length > 0) {
        const changes = Object.fromEntries(Object.entries(deletionChanges).map(([id, change]) => [id, change.deleted]));
        const deletionRevision = getDeletionStateRevision();
        const cloudIds = await api.updatePersonDeletionMarkers?.(changes);
        const confirmedIds = Array.isArray(cloudIds) ? new Set(cloudIds) : null;
        if (!Array.isArray(cloudIds) || cloudIds.some(id => typeof id !== 'string') ||
            Object.entries(changes).some(([id, deleted]) => confirmedIds!.has(id) !== deleted)) {
          preserveProjectRetry(Boolean(full));
          store.setStatus(useCloudSyncStore.getState().isQuotaExceeded ? 'offline' : 'error', errorMessage);
          return { success: false, message: errorMessage };
        }
        acknowledgeDeletionChanges(deletionChanges, cloudIds, deletionRevision);
      }
      if (Object.keys(ignoredChanges).length > 0) {
        const confirmed = await api.updateIgnoredDuplicatePairs?.(Object.values(ignoredChanges));
        if (!acknowledgeIgnoredDuplicateChanges(ignoredChanges, confirmed)) {
          preserveProjectRetry(Boolean(full));
          store.setStatus(useCloudSyncStore.getState().isQuotaExceeded ? 'offline' : 'error', errorMessage);
          return { success: false, message: errorMessage };
        }
      }
      if (Object.keys(mergedChanges).length > 0) {
        const changes = Object.fromEntries(Object.entries(mergedChanges).map(([id, change]) => [id, change.target]));
        const confirmed = await api.updateMergedPersons?.(changes);
        if (!acknowledgeMergedPersonChanges(mergedChanges, confirmed)) {
          preserveProjectRetry(Boolean(full));
          store.setStatus(useCloudSyncStore.getState().isQuotaExceeded ? 'offline' : 'error', errorMessage);
          return { success: false, message: errorMessage };
        }
      }
      // Retain the entire batch on a partial failure. Repeating these merge/delete
      // operations is idempotent; discarding an unconfirmed operation is not safe.
      if (Object.keys(getPendingDeletionChanges()).length > 0 || Object.keys(getPendingIgnoredDuplicateChanges()).length > 0 || Object.keys(getPendingMergedPersonChanges()).length > 0 || !store.clearDirtyIfUnchanged(snapshot.revision)) {
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
        await flushPendingLocalWrites();
        // Send the full accumulated delta, including any previously failed fields.
        if (await writeDelta(id, delta) === true) state.clearPersonDirtyDelta(id, snapshot);
        else state.setStatus(useCloudSyncStore.getState().isQuotaExceeded ? 'offline' : 'error', errorMessage);
      } catch {
        state.setStatus(useCloudSyncStore.getState().isQuotaExceeded ? 'offline' : 'error', errorMessage);
      }
    }
  });
}
