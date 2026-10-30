/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * High-performance, non-blocking IndexedDB Storage Engine for Familio.
 * Replaces synchronous 5MB localStorage with unlimited asynchronous storage.
 * Provides transparent fallback, auto-migration, and fast synchronous boot cache.
 */

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

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event: Event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      db.onclose = () => {
        dbPromise = null;
      };
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
let isFlushingInProgress = false;

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
  try {
    const db = await getIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Fallback to localStorage
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }
}

/**
 * Write multiple key-value pairs in a single readwrite transaction
 */
export async function idbSetMultiple(entries: Record<string, any>): Promise<void> {
  try {
    const db = await getIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      for (const [key, val] of Object.entries(entries)) {
        store.put(val, key);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    for (const [key, val] of Object.entries(entries)) {
      try {
        localStorage.setItem(key, JSON.stringify(val));
      } catch {}
    }
  }
}

/**
 * Asynchronously delete a key from IndexedDB
 */
export async function idbDelete(key: string): Promise<void> {
  try {
    const db = await getIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    try {
      localStorage.removeItem(key);
    } catch {}
  }
}

/**
 * Flush all pending writes from the memory buffer to IndexedDB in a single batch transaction.
 * Also mirrors compact keys to localStorage.
 */
export async function flushPendingLocalWrites(): Promise<void> {
  if (flushTimeoutId) {
    clearTimeout(flushTimeoutId);
    flushTimeoutId = null;
  }
  if (maxWaitTimeoutId) {
    clearTimeout(maxWaitTimeoutId);
    maxWaitTimeoutId = null;
  }

  if (pendingWritesBuffer.size === 0 || isFlushingInProgress) {
    return;
  }

  isFlushingInProgress = true;
  // Snapshot current pending batch
  const batch: Record<string, any> = {};
  pendingWritesBuffer.forEach((val, key) => {
    batch[key] = val;
  });
  pendingWritesBuffer.clear();

  try {
    // 1. Single multi-put IDB transaction
    await idbSetMultiple(batch);

    // 2. Mirror light structures to localStorage in background
    for (const [key, data] of Object.entries(batch)) {
      try {
        const serialized = JSON.stringify(data);
        if (serialized.length < 1024 * 1024) {
          localStorage.setItem(key, serialized);
        } else {
          localStorage.removeItem(key);
        }
      } catch {
        try {
          localStorage.removeItem(key);
        } catch {}
      }
    }
  } catch (err) {
    console.warn('Batch storage flush warning:', err);
  } finally {
    isFlushingInProgress = false;
    // If new writes arrived while flushing, schedule another flush
    if (pendingWritesBuffer.size > 0 && !flushTimeoutId) {
      flushTimeoutId = setTimeout(flushPendingLocalWrites, BATCH_DEBOUNCE_DELAY_MS);
    }
  }
}

/**
 * Synchronous flush on page exit/unload so data is immediately saved to localStorage
 * if the browser kills background tasks before async IDB finishes.
 */
export function flushPendingLocalWritesSync(): void {
  if (pendingWritesBuffer.size === 0) return;

  pendingWritesBuffer.forEach((data, key) => {
    try {
      const serialized = JSON.stringify(data);
      if (serialized.length < 1024 * 1024) {
        localStorage.setItem(key, serialized);
      }
    } catch {}
  });
  // Also trigger async IDB flush
  flushPendingLocalWrites().catch(() => {});
}

/**
 * Unified persistence function with intelligent debounced batching:
 * 1. Batches rapid successive writes (typing, dragging, multi-updates) into a single transaction.
 * 2. Keeps UI thread at 60 FPS by eliminating redundant JSON.stringifications and IDB transactions.
 * 3. Supports immediate=true for critical transitions (import, restore, delete database).
 */
export function persistLocalData(key: string, data: any, immediate: boolean = false): void {
  if (immediate) {
    pendingWritesBuffer.delete(key);
    idbSet(key, data).catch(() => {});
    try {
      const serialized = JSON.stringify(data);
      if (serialized.length < 1024 * 1024) {
        localStorage.setItem(key, serialized);
      } else {
        localStorage.removeItem(key);
      }
    } catch {
      try {
        localStorage.removeItem(key);
      } catch {}
    }
    return;
  }

  // Add to batch buffer
  pendingWritesBuffer.set(key, data);

  // Debounce scheduling
  if (flushTimeoutId) {
    clearTimeout(flushTimeoutId);
  }

  flushTimeoutId = setTimeout(flushPendingLocalWrites, BATCH_DEBOUNCE_DELAY_MS);

  if (!maxWaitTimeoutId) {
    maxWaitTimeoutId = setTimeout(flushPendingLocalWrites, BATCH_MAX_WAIT_MS);
  }
}

/**
 * Auto-migration on first load:
 * Copies existing historical localStorage data into IndexedDB so historical trees,
 * research records, notes, and custom emblems are immediately preserved in the unlimited storage layer.
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
        if (!idbVal) {
          const localVal = localStorage.getItem(key);
          if (localVal) {
            try {
              const parsed = JSON.parse(localVal);
              await idbSet(key, parsed);
            } catch {
              // Plain string (e.g., custom emblem data URL)
              await idbSet(key, localVal);
            }
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
  window.addEventListener('beforeunload', () => {
    flushPendingLocalWritesSync();
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
