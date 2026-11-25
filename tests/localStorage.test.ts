import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB, IDBDatabase } from 'fake-indexeddb';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
  removeItem(key: string) { this.values.delete(key); }
}
const memory = new MemoryStorage();
const browser = Object.assign(new EventTarget(), { indexedDB });
Object.assign(globalThis, { indexedDB, window: browser, localStorage: memory });
const { idbGet, idbSet, persistLocalData, flushPendingLocalWrites, hasPendingLocalWrites, readLocalDataSync } = await import('../src/utils/indexedDbStorage');
const { useLocalPersistenceStore } = await import('../src/stores/useLocalPersistenceStore');
const originalTransaction = IDBDatabase.prototype.transaction;
const originalSetItem = memory.setItem;
afterEach(async () => {
  IDBDatabase.prototype.transaction = originalTransaction;
  memory.setItem = originalSetItem;
  browser.indexedDB = indexedDB;
  await flushPendingLocalWrites();
});

function failWrites() {
  IDBDatabase.prototype.transaction = function (...args: any[]) {
    if (args[1] === 'readwrite') throw new DOMException('Disk quota exhausted', 'QuotaExceededError');
    return originalTransaction.apply(this, args as any);
  };
}

test('failed batch retains its data, reports an error, and persists on retry', async () => {
  failWrites();
  persistLocalData('retry', { name: 'Unsaved' });
  await assert.rejects(flushPendingLocalWrites(), /quota/i);
  assert.equal(hasPendingLocalWrites(), true);
  assert.deepEqual(await idbGet('retry'), { name: 'Unsaved' });
  assert.match(useLocalPersistenceStore.getState().lastError!, /quota/i);
  IDBDatabase.prototype.transaction = originalTransaction;
  await flushPendingLocalWrites();
  assert.equal(hasPendingLocalWrites(), false);
  assert.equal(useLocalPersistenceStore.getState().lastError, null);
  assert.deepEqual(await idbGet('retry'), { name: 'Unsaved' });
});

test('a request success followed by transaction abort cannot acknowledge the write', async () => {
  await idbSet('abort', 'previous');
  IDBDatabase.prototype.transaction = function (...args: any[]) {
    const tx = originalTransaction.apply(this, args as any);
    if (args[1] === 'readwrite') {
      const store = tx.objectStore('genealogy_records');
      const put = store.put.bind(store);
      store.put = (...values: any[]) => {
        const request = put(...values as [any, any]);
        request.addEventListener('success', () => tx.abort());
        return request;
      };
    }
    return tx;
  };
  await assert.rejects(idbSet('abort', 'lost'), /abort/i);
  assert.equal(await idbGet('abort'), 'previous');
});

test('a newer edit during a committing batch survives and is committed by the same flush', async () => {
  let edited = false;
  IDBDatabase.prototype.transaction = function (...args: any[]) {
    const tx = originalTransaction.apply(this, args as any);
    if (args[1] === 'readwrite' && !edited) {
      edited = true;
      tx.addEventListener('complete', () => persistLocalData('concurrent', 'newer'));
    }
    return tx;
  };
  persistLocalData('concurrent', 'older');
  const first = flushPendingLocalWrites();
  assert.equal(flushPendingLocalWrites(), first);
  assert.equal(await idbGet('concurrent'), 'older');
  await first;
  assert.equal(await idbGet('concurrent'), 'newer');
  assert.equal(hasPendingLocalWrites(), false);
});

test('immediate writes stay queued when the transaction fails', async () => {
  failWrites();
  persistLocalData('immediate', 'important', true);
  await assert.rejects(flushPendingLocalWrites());
  assert.equal(await idbGet('immediate'), 'important');
  assert.equal(hasPendingLocalWrites(), true);
});

test('unavailable IndexedDB cannot acknowledge a write through a stale fallback cache', async () => {
  delete (browser as any).indexedDB;
  memory.setItem = () => { throw new DOMException('Fallback full', 'QuotaExceededError'); };
  persistLocalData('fallback', 'important');
  await assert.rejects(flushPendingLocalWrites(), /not supported/i);
  assert.equal(await idbGet('fallback'), 'important');
  assert.equal(hasPendingLocalWrites(), true);
});

test('optional localStorage mirror failure does not undo a durable IndexedDB commit', async () => {
  memory.setItem = () => { throw new Error('mirror unavailable'); };
  persistLocalData('mirror', { committed: true });
  await flushPendingLocalWrites();
  assert.equal(hasPendingLocalWrites(), false);
  assert.deepEqual(await idbGet('mirror'), { committed: true });
});

test('synchronous readers see the latest queued value before a batch commits', async () => {
  readLocalDataSync('sync-key');
  await idbSet('sync-key', ['old']);
  persistLocalData('sync-key', ['new']);
  assert.deepEqual(readLocalDataSync('sync-key'), ['new']);
  await flushPendingLocalWrites();
  assert.deepEqual(readLocalDataSync('sync-key'), ['new']);
});

test('a large committed value stays available to registered readers without a localStorage mirror', async () => {
  readLocalDataSync('large-sync');
  const value = ['large'.repeat(250_000)];
  persistLocalData('large-sync', value);
  await flushPendingLocalWrites();
  assert.equal(localStorage.getItem('large-sync'), null);
  assert.deepEqual(readLocalDataSync('large-sync'), value);
});

test('a cross-tab storage notification invalidates a committed read cache but not a local pending write', async () => {
  readLocalDataSync('external-sync');
  await idbSet('external-sync', ['old']);
  localStorage.setItem('external-sync', JSON.stringify(['external']));
  browser.dispatchEvent(Object.assign(new Event('storage'), { key: 'external-sync' }));
  assert.deepEqual(readLocalDataSync('external-sync'), ['external']);
  persistLocalData('external-sync', ['pending-local']);
  localStorage.setItem('external-sync', JSON.stringify(['stale-external']));
  browser.dispatchEvent(Object.assign(new Event('storage'), { key: 'external-sync' }));
  assert.deepEqual(readLocalDataSync('external-sync'), ['pending-local']);
});

test('an unrelated queued write cannot prevent a registered reader from hydrating its authoritative value', async () => {
  readLocalDataSync('hydrate-sync');
  await idbSet('hydrate-sync', ['from-idb']);
  localStorage.setItem('hydrate-sync', JSON.stringify(['stale-mirror']));
  browser.dispatchEvent(Object.assign(new Event('storage'), { key: 'hydrate-sync' }));
  const reading = idbGet('hydrate-sync');
  persistLocalData('unrelated-key', 'new');
  await reading;
  assert.deepEqual(readLocalDataSync('hydrate-sync'), ['from-idb']);
});
