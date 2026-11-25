import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { indexedDB } from 'fake-indexeddb';
import type { Person, Family } from '../src/types';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
  removeItem(key: string) { this.values.delete(key); }
}
Object.assign(globalThis, { localStorage: new MemoryStorage(), indexedDB, window: Object.assign(new EventTarget(), { indexedDB }) });
const { useCloudSyncStore } = await import('../src/stores/useCloudSyncStore');
const { synchronizeProject } = await import('../src/services/cloudSyncService');
const { persistLocalData, flushPendingLocalWrites } = await import('../src/utils/indexedDbStorage');
const { DELETION_CHANGES_KEY } = await import('../src/utils/personDeletionState');
const { executeGlobalTreeSearch, clearGlobalSearchCache } = await import('../src/utils/globalTreeSearch');
const { calculateClassicFamilyTreeLayout, clearTreeLayoutCache } = await import('../src/rodovid/utils/treeLayout');
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const round = (value: number) => Number(value.toFixed(3));

function fixture(size: number) {
  const persons: Person[] = Array.from({ length: size }, (_, i) => ({ id: `p${i}`, firstName: 'Марія',
    lastName: `Тестова${i}`, gender: 'F', notes: i === size - 1 ? 'спеціальна позначка' : 'архівний запис' }));
  const families: Record<string, Family> = {};
  for (let i = 0; i * 2 + 1 < size; i++) {
    const childrenIds = [i * 2 + 1, i * 2 + 2].filter(id => id < size).map(id => `p${id}`);
    families[`f${i}`] = { id: `f${i}`, husbandId: `p${i}`, childrenIds, children: childrenIds.map(personId => ({ personId })) };
  }
  return { persons, families, sources: {}, events: {}, places: {}, metricRecords: [], documents: [],
    tasks: [], findings: [], hypotheses: [], requests: [], matrixEntries: [], trashPersons: [] };
}

async function syncSample(size: number, mode: 'single' | 'bulk' | 'restore') {
  const data = fixture(size);
  const ids = mode === 'single' ? [data.persons[0].id] : data.persons.map(person => person.id);
  useCloudSyncStore.getState().clearDirty();
  const tracker = { ...useCloudSyncStore.getState().dirtyTracker, persons: ids };
  useCloudSyncStore.setState({ dirtyTracker: tracker, dirtyPersonsDelta: {}, hasUnsavedChanges: true,
    unsavedChangesCount: ids.length, projectUploadPending: true, pendingWritesCount: 0, pendingWriteError: null,
    untrackedChangesCount: 0, status: 'pending', isQuotaExceeded: false, syncMode: 'manual' });
  persistLocalData(DELETION_CHANGES_KEY, mode === 'restore'
    ? Object.fromEntries(ids.map(id => [id, { deleted: false, token: id }])) : {});
  await flushPendingLocalWrites();
  let writes = 0;
  (globalThis as any).gc?.();
  const started = performance.now();
  const result = await synchronizeProject(() => data, {
    savePersonDoc: async () => { writes++; return true; }, savePersonDeltaDoc: async () => true,
    batchDeleteEntities: async () => true, saveProjectDataToCloud: async () => true,
    updatePersonDeletionMarkers: async () => []
  }, { manual: true });
  const elapsed = performance.now() - started;
  assert.equal(result.success, true);
  assert.equal(writes, ids.length);
  await flushPendingLocalWrites();
  return elapsed;
}

const results = [];
for (const size of [1000, 5000, 10000]) {
  for (const mode of ['single','bulk','restore'] as const) {
    await syncSample(size, mode);
    const samples = [];
    for (let i = 0; i < 5; i++) samples.push(await syncSample(size, mode));
    results.push({ operation: `sync-${mode}`, persons: size, medianMs: round(median(samples)), samplesMs: samples.map(round) });
  }
  const data = fixture(size);
  const searchCold = [], searchWarm = [], layoutCold = [], layoutWarm = [];
  for (let i = 0; i < 3; i++) {
    clearGlobalSearchCache();
    (globalThis as any).gc?.();
    let started = performance.now();
    assert.ok(executeGlobalTreeSearch(data.persons, 'позначка', 'note').some(row => row.person.id === `p${size - 1}`));
    searchCold.push(performance.now() - started);
    started = performance.now();
    executeGlobalTreeSearch(data.persons, 'позначка', 'note');
    searchWarm.push(performance.now() - started);
    clearTreeLayoutCache();
    const database = { persons: Object.fromEntries(data.persons.map(person => [person.id, person])), families: data.families, sources: {} };
    (globalThis as any).gc?.();
    started = performance.now();
    calculateClassicFamilyTreeLayout(database as any, 'p0', 4, { enableLineBridges: false });
    layoutCold.push(performance.now() - started);
    started = performance.now();
    calculateClassicFamilyTreeLayout(database as any, 'p0', 4, { enableLineBridges: false });
    layoutWarm.push(performance.now() - started);
  }
  for (const [operation, samples] of [['search-cold',searchCold],['search-warm',searchWarm],['layout-cold',layoutCold],['layout-warm',layoutWarm]] as const) {
    results.push({ operation, persons: size, medianMs: round(median(samples)), samplesMs: samples.map(round) });
  }
}
console.log(JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch,
  network: 'mocked writes only; fake IndexedDB', results }, null, 2));
