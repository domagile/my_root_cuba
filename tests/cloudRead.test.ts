import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readProjectSnapshot, projectCollections, type ProjectReader } from '../src/services/projectCloudReadService';
import { selectCloudPersons } from '../src/services/cloudPersonReadService';
import type { Person } from '../src/types';

const person = (id: string, firstName = 'Марія'): Person => ({ id, firstName, lastName: 'Тестова', gender: 'F' });
function reader(overrides: Partial<ProjectReader> = {}): ProjectReader {
  return { readCollection: async () => [], readSetting: async () => undefined, readLegacy: async () => undefined, ...overrides };
}

test('complete download returns all tree collections and settings without mutating its source', async () => {
  const source = Object.freeze({ ids: Object.freeze(['deleted']) });
  const result = await readProjectSnapshot(reader({
    readCollection: async name => name === 'persons' ? [Object.freeze(person('remote'))] : [],
    readSetting: async name => name === 'deletedTombstones' ? source : undefined,
    readLegacy: async () => { assert.fail('canonical tree must not trigger legacy loading'); }
  }));
  assert.deepEqual(Object.keys(result.data), [...projectCollections]);
  assert.equal(result.data.persons![0].id, 'remote');
  assert.deepEqual(result.settings.deletedTombstones, ['deleted']);
  assert.deepEqual(source, { ids: ['deleted'] });
});
test('duplicate snapshots expose their revision and accept the legacy unversioned list', async () => {
  for (const revision of [undefined, 7]) {
    const result = await readProjectSnapshot(reader({ readSetting: async name => name === 'ignoredDuplicates'
      ? { keys: ['a___b'], ...(revision === undefined ? {} : { revision }) } : undefined }));
    assert.deepEqual(result.settings.ignoredDuplicatePairs, ['a___b']);
    assert.equal(result.settings.ignoredDuplicateRevision, revision ?? 0);
  }
});
test('malformed duplicate revisions cannot authorize replacement of local decisions', async () => {
  for (const revision of [-1, '2', 0.5]) await assert.rejects(readProjectSnapshot(reader({
    readSetting: async name => name === 'ignoredDuplicates' ? { keys: [], revision } : undefined
  })), /Invalid cloud duplicate revision/);
});

for (const code of ['permission-denied', 'unavailable', 'resource-exhausted']) {
  test(`${code} cannot become an empty successful collection`, async () => {
    await assert.rejects(readProjectSnapshot(reader({ readCollection: async name => {
      if (name === 'families') throw Object.assign(new Error(code), { code });
      return [person('must-not-be-applied')];
    } })), new RegExp(code));
  });
}

test('unavailable deletion settings abort the snapshot rather than replacing local data', async () => {
  await assert.rejects(readProjectSnapshot(reader({ readSetting: async name => {
    if (name === 'deletedTombstones') throw new Error('settings offline');
    return undefined;
  } })), /settings offline/);
});

for (const [name, value] of [['deletedTombstones', { ids: [7] }], ['ignoredDuplicates', { keys: 'invalid' }],
  ['mergedPersons', { mapping: { a: false } }]] as const) {
  test(`malformed ${name} does not authorize a local replacement`, async () => {
    await assert.rejects(readProjectSnapshot(reader({ readSetting: async key => key === name ? value : undefined })), /Invalid cloud/);
  });
}

test('legacy data can be read with every research collection, without a migration write', async () => {
  const legacy = Object.freeze(Object.fromEntries(projectCollections.map(name => [name, Object.freeze([{ id: name }])])));
  const result = await readProjectSnapshot(reader({ readLegacy: async () => legacy }));
  assert.deepEqual(result.data, legacy);
});

test('confirmed empty canonical data never reloads a stale legacy tree', async () => {
  const result = await readProjectSnapshot(reader({
    readSetting: async name => name === 'deletedTombstones' ? { ids: [] } : undefined,
    readLegacy: async () => { assert.fail('explicitly empty project must remain empty'); }
  }));
  assert.deepEqual(result.data.persons, []);
});

test('denied optional legacy access permits an empty tree but network errors do not', async () => {
  const result = await readProjectSnapshot(reader({ readLegacy: async () => { throw Object.assign(new Error('legacy denied'), { code: 'permission-denied' }); } }));
  assert.deepEqual(result.data.persons, []);
  await assert.rejects(readProjectSnapshot(reader({ readLegacy: async () => { throw new Error('legacy offline'); } })), /legacy offline/);
});

test('a stale local exclusion filters only the local view and leaves another client’s restored cloud record intact', () => {
  const restoredByOtherClient = Object.freeze(person('restored-on-B'));
  const cloud = Object.freeze([restoredByOtherClient, Object.freeze(person('visible'))]);
  const selected = selectCloudPersons(cloud as unknown as Person[], { excludedIds: new Set(['restored-on-B']) });
  assert.deepEqual(selected.map(item => item.id), ['visible']);
  assert.equal(cloud[0], restoredByOtherClient);
  assert.equal(cloud[0].isDeleted, undefined);
  assert.equal(cloud.length, 2);
});

test('live reads preserve queued local edits and unsent people and deduplicate cloud records', () => {
  const edited = person('edited', 'Локальне ім’я');
  const local = person('local-only');
  const selected = selectCloudPersons([person('edited', 'Старе ім’я'), person('twice'), person('twice')], {
    excludedIds: new Set(), localPersons: [edited, local], pendingIds: new Set(['edited'])
  });
  assert.deepEqual(selected.map(item => item.id), ['edited','twice','local-only']);
  assert.equal(selected[0], edited);
});

test('empty and malformed person lists cannot resurrect excluded, deleted or invalid local records', () => {
  const rows = [null, { id: '' }, { ...person('deleted'), isDeleted: true }, person('excluded')] as Person[];
  assert.deepEqual(selectCloudPersons(rows, { excludedIds: new Set(['excluded']) }), []);
  assert.deepEqual(selectCloudPersons([], { excludedIds: new Set() }), []);
  assert.deepEqual(selectCloudPersons([], { excludedIds: new Set(), localPersons: [person('local')] }).map(p => p.id), ['local']);
});
