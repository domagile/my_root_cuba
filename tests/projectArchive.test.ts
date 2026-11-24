import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProjectArchive, parseProjectArchive } from '../src/utils/projectArchive';

test('archive round-trip preserves people, family links, sources, events, places and research collections', () => {
  const data = {
    persons: [{ id: 'p1', name: { given: 'Марія' } }, { id: 'p2' }],
    families: { f1: { id: 'f1', children: ['p1'], husband: 'p2' } },
    sources: { s1: { id: 's1', title: 'Document' } }, events: { e1: { id: 'e1', personId: 'p1' } },
    places: { village: { id: 'village', notes: 'Village research' } },
    metricRecords: [{ id: 'record-id' }], documents: [{ id: 'document-id' }], tasks: [], findings: [], hypotheses: [], requests: [], matrixEntries: []
  };
  assert.deepEqual(parseProjectArchive(JSON.stringify(createProjectArchive(data))), data);
});

test('old v2 archives preserve missing sections as missing rather than erasing current data', () => {
  assert.deepEqual(parseProjectArchive('{"version":"2.0","persons":[{"id":"p1"}]}'), { persons: [{ id: 'p1' }] });
});

test('local snapshot researchData is restored alongside tree data', () => {
  assert.deepEqual(parseProjectArchive(JSON.stringify({ persons: [], families: {}, researchData: { documents: [{ id: 'doc' }], tasks: [] } })),
    { persons: [], families: {}, documents: [{ id: 'doc' }], tasks: [] });
});

test('every section is structurally checked before returning data for import', () => {
  for (const data of [null, [], {}, { persons: [null] }, { persons: [{}] }, { persons: [], families: [] },
    { persons: [], sources: { s1: null } }, { persons: [], researchData: [] }, { persons: [], tasks: 'wrong' }, { version: 'future', persons: [] }]) {
    assert.throws(() => parseProjectArchive(JSON.stringify(data)));
  }
});

test('archive exports never include integration secrets or access-control settings', () => {
  const archive = createProjectArchive({ persons: [], gitConfig: { token: 'private' }, whitelist: [{ role: 'admin' }], accessConfig: { pinCode: 'private' } } as any);
  assert.doesNotMatch(JSON.stringify(archive), /private|gitConfig|whitelist|accessConfig/);
});
