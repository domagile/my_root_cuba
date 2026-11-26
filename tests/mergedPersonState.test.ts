import { beforeEach, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB } from 'fake-indexeddb';
import { MERGED_PERSON_MAP_KEY, MERGED_PERSON_STATE_KEY, getMergedPersonMap, getPendingMergedPersonChanges,
  recordMergedPersonChanges, applyMergedPersonChanges, acceptMergedPersonSnapshot, acknowledgeMergedPersonChanges,
  hydrateMergedPersonState, type MergedPersonSnapshot } from '../src/utils/mergedPersonState';
class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}
Object.assign(globalThis, { indexedDB, localStorage: new MemoryStorage(), window: Object.assign(new EventTarget(), { indexedDB }) });
const storage = await import('../src/utils/indexedDbStorage');
const { useCloudSyncStore: sync } = await import('../src/stores/useCloudSyncStore');
const { synchronizeProject, queueCloudSync } = await import('../src/services/cloudSyncService');
const data = () => ({ persons: [], families: {}, events: {}, sources: {}, places: {}, metricRecords: [], documents: [],
  tasks: [], findings: [], hypotheses: [], requests: [], matrixEntries: [] });
function serverApi(initial: MergedPersonSnapshot = { mapping: {}, revision: 0 }) {
  let snapshot = initial;
  const api = { savePersonDoc: async () => true, savePersonDeltaDoc: async () => true,
    batchDeleteEntities: async () => true, saveProjectDataToCloud: async () => true,
    updateMergedPersons: async changes => {
      snapshot = { mapping: applyMergedPersonChanges(snapshot.mapping, changes), revision: snapshot.revision + 1 };
      return snapshot;
    } };
  return { api, snapshot: () => snapshot };
}
beforeEach(async () => {
  await queueCloudSync(async () => {}); await storage.flushPendingLocalWrites(); localStorage.clear();
  storage.persistLocalData(MERGED_PERSON_MAP_KEY, {}); storage.persistLocalData(MERGED_PERSON_STATE_KEY, null); await storage.flushPendingLocalWrites();
  sync.getState().clearDirty(); sync.setState({ syncMode: 'manual', isManualPushing: false, status: 'synced', isQuotaExceeded: false, pendingWritesCount: 0, pendingWriteError: null });
});
afterEach(async () => { await storage.flushPendingLocalWrites(); });

