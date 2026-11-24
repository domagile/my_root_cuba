import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import type { CloudSyncApi, ProjectSyncData } from '../src/services/cloudSyncService';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
  removeItem(key: string) { this.values.delete(key); }
}
// No Firebase application/configuration is imported. These tests exercise the
// outbox and orchestration with controlled write results, never a real database.
Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
const { useCloudSyncStore, captureDirtySnapshot, loadDirtyEntities, loadDirtyPersonsDeltas, trackAtomicSync } =
  await import('../src/stores/useCloudSyncStore');
const { queueCloudSync, synchronizeProject, synchronizePersonDeltas } = await import('../src/services/cloudSyncService');
const previousSync = '2026-11-18T10:00:00.000Z';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
function data(): ProjectSyncData {
  return { persons: [{ id: 'p1', gender: 'M', firstName: 'First' }],
    families: { f1: { id: 'f1', children: [] } }, events: {}, sources: {}, places: {},
    metricRecords: [], documents: [{ id: 'doc1' }], tasks: [], findings: [],
    hypotheses: [], requests: [], matrixEntries: [], trashPersons: [] };
}
function api(overrides: Partial<CloudSyncApi> = {}): CloudSyncApi {
  return { savePersonDoc: async () => true, savePersonDeltaDoc: async () => true,
    batchDeleteEntities: async () => true, saveProjectDataToCloud: async () => true, ...overrides };
}
function markBatch() {
  const store = useCloudSyncStore.getState();
  store.markPersonDirtyWithDelta('p1', { firstName: 'Changed' });
  store.markDirty('families', 'f1');
  store.markDeleted('families', 'removed');
}
beforeEach(async () => {
  await queueCloudSync(async () => {});
  localStorage.clear();
  useCloudSyncStore.getState().clearDirty();
  useCloudSyncStore.setState({ status: 'pending', syncMode: 'auto', lastSyncTime: previousSync,
    lastError: null, pendingWriteError: null, pendingWritesCount: 0,
    isQuotaExceeded: false, isManualPushing: false, isManualPulling: false });
});

test('resolved false from an atomic write is an error, with the previous timestamp preserved', async () => {
  assert.equal(await trackAtomicSync(async () => false), false);
  // An unrelated read/listener must not acknowledge the failed write either.
  useCloudSyncStore.getState().setStatus('synced');
  const state = useCloudSyncStore.getState();
  assert.equal(state.status, 'error');
  assert.equal(state.pendingWritesCount, 0);
  assert.equal(state.lastSyncTime, previousSync);
});

test('a rejected atomic write is an error and does not replace the last confirmed timestamp', async () => {
  await assert.rejects(trackAtomicSync(async () => { throw new Error('offline'); }), /offline/);
  assert.equal(useCloudSyncStore.getState().status, 'error');
  assert.equal(useCloudSyncStore.getState().lastSyncTime, previousSync);
});

test('the last successful concurrent write cannot hide an earlier failed write', async () => {
  const failed = deferred<boolean>(), successful = deferred<boolean>();
  const first = trackAtomicSync(() => failed.promise);
  const second = trackAtomicSync(() => successful.promise);
  failed.resolve(false); await first;
  successful.resolve(true); await second;
  assert.equal(useCloudSyncStore.getState().status, 'error');
  assert.equal(useCloudSyncStore.getState().lastSyncTime, previousSync);
});

