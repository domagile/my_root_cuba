/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * High-performance, non-blocking IndexedDB Storage Engine for Familio.
 * Stores large records asynchronously, subject to the browser storage quota.
 * Provides legacy cache reads, auto-migration, and a fast synchronous boot cache.
 */

import { useLocalPersistenceStore } from '../stores/useLocalPersistenceStore';

const DB_NAME = 'familio_genealogy_idb_v1';
const DB_VERSION = 1;
const STORE_NAME = 'genealogy_records';

let dbPromise: Promise<IDBDatabase> | null = null;

function getIDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.reject(new Error('IndexedDB not supported in this environment'));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    let blocked = false;
    request.onblocked = () => {
      blocked = true;
      dbPromise = null;
      reject(new Error('Local storage is blocked by another tab. Close the other tab and retry.'));
    };

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event: Event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (blocked) { db.close(); return; }
      db.onclose = () => { dbPromise = null; };
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };

    request.onerror = (event: Event) => {
      dbPromise = null;
      reject((event.target as IDBOpenDBRequest).error);
    };
  });

  return dbPromise;
}

/**
 * In-Memory Dirty Write Buffer for Debounced Batching
 */
const pendingWritesBuffer = new Map<string, any>();
let flushTimeoutId: ReturnType<typeof setTimeout> | null = null;
let maxWaitTimeoutId: ReturnType<typeof setTimeout> | null = null;
const pendingVersions = new Map<string, number>();
let writeRevision = 0;
let flushPromise: Promise<void> | null = null;

const BATCH_DEBOUNCE_DELAY_MS = 300;
const BATCH_MAX_WAIT_MS = 1200;

/**
 * Asynchronously read a value from IndexedDB (with instant read-your-own-writes buffer check)
 */
export async function idbGet<T = any>(key: string): Promise<T | null> {
  // If there's an in-flight pending write in the memory buffer, return it immediately!
  if (pendingWritesBuffer.has(key)) {
    return pendingWritesBuffer.get(key) as T;
  }

  try {
    const db = await getIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);

      req.onsuccess = () => {
        resolve(req.result !== undefined ? req.result : null);
      };

      req.onerror = () => {
        reject(req.error);
      };
    });
  } catch {
    // Fallback to localStorage if IndexedDB is disabled or in private mode
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}

/**
 * Read multiple keys in a single readonly IndexedDB transaction (with instant buffer check)
 */
export async function idbGetMultiple(keys: string[]): Promise<Record<string, any>> {
  const results: Record<string, any> = {};
  const missingKeys: string[] = [];

  for (const k of keys) {
    if (pendingWritesBuffer.has(k)) {
      results[k] = pendingWritesBuffer.get(k);
    } else {
      missingKeys.push(k);
    }
  }

  if (missingKeys.length === 0) {
    return results;
  }

  try {
    const db = await getIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      let completed = 0;

      for (let i = 0; i < missingKeys.length; i++) {
        const key = missingKeys[i];
        const req = store.get(key);
        req.onsuccess = () => {
          if (req.result !== undefined) {
            results[key] = req.result;
          }
          completed++;
          if (completed === missingKeys.length) {
            resolve(results);
          }
        };
        req.onerror = () => {
          completed++;
          if (completed === missingKeys.length) {
            resolve(results);
          }
        };
      }
    });
  } catch {
    for (const key of missingKeys) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) results[key] = JSON.parse(raw);
      } catch {}
    }
    return results;
  }
}

/**
 * Asynchronously write a value to IndexedDB
 */
export async function idbSet<T = any>(key: string, value: T): Promise<void> {
  await idbSetMultiple({ [key]: value });
}

/** Resolve only after the whole transaction commits. Never hide quota/abort errors. */
export async function idbSetMultiple(entries: Record<string, any>): Promise<void> {
  // A failed IndexedDB write must remain visibly pending. localStorage is only
  // a legacy read cache: switching write backends could make stale data win on
  // the next load, especially for large trees whose compact mirror is absent.
  const db = await getIDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || new Error('Local storage transaction aborted'));
    tx.onerror = () => reject(tx.error || new Error('Local storage transaction failed'));
    try {
      const store = tx.objectStore(STORE_NAME);
      for (const [key, value] of Object.entries(entries)) store.put(value, key);
    } catch (error) {
      tx.abort();
      reject(error);
    }
  });
}

/**
 * Asynchronously delete a key from IndexedDB
 */
export async function idbDelete(key: string): Promise<void> {
  const db = await getIDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || new Error('Local deletion aborted'));
    tx.onerror = () => reject(tx.error || new Error('Local deletion failed'));
    tx.objectStore(STORE_NAME).delete(key);
  });
  try { localStorage.removeItem(key); } catch { /* Optional legacy mirror */ }
}

/**
 * Flush all pending writes from the memory buffer to IndexedDB in a single batch transaction.
 * Also mirrors compact keys to localStorage.
 */
function clearFlushTimers(): void {
  if (flushTimeoutId) clearTimeout(flushTimeoutId);
  if (maxWaitTimeoutId) clearTimeout(maxWaitTimeoutId);
  flushTimeoutId = null;
  maxWaitTimeoutId = null;
}

function mirrorCompactData(entries: Record<string, any>): void {
  for (const [key, value] of Object.entries(entries)) {
    try {
      const serialized = JSON.stringify(value);
      if (serialized.length < 1024 * 1024) localStorage.setItem(key, serialized);
      else localStorage.removeItem(key);
    } catch {
      // The mirror is optional after an IndexedDB commit.
    }
  }
}

