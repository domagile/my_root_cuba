import { beforeEach, afterEach, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB, IDBDatabase } from 'fake-indexeddb';
import type { Person } from '../src/types';
class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}
Object.assign(globalThis, { indexedDB, localStorage: new MemoryStorage(), window: Object.assign(new EventTarget(), { indexedDB }) });
const calls: string[] = [];
mock.module(new URL('../src/lib/firebase.ts', import.meta.url).href, { namedExports: Object.fromEntries([
  'savePersonDoc','savePersonDeltaDoc','deletePersonDoc','saveFamilyDoc','deleteFamilyDoc','saveSourceDoc','deleteSourceDoc',
  'saveEventDoc','deleteEventDoc','savePlaceDoc','deletePlaceDoc','saveDeletedTombstonesToCloud','batchSaveEntities','batchDeleteEntities'
].map(name => [name, async () => { calls.push(name); return true; }])) });
mock.module(new URL('../src/stores/useAuthStore.ts', import.meta.url).href, { namedExports: { useAuthStore: { getState: () => ({ currentUser: null, whitelist: [] }) } } });
mock.module(new URL('../src/services/githubService.ts', import.meta.url).href, { namedExports: { getGitHubConfig: () => ({ isConfigured: false }), savePlaceDossierToGitHub: async () => { throw new Error('Unexpected GitHub call'); } } });
const { useGenealogyStore: store, normalizePerson, getTombstoneIds, TOMBSTONE_STORAGE_KEY } = await import('../src/stores/useGenealogyStore');
const { useCloudSyncStore: sync } = await import('../src/stores/useCloudSyncStore');
const storage = await import('../src/utils/indexedDbStorage');
const { quickMergePersons, batchMergeSafeDuplicates } = await import('../src/utils/personMerge');
const { getSnapshot, getAllSnapshots, deleteSnapshot } = await import('../src/utils/persistentBackup');
const merged = await import('../src/utils/mergedPersonState');
const ignored = await import('../src/utils/ignoredDuplicateState');
const detector = await import('../src/utils/duplicateDetector');
const { getPendingDeletionChanges } = await import('../src/utils/personDeletionState');
const { queueCloudSync } = await import('../src/services/cloudSyncService');
const prefix = 'genealogy_workstation_data_v4_familio';
const originalTransaction = IDBDatabase.prototype.transaction;
function seed() {
  const persons = [
    { id: 'merge-a', gender: 'M', firstName: 'Іван', lastName: 'Тестовий', birthDate: '1900', notes: 'Master' },
    { id: 'merge-b', gender: 'M', firstName: 'Іван', lastName: 'Тестовий', birthDate: '1900', notes: 'Duplicate', sources: ['source'] },
    { id: 'child', gender: 'F', firstName: 'Марія', lastName: 'Тестова', fatherId: 'merge-b' }
  ].map(person => normalizePerson(person as Person));
  store.setState({ persons, families: { family: { id: 'family', husbandId: 'merge-b', children: [{ personId: 'child' }] } }, trashPersons: [],
    sources: {}, events: {}, places: {}, selectedPersonId: 'merge-b', mergeInProgress: false, lastPersonMergeSnapshotId: null });
  return structuredClone({ persons, families: store.getState().families, trashPersons: [] });
}
function payload() {
  const { persons, families } = store.getState();
  const result = quickMergePersons(persons[0], persons[1], persons, families);
  return { ...result, sourcePersons: persons, sourceFamilies: families, deletedPersonIds: [result.deletedPersonId] };
}
function interceptWrites(dbName: string, onPut: (tx: IDBTransaction) => void) {
  IDBDatabase.prototype.transaction = function (...args: any[]) {
    const tx = originalTransaction.apply(this, args as any);
    if (this.name === dbName && args[1] === 'readwrite') {
      const getStore = tx.objectStore.bind(tx);
      tx.objectStore = name => {
        const object = getStore(name), put = object.put.bind(object);
        object.put = (...values) => { const request = put(...values); onPut(tx); return request; };
        return object;
      };
    }
    return tx;
  };
}
beforeEach(async () => {
  await queueCloudSync(async () => {}); await storage.flushPendingLocalWrites(); localStorage.clear();
  for (const [key, value] of Object.entries({ [TOMBSTONE_STORAGE_KEY]: [], genealogy_person_deletion_changes_v1: {},
    [merged.MERGED_PERSON_MAP_KEY]: {}, [merged.MERGED_PERSON_STATE_KEY]: null,
    [ignored.IGNORED_DUPLICATE_STATE_KEY]: null, [detector.RODOVID_IGNORED_DUPLICATE_PAIRS_KEY]: [] })) storage.persistLocalData(key, value);
  await storage.flushPendingLocalWrites(); seed(); sync.getState().clearDirty();
  sync.setState({ syncMode: 'manual', isQuotaExceeded: false, status: 'synced', pendingWritesCount: 0, pendingWriteError: null }); calls.length = 0;
});
afterEach(async () => { IDBDatabase.prototype.transaction = originalTransaction; await storage.flushPendingLocalWrites(); });