test('pending merge and undo overlay stale cloud mappings in both directions', () => {
  recordMergedPersonChanges({ duplicate: 'master' }); acceptMergedPersonSnapshot({ mapping: {}, revision: 0 });
  assert.deepEqual(getMergedPersonMap(), { duplicate: 'master' });
  recordMergedPersonChanges({ duplicate: null }); acceptMergedPersonSnapshot({ mapping: { duplicate: 'master' }, revision: 1 });
  assert.deepEqual(getMergedPersonMap(), {}); assert.equal(getPendingMergedPersonChanges().duplicate.target, null);
});
test('manual mode blocks background mapping uploads and explicit upload confirms the queued mapping', async () => {
  recordMergedPersonChanges({ duplicate: 'master' }); const server = serverApi();
  assert.equal((await synchronizeProject(data, server.api, { manual: false })).success, false); assert.equal(server.snapshot().revision, 0);
  assert.equal((await synchronizeProject(data, server.api)).success, true); assert.deepEqual(getPendingMergedPersonChanges(), {});
  assert.deepEqual(server.snapshot().mapping, { duplicate: 'master' });
});
test('undo is uploaded as a per-ID removal while retaining another client’s merge', async () => {
  acceptMergedPersonSnapshot({ mapping: { duplicate: 'master', other: 'target' }, revision: 4 }); recordMergedPersonChanges({ duplicate: null });
  const server = serverApi({ mapping: { duplicate: 'master', other: 'target', remote: 'remote-master' }, revision: 5 });
  assert.equal((await synchronizeProject(data, server.api)).success, true);
  assert.deepEqual(server.snapshot().mapping, { other: 'target', remote: 'remote-master' });
  assert.deepEqual(getMergedPersonMap(), server.snapshot().mapping);
});
for (const mode of ['missing', 'false', 'throw', 'wrong'] as const) test(`an unconfirmed ${mode} mapping write retains the outbox for retry`, async () => {
  recordMergedPersonChanges({ duplicate: 'master' }); const server = serverApi();
  const api = { ...server.api, updateMergedPersons: mode === 'missing' ? undefined : async () => {
    if (mode === 'throw') throw new Error('offline'); return mode === 'wrong' ? { mapping: {}, revision: 1 } : null;
  } };
  assert.equal((await synchronizeProject(data, api)).success, false); assert.equal(getPendingMergedPersonChanges().duplicate.target, 'master');
  assert.equal(sync.getState().hasUnsavedChanges, true);
  assert.equal((await synchronizeProject(data, server.api)).success, true); assert.deepEqual(getPendingMergedPersonChanges(), {});
});
test('an undo during a merge upload cannot be acknowledged by the older upload', async () => {
  recordMergedPersonChanges({ duplicate: 'master' }); const server = serverApi(); const write = server.api.updateMergedPersons;
  server.api.updateMergedPersons = async changes => { recordMergedPersonChanges({ duplicate: null }); return write(changes); };
  assert.equal((await synchronizeProject(data, server.api)).success, false);
  assert.equal(getPendingMergedPersonChanges().duplicate.target, null); assert.deepEqual(getMergedPersonMap(), {});
  server.api.updateMergedPersons = write; assert.equal((await synchronizeProject(data, server.api)).success, true); assert.deepEqual(server.snapshot().mapping, {});
});
test('older cloud revisions cannot resurrect a confirmed undo', () => {
  recordMergedPersonChanges({ duplicate: null }); const changes = getPendingMergedPersonChanges();
  assert.equal(acknowledgeMergedPersonChanges(changes, { mapping: {}, revision: 8 }), true);
  assert.equal(acceptMergedPersonSnapshot({ mapping: { duplicate: 'master' }, revision: 7 }), false); assert.deepEqual(getMergedPersonMap(), {});
  assert.equal(acceptMergedPersonSnapshot({ mapping: { duplicate: 'new-master' }, revision: 9 }), true); assert.equal(getMergedPersonMap().duplicate, 'new-master');
});
test('legacy mappings remain pending until confirmed, including after IndexedDB hydration', async () => {
  storage.persistLocalData(MERGED_PERSON_MAP_KEY, { legacy: 'merged' }); await storage.flushPendingLocalWrites(); localStorage.clear();
  await hydrateMergedPersonState(); assert.deepEqual(getMergedPersonMap(), { legacy: 'merged' });
  assert.equal((await synchronizeProject(data, serverApi().api)).success, true); assert.deepEqual(getPendingMergedPersonChanges(), {});
});
test('a durable journal survives a lost localStorage mirror', async () => {
  recordMergedPersonChanges({ duplicate: 'master' }); await storage.flushPendingLocalWrites(); localStorage.clear();
  await hydrateMergedPersonState(); assert.deepEqual(getMergedPersonMap(), { duplicate: 'master' }); assert.ok(getPendingMergedPersonChanges().duplicate);
});
test('opaque person IDs are supported and invalid self links are rejected', () => {
  assert.deepEqual(applyMergedPersonChanges({}, Object.fromEntries([['__proto__', 'target']])), Object.fromEntries([['__proto__', 'target']]));
  assert.throws(() => recordMergedPersonChanges({ duplicate: 'duplicate' }), /Некоректний/);
  assert.equal(acceptMergedPersonSnapshot({ mapping: {}, revision: -1 }), false); assert.deepEqual(getPendingMergedPersonChanges(), {});
});
