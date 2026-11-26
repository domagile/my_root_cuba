import { beforeEach, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB } from 'fake-indexeddb';
import { applyIgnoredDuplicateChanges, duplicatePairAliases, type IgnoredDuplicateSnapshot } from '../src/utils/ignoredDuplicateKeys';
import { IGNORED_DUPLICATE_STATE_KEY, getPendingIgnoredDuplicateChanges, applyCloudIgnoredDuplicateSnapshot,
  acknowledgeIgnoredDuplicateChanges, hydrateIgnoredDuplicateState } from '../src/utils/ignoredDuplicateState';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}
Object.assign(globalThis, { indexedDB, localStorage: new MemoryStorage(), window: Object.assign(new EventTarget(), { indexedDB }) });
const storage = await import('../src/utils/indexedDbStorage');
const detector = await import('../src/utils/duplicateDetector');
const { useCloudSyncStore } = await import('../src/stores/useCloudSyncStore');
const { synchronizeProject, queueCloudSync } = await import('../src/services/cloudSyncService');
const legacyKey = detector.RODOVID_IGNORED_DUPLICATE_PAIRS_KEY;
const persons: any[] = [
  { id: 'person_a', gender: 'M', firstName: 'Іван', lastName: 'Тестовий', birthDate: '1900', deathDate: '1980', fatherId: 'dad' },
  { id: 'person_b', gender: 'M', firstName: 'Іван', lastName: 'Тестовий', birthDate: '1900', deathDate: '1980', fatherId: 'dad' }
];
function data() { return { persons, families: {}, events: {}, sources: {}, places: {}, metricRecords: [], documents: [],
  tasks: [], findings: [], hypotheses: [], requests: [], matrixEntries: [] }; }
async function writeRawJournal(value: unknown): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('familio_genealogy_idb_v1', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('genealogy_records', 'readwrite');
      tx.objectStore('genealogy_records').put(value, IGNORED_DUPLICATE_STATE_KEY);
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
    };
  });
}
function serverApi(initial: IgnoredDuplicateSnapshot = { keys: [], revision: 0 }, overrides: Record<string, any> = {}) {
  let server = initial;
  const api = { savePersonDoc: async () => true, savePersonDeltaDoc: async () => true,
    batchDeleteEntities: async () => true, saveProjectDataToCloud: async () => true,
    updateIgnoredDuplicatePairs: async changes => {
      server = { keys: applyIgnoredDuplicateChanges(server.keys, changes), revision: server.revision + 1 };
      return server;
    }, ...overrides };
  return { api, snapshot: () => server };
}
beforeEach(async () => {
  await queueCloudSync(async () => {}); await storage.flushPendingLocalWrites();
  localStorage.clear();
  storage.persistLocalData(IGNORED_DUPLICATE_STATE_KEY, null);
  storage.persistLocalData(legacyKey, []);
  await storage.flushPendingLocalWrites();
  useCloudSyncStore.getState().clearDirty();
  useCloudSyncStore.setState({ syncMode: 'manual', status: 'synced', isQuotaExceeded: false,
    pendingWriteError: null, pendingWritesCount: 0, isManualPushing: false });
  detector.clearDuplicateDetectorCache();
});
afterEach(async () => { await storage.flushPendingLocalWrites(); });