test('a confirmed checkpoint precedes a merge and preserves original people and family links', async () => {
  const before = seed(), input = payload();
  const result = await store.getState().mergePersons(input);
  assert.equal(result.persisted, true);
  const snapshot = await getSnapshot(result.snapshotId);
  assert.deepEqual(snapshot?.data.persons, before.persons); assert.deepEqual(snapshot?.data.families, before.families);
  assert.equal(store.getState().persons.find(person => person.id === 'child')?.fatherId, input.masterPerson.id);
  assert.equal(store.getState().families.family.husbandId, input.masterPerson.id);
  assert.ok(getTombstoneIds().has(input.deletedPersonId));
  assert.equal(merged.getMergedPersonMap()[input.deletedPersonId], input.masterPerson.id);
  assert.deepEqual(detector.getIgnoredDuplicatePairKeys(), new Set()); assert.deepEqual(calls, []);
});
test('undo restores original records, queues undelete and mapping removal, and never uploads in manual mode', async () => {
  const before = seed(), input = payload(); await store.getState().mergePersons(input);
  assert.equal((await store.getState().undoLastPersonMerge()).persisted, true);
  assert.deepEqual(store.getState().persons, before.persons); assert.deepEqual(store.getState().families, before.families);
  assert.deepEqual(store.getState().trashPersons, []); assert.equal(store.getState().selectedPersonId, 'merge-b');
  assert.equal(getPendingDeletionChanges()[input.deletedPersonId].deleted, false); assert.equal(getTombstoneIds().has(input.deletedPersonId), false);
  assert.equal(merged.getPendingMergedPersonChanges()[input.deletedPersonId].target, null); assert.deepEqual(merged.getMergedPersonMap(), {});
  assert.ok(sync.getState().dirtyTracker.persons.includes(input.deletedPersonId)); assert.deepEqual(sync.getState().dirtyTracker.deletedPersons, []);
  assert.deepEqual(calls, []);
});
test('merging a person with itself and a stale comparison are rejected before a mutation', () => {
  const { persons, families } = store.getState();
  assert.throws(() => quickMergePersons(persons[0], persons[0], persons, families), /дві різні/);
  assert.throws(() => quickMergePersons({ ...persons[0], notes: 'old' }, persons[1], persons, families), /змінилися/);
  assert.equal(store.getState().persons.length, 3); assert.equal(sync.getState().hasUnsavedChanges, false);
});
test('a database change after calculating a merge cannot be overwritten by that result', async () => {
  const input = payload(); store.setState({ families: { family: { ...store.getState().families.family, notes: 'New evidence' } } });
  await assert.rejects(store.getState().mergePersons(input), /База змінилася/);
  assert.equal(store.getState().families.family.notes, 'New evidence'); assert.equal(store.getState().persons.length, 3);
  assert.deepEqual(merged.getMergedPersonMap(), {}); assert.equal(sync.getState().hasUnsavedChanges, false);
});
test('an aborted recovery snapshot leaves the people, outbox and dismissal decisions untouched', async () => {
  const input = payload(), before = structuredClone(store.getState().persons);
  interceptWrites('GenealogyWorkstationPersistence', tx => queueMicrotask(() => { try { tx.abort(); } catch {} }));
  await assert.rejects(store.getState().mergePersons(input), /контрольну точку/);
  assert.deepEqual(store.getState().persons, before); assert.equal(store.getState().mergeInProgress, false);
  assert.deepEqual(getPendingDeletionChanges(), {}); assert.deepEqual(merged.getMergedPersonMap(), {});
  assert.equal(sync.getState().hasUnsavedChanges, false); assert.equal(detector.isDuplicatePairIgnored('merge-a', 'merge-b'), false); assert.deepEqual(calls, []);
});
test('an edit while saving the checkpoint aborts the merge and preserves the newer edit', async () => {
  const input = payload(); let edited = false;
  interceptWrites('GenealogyWorkstationPersistence', () => {
    if (!edited) { edited = true; store.setState({ persons: store.getState().persons.map(person => person.id === 'child' ? { ...person, notes: 'New evidence' } : person) }); }
  });
  await assert.rejects(store.getState().mergePersons(input), /під час збереження/);
  assert.equal(store.getState().persons.length, 3); assert.equal(store.getState().persons[2].notes, 'New evidence'); assert.deepEqual(merged.getMergedPersonMap(), {});
});
test('a double submission performs only one merge', async () => {
  const input = payload(), first = store.getState().mergePersons(input);
  await assert.rejects(store.getState().mergePersons(input), /Інша операція/);
  await first; assert.equal(store.getState().persons.length, 2); assert.equal(store.getState().trashPersons.length, 1);
});
for (const kind of ['person', 'family', 'trash'] as const) test(`undo refuses to overwrite a later ${kind} edit`, async () => {
  await store.getState().mergePersons(payload());
  if (kind === 'person') store.setState({ persons: store.getState().persons.map(person => ({ ...person, notes: 'Later edit' })) });
  if (kind === 'family') store.setState({ families: { family: { ...store.getState().families.family, notes: 'Later edit' } } });
  if (kind === 'trash') store.setState({ trashPersons: [] });
  const before = structuredClone({ persons: store.getState().persons, families: store.getState().families, trashPersons: store.getState().trashPersons });
  await assert.rejects(store.getState().undoLastPersonMerge(), /записи змінилися/);
  assert.deepEqual({ persons: store.getState().persons, families: store.getState().families, trashPersons: store.getState().trashPersons }, before);
});
test('a missing checkpoint blocks undo without changing the merged records', async () => {
  const result = await store.getState().mergePersons(payload()); await deleteSnapshot(result.snapshotId);
  await assert.rejects(store.getState().undoLastPersonMerge(), /недоступна/); assert.equal(store.getState().persons.length, 2);
});
test('overlapping batch suggestions only map actual merges and never dismiss skipped pairs', async () => {
  const { persons, families } = store.getState();
  const res = batchMergeSafeDuplicates([{ personA: persons[0], personB: persons[1], confidence: 99 },
    { personA: persons[1], personB: persons[2], confidence: 99 }] as any, persons, families);
  assert.equal(res.mergedCount, 1); await store.getState().mergePersons({ ...res, sourcePersons: persons, sourceFamilies: families });
  assert.equal(Object.keys(merged.getMergedPersonMap()).length, 1); assert.equal(detector.isDuplicatePairIgnored(persons[1].id, persons[2].id), false);
});
test('a committed merge can be rehydrated from IndexedDB and then undone', async () => {
  const before = seed(), result = await store.getState().mergePersons(payload());
  localStorage.clear(); store.setState({ persons: [], families: {}, trashPersons: [], lastPersonMergeSnapshotId: null });
  await store.getState().hydrateFromIndexedDB(); assert.equal(store.getState().lastPersonMergeSnapshotId, result.snapshotId);
  assert.equal(store.getState().persons.length, 2); await store.getState().undoLastPersonMerge(); assert.deepEqual(store.getState().persons, before.persons);
});
test('a failed local record commit reports pending persistence and retains a usable checkpoint for retry', async () => {
  interceptWrites('familio_genealogy_idb_v1', tx => queueMicrotask(() => { try { tx.abort(); } catch {} }));
  const result = await store.getState().mergePersons(payload());
  assert.equal(result.persisted, false); assert.equal(store.getState().persons.length, 2); assert.ok(await getSnapshot(result.snapshotId));
  assert.equal(storage.hasPendingLocalWrites(), true); IDBDatabase.prototype.transaction = originalTransaction;
  await storage.flushPendingLocalWrites(); await store.getState().undoLastPersonMerge(); assert.equal(store.getState().persons.length, 3);
});
test('the checkpoint waits for an active cloud drain and merging in auto mode queues all writes', async () => {
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  const active = queueCloudSync(() => gate), count = (await getAllSnapshots()).length;
  sync.setState({ syncMode: 'auto' }); const merging = store.getState().mergePersons(payload());
  await new Promise(resolve => setImmediate(resolve)); assert.equal((await getAllSnapshots()).length, count); assert.equal(store.getState().persons.length, 3);
  release(); await active; await merging; assert.deepEqual(calls, []); assert.ok(sync.getState().dirtyTracker.deletedPersons.length);
});

