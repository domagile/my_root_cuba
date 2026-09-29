import { create } from 'zustand';

export type CloudSyncStatus = 'synced' | 'syncing' | 'offline' | 'error';
export type CloudSyncMode = 'manual' | 'auto';

const SYNC_MODE_STORAGE_KEY = 'rodovid_cloud_sync_mode';

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
  
  setStatus: (status: CloudSyncStatus, error?: string | null) => void;
  setSyncMode: (mode: CloudSyncMode) => void;
  setLastSyncTime: (time: string) => void;
  incrementPending: () => void;
  decrementPending: (success?: boolean, error?: string | null) => void;
  setIsManualPushing: (isPushing: boolean) => void;
  setIsManualPulling: (isPulling: boolean) => void;
  markUnsavedChange: () => void;
  clearUnsavedChanges: () => void;
}

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
  hasUnsavedChanges: false,
  unsavedChangesCount: 0,

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

  markUnsavedChange: () =>
    set((state) => ({
      hasUnsavedChanges: true,
      unsavedChangesCount: state.unsavedChangesCount + 1
    })),

  clearUnsavedChanges: () =>
    set({
      hasUnsavedChanges: false,
      unsavedChangesCount: 0
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
