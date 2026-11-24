import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB, IDBDatabase } from 'fake-indexeddb';
Object.assign(globalThis, { indexedDB, window: { indexedDB } });
const { saveSnapshot, getAllSnapshots, saveToIDB, deleteSnapshot, getFromIDB } = await import('../src/utils/persistentBackup');
const original = IDBDatabase.prototype.transaction;
const data = { persons: [{ id: 'p-user' }], families: {}, sources: {}, events: {}, places: { village: { notes: 'Research' } }, whitelist: [] };
function abortWrite() {
  IDBDatabase.prototype.transaction = function (...args: any[]) {
    const tx = original.apply(this, args as any);
    if (args[1] === 'readwrite') {
      const getStore = tx.objectStore.bind(tx);
      tx.objectStore = (name) => {
        const store = getStore(name);
        for (const method of ['put', 'delete'] as const) {
          const operation = store[method].bind(store);
          (store as any)[method] = (...values: any[]) => {
            const request = (operation as any)(...values);
            request.addEventListener('success', () => tx.abort());
            return request;
          };
        }
        return store;
      };
    }
    return tx;
  };
}

test('an aborted snapshot is never reported as a saved recovery point', async () => {
  const saved = await saveSnapshot(data, 'Before failure');
  assert.ok(saved);
  abortWrite();
  try { assert.equal(await saveSnapshot(data, 'Must not appear'), null); }
  finally { IDBDatabase.prototype.transaction = original; }
  const snapshots = await getAllSnapshots();
  assert.equal(snapshots.length, 1);
  assert.deepEqual(snapshots[0].data.places, data.places);
});

test('backup value writes and deletions wait for transaction commit', async () => {
  await saveToIDB('key', 'previous');
  const saved = await saveSnapshot(data);
  abortWrite();
  try {
    assert.equal(await saveToIDB('key', 'lost'), false);
    assert.equal(await deleteSnapshot(saved!.id), false);
  } finally { IDBDatabase.prototype.transaction = original; }
  assert.equal(await getFromIDB('key'), 'previous');
  assert.ok((await getAllSnapshots()).some((item) => item.id === saved!.id));
});