test('not-a-duplicate remains hidden after a stale empty download and repeat scan', async () => {
  assert.equal(detector.detectDuplicatePersons(persons, true).length, 1);
  detector.ignoreDuplicatePair('person_a', 'person_b');
  applyCloudIgnoredDuplicateSnapshot({ keys: [], revision: 0 });
  assert.equal(detector.detectDuplicatePersons(persons, true).length, 0);
  await storage.flushPendingLocalWrites();
  assert.ok(Object.keys((await storage.idbGet<any>(IGNORED_DUPLICATE_STATE_KEY)).pending).length > 0);
  assert.equal(detector.detectDuplicatePersons([...persons], true).length, 0);
  assert.equal(detector.detectDuplicatePersons(persons, false).length, 1);
});
test('reverse ID order and repeated not-a-duplicate callbacks do not create a newer intention', () => {
  detector.ignoreDuplicatePair('person_a', 'person_b');
  const original = getPendingIgnoredDuplicateChanges();
  detector.ignoreDuplicatePair('person_b', 'person_a');
  assert.deepEqual(getPendingIgnoredDuplicateChanges(), original);
  assert.equal(detector.isDuplicatePairIgnored('person_b', 'person_a'), true);
});
test('successive independent choices survive the same pending local commit', () => {
  detector.ignoreDuplicatePair('a', 'b'); detector.ignoreDuplicatePair('c', 'd');
  applyCloudIgnoredDuplicateSnapshot({ keys: ['remote___other'], revision: 0 });
  assert.ok(detector.isDuplicatePairIgnored('a', 'b') && detector.isDuplicatePairIgnored('c', 'd'));
  assert.ok(detector.isDuplicatePairIgnored('remote', 'other'));
});
test('historical and opaque aliases are retained until a confirmed upload', async () => {
  storage.persistLocalData(legacyKey, ['b:::a', 'dup_person_a_person_b']);
  assert.ok(detector.isDuplicatePairIgnored('a', 'b'));
  assert.ok(detector.isDuplicatePairIgnored('person_a', 'person_b'));
  applyCloudIgnoredDuplicateSnapshot({ keys: [], revision: 0 });
  assert.ok(detector.isDuplicatePairIgnored('a', 'b'));
  assert.ok(detector.isDuplicatePairIgnored('person_a', 'person_b'));
  const server = serverApi();
  assert.equal((await synchronizeProject(data, server.api)).success, true);
  assert.ok(server.snapshot().keys.includes('dup_person_a_person_b'));
});
test('manual mode does not upload a choice automatically, but explicit upload includes it', async () => {
  let writes = 0;
  const server = serverApi(); const write = server.api.updateIgnoredDuplicatePairs;
  server.api.updateIgnoredDuplicatePairs = async changes => {
    writes++; assert.equal(useCloudSyncStore.getState().isManualPushing, true); return write(changes);
  };
  detector.ignoreDuplicatePair('a', 'b');
  assert.equal((await synchronizeProject(data, server.api, { manual: false })).success, false);
  assert.equal(writes, 0);
  assert.equal((await synchronizeProject(data, server.api, { manual: true })).success, true);
  assert.equal(writes, 1); assert.equal(Object.keys(getPendingIgnoredDuplicateChanges()).length, 0);
  assert.ok(server.snapshot().keys.includes(detector.getDuplicatePairKey('a', 'b')));
});
for (const failure of ['false-result', 'exception', 'wrong-content', 'missing-adapter']) {
  test(`unconfirmed ${failure} keeps the choice queued for retry`, async () => {
    detector.ignoreDuplicatePair('a', 'b');
    const server = serverApi(); const api = { ...server.api };
    if (failure === 'false-result') api.updateIgnoredDuplicatePairs = async () => null;
    if (failure === 'exception') api.updateIgnoredDuplicatePairs = async () => { throw new Error('offline'); };
    if (failure === 'wrong-content') api.updateIgnoredDuplicatePairs = async () => ({ keys: [], revision: 1 });
    if (failure === 'missing-adapter') delete api.updateIgnoredDuplicatePairs;
    assert.equal((await synchronizeProject(data, api)).success, false);
    assert.ok(Object.keys(getPendingIgnoredDuplicateChanges()).length > 0);
    assert.equal(detector.isDuplicatePairIgnored('a', 'b'), true);
    assert.equal((await synchronizeProject(data, server.api)).success, true);
  });
}
test('project or quota failure cannot discard duplicate choices', async () => {
  detector.ignoreDuplicatePair('a', 'b');
  assert.equal((await synchronizeProject(data, serverApi(undefined, { saveProjectDataToCloud: async () => false }).api)).success, false);
  useCloudSyncStore.setState({ isQuotaExceeded: true });
  assert.equal((await synchronizeProject(data, serverApi().api)).success, false);
  assert.ok(Object.keys(getPendingIgnoredDuplicateChanges()).length > 0);
});
test('an acknowledgement cannot remove a newer opposite decision', () => {
  detector.ignoreDuplicatePair('a', 'b'); const first = getPendingIgnoredDuplicateChanges();
  detector.unignoreDuplicatePair('a', 'b');
  assert.equal(acknowledgeIgnoredDuplicateChanges(first, { keys: Object.keys(first), revision: 1 }), true);
  assert.ok(Object.values(getPendingIgnoredDuplicateChanges()).every(change => change.ignored === false));
  assert.equal(detector.isDuplicatePairIgnored('a', 'b'), false);
});
test('explicit undo survives an old snapshot both before and after its acknowledgement', async () => {
  const server = serverApi();
  detector.ignoreDuplicatePair('a', 'b'); await synchronizeProject(data, server.api);
  const old = server.snapshot();
  detector.unignoreDuplicatePair('a', 'b');
  applyCloudIgnoredDuplicateSnapshot(old); assert.equal(detector.isDuplicatePairIgnored('a', 'b'), false);
  await synchronizeProject(data, server.api);
  assert.equal(applyCloudIgnoredDuplicateSnapshot(old), false);
  assert.equal(detector.isDuplicatePairIgnored('a', 'b'), false);
});
test('a late upload result preserves a newer confirmed server revision', () => {
  detector.ignoreDuplicatePair('a', 'b'); const changes = getPendingIgnoredDuplicateChanges();
  applyCloudIgnoredDuplicateSnapshot({ keys: ['other___pair'], revision: 2 });
  acknowledgeIgnoredDuplicateChanges(changes, { keys: Object.keys(changes), revision: 1 });
  assert.equal(detector.isDuplicatePairIgnored('a', 'b'), false);
  assert.equal(detector.isDuplicatePairIgnored('other', 'pair'), true);
});
test('a choice made during upload remains queued after the older batch succeeds', async () => {
  let release!: (snapshot: IgnoredDuplicateSnapshot) => void;
  let started!: () => void;
  const begin = new Promise<void>(resolve => { started = resolve; });
  const waiting = new Promise<IgnoredDuplicateSnapshot>(resolve => { release = resolve; });
  detector.ignoreDuplicatePair('a', 'b'); const first = getPendingIgnoredDuplicateChanges();
  const run = synchronizeProject(data, serverApi(undefined, { updateIgnoredDuplicatePairs: () => { started(); return waiting; } }).api);
  await begin; detector.ignoreDuplicatePair('c', 'd');
  release({ keys: Object.keys(first), revision: 1 });
  assert.equal((await run).success, false);
  assert.ok(Object.keys(getPendingIgnoredDuplicateChanges()).some(key => key.includes('c')));
  assert.ok(detector.isDuplicatePairIgnored('a', 'b') && detector.isDuplicatePairIgnored('c', 'd'));
});
test('transaction patches preserve unrelated choices and remove every historical alias on undo', () => {
  const aliases = duplicatePairAliases('a', 'b');
  const result = applyIgnoredDuplicateChanges([...aliases, 'other___pair'], aliases.map(key => ({ key, ignored: false, token: 'test' })));
  assert.deepEqual(result, ['other___pair']);
});
test('hydration recovers a journal available only in IndexedDB without migrating over it', async () => {
  const pending = { 'a___b': { key: 'a___b', ignored: true, token: 'durable' } };
  // Write below the cache layer to model a fresh browser's DB-only journal.
  await writeRawJournal({ version: 1, base: { keys: [], revision: 1 }, pending });
  assert.equal(detector.isDuplicatePairIgnored('a', 'b'), false);
  await hydrateIgnoredDuplicateState();
  assert.equal(detector.isDuplicatePairIgnored('a', 'b'), true);
  assert.deepEqual(getPendingIgnoredDuplicateChanges(), pending);
});
test('an emergency mirror newer than IndexedDB survives hydration after an interrupted commit', async () => {
  detector.ignoreDuplicatePair('a', 'b'); await storage.flushPendingLocalWrites();
  const pending = getPendingIgnoredDuplicateChanges();
  await writeRawJournal({ version: 1, base: { keys: [], revision: 0 }, pending: {}, localRevision: 0 });
  await hydrateIgnoredDuplicateState();
  assert.equal(detector.isDuplicatePairIgnored('a', 'b'), true);
  assert.deepEqual(getPendingIgnoredDuplicateChanges(), pending);
});
test('an old empty download cannot erase an already acknowledged dismissal', async () => {
  detector.ignoreDuplicatePair('a', 'b'); await synchronizeProject(data, serverApi().api);
  assert.equal(Object.keys(getPendingIgnoredDuplicateChanges()).length, 0);
  assert.equal(applyCloudIgnoredDuplicateSnapshot({ keys: [], revision: 0 }), false);
  assert.equal(detector.isDuplicatePairIgnored('a', 'b'), true);
});
test('a newer confirmed explicit undo from another client is accepted', async () => {
  detector.ignoreDuplicatePair('a', 'b'); await synchronizeProject(data, serverApi().api);
  applyCloudIgnoredDuplicateSnapshot({ keys: ['other___pair'], revision: 2 });
  assert.equal(detector.isDuplicatePairIgnored('a', 'b'), false);
  assert.equal(detector.isDuplicatePairIgnored('other', 'pair'), true);
});
test('an unavailable localStorage mirror does not lose the durable decision journal', async () => {
  const original = localStorage.setItem;
  localStorage.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
  try {
    detector.ignoreDuplicatePair('a', 'b'); await storage.flushPendingLocalWrites();
    assert.equal(detector.isDuplicatePairIgnored('a', 'b'), true);
    assert.ok(Object.keys((await storage.idbGet<any>(IGNORED_DUPLICATE_STATE_KEY)).pending).length > 0);
  } finally { localStorage.setItem = original; }
});
test('a worker started before a dismissal cannot return that pair as an active suggestion', async () => {
  class FakeWorker {
    static latest: FakeWorker;
    onmessage: any; onerror: any; message: any;
    constructor() { FakeWorker.latest = this; }
    postMessage(message: any) { this.message = message; }
    terminate() {}
    finish(payload: any) { this.onmessage({ data: { id: this.message.id, type: 'SUCCESS', payload } }); }
  }
  Object.assign(globalThis, { Worker: FakeWorker });
  const { detectDuplicatesAsync } = await import('../src/workers/workerBridge');
  const pairs = detector.detectDuplicatePersons(persons, false);
  const result = detectDuplicatesAsync(persons, true);
  detector.ignoreDuplicatePair('person_a', 'person_b');
  FakeWorker.latest.finish(pairs); assert.deepEqual(await result, []);
  const all = detectDuplicatesAsync(persons, false);
  FakeWorker.latest.finish(pairs); assert.equal((await all).length, 1);
});