test('a failed atomic local commit leaves all durable merge records and journals at the original state', async () => {
  const before = seed();
  for (const [key, value] of Object.entries({ [`${prefix}_persons`]: before.persons, [`${prefix}_families`]: before.families,
    [`${prefix}_trashPersons`]: [], [`${prefix}_lastPersonMergeSnapshotId`]: null })) storage.persistLocalData(key, value);
  await storage.flushPendingLocalWrites();
  interceptWrites('familio_genealogy_idb_v1', tx => queueMicrotask(() => { try { tx.abort(); } catch {} }));
  assert.equal((await store.getState().mergePersons(payload())).persisted, false);
  IDBDatabase.prototype.transaction = originalTransaction;
  // Read committed values directly, bypassing the pending in-memory write overlay.
  const raw = await new Promise<any>(resolve => {
    const request = indexedDB.open('familio_genealogy_idb_v1', 1);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('genealogy_records', 'readonly'), object = tx.objectStore('genealogy_records'), result: any = {};
      for (const key of [`${prefix}_persons`, `${prefix}_lastPersonMergeSnapshotId`, merged.MERGED_PERSON_STATE_KEY]) {
        const get = object.get(key); get.onsuccess = () => { result[key] = get.result; };
      }
      tx.oncomplete = () => { db.close(); resolve(result); };
    };
  });
  assert.deepEqual(raw[`${prefix}_persons`], before.persons); assert.equal(raw[`${prefix}_lastPersonMergeSnapshotId`], null); assert.equal(raw[merged.MERGED_PERSON_STATE_KEY], null);
});
test('a stale batch suggestion cannot merge records that changed since the scan', () => {
  const { persons, families } = store.getState();
  assert.throws(() => batchMergeSafeDuplicates([{ personA: { ...persons[0], notes: 'Stale' }, personB: persons[1], confidence: 99 }] as any, persons, families), /Дані осіб змінилися/);
});
test('two consecutive merges can be undone in reverse order without losing the earlier checkpoint', async () => {
  const before = seed(), first = await store.getState().mergePersons(payload());
  const { persons, families } = store.getState();
  const result = quickMergePersons(persons[0], persons[1], persons, families);
  await store.getState().mergePersons({ ...result, sourcePersons: persons, sourceFamilies: families, deletedPersonIds: [result.deletedPersonId] });
  await store.getState().undoLastPersonMerge(); assert.equal(store.getState().lastPersonMergeSnapshotId, first.snapshotId);
  await store.getState().undoLastPersonMerge(); assert.deepEqual(store.getState().persons, before.persons); assert.deepEqual(merged.getMergedPersonMap(), {});
});

