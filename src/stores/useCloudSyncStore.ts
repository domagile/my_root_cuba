import { create } from 'zustand';

export type CloudSyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

export interface CloudSyncState {
  status: CloudSyncStatus;
  lastSyncTime: string | null;
  lastError: string | null;
  pendingWritesCount: number;
  isManualPushing: boolean;
  isManualPulling: boolean;
  
  setStatus: (status: CloudSyncStatus, error?: string | null) => void;
  setLastSyncTime: (time: string) => void;
  incrementPending: () => void;
  decrementPending: (success?: boolean, error?: string | null) => void;
  setIsManualPushing: (isPushing: boolean) => void;
  setIsManualPulling: (isPulling: boolean) => void;
}

export const useCloudSyncStore = create<CloudSyncState>((set) => ({
  status: 'synced',
  lastSyncTime: new Date().toISOString(),
  lastError: null,
  pendingWritesCount: 0,
  isManualPushing: false,
  isManualPulling: false,

  setStatus: (status, error = null) =>
    set({
      status,
      lastError: error,
      lastSyncTime: status === 'synced' ? new Date().toISOString() : undefined
    }),

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
  setIsManualPulling: (isManualPulling) => set({ isManualPulling })
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
