import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import type { GenealogyDatabase } from '../src/types';
import {
  calculateClassicFamilyTreeLayout, calculateHorizontalFamilyTreeLayout,
  calculateFanChart, clearTreeLayoutCache, clearFanChartCache
} from '../src/rodovid/utils/treeLayout';

function data(): GenealogyDatabase {
  return {
    metadata: { title: 'Synthetic test', lastModified: '2026-01-01T00:00:00.000Z' },
    lastModified: '2026-01-01T00:00:00.000Z',
    persons: {
      root: { id: 'root', firstName: 'Before', lastName: 'Synthetic', gender: 'F', parentFamilyId: 'parents' },
      dad1: { id: 'dad1', firstName: 'First', lastName: 'Synthetic', gender: 'M' },
      dad2: { id: 'dad2', firstName: 'Second', lastName: 'Synthetic', gender: 'M' }
    },
    families: { parents: { id: 'parents', husbandId: 'dad1', children: [], childrenIds: ['root'] } },
    sources: {}, events: {}
  };
}
const renderers = [
  { name: 'vertical tree', render: (db: GenealogyDatabase) => calculateClassicFamilyTreeLayout(db, 'root', 2).nodes },
  { name: 'horizontal tree', render: (db: GenealogyDatabase) => calculateHorizontalFamilyTreeLayout(db, 'root', 2).nodes },
  { name: 'fan chart', render: (db: GenealogyDatabase) => calculateFanChart(db, 'root', 2) }
];
beforeEach(() => clearTreeLayoutCache());

for (const { name, render } of renderers) {
  test(`${name}: editing a person at the same count and timestamp updates the result`, () => {
    const db = data();
    render(db);
    db.persons = { ...db.persons, root: { ...db.persons.root, firstName: 'After' } };
    assert.equal(render(db).find((node) => node.person.id === 'root')!.person.firstName, 'After');
  });

  test(`${name}: independent databases with identical IDs and counts cannot share old people`, () => {
    render(data());
    const another = data();
    another.persons.root.firstName = 'Another database';
    assert.equal(render(another).find((node) => node.person.id === 'root')!.person.firstName, 'Another database');
  });

  test(`${name}: changing a family at the same record count updates parents`, () => {
    const db = data();
    render(db);
    db.families = { parents: { ...db.families.parents, husbandId: 'dad2' } };
    const ids = render(db).map((node) => node.person.id);
    assert.ok(ids.includes('dad2'));
    assert.ok(!ids.includes('dad1'));
  });

  test(`${name}: an explicit version change invalidates in-place changes even with a fixed timestamp`, () => {
    const db = data();
    const previous = render(db);
    db.persons.root = { ...db.persons.root, firstName: 'Versioned' };
    (db as GenealogyDatabase & { version: number }).version = 2;
    const current = render(db);
    assert.notEqual(current, previous);
    assert.equal(current.find((node) => node.person.id === 'root')!.person.firstName, 'Versioned');
  });

  test(`${name}: unchanged data keeps a reusable cached result`, () => {
    const db = data();
    assert.equal(render(db), render(db));
  });
}

test('recently used tree layouts survive eviction of older layouts', () => {
  const db = data();
  const recent = calculateClassicFamilyTreeLayout(db, 'root', 1);
  for (let generation = 2; generation <= 40; generation++) calculateClassicFamilyTreeLayout(db, 'root', generation);
  assert.equal(calculateClassicFamilyTreeLayout(db, 'root', 1), recent);
  calculateClassicFamilyTreeLayout(db, 'root', 41);
  assert.equal(calculateClassicFamilyTreeLayout(db, 'root', 1), recent);
});

test('recently used fan charts survive eviction of older charts', () => {
  const db = data();
  const recent = calculateFanChart(db, 'root', 1);
  for (let generation = 2; generation <= 40; generation++) calculateFanChart(db, 'root', generation);
  assert.equal(calculateFanChart(db, 'root', 1), recent);
  calculateFanChart(db, 'root', 41);
  assert.equal(calculateFanChart(db, 'root', 1), recent);
});

test('fan options in the fourth argument change cached descendant visibility', () => {
  const db = data();
  db.persons.child = { id: 'child', firstName: 'Child', gender: 'U' };
  db.persons.root.spouseFamilyIds = ['children'];
  db.families.children = { id: 'children', wifeId: 'root', children: [], childrenIds: ['child'] };
  calculateFanChart(db, 'root', 2);
  const extended = calculateFanChart(db, 'root', 2, { includeDescendantsAndSpouses: true });
  assert.ok(extended.some((sector) => sector.person.id === 'child'));
});

test('fan color override is resolved before a cached chart is selected', () => {
  const db = data();
  const expected = calculateFanChart(db, 'root', 2, 'gender');
  calculateFanChart(db, 'root', 2, 'clans');
  const colored = calculateFanChart(db, 'root', 2, 'clans', undefined, { colorMode: 'gender' });
  assert.deepEqual(colored, expected);
});

test('zero inner radius is distinct from the default radius', () => {
  const db = data();
  calculateFanChart(db, 'root', 2);
  assert.equal(calculateFanChart(db, 'root', 2, 0)[0].outerRadius, 0);
});

test('zero ring width is distinct from the default ring width', () => {
  const db = data();
  calculateFanChart(db, 'root', 2, 110);
  const parent = calculateFanChart(db, 'root', 2, 110, 0).find((sector) => sector.generation === 1)!;
  assert.equal(parent.innerRadius, parent.outerRadius);
});

test('clearing fan and tree caches causes fresh calculations', () => {
  const db = data();
  const tree = calculateClassicFamilyTreeLayout(db, 'root', 2);
  const fan = calculateFanChart(db, 'root', 2);
  clearFanChartCache();
  assert.notEqual(calculateFanChart(db, 'root', 2), fan);
  assert.equal(calculateClassicFamilyTreeLayout(db, 'root', 2), tree);
  clearTreeLayoutCache();
  assert.notEqual(calculateClassicFamilyTreeLayout(db, 'root', 2), tree);
});