for (const manual of [false, true]) {
  for (const failure of ['person-false', 'person-reject', 'delete-false', 'project-false'] as const) {
    test(`${manual ? 'manual' : 'auto'}: ${failure} keeps the outbox until a successful retry`, async () => {
      markBatch();
      const before = captureDirtySnapshot();
      let fail = true;
      const client = api({
        savePersonDeltaDoc: async () => {
          if (fail && failure === 'person-reject') throw new Error('connection lost');
          return !(fail && failure === 'person-false');
        },
        batchDeleteEntities: async () => !(fail && failure === 'delete-false'),
        saveProjectDataToCloud: async () => !(fail && failure === 'project-false')
      });
      const result = await synchronizeProject(data, client, { manual });
      assert.equal(result.success, false);
      assert.equal(useCloudSyncStore.getState().status, 'error');
      assert.equal(useCloudSyncStore.getState().lastSyncTime, previousSync);
      assert.deepEqual(useCloudSyncStore.getState().dirtyTracker, before.tracker);
      assert.deepEqual(loadDirtyEntities(), before.tracker);
      assert.deepEqual(loadDirtyPersonsDeltas(), before.personDeltas);
      assert.equal(useCloudSyncStore.getState().isManualPushing, false);
      fail = false;
      assert.equal((await synchronizeProject(data, client, { manual })).success, true);
      assert.equal(useCloudSyncStore.getState().hasUnsavedChanges, false);
      assert.equal(useCloudSyncStore.getState().status, 'synced');
      assert.notEqual(useCloudSyncStore.getState().lastSyncTime, previousSync);
    });
  }
}

test('missing local entities cannot silently disappear from the upload queue', async () => {
  useCloudSyncStore.getState().markDirty('persons', 'missing');
  assert.equal((await synchronizeProject(data, api())).success, false);
  assert.deepEqual(useCloudSyncStore.getState().dirtyTracker.persons, ['missing']);
});

test('background upload includes queued research collections and full person writes', async () => {
  const store = useCloudSyncStore.getState();
  store.markDirty('persons', 'p1');
  store.markDirty('research', 'documents');
  let fullPerson = false, documents: any[] | undefined;
  const result = await synchronizeProject(data, api({
    savePersonDoc: async person => { fullPerson = person.id === 'p1'; return true; },
    savePersonDeltaDoc: async () => { assert.fail('a full write must not become a partial delta'); },
    saveProjectDataToCloud: async payload => { documents = payload.documents; return true; }
  }), { manual: false });
  assert.equal(result.success, true);
  assert.equal(fullPerson, true);
  assert.deepEqual(documents, [{ id: 'doc1' }]);
});

test('force-full upload checks deletions, including non-person entities and trash', async () => {
  useCloudSyncStore.getState().markDeleted('families', 'removed');
  const current = data(); current.trashPersons = [{ id: 'trashed', gender: 'U' }];
  const deleted: string[][] = [];
  const result = await synchronizeProject(() => current, api({
    batchDeleteEntities: async (type, ids) => { deleted.push([type, ...ids]); return type !== 'families'; }
  }), { forceFull: true });
  assert.equal(result.success, false);
  assert.deepEqual(deleted, [['persons', 'trashed'], ['families', 'removed']]);
  assert.deepEqual(useCloudSyncStore.getState().dirtyTracker.deletedFamilies, ['removed']);
  assert.equal(useCloudSyncStore.getState().lastSyncTime, previousSync);
});

test('quota exhaustion before upload preserves the queue and returns failure', async () => {
  markBatch();
  const before = captureDirtySnapshot();
  useCloudSyncStore.getState().setQuotaExceeded(true);
  let called = false;
  const result = await synchronizeProject(data, api({ saveProjectDataToCloud: async () => { called = true; return true; } }));
  assert.equal(result.success, false);
  assert.equal(called, false);
  assert.equal(useCloudSyncStore.getState().status, 'offline');
  assert.equal(useCloudSyncStore.getState().lastSyncTime, previousSync);
  assert.deepEqual(loadDirtyEntities(), before.tracker);
});

test('quota exhaustion during a write cannot be hidden by another successful operation', async () => {
  markBatch();
  const result = await synchronizeProject(data, api({ savePersonDeltaDoc: async () => {
    useCloudSyncStore.getState().setQuotaExceeded(true); return false;
  } }));
  assert.equal(result.success, false);
  assert.equal(useCloudSyncStore.getState().status, 'offline');
  assert.equal(useCloudSyncStore.getState().hasUnsavedChanges, true);
  assert.equal(useCloudSyncStore.getState().lastSyncTime, previousSync);
});

