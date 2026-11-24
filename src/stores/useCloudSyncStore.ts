import { create } from 'zustand';
import type { Person } from '../types';

export type CloudSyncStatus = 'synced' | 'syncing' | 'pending' | 'offline' | 'error';
export type CloudSyncMode = 'manual' | 'auto';
export type EntitySyncType = 'persons' | 'families' | 'events' | 'sources' | 'places' | 'research';
export type DirtyPersonsDeltaMap = Record<string, Partial<Person>>;

const SYNC_MODE_STORAGE_KEY = 'rodovid_cloud_sync_mode';
const QUOTA_STORAGE_KEY = 'rodovid_firestore_quota_exceeded_day';
const DELTAS_STORAGE_KEY = 'rodovid_dirty_person_deltas_v2';
const DIRTY_STORAGE_KEY = 'rodovid_dirty_entities_tracker_v2';
const UNTRACKED_STORAGE_KEY = 'rodovid_untracked_changes_count_v1';
const PROJECT_PENDING_STORAGE_KEY = 'rodovid_project_upload_pending_v1';

export interface DirtyEntitiesTracker {
  persons: string[];
  families: string[];
  events: string[];
  sources: string[];
  places: string[];
  research: string[];
  deletedPersons: string[];
  deletedFamilies: string[];
  deletedEvents: string[];
  deletedSources: string[];
  deletedPlaces: string[];
}

function emptyTracker(): DirtyEntitiesTracker {
  return { persons: [], families: [], events: [], sources: [], places: [], research: [],
    deletedPersons: [], deletedFamilies: [], deletedEvents: [], deletedSources: [], deletedPlaces: [] };
}