test('cloud upload waits for a confirmed local merge commit and retains the outbox on a local failure', async () => {
  const { synchronizeProject } = await import('../src/services/cloudSyncService');
  interceptWrites('familio_genealogy_idb_v1', tx => queueMicrotask(() => { try { tx.abort(); } catch {} }));
  await store.getState().mergePersons(payload()); let writes = 0;
  const result = await synchronizeProject(() => ({ ...store.getState(), metricRecords: [], documents: [], tasks: [], findings: [], hypotheses: [], requests: [], matrixEntries: [] }), {
    savePersonDoc: async () => { writes++; return true; }, savePersonDeltaDoc: async () => { writes++; return true; },
    batchDeleteEntities: async () => { writes++; return true; }, saveProjectDataToCloud: async () => { writes++; return true; }
  });
  assert.equal(result.success, false); assert.equal(writes, 0); assert.equal(sync.getState().hasUnsavedChanges, true);
});

test('server timestamps and null representations of empty optional fields do not disable undo', async () => {
  const before = seed(); await store.getState().mergePersons(payload());
  store.setState({ persons: store.getState().persons.map(person => ({ ...person, updatedAt: '2026-11-26T19:00:00Z', birthPlace: person.birthPlace ?? null } as any)),
    families: Object.fromEntries(Object.entries(store.getState().families).map(([id, family]) => [id, { ...family, updatedAt: '2026-11-26T19:00:00Z' }])) });
  await store.getState().undoLastPersonMerge(); assert.deepEqual(store.getState().persons, before.persons); assert.deepEqual(store.getState().families, before.families);
});