test('another edit to the same person during upload is retained even when the dirty count is unchanged', async () => {
  const store = useCloudSyncStore.getState();
  store.markPersonDirtyWithDelta('p1', { firstName: 'First edit' });
  const started = deferred<void>(), finish = deferred<boolean>();
  const result = synchronizeProject(data, api({ savePersonDeltaDoc: async () => {
    started.resolve(); return finish.promise;
  } }));
  await started.promise;
  store.markPersonDirtyWithDelta('p1', { firstName: 'New edit' });
  finish.resolve(true);
  assert.equal((await result).success, false);
  assert.equal(useCloudSyncStore.getState().unsavedChangesCount, 1);
  assert.equal(useCloudSyncStore.getState().dirtyPersonsDelta.p1.firstName, 'New edit');
  assert.equal(useCloudSyncStore.getState().status, 'pending');
  assert.equal(useCloudSyncStore.getState().lastSyncTime, previousSync);
});

test('edits made while the optional local backup is running are not acknowledged by that upload', async () => {
  useCloudSyncStore.getState().markDirty('families', 'f1');
  const started = deferred<void>(), finish = deferred<void>();
  const result = synchronizeProject(data, api(), { beforeUpload: async () => { started.resolve(); await finish.promise; } });
  await started.promise;
  useCloudSyncStore.getState().markDirty('families', 'f1');
  finish.resolve();
  assert.equal((await result).success, false);
  assert.deepEqual(useCloudSyncStore.getState().dirtyTracker.families, ['f1']);
});

test('generic bulk changes survive later entity edits and force a complete upload', async () => {
  const store = useCloudSyncStore.getState();
  store.markUnsavedChange(); store.markDirty('families', 'f1');
  assert.equal(useCloudSyncStore.getState().unsavedChangesCount, 2);
  let people: any[] | undefined;
  const result = await synchronizeProject(data, api({ saveProjectDataToCloud: async payload => {
    people = payload.persons; return true;
  } }));
  assert.equal(result.success, true);
  assert.deepEqual(people, data().persons);
  assert.equal(useCloudSyncStore.getState().untrackedChangesCount, 0);
  assert.equal(localStorage.getItem('rodovid_untracked_changes_count_v1'), '0');
});

test('queued upload jobs execute in order and capture the current data only when they start', async () => {
  const store = useCloudSyncStore.getState();
  store.markPersonDirtyWithDelta('p1', { firstName: 'First edit' });
  const started = deferred<void>(), finish = deferred<boolean>();
  const sent: string[] = [];
  let first = true;
  const client = api({ savePersonDeltaDoc: async (_id, delta) => {
    sent.push(delta.firstName!);
    if (first) { first = false; started.resolve(); return finish.promise; }
    return true;
  } });
  const one = synchronizeProject(data, client, { manual: false });
  await started.promise;
  const two = synchronizeProject(data, client, { manual: true });
  store.markPersonDirtyWithDelta('p1', { firstName: 'Second edit' });
  finish.resolve(true);
  assert.equal((await one).success, false);
  assert.equal((await two).success, true);
  assert.deepEqual(sent, ['First edit', 'Second edit']);
  assert.equal(useCloudSyncStore.getState().status, 'synced');
});

test('fast person upload retries every accumulated field and preserves failed deltas', async () => {
  const store = useCloudSyncStore.getState();
  store.markPersonDirtyWithDelta('p1', { firstName: 'Earlier failed field' });
  store.markPersonDirtyWithDelta('p1', { birthYear: 1900 });
  const expected = { firstName: 'Earlier failed field', birthYear: 1900 };
  await synchronizePersonDeltas(['p1'], async (_id, delta) => { assert.deepEqual(delta, expected); return false; });
  assert.deepEqual(loadDirtyPersonsDeltas().p1, expected);
  assert.equal(useCloudSyncStore.getState().status, 'error');
  await synchronizePersonDeltas(['p1'], async (_id, delta) => { assert.deepEqual(delta, expected); return true; });
  assert.equal(useCloudSyncStore.getState().hasUnsavedChanges, false);
  assert.equal(useCloudSyncStore.getState().status, 'synced');
});

