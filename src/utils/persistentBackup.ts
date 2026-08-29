/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// IndexedDB database configuration
const DB_NAME = 'GenealogyWorkstationPersistence';
const DB_VERSION = 1;
const STORE_NAME = 'app_backups';
const SNAPSHOTS_STORE = 'snapshots';

export interface DataSnapshot {
  id: string;
  timestamp: string;
  personsCount: number;
  familiesCount: number;
  adminsCount: number;
  note: string;
  data: {
    persons: any[];
    families: Record<string, any>;
    sources: Record<string, any>;
    events: Record<string, any>;
    trashPersons?: any[];
    whitelist: any[];
    accessConfig?: any;
    researchData?: {
      metricRecords?: any[];
      documents?: any[];
      tasks?: any[];
      findings?: any[];
      hypotheses?: any[];
      requests?: any[];
      matrixEntries?: any[];
    };
  };
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB is not supported in this environment'));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
        if (!db.objectStoreNames.contains(SNAPSHOTS_STORE)) {
          db.createObjectStore(SNAPSHOTS_STORE, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onerror = (event) => {
        console.warn('IndexedDB open error:', (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    } catch (e) {
      reject(e);
    }
  });

  return dbPromise;
}

/**
 * Save data to IndexedDB
 */
export async function saveToIDB(key: string, value: any): Promise<boolean> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);

      req.onsuccess = () => resolve(true);
      req.onerror = () => {
        console.warn(`Failed to write key ${key} to IndexedDB`);
        resolve(false);
      };
    });
  } catch {
    return false;
  }
}

/**
 * Read data from IndexedDB
 */
export async function getFromIDB<T = any>(key: string): Promise<T | null> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);

      req.onsuccess = () => {
        resolve(req.result !== undefined ? req.result : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Saves a timestamped snapshot of the whole database
 */
export async function saveSnapshot(
  snapshotData: DataSnapshot['data'],
  note: string = 'Автоматичне збереження'
): Promise<DataSnapshot | null> {
  try {
    const db = await getDB();
    const snapshot: DataSnapshot = {
      id: `snap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      personsCount: snapshotData.persons?.length || 0,
      familiesCount: Object.keys(snapshotData.families || {}).length,
      adminsCount: (snapshotData.whitelist || []).filter((w: any) => w.role === 'admin').length,
      note,
      data: snapshotData
    };

    return new Promise((resolve) => {
      const tx = db.transaction(SNAPSHOTS_STORE, 'readwrite');
      const store = tx.objectStore(SNAPSHOTS_STORE);
      const req = store.put(snapshot);

      req.onsuccess = () => {
        // Also keep last 15 snapshots max to avoid filling storage
        cleanOldSnapshots(store);
        resolve(snapshot);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

function cleanOldSnapshots(store: IDBObjectStore) {
  try {
    const req = store.getAll();
    req.onsuccess = () => {
      const all = req.result as DataSnapshot[];
      if (all && all.length > 20) {
        all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const toDelete = all.slice(20);
        toDelete.forEach((s) => {
          store.delete(s.id);
        });
      }
    };
  } catch {}
}

/**
 * List all available snapshots
 */
export async function getAllSnapshots(): Promise<DataSnapshot[]> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(SNAPSHOTS_STORE, 'readonly');
      const store = tx.objectStore(SNAPSHOTS_STORE);
      const req = store.getAll();

      req.onsuccess = () => {
        const list = (req.result || []) as DataSnapshot[];
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        resolve(list);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Delete a specific snapshot
 */
export async function deleteSnapshot(id: string): Promise<boolean> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(SNAPSHOTS_STORE, 'readwrite');
      const store = tx.objectStore(SNAPSHOTS_STORE);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}