export function loadDirtyPersonsDeltas(): DirtyPersonsDeltaMap {
  try {
    const raw = localStorage.getItem(DELTAS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

export function saveDirtyPersonsDeltas(deltas: DirtyPersonsDeltaMap): void {
  try { localStorage.setItem(DELTAS_STORAGE_KEY, JSON.stringify(deltas)); } catch {}
}

export function loadDirtyEntities(): DirtyEntitiesTracker {
  try {
    const raw = localStorage.getItem(DIRTY_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return emptyTracker();
}

export function saveDirtyEntities(tracker: DirtyEntitiesTracker): void {
  try { localStorage.setItem(DIRTY_STORAGE_KEY, JSON.stringify(tracker)); } catch {}
}

function loadUntrackedChanges(): number {
  try { return Math.max(0, Number(localStorage.getItem(UNTRACKED_STORAGE_KEY)) || 0); }
  catch { return 0; }
}

function saveUntrackedChanges(count: number): void {
  try { localStorage.setItem(UNTRACKED_STORAGE_KEY, String(count)); } catch {}
}

function loadProjectPending(): boolean {
  try { return localStorage.getItem(PROJECT_PENDING_STORAGE_KEY) === '1'; } catch { return false; }
}
function saveProjectPending(pending: boolean): void {
  try { localStorage.setItem(PROJECT_PENDING_STORAGE_KEY, pending ? '1' : '0'); } catch {}
}

export function countDirtyItems(tracker: DirtyEntitiesTracker): number {
  return Object.values(tracker).reduce((count, ids) => count + ids.length, 0);
}

export function isQuotaExceededToday(): boolean {
  try { return localStorage.getItem(QUOTA_STORAGE_KEY) === new Date().toISOString().slice(0, 10); }
  catch { return false; }
}

export function markQuotaExceededToday(exceeded: boolean = true): void {
  try {
    if (exceeded) localStorage.setItem(QUOTA_STORAGE_KEY, new Date().toISOString().slice(0, 10));
    else localStorage.removeItem(QUOTA_STORAGE_KEY);
  } catch {}
}

export interface DirtySyncSnapshot {
  revision: number;
  tracker: DirtyEntitiesTracker;
  personDeltas: DirtyPersonsDeltaMap;
}

export function captureDirtySnapshot(): DirtySyncSnapshot {
  const state = useCloudSyncStore.getState();
  return { revision: state.changeRevision, tracker: state.dirtyTracker, personDeltas: state.dirtyPersonsDelta };
}

export interface CloudSyncState {
  status: CloudSyncStatus;
  syncMode: CloudSyncMode;
  lastSyncTime: string | null;
  lastError: string | null;
  pendingWritesCount: number;
  pendingWriteError: string | null;
  isManualPushing: boolean;
  isManualPulling: boolean;
  hasUnsavedChanges: boolean;
  unsavedChangesCount: number;
  isQuotaExceeded: boolean;
  dirtyTracker: DirtyEntitiesTracker;
  dirtyPersonsDelta: DirtyPersonsDeltaMap;
  changeRevision: number;
  untrackedChangesCount: number;
  projectUploadPending: boolean;
  setStatus: (status: CloudSyncStatus, error?: string | null) => void;
  setSyncMode: (mode: CloudSyncMode) => void;
  setLastSyncTime: (time: string) => void;
  setQuotaExceeded: (exceeded: boolean) => void;
  incrementPending: () => void;
  decrementPending: (success?: boolean, error?: string | null) => void;
  setIsManualPushing: (isPushing: boolean) => void;
  setIsManualPulling: (isPulling: boolean) => void;
  markDirty: (type: EntitySyncType, id: string) => void;
  markPersonDirtyWithDelta: (personId: string, delta: Partial<Person>) => void;
  clearPersonDirtyDelta: (personId: string, snapshot: DirtySyncSnapshot) => void;
  markDeleted: (type: EntitySyncType, id: string) => void;
  clearDirtyIfUnchanged: (revision: number) => boolean;
  clearDirty: () => void;
  markUnsavedChange: () => void;
  markProjectUploadPending: () => void;
  clearUnsavedChanges: () => void;
}

function queueUpdate(
  state: CloudSyncState, tracker: DirtyEntitiesTracker, deltas = state.dirtyPersonsDelta
): Partial<CloudSyncState> {
  saveDirtyEntities(tracker);
  saveDirtyPersonsDeltas(deltas);
  const count = countDirtyItems(tracker) + state.untrackedChangesCount + Number(state.projectUploadPending);
  return { dirtyTracker: tracker, dirtyPersonsDelta: deltas,
    hasUnsavedChanges: count > 0, unsavedChangesCount: count };
}

function changedStatus(state: CloudSyncState): CloudSyncStatus {
  return state.isQuotaExceeded ? 'offline' : state.pendingWritesCount > 0 ? 'syncing' : 'pending';
}

function resetDirtyState(state: CloudSyncState): Partial<CloudSyncState> {
  saveUntrackedChanges(0);
  saveProjectPending(false);
  return { ...queueUpdate({ ...state, untrackedChangesCount: 0, projectUploadPending: false }, emptyTracker(), {}),
    untrackedChangesCount: 0, projectUploadPending: false, changeRevision: state.changeRevision + 1,
    lastError: null, pendingWriteError: null };
}

const initialDirtyPersonsDelta = loadDirtyPersonsDeltas();
const restoredTracker = loadDirtyEntities();
const initialDirtyTracker = { ...restoredTracker, persons: Array.from(new Set([
  ...restoredTracker.persons, ...Object.keys(initialDirtyPersonsDelta)
])) };
const initialUntrackedCount = loadUntrackedChanges();
const initialProjectPending = loadProjectPending();
const initialDirtyCount = countDirtyItems(initialDirtyTracker) + initialUntrackedCount + Number(initialProjectPending);

export const useCloudSyncStore = create<CloudSyncState>((set) => ({
  status: isQuotaExceededToday() ? 'offline' : 'pending',
  syncMode: (() => {
    try {
      const saved = localStorage.getItem(SYNC_MODE_STORAGE_KEY);
      if (saved === 'auto' || saved === 'manual') return saved;
    } catch {}
    return 'manual';
  })(),
  lastSyncTime: null,
  lastError: null,
  pendingWritesCount: 0,
  pendingWriteError: null,
  isManualPushing: false,
  isManualPulling: false,
  hasUnsavedChanges: initialDirtyCount > 0,
  unsavedChangesCount: initialDirtyCount,
  isQuotaExceeded: isQuotaExceededToday(),
  dirtyTracker: initialDirtyTracker,
  dirtyPersonsDelta: initialDirtyPersonsDelta,
  changeRevision: 0,
  untrackedChangesCount: initialUntrackedCount,
  projectUploadPending: initialProjectPending,

  setQuotaExceeded: (isQuotaExceeded) => {
    markQuotaExceededToday(isQuotaExceeded);
    set((state) => ({ isQuotaExceeded, status: isQuotaExceeded ? 'offline'
      : state.pendingWritesCount > 0 ? 'syncing'
      : state.hasUnsavedChanges || !state.lastSyncTime ? 'pending'
      : state.lastError ? 'error' : 'synced' }));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rodovid_quota_exceeded_changed', { detail: { isQuotaExceeded } }));
    }
  },

  setStatus: (status, error = null) => set((state) => {
    const nextStatus = status === 'synced'
      ? state.isQuotaExceeded ? 'offline' : state.pendingWritesCount > 0 ? 'syncing'
        : state.pendingWriteError ? 'error'
        : state.hasUnsavedChanges ? (state.lastError ? 'error' : 'pending') : 'synced'
      : status;
    return { status: nextStatus, lastError: error || (nextStatus === 'error' ? state.lastError : null),
      lastSyncTime: nextStatus === 'synced' ? new Date().toISOString() : state.lastSyncTime };
  }),

  setSyncMode: (syncMode) => {
    try { localStorage.setItem(SYNC_MODE_STORAGE_KEY, syncMode); } catch {}
    set({ syncMode });
  },
  setLastSyncTime: (time) => set({ lastSyncTime: time }),

  incrementPending: () => set((state) => ({
    pendingWritesCount: state.pendingWritesCount + 1,
    pendingWriteError: state.pendingWritesCount === 0 ? null : state.pendingWriteError,
    status: state.isQuotaExceeded ? 'offline' : 'syncing'
  })),

  decrementPending: (success = true, error = null) => set((state) => {
    const nextCount = Math.max(0, state.pendingWritesCount - 1);
    const failure = success ? state.pendingWriteError
      : error || state.pendingWriteError || 'Помилка синхронізації з Firestore';
    const status: CloudSyncStatus = state.isQuotaExceeded ? 'offline' : nextCount > 0 ? 'syncing'
      : failure ? 'error' : state.hasUnsavedChanges ? 'pending' : 'synced';
    return { pendingWritesCount: nextCount, pendingWriteError: failure, status, lastError: failure,
      lastSyncTime: status === 'synced' ? new Date().toISOString() : state.lastSyncTime };
  }),

  setIsManualPushing: (isManualPushing) => set({ isManualPushing }),
  setIsManualPulling: (isManualPulling) => set({ isManualPulling }),

  markDirty: (type, id) => set((state) => {
    const tracker = { ...state.dirtyTracker, [type]: Array.from(new Set([...state.dirtyTracker[type], id])) };
    const deletedKey = ('deleted' + type[0].toUpperCase() + type.slice(1)) as keyof DirtyEntitiesTracker;
    if (tracker[deletedKey]) tracker[deletedKey] = tracker[deletedKey].filter(item => item !== id);
    // A full-entity write must not be acknowledged by an older partial delta.
    const deltas = { ...state.dirtyPersonsDelta };
    if (type === 'persons') delete deltas[id];
    return { ...queueUpdate(state, tracker, deltas),
      changeRevision: state.changeRevision + 1, status: changedStatus(state) };
  }),

  markPersonDirtyWithDelta: (personId, delta) => set((state) => {
    const tracker = { ...state.dirtyTracker,
      persons: Array.from(new Set([...state.dirtyTracker.persons, personId])),
      deletedPersons: state.dirtyTracker.deletedPersons.filter(id => id !== personId) };
    // Keep the full-write marker for new/full-updated persons until it is acknowledged.
    const needsFullWrite = state.dirtyTracker.persons.includes(personId) && !state.dirtyPersonsDelta[personId];
    const deltas = needsFullWrite ? state.dirtyPersonsDelta : { ...state.dirtyPersonsDelta,
      [personId]: { ...state.dirtyPersonsDelta[personId], ...delta } };
    return { ...queueUpdate(state, tracker, deltas),
      changeRevision: state.changeRevision + 1, status: changedStatus(state) };
  }),

  clearPersonDirtyDelta: (personId, snapshot) => set((state) => {
    if (state.changeRevision !== snapshot.revision || !snapshot.personDeltas[personId]
      || state.dirtyPersonsDelta[personId] !== snapshot.personDeltas[personId]) return state;
    const tracker = { ...state.dirtyTracker, persons: state.dirtyTracker.persons.filter(id => id !== personId) };
    const deltas = { ...state.dirtyPersonsDelta };
    delete deltas[personId];
    const next = queueUpdate(state, tracker, deltas);
    const status: CloudSyncStatus = state.isQuotaExceeded ? 'offline' : state.pendingWritesCount > 0 ? 'syncing'
      : state.pendingWriteError ? 'error' : next.hasUnsavedChanges ? 'pending' : 'synced';
    return { ...next, status, lastError: state.pendingWriteError,
      lastSyncTime: status === 'synced' ? new Date().toISOString() : state.lastSyncTime };
  }),

  markDeleted: (type, id) => set((state) => {
    const tracker = { ...state.dirtyTracker, [type]: state.dirtyTracker[type].filter(item => item !== id) };
    const deletedKey = ('deleted' + type[0].toUpperCase() + type.slice(1)) as keyof DirtyEntitiesTracker;
    if (tracker[deletedKey]) tracker[deletedKey] = Array.from(new Set([...tracker[deletedKey], id]));
    const deltas = { ...state.dirtyPersonsDelta };
    if (type === 'persons') delete deltas[id];
    return { ...queueUpdate(state, tracker, deltas),
      changeRevision: state.changeRevision + 1, status: changedStatus(state) };
  }),

  clearDirtyIfUnchanged: (revision) => {
    let cleared = false;
    set((state) => {
      if (state.changeRevision !== revision || state.pendingWritesCount > 0) return state;
      cleared = true;
      return resetDirtyState(state);
    });
    return cleared;
  },

  // Explicit resets are retained for user-triggered download/replacement, never failed uploads.
  clearDirty: () => set((state) => resetDirtyState(state)),
  clearUnsavedChanges: () => set((state) => resetDirtyState(state)),
  markProjectUploadPending: () => set((state) => {
    if (state.projectUploadPending) return state;
    saveProjectPending(true);
    return { projectUploadPending: true, hasUnsavedChanges: true,
      unsavedChangesCount: countDirtyItems(state.dirtyTracker) + state.untrackedChangesCount + 1,
      changeRevision: state.changeRevision + 1 };
  }),
  markUnsavedChange: () => set((state) => {
    const count = state.untrackedChangesCount + 1;
    saveUntrackedChanges(count);
    return { untrackedChangesCount: count, hasUnsavedChanges: true,
      unsavedChangesCount: countDirtyItems(state.dirtyTracker) + count + Number(state.projectUploadPending),
      changeRevision: state.changeRevision + 1, status: changedStatus(state) };
  })
}));

/** A resolved false is a failed Firestore write, not a successful promise. */
export async function trackAtomicSync<T>(operation: () => Promise<T>): Promise<T> {
  const store = useCloudSyncStore.getState();
  store.incrementPending();
  try {
    const result = await operation();
    store.decrementPending(result !== false, result === false ? 'Firestore не підтвердив запис змін' : null);
    return result;
  } catch (err: any) {
    store.decrementPending(false, err?.message || 'Помилка синхронізації з Firestore');
    throw err;
  }
}