test('an older fast upload cannot clear a newer delta', async () => {
  const store = useCloudSyncStore.getState();
  store.markPersonDirtyWithDelta('p1', { firstName: 'Old' });
  const started = deferred<void>(), finish = deferred<boolean>();
  const upload = synchronizePersonDeltas(['p1'], async () => { started.resolve(); return finish.promise; });
  await started.promise;
  store.markPersonDirtyWithDelta('p1', { birthYear: 1899 });
  finish.resolve(true); await upload;
  assert.deepEqual(loadDirtyPersonsDeltas().p1, { firstName: 'Old', birthYear: 1899 });
  assert.equal(useCloudSyncStore.getState().hasUnsavedChanges, true);
});

test('a full-person write cannot be acknowledged by an incomplete fast delta', async () => {
  const store = useCloudSyncStore.getState();
  store.markPersonDirtyWithDelta('p1', { firstName: 'Old partial' });
  store.markDirty('persons', 'p1');
  store.markPersonDirtyWithDelta('p1', { birthYear: 1899 });
  await synchronizePersonDeltas(['p1'], async () => { assert.fail('full record is required'); });
  assert.equal(useCloudSyncStore.getState().hasUnsavedChanges, true);
  assert.equal(useCloudSyncStore.getState().dirtyPersonsDelta.p1, undefined);
  assert.equal((await synchronizeProject(data, api())).success, true);
});

test('status setters and quota reset cannot announce synced while the queue is not empty', () => {
  const store = useCloudSyncStore.getState();
  store.markDirty('families', 'f1');
  store.setStatus('synced');
  assert.equal(useCloudSyncStore.getState().status, 'pending');
  store.setQuotaExceeded(true); store.setQuotaExceeded(false);
  assert.equal(useCloudSyncStore.getState().status, 'pending');
  store.setStatus('error', 'write failed');
  assert.equal(useCloudSyncStore.getState().lastSyncTime, previousSync);
});

test('a failed queued job does not block the next synchronization attempt', async () => {
  await assert.rejects(queueCloudSync(async () => { throw new Error('unexpected failure'); }));
  assert.equal(await queueCloudSync(async () => 42), 42);
});

test('incremental metadata contains total collection counts rather than the dirty subset size', async () => {
  const current = data();
  current.persons.push({ id: 'p2', gender: 'F' });
  current.families.f2 = { id: 'f2', children: [] };
  useCloudSyncStore.getState().markDirty('families', 'f1');
  const result = await synchronizeProject(() => current, api({ saveProjectDataToCloud: async payload => {
    assert.equal(payload.families!.length, 1);
    assert.equal(payload.persons, undefined);
    assert.deepEqual(payload.counts, { personsCount: 2, familiesCount: 2,
      metricRecordsCount: 0, documentsCount: 1, hypothesesCount: 0 });
    return true;
  } }));
  assert.equal(result.success, true);
});

test('resetting the quota flag cannot announce success while a write is still running', async () => {
  const write = deferred<boolean>();
  const result = trackAtomicSync(() => write.promise);
  useCloudSyncStore.getState().setQuotaExceeded(true);
  useCloudSyncStore.getState().setQuotaExceeded(false);
  assert.equal(useCloudSyncStore.getState().status, 'syncing');
  write.resolve(true); await result;
  assert.equal(useCloudSyncStore.getState().status, 'synced');
});

test('fast person success cannot hide a failed project upload or its metadata', async () => {
  const store = useCloudSyncStore.getState();
  store.markPersonDirtyWithDelta('p1', { firstName: 'Changed' });
  assert.equal((await synchronizeProject(data, api({ saveProjectDataToCloud: async () => false }))).success, false);
  await synchronizePersonDeltas(['p1'], async () => true);
  assert.equal(useCloudSyncStore.getState().projectUploadPending, true);
  assert.equal(useCloudSyncStore.getState().hasUnsavedChanges, true);
  assert.notEqual(useCloudSyncStore.getState().status, 'synced');
  assert.equal(useCloudSyncStore.getState().lastSyncTime, previousSync);
  assert.equal(localStorage.getItem('rodovid_project_upload_pending_v1'), '1');
  assert.equal((await synchronizeProject(data, api())).success, true);
  assert.equal(useCloudSyncStore.getState().projectUploadPending, false);
  assert.equal(useCloudSyncStore.getState().status, 'synced');
});
