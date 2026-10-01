import { create } from 'zustand';

export type CloudSyncStatus = 'synced' | 'syncing' | 'offline' | 'error';
export type CloudSyncMode = 'manual' | 'auto';

const SYNC_MODE_STORAGE_KEY = 'rodovid_cloud_sync_mode';
const QUOTA_STORAGE_KEY = 'rodovid_firestore_quota_exceeded_day';

export function isQuotaExceededToday(): boolean {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const saved = localStorage.getItem(QUOTA_STORAGE_KEY);
    if (!saved) return false;
    return saved === today;
  } catch {
    return false;
  }
}

export function markQuotaExceededToday(exceeded: boolean = true): void {
  try {
    if (exceeded) {
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem(QUOTA_STORAGE_KEY, today);
    } else {
      localStorage.removeItem(QUOTA_STORAGE_KEY);
    }
  } catch {}
}

export type EntitySyncType = 'persons' | 'families' | 'events' | 'sources' | 'places' | 'research';

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

const DIRTY_STORAGE_KEY = 'rodovid_dirty_entities_tracker_v2';

export function loadDirtyEntities(): DirtyEntitiesTracker {
  try {
    const raw = localStorage.getItem(DIRTY_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    persons: [],
    families: [],
    events: [],
    sources: [],
    places: [],
    research: [],
    deletedPersons: [],
    deletedFamilies: [],
    deletedEvents: [],
    deletedSources: [],
    deletedPlaces: []
  };
}

export function saveDirtyEntities(tracker: DirtyEntitiesTracker) {
  try {
    localStorage.setItem(DIRTY_STORAGE_KEY, JSON.stringify(tracker));
  } catch {}
}

export function countDirtyItems(tracker: DirtyEntitiesTracker): number {
  return (
    tracker.persons.length +
    tracker.families.length +
    tracker.events.length +
    tracker.sources.length +
    tracker.places.length +
    tracker.research.length +
    tracker.deletedPersons.length +
    tracker.deletedFamilies.length +
    tracker.deletedEvents.length +
    tracker.deletedSources.length +
    tracker.deletedPlaces.length
  );
}

export interface CloudSyncState {
  status: CloudSyncStatus;
  syncMode: CloudSyncMode;
  lastSyncTime: string | null;
  lastError: string | null;
  pendingWritesCount: number;
  isManualPushing: boolean;
  isManualPulling: boolean;
  hasUnsavedChanges: boolean;
  unsavedChangesCount: number;
  isQuotaExceeded: boolean;
  dirtyTracker: DirtyEntitiesTracker;
  
  setStatus: (status: CloudSyncStatus, error?: string | null) => void;
  setSyncMode: (mode: CloudSyncMode) => void;
  setLastSyncTime: (time: string) => void;
  setQuotaExceeded: (exceeded: boolean) => void;
  incrementPending: () => void;
  decrementPending: (success?: boolean, error?: string | null) => void;
  setIsManualPushing: (isPushing: boolean) => void;
  setIsManualPulling: (isPulling: boolean) => void;
  markDirty: (type: EntitySyncType, id: string) => void;
  markDeleted: (type: EntitySyncType, id: string) => void;
  clearDirty: () => void;
  markUnsavedChange: () => void;
  clearUnsavedChanges: () => void;
}

const initialDirtyTracker = loadDirtyEntities();
const initialDirtyCount = countDirtyItems(initialDirtyTracker);

export const useCloudSyncStore = create<CloudSyncState>((set) => ({
  status: 'synced',
  syncMode: (() => {
    try {
      const saved = localStorage.getItem(SYNC_MODE_STORAGE_KEY);
      if (saved === 'auto' || saved === 'manual') return saved;
      return 'manual'; // Default to safe manual upload by button
    } catch {
      return 'manual';
    }
  })(),
  lastSyncTime: new Date().toISOString(),
  lastError: null,
  pendingWritesCount: 0,
  isManualPushing: false,
  isManualPulling: false,
  hasUnsavedChanges: initialDirtyCount > 0,
  unsavedChangesCount: initialDirtyCount,
  isQuotaExceeded: isQuotaExceededToday(),
  dirtyTracker: initialDirtyTracker,

  setQuotaExceeded: (isQuotaExceeded) => {
    markQuotaExceededToday(isQuotaExceeded);
    set({ isQuotaExceeded, status: isQuotaExceeded ? 'offline' : 'synced' });
  },

  setStatus: (status, error = null) =>
    set({
      status,
      lastError: error,
      lastSyncTime: status === 'synced' ? new Date().toISOString() : undefined
    }),

  setSyncMode: (syncMode) => {
    try {
      localStorage.setItem(SYNC_MODE_STORAGE_KEY, syncMode);
    } catch {}
    set({ syncMode });
  },

  setLastSyncTime: (time) => set({ lastSyncTime: time }),

  incrementPending: () =>
    set((state) => ({
      pendingWritesCount: state.pendingWritesCount + 1,
      status: 'syncing'
    })),

  decrementPending: (success = true, error = null) =>
    set((state) => {
      const nextCount = Math.max(0, state.pendingWritesCount - 1);
      return {
        pendingWritesCount: nextCount,
        status: nextCount > 0 ? 'syncing' : success ? 'synced' : 'error',
        lastError: error || (success ? null : state.lastError),
        lastSyncTime: success && nextCount === 0 ? new Date().toISOString() : state.lastSyncTime
      };
    }),

  setIsManualPushing: (isManualPushing) => set({ isManualPushing }),
  setIsManualPulling: (isManualPulling) => set({ isManualPulling }),

  markDirty: (type, id) =>
    set((state) => {
      const tracker = { ...state.dirtyTracker };
      const setList = new Set(tracker[type]);
      setList.add(id);
      tracker[type] = Array.from(setList);

      // Remove from deleted list if present
      const delKey = `deleted${type.charAt(0).toUpperCase() + type.slice(1)}` as keyof DirtyEntitiesTracker;
      if (tracker[delKey] && Array.isArray(tracker[delKey])) {
        tracker[delKey] = (tracker[delKey] as string[]).filter((x) => x !== id) as any;
      }

      saveDirtyEntities(tracker);
      const total = countDirtyItems(tracker);
      return {
        dirtyTracker: tracker,
        hasUnsavedChanges: total > 0,
        unsavedChangesCount: total
      };
    }),

  markDeleted: (type, id) =>
    set((state) => {
      const tracker = { ...state.dirtyTracker };
      tracker[type] = tracker[type].filter((x) => x !== id);

      const delKey = `deleted${type.charAt(0).toUpperCase() + type.slice(1)}` as keyof DirtyEntitiesTracker;
      if (tracker[delKey] && Array.isArray(tracker[delKey])) {
        const delSet = new Set(tracker[delKey] as string[]);
        delSet.add(id);
        tracker[delKey] = Array.from(delSet) as any;
      }

      saveDirtyEntities(tracker);
      const total = countDirtyItems(tracker);
      return {
        dirtyTracker: tracker,
        hasUnsavedChanges: total > 0,
        unsavedChangesCount: total
      };
    }),

  clearDirty: () =>
    set(() => {
      const empty: DirtyEntitiesTracker = {
        persons: [],
        families: [],
        events: [],
        sources: [],
        places: [],
        research: [],
        deletedPersons: [],
        deletedFamilies: [],
        deletedEvents: [],
        deletedSources: [],
        deletedPlaces: []
      };
      saveDirtyEntities(empty);
      return {
        dirtyTracker: empty,
        hasUnsavedChanges: false,
        unsavedChangesCount: 0
      };
    }),

  markUnsavedChange: () =>
    set((state) => ({
      hasUnsavedChanges: true,
      unsavedChangesCount: state.unsavedChangesCount + 1
    })),

  clearUnsavedChanges: () =>
    set(() => {
      const empty: DirtyEntitiesTracker = {
        persons: [],
        families: [],
        events: [],
        sources: [],
        places: [],
        research: [],
        deletedPersons: [],
        deletedFamilies: [],
        deletedEvents: [],
        deletedSources: [],
        deletedPlaces: []
      };
      saveDirtyEntities(empty);
      return {
        dirtyTracker: empty,
        hasUnsavedChanges: false,
        unsavedChangesCount: 0
      };
    })
}));

/**
 * Utility helper to automatically track atomic promise writes
 */
export async function trackAtomicSync<T>(operation: () => Promise<T>): Promise<T> {
  const store = useCloudSyncStore.getState();
  store.incrementPending();
  try {
    const result = await operation();
    store.decrementPending(true);
    return result;
  } catch (err: any) {
    store.decrementPending(false, err?.message || 'Помилка синхронізації з Firestore');
    throw err;
  }
}
