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
 * Asynchronously read a value from IndexedDB
 */
export async function idbGet<T = any>(key: string): Promise<T | null> {
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
  } catch (err) {
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
  } catch (err) {
    // Fallback to localStorage
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
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
  } catch (err) {
    try {
      localStorage.removeItem(key);
    } catch {}
  }
}

/**
 * Unified persistence function:
 * 1. Writes asynchronously to IndexedDB (unlimited quota, non-blocking).
 * 2. Safely mirrors to localStorage if data fits (< 2.5MB) to keep synchronous boot fast.
 * 3. Never throws QuotaExceededError or crashes the UI thread.
 */
export function persistLocalData(key: string, data: any): void {
  // 1. IndexedDB write (async, non-blocking)
  idbSet(key, data).catch(() => {});

  // 2. Safe localStorage cache mirror
  try {
    const serialized = JSON.stringify(data);
    // Only mirror to localStorage if below 2.5 MB to avoid quota exhaustion
    if (serialized.length < 2.5 * 1024 * 1024) {
      localStorage.setItem(key, serialized);
    }
  } catch (e: any) {
    // QuotaExceededError is safely ignored because data is already in IndexedDB!
  }
}

/**
 * Auto-migration on first load:
 * Copies existing localStorage data into IndexedDB so historical trees and research records
 * are immediately preserved in the unlimited storage layer.
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
      'genealogy_workstation_data_v2_metrics',
      'genealogy_workstation_data_v2_documents',
      'genealogy_workstation_data_v2_tasks',
      'genealogy_workstation_data_v2_findings',
      'genealogy_workstation_data_v2_hypotheses',
      'genealogy_workstation_data_v2_requests',
      'genealogy_workstation_data_v2_matrix',
      'genealogy_deleted_tombstone_ids_v1',
      'rodovid_ignored_duplicate_pairs',
      'genealogy_merged_person_ids'
    ];

    for (const key of keysToCheck) {
      try {
        const idbVal = await idbGet(key);
        if (!idbVal) {
          const localVal = localStorage.getItem(key);
          if (localVal) {
            const parsed = JSON.parse(localVal);
            await idbSet(key, parsed);
          }
        }
      } catch {}
    }
  } catch {}
}
