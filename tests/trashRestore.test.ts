import { beforeEach, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB, IDBDatabase } from 'fake-indexeddb';

class MemoryStorage implements Storage {
  values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  key(i: number) { return Array.from(this.values.keys())[i] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
  removeItem(key: string) { this.values.delete(key); }
}
Object.assign(globalThis, { indexedDB, localStorage: new MemoryStorage(), window: Object.assign(new EventTarget(), { indexedDB }) });
localStorage.setItem('genealogy_workstation_data_v4_familio_persons', JSON.stringify([
  { id: 'boot-placeholder', firstName: 'Невідомо', lastName: 'Невідомо', gender: 'U' }
]));
// No real Firebase module, app configuration or outbound transport is imported.
const calls: string[] = [];
const names = ['savePersonDoc','savePersonDeltaDoc','deletePersonDoc','saveFamilyDoc','deleteFamilyDoc','saveSourceDoc',
  'deleteSourceDoc','saveEventDoc','deleteEventDoc','savePlaceDoc','deletePlaceDoc','saveDeletedTombstonesToCloud',
  'saveMergedPersonsToCloud','saveIgnoredDuplicatePairsToCloud','batchSaveEntities','batchDeleteEntities'];
mock.module(new URL('../src/lib/firebase.ts', import.meta.url).href, {
  namedExports: Object.fromEntries(names.map(name => [name, async () => { calls.push(name); return true; }]))
});
mock.module(new URL('../src/stores/useAuthStore.ts', import.meta.url).href, {
  namedExports: { useAuthStore: { getState: () => ({ currentUser: null, whitelist: [] }) } }
});
mock.module(new URL('../src/services/githubService.ts', import.meta.url).href, {
  namedExports: { getGitHubConfig: () => ({ isConfigured: false }), savePlaceDossierToGitHub: async () => { throw new Error('Unexpected GitHub call'); } }
});
const { useGenealogyStore, getTombstoneIds, addTombstoneIds, TOMBSTONE_STORAGE_KEY } = await import('../src/stores/useGenealogyStore');
const { useCloudSyncStore } = await import('../src/stores/useCloudSyncStore');
const { idbSetMultiple, idbGet, flushPendingLocalWrites } = await import('../src/utils/indexedDbStorage');
const key = 'genealogy_workstation_data_v4_familio';
const journalKey = 'genealogy_person_deletion_changes_v1';
const person = (id: string) => ({ id, firstName: 'Марія', lastName: 'Тестова', gender: 'F' as const, isDeleted: true, deletedAt: '2026-11-25' });
const startupCalls = [...calls];
const startupJournal = await idbGet(journalKey);

test('startup filtering of unknown placeholders creates no cloud write or deletion intention', () => {
  assert.deepEqual(startupCalls, []);
  assert.equal(startupJournal, null);
});

beforeEach(async () => {
  await flushPendingLocalWrites();
  localStorage.clear();
  await idbSetMultiple({ [TOMBSTONE_STORAGE_KEY]: [], [journalKey]: {}, ['genealogy_deleted_family_links_v1']: {}, [`${key}_persons`]: [], [`${key}_trashPersons`]: [] });
  useGenealogyStore.setState({ persons: [], trashPersons: [], deletedFamilyLinks: {}, families: {}, sources: {}, events: {}, places: {} });
  useCloudSyncStore.getState().clearDirty();
  useCloudSyncStore.setState({ syncMode: 'manual', isQuotaExceeded: false, pendingWritesCount: 0, pendingWriteError: null });
  calls.length = 0;
});

async function seedTrash(ids = ['a','b','keep']) {
  const trash = ids.map(person);
  await idbSetMultiple({ [TOMBSTONE_STORAGE_KEY]: ids, [`${key}_trashPersons`]: trash });
  localStorage.setItem(TOMBSTONE_STORAGE_KEY, JSON.stringify(ids));
  localStorage.setItem(`${key}_trashPersons`, JSON.stringify(trash));
  useGenealogyStore.setState({ trashPersons: trash });
}

for (const syncMode of ['manual', 'auto'] as const) {
  test(`${syncMode}: applying a downloaded person list does not upload automatic placeholder cleanup`, () => {
    useCloudSyncStore.setState({ syncMode });
    useGenealogyStore.getState().setPersons([
      { id: 'unknown', firstName: 'Невідомо', lastName: 'Невідомо', gender: 'U' },
      { ...person('visible'), isDeleted: false }
    ]);
    assert.deepEqual(calls, []);
    assert.equal(useCloudSyncStore.getState().hasUnsavedChanges, false);
    assert.equal(getTombstoneIds().has('unknown'), false);
  });
}

test('bulk restore clears selected deletion markers immediately and preserves unrelated trash', async () => {
  await seedTrash();
  useGenealogyStore.getState().restorePersons(['a','b']);
  assert.deepEqual([...getTombstoneIds()].sort(), ['keep']);
  assert.deepEqual(useGenealogyStore.getState().trashPersons.map(p => p.id), ['keep']);
  assert.deepEqual(useGenealogyStore.getState().persons.map(p => p.id), ['a','b']);
  assert.ok(useGenealogyStore.getState().persons.every(p => !p.isDeleted && p.deletedAt === undefined));
  assert.deepEqual(calls, []);
});

test('consecutive single restores cannot put an earlier restored ID back into the marker list', async () => {
  await seedTrash();
  useGenealogyStore.getState().restorePerson('a');
  useGenealogyStore.getState().restorePerson('b');
  assert.deepEqual([...getTombstoneIds()].sort(), ['keep']);
});

test('unknown restore IDs do not clear existing deletion markers or queue changes', async () => {
  await idbSetMultiple({ [TOMBSTONE_STORAGE_KEY]: ['missing'] });
  localStorage.setItem(TOMBSTONE_STORAGE_KEY, JSON.stringify(['missing']));
  useGenealogyStore.getState().restorePerson('missing');
  await flushPendingLocalWrites();
  assert.deepEqual([...getTombstoneIds()], ['missing']);
  assert.equal(useCloudSyncStore.getState().hasUnsavedChanges, false);
});

test('restored persons survive a committed local save and IndexedDB hydration', async () => {
  await seedTrash();
  useGenealogyStore.getState().restorePersons(['a','b']);
  await flushPendingLocalWrites();
  assert.deepEqual(await idbGet(TOMBSTONE_STORAGE_KEY), ['keep']);
  useGenealogyStore.setState({ persons: [], trashPersons: [] });
  useCloudSyncStore.getState().clearDirty();
  await useGenealogyStore.getState().hydrateFromIndexedDB();
  assert.deepEqual(useGenealogyStore.getState().persons.map(p => p.id), ['a','b']);
  assert.equal(useCloudSyncStore.getState().hasUnsavedChanges, true);
});

const deletion = await import('../src/utils/personDeletionState');
const { synchronizeProject } = await import('../src/services/cloudSyncService');
function data() {
  const state = useGenealogyStore.getState();
  return { persons: state.persons, families: state.families, events: state.events, sources: state.sources,
    places: state.places, trashPersons: state.trashPersons, metricRecords: [], documents: [], tasks: [],
    findings: [], hypotheses: [], requests: [], matrixEntries: [] };
}
function api(overrides: Record<string, any> = {}) {
  return { savePersonDoc: async () => true, savePersonDeltaDoc: async () => true,
    batchDeleteEntities: async () => true, saveProjectDataToCloud: async () => true,
    updatePersonDeletionMarkers: async (changes: Record<string, boolean>) => deletion.applyDeletionChangesToIds(['a','b','keep'], changes), ...overrides };
}

for (const syncMode of ['manual', 'auto'] as const) {
  test(`${syncMode}: explicit delete is queued and a restore before upload cancels the queued document delete`, async () => {
    useCloudSyncStore.setState({ syncMode });
    useGenealogyStore.setState({ persons: [{ ...person('queued'), isDeleted: false }] });
    useGenealogyStore.getState().deletePerson('queued');
    assert.deepEqual(calls, []);
    assert.deepEqual(useCloudSyncStore.getState().dirtyTracker.deletedPersons, ['queued']);
    useGenealogyStore.getState().restorePerson('queued');
    let deletes = 0;
    const result = await synchronizeProject(data, api({
      batchDeleteEntities: async () => { deletes++; return true; },
      updatePersonDeletionMarkers: async () => []
    }), { manual: syncMode === 'manual' });
    assert.equal(result.success, true);
    assert.equal(deletes, 0);
    assert.equal(getTombstoneIds().has('queued'), false);
  });
}

test('old cloud markers cannot hide a pending restored person, including after local hydration', async () => {
  await seedTrash();
  useGenealogyStore.getState().restorePerson('a');
  deletion.acceptCloudTombstones(['a','b','keep']);
  assert.equal(getTombstoneIds().has('a'), false);
  await flushPendingLocalWrites();
  await useGenealogyStore.getState().hydrateFromIndexedDB();
  assert.ok(useGenealogyStore.getState().persons.some(p => p.id === 'a'));
  assert.equal(getTombstoneIds().has('a'), false);
});

for (const manual of [true, false]) {
  test(`${manual ? 'manual' : 'auto'} upload acknowledges restored markers only after person and settings succeed`, async () => {
    await seedTrash();
    useCloudSyncStore.setState({ syncMode: manual ? 'manual' : 'auto' });
    useGenealogyStore.getState().restorePersons(['a','b']);
    const order: string[] = [];
    const result = await synchronizeProject(data, api({
      savePersonDoc: async () => { order.push('person'); return true; },
      updatePersonDeletionMarkers: async (changes: Record<string, boolean>) => { order.push('markers'); return deletion.applyDeletionChangesToIds(['a','b','keep'], changes); }
    }), { manual });
    assert.equal(result.success, true);
    assert.equal(order.filter(v => v === 'person').length, 2);
    assert.equal(order.at(-1), 'markers');
    assert.deepEqual(deletion.getPendingDeletionChanges(), {});
    assert.deepEqual([...getTombstoneIds()], ['keep']);
    assert.equal(useCloudSyncStore.getState().hasUnsavedChanges, false);
  });
}

for (const failure of ['person', 'markers', 'mismatched-result', 'quota']) {
  test(`${failure} failure retains the restoration intention and supports retry`, async () => {
    await seedTrash();
    useGenealogyStore.getState().restorePerson('a');
    const before = deletion.getPendingDeletionChanges();
    if (failure === 'quota') useCloudSyncStore.getState().setQuotaExceeded(true);
    const result = await synchronizeProject(data, api({
      savePersonDoc: async () => failure !== 'person',
      updatePersonDeletionMarkers: async () => failure === 'markers' ? null : ['a','b','keep']
    }), { manual: true });
    assert.equal(result.success, false);
    assert.deepEqual(deletion.getPendingDeletionChanges(), before);
    assert.equal(getTombstoneIds().has('a'), false);
    assert.equal(useCloudSyncStore.getState().hasUnsavedChanges, true);
    useCloudSyncStore.getState().setQuotaExceeded(false);
    assert.equal((await synchronizeProject(data, api(), { manual: true })).success, true);
  });
}

test('an older acknowledgement cannot clear a newer delete after restore', async () => {
  await seedTrash();
  useGenealogyStore.getState().restorePerson('a');
  const result = await synchronizeProject(data, api({ updatePersonDeletionMarkers: async () => {
    useGenealogyStore.getState().deletePerson('a');
    return ['b','keep'];
  } }), { manual: true });
  assert.equal(result.success, false);
  assert.equal(deletion.getPendingDeletionChanges().a.deleted, true);
  assert.equal(getTombstoneIds().has('a'), true);
  assert.equal(useCloudSyncStore.getState().hasUnsavedChanges, true);
});

test('consecutive local deletions keep both markers before the debounce flush', () => {
  addTombstoneIds(['first']);
  addTombstoneIds(['second']);
  assert.deepEqual([...getTombstoneIds()].sort(), ['first','second']);
});

test('authoritative empty cloud state clears obsolete base markers without clearing a pending local deletion', async () => {
  await idbSetMultiple({ [TOMBSTONE_STORAGE_KEY]: ['obsolete'] });
  addTombstoneIds(['pending']);
  deletion.acceptCloudTombstones([]);
  assert.deepEqual([...getTombstoneIds()], ['pending']);
});

test('a delayed cloud response cannot overwrite state after a local change', () => {
  const revision = deletion.getDeletionStateRevision();
  addTombstoneIds(['newer']);
  assert.equal(deletion.acceptCloudTombstones(['old'], revision), false);
  assert.deepEqual([...getTombstoneIds()], ['newer']);
});

test('repeated IDs and an already active duplicate do not duplicate or overwrite the active person', async () => {
  await seedTrash(['a']);
  useGenealogyStore.setState({ persons: [{ ...person('a'), firstName: 'Active', isDeleted: false }] });
  useGenealogyStore.getState().restorePersons(['a','a','missing']);
  assert.equal(useGenealogyStore.getState().persons.length, 1);
  assert.equal(useGenealogyStore.getState().persons[0].firstName, 'Active');
  assert.equal(getTombstoneIds().has('a'), false);
});

test('a failed local commit keeps the restore intention and data until a successful retry', async () => {
  await seedTrash(['a','keep']);
  const original = IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction = function (...args: any[]) {
    if (args[1] === 'readwrite') throw new DOMException('Storage full', 'QuotaExceededError');
    return original.apply(this, args as any);
  };
  try {
    useGenealogyStore.getState().restorePerson('a');
    await assert.rejects(flushPendingLocalWrites(), /Storage full/);
    assert.equal(getTombstoneIds().has('a'), false);
    assert.equal(deletion.getPendingDeletionChanges().a.deleted, false);
    assert.ok(useGenealogyStore.getState().persons.some(p => p.id === 'a'));
  } finally { IDBDatabase.prototype.transaction = original; }
  await flushPendingLocalWrites();
  useGenealogyStore.setState({ persons: [], trashPersons: [] });
  await useGenealogyStore.getState().hydrateFromIndexedDB();
  assert.ok(useGenealogyStore.getState().persons.some(p => p.id === 'a'));
});

test('missing ordinary dirty tracking does not lose a persisted restore intention', async () => {
  await seedTrash();
  useGenealogyStore.getState().restorePerson('a');
  await flushPendingLocalWrites();
  useCloudSyncStore.getState().clearDirty();
  const writes: string[] = [];
  const result = await synchronizeProject(data, api({ savePersonDoc: async (p: any) => { writes.push(p.id); return true; } }), { manual: true });
  assert.equal(result.success, true);
  assert.deepEqual(writes, ['a']);
  assert.deepEqual(deletion.getPendingDeletionChanges(), {});
});

test('missing restored entity cannot clear the cloud deletion marker', async () => {
  await seedTrash();
  useGenealogyStore.getState().restorePerson('a');
  useGenealogyStore.setState({ persons: [] });
  let settingsCalled = false;
  const result = await synchronizeProject(data, api({ updatePersonDeletionMarkers: async () => { settingsCalled = true; return []; } }), { manual: true });
  assert.equal(result.success, false);
  assert.equal(settingsCalled, false);
  assert.equal(deletion.getPendingDeletionChanges().a.deleted, false);
});

test('settings exceptions keep the journal durable for the next attempt', async () => {
  await seedTrash();
  useGenealogyStore.getState().restorePerson('a');
  const result = await synchronizeProject(data, api({ updatePersonDeletionMarkers: async () => { throw new Error('connection lost'); } }), { manual: true });
  assert.equal(result.success, false);
  await flushPendingLocalWrites();
  assert.deepEqual(await idbGet(journalKey), deletion.getPendingDeletionChanges());
});

test('a newer restore token cannot be acknowledged by an older marker transaction', async () => {
  await seedTrash();
  useGenealogyStore.getState().restorePerson('a');
  const old = deletion.getPendingDeletionChanges().a.token;
  const result = await synchronizeProject(data, api({ updatePersonDeletionMarkers: async () => {
    deletion.recordPersonDeletionChanges(['a'], false);
    return ['b','keep'];
  } }), { manual: true });
  assert.equal(result.success, false);
  assert.notEqual(deletion.getPendingDeletionChanges().a.token, old);
});

test('a marker acknowledgement cannot overwrite a newer confirmed cloud list', async () => {
  await seedTrash(['a']);
  useGenealogyStore.getState().restorePerson('a');
  const result = await synchronizeProject(data, api({ updatePersonDeletionMarkers: async () => {
    // Another device deletes a different person after this transaction commits,
    // and the live subscription arrives before the transaction promise resolves.
    deletion.acceptCloudTombstones(['other-device']);
    return [];
  } }), { manual: true });
  assert.equal(result.success, true);
  assert.deepEqual(deletion.getPendingDeletionChanges(), {});
  assert.deepEqual([...getTombstoneIds()], ['other-device']);
});

test('a confirmed pre-transaction snapshot cannot undo the transaction when its journal is acknowledged', async () => {
  await seedTrash(['a']);
  useGenealogyStore.getState().restorePerson('a');
  const result = await synchronizeProject(data, api({ updatePersonDeletionMarkers: async () => {
    deletion.acceptCloudTombstones(['a','unrelated']);
    return ['unrelated'];
  } }), { manual: true });
  assert.equal(result.success, true);
  assert.deepEqual(deletion.getPendingDeletionChanges(), {});
  assert.deepEqual([...getTombstoneIds()], ['unrelated']);
});

test('per-person marker patches preserve unrelated remote deletions', () => {
  assert.deepEqual(deletion.applyDeletionChangesToIds(['remote','restored'], { restored: false, local: true }).sort(), ['local','remote']);
});

test('confirmed cloud reconciliation releases stale trash durably without queuing a cloud write', async () => {
  await seedTrash(['a','keep']);
  useGenealogyStore.getState().applyConfirmedCloudDeletionState(['keep'], [{ ...person('a'), isDeleted: false }]);
  assert.deepEqual(useGenealogyStore.getState().persons.map(p => p.id), ['a']);
  assert.deepEqual(useGenealogyStore.getState().trashPersons.map(p => p.id), ['keep']);
  assert.equal(getTombstoneIds().has('a'), false);
  assert.deepEqual(calls, []);
  assert.equal(useCloudSyncStore.getState().hasUnsavedChanges, false);
  await flushPendingLocalWrites();
  useGenealogyStore.setState({ persons: [], trashPersons: [] });
  await useGenealogyStore.getState().hydrateFromIndexedDB();
  assert.deepEqual(useGenealogyStore.getState().persons.map(p => p.id), ['a']);
  assert.equal(getTombstoneIds().has('a'), false);
});

test('confirmed remote deletion creates a local trash copy without echoing the deletion to the server', () => {
  useGenealogyStore.setState({ persons: [{ ...person('remote-deleted'), isDeleted: false }] });
  useGenealogyStore.getState().applyConfirmedCloudDeletionState(['remote-deleted']);
  assert.equal(useGenealogyStore.getState().persons.length, 0);
  assert.equal(useGenealogyStore.getState().trashPersons[0].id, 'remote-deleted');
  assert.deepEqual(deletion.getPendingDeletionChanges(), {});
  assert.deepEqual(calls, []);
  assert.equal(useCloudSyncStore.getState().hasUnsavedChanges, false);
});

function seedFamily() {
  useGenealogyStore.setState({
    persons: ['dad','mom','child'].map(id => ({ ...person(id), isDeleted: false })),
    families: { f: { id: 'f', husbandId: 'dad', wifeId: 'mom', marriageDate: '1900',
      children: [{ personId: 'child', relationType: 'adopted' }], childrenIds: ['child'] } }
  });
}

test('single deletion and restoration preserve family membership and queue the changed family', () => {
  seedFamily();
  const before = useGenealogyStore.getState().families;
  useGenealogyStore.getState().deletePerson('dad');
  assert.equal(useGenealogyStore.getState().families.f.husbandId, undefined);
  assert.deepEqual(useCloudSyncStore.getState().dirtyTracker.families, ['f']);
  const result = useGenealogyStore.getState().restorePerson('dad');
  assert.deepEqual(useGenealogyStore.getState().families, before);
  assert.deepEqual(result, { restoredCount: 1, skippedFamilyLinks: 0 });
  assert.deepEqual(useGenealogyStore.getState().deletedFamilyLinks, {});
});

test('bulk deletion removes family memberships consistently and restores them after IndexedDB hydration', async () => {
  seedFamily();
  const before = useGenealogyStore.getState().families;
  useGenealogyStore.getState().deletePersons(['dad','mom','child']);
  assert.equal(useGenealogyStore.getState().families.f.children.length, 0);
  await flushPendingLocalWrites();
  useGenealogyStore.setState({ persons: [], trashPersons: [], families: {}, deletedFamilyLinks: {} });
  await useGenealogyStore.getState().hydrateFromIndexedDB();
  useGenealogyStore.getState().restorePersons(['mom','child','dad']);
  assert.deepEqual(useGenealogyStore.getState().families, before);
  assert.equal(useGenealogyStore.getState().persons.length, 3);
});

test('restoration reports a changed parent slot without overwriting the new family member', () => {
  seedFamily();
  useGenealogyStore.getState().deletePerson('dad');
  const f = useGenealogyStore.getState().families.f;
  useGenealogyStore.getState().setFamilies({ f: { ...f, husbandId: 'new-partner', notes: 'New edit' } });
  const result = useGenealogyStore.getState().restorePerson('dad');
  assert.equal(result.skippedFamilyLinks, 1);
  assert.equal(useGenealogyStore.getState().families.f.husbandId, 'new-partner');
  assert.equal(useGenealogyStore.getState().families.f.notes, 'New edit');
  assert.ok(useGenealogyStore.getState().deletedFamilyLinks.dad);
});

test('failed family upload retains restored-person intention and retries the family before acknowledging markers', async () => {
  seedFamily();
  useGenealogyStore.getState().deletePerson('dad');
  useGenealogyStore.getState().restorePerson('dad');
  let markerCalls = 0;
  const result = await synchronizeProject(data, api({
    saveProjectDataToCloud: async (payload: any) => { assert.equal(payload.families[0].husbandId, 'dad'); return false; },
    updatePersonDeletionMarkers: async () => { markerCalls++; return []; }
  }), { manual: true });
  assert.equal(result.success, false);
  assert.equal(markerCalls, 0);
  assert.equal(deletion.getPendingDeletionChanges().dad.deleted, false);
  const retry = await synchronizeProject(data, api({ updatePersonDeletionMarkers: async () => [] }), { manual: true });
  assert.equal(retry.success, true);
});

test('permanent deletion discards only the selected local family recovery history', () => {
  seedFamily();
  useGenealogyStore.getState().deletePersons(['dad','mom']);
  useGenealogyStore.getState().permanentlyDeletePerson('dad');
  assert.equal(useGenealogyStore.getState().deletedFamilyLinks.dad, undefined);
  assert.ok(useGenealogyStore.getState().deletedFamilyLinks.mom);
  useGenealogyStore.getState().emptyTrash();
  assert.deepEqual(useGenealogyStore.getState().deletedFamilyLinks, {});
});