export function flushPendingLocalWrites(): Promise<void> {
  clearFlushTimers();
  if (flushPromise) return flushPromise;
  if (pendingWritesBuffer.size === 0) return Promise.resolve();

  flushPromise = (async () => {
    try {
      while (pendingWritesBuffer.size > 0) {
        const batch = Object.fromEntries(pendingWritesBuffer);
        const versions = new Map(pendingVersions);
        // Keep unconfirmed values in memory so reads and retries see them.
        await idbSetMultiple(batch);
        mirrorCompactData(batch);
        for (const key of Object.keys(batch)) {
          if (pendingVersions.get(key) === versions.get(key)) {
            pendingWritesBuffer.delete(key);
            pendingVersions.delete(key);
          }
        }
        useLocalPersistenceStore.setState({ pendingWritesCount: pendingWritesBuffer.size, lastError: null });
      }
      clearFlushTimers();
    } catch (error) {
      clearFlushTimers();
      useLocalPersistenceStore.setState({
        pendingWritesCount: pendingWritesBuffer.size,
        lastError: error instanceof Error ? error.message : 'Local storage write failed'
      });
      throw error;
    } finally {
      flushPromise = null;
    }
  })();
  return flushPromise;
}

/** Best-effort emergency mirror. Large records still need a completed IDB commit. */
export function flushPendingLocalWritesSync(): void {
  if (pendingWritesBuffer.size === 0) return;
  mirrorCompactData(Object.fromEntries(pendingWritesBuffer));
  void flushPendingLocalWrites().catch(() => {});
}

export function hasPendingLocalWrites(): boolean {
  return pendingWritesBuffer.size > 0;
}

/** Queue every write, including immediate writes, until durable confirmation. */
export function persistLocalData(key: string, data: any, immediate: boolean = false): void {
  pendingWritesBuffer.set(key, data);
  pendingVersions.set(key, ++writeRevision);
  useLocalPersistenceStore.setState({ pendingWritesCount: pendingWritesBuffer.size });
  if (immediate) {
    void flushPendingLocalWrites().catch(() => {});
    return;
  }
  if (flushTimeoutId) clearTimeout(flushTimeoutId);
  const flush = () => { void flushPendingLocalWrites().catch(() => {}); };
  flushTimeoutId = setTimeout(flush, BATCH_DEBOUNCE_DELAY_MS);
  if (!maxWaitTimeoutId) maxWaitTimeoutId = setTimeout(flush, BATCH_MAX_WAIT_MS);
}

/**
 * Auto-migration on first load:
 * Copies historical localStorage data into IndexedDB without removing the original cache.
 */
export async function autoMigrateLocalStorageToIDB(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const keysToCheck = [
      'genealogy_workstation_data_v4_familio_persons',
      'genealogy_workstation_data_v4_familio_families',
      'genealogy_workstation_data_v4_familio_sources',
      'genealogy_workstation_data_v4_familio_events',
      'genealogy_workstation_data_v4_familio_places',
      'genealogy_workstation_data_v4_familio_trashPersons',
      'genealogy_workstation_data_v4_familio_importHistory',
      'genealogy_workstation_data_v4_familio_selectedPersonId',
      'genealogy_workstation_data_v4_familio_gitConfig',
      'genealogy_workstation_data_v2_metrics',
      'genealogy_workstation_data_v2_documents',
      'genealogy_workstation_data_v2_tasks',
      'genealogy_workstation_data_v2_findings',
      'genealogy_workstation_data_v2_hypotheses',
      'genealogy_workstation_data_v2_requests',
      'genealogy_workstation_data_v2_matrix',
      'genealogy_deleted_tombstone_ids_v1',
      'rodovid_ignored_duplicate_pairs',
      'genealogy_merged_person_ids',
      'genealogy_research_notes_v1',
      'genealogy_custom_emblem_image',
      'genealogy_app_emblem_variant',
      'genealogy_auth_security_v1_currentUser',
      'genealogy_auth_security_v1_whitelist',
      'genealogy_auth_security_v1_requests',
      'genealogy_auth_security_v1_config'
    ];

    // Also look for dynamic keys like rodovid_user_tree_state_*
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('rodovid_user_tree_state_') && !keysToCheck.includes(k)) {
          keysToCheck.push(k);
        }
      }
    } catch {}

    for (const key of keysToCheck) {
      try {
        const idbVal = await idbGet(key);
        if (idbVal === null) {
          const localVal = localStorage.getItem(key);
          if (localVal) {
            let parsed: any = localVal;
            try { parsed = JSON.parse(localVal); } catch { /* Historical plain string */ }
            await idbSet(key, parsed);
          }
        }
      } catch {}
    }
  } catch {}
}

/**
 * Storage health and capacity reporting API
 */
export async function getStorageStats(): Promise<{
  isIndexedDB: boolean;
  usageBytes: number;
  quotaBytes: number;
  usageFormatted: string;
  quotaFormatted: string;
  percentUsed: number;
}> {
  const isIndexedDB = typeof window !== 'undefined' && 'indexedDB' in window;
  let usageBytes = 0;
  let quotaBytes = 0;

  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      usageBytes = estimate.usage || 0;
      quotaBytes = estimate.quota || 0;
    } catch {}
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const percentUsed = quotaBytes > 0 ? Math.round((usageBytes / quotaBytes) * 100) : 0;

  return {
    isIndexedDB,
    usageBytes,
    quotaBytes,
    usageFormatted: formatBytes(usageBytes),
    quotaFormatted: formatBytes(quotaBytes),
    percentUsed
  };
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (event) => {
    flushPendingLocalWritesSync();
    if (hasPendingLocalWrites()) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  window.addEventListener('pagehide', () => {
    flushPendingLocalWritesSync();
  });
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flushPendingLocalWritesSync();
      }
    });
  }
}
