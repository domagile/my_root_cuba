import { create } from 'zustand';

// This reports durable local writes separately from cloud synchronization.
export const useLocalPersistenceStore=create<{
  pendingWritesCount: number;
  lastError: string|null;
}>(() => ({ pendingWritesCount: 0,lastError: null }));
