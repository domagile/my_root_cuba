import { test } from 'node:test';
import assert from 'node:assert/strict';
import { removeFamilyMemberships, restoreFamilyMemberships } from '../src/services/familyRestoreService';
import type { Family } from '../src/types';
import { serializeFamilyForCloud } from '../src/utils/familyCloudData';
const family = (): Family => ({ id: 'f', husbandId: 'dad', wifeId: 'mom', marriageDate: '1900',
  children: [{ personId: 'a', relationType: 'adopted' }, { personId: 'b' }, { personId: 'c' }], childrenIds: ['a','b','c'] });

test('removal captures parent and both child representations without changing unrelated families or input', () => {
  const input = { f: family(), unrelated: { ...family(), id: 'unrelated', husbandId: 'other' } };
  const result = removeFamilyMemberships(input, new Set(['dad']));
  assert.equal(result.families.f.husbandId, undefined);
  assert.equal(input.f.husbandId, 'dad');
  assert.equal(result.families.unrelated, input.unrelated);
  assert.deepEqual(result.history.dad.map(link => link.familyId), ['f']);
  assert.deepEqual(result.changedIds, ['f']);
});

test('restore returns spouses, adopted child metadata and original child order after a bulk deletion', () => {
  const initial = { f: family() };
  const removed = removeFamilyMemberships(initial, new Set(['dad','mom','a','b']));
  const restored = restoreFamilyMemberships(removed.families, removed.history, ['b','mom','a','dad']);
  assert.deepEqual(restored.families, initial);
  assert.deepEqual(restored.remaining, {});
  assert.equal(restored.skippedFamilyLinks, 0);
});

test('restoration preserves family edits and a newly added child', () => {
  const removed = removeFamilyMemberships({ f: family() }, new Set(['dad','a']));
  const current = { f: { ...removed.families.f, marriageDate: 'Corrected date', notes: 'New note',
    children: [...removed.families.f.children, { personId: 'new' }], childrenIds: [...removed.families.f.childrenIds!, 'new'] } };
  const restored = restoreFamilyMemberships(current, removed.history, ['dad','a']);
  assert.equal(restored.families.f.marriageDate, 'Corrected date');
  assert.equal(restored.families.f.notes, 'New note');
  assert.deepEqual(restored.families.f.childrenIds, ['a','b','c','new']);
});

test('an occupied spouse slot is preserved and its unresolved history remains available', () => {
  const removed = removeFamilyMemberships({ f: family() }, new Set(['dad']));
  const current = { f: { ...removed.families.f, husbandId: 'new-husband' } };
  const result = restoreFamilyMemberships(current, removed.history, ['dad']);
  assert.equal(result.families, current);
  assert.equal(result.families.f.husbandId, 'new-husband');
  assert.equal(result.skippedFamilyLinks, 1);
  assert.deepEqual(result.remaining, removed.history);
});

test('a deleted family is not recreated during person restoration', () => {
  const removed = removeFamilyMemberships({ f: family() }, new Set(['dad']));
  const result = restoreFamilyMemberships({}, removed.history, ['dad']);
  assert.deepEqual(result.families, {});
  assert.equal(result.skippedFamilyLinks, 1);
  assert.deepEqual(result.remaining, removed.history);
});

test('existing child metadata and ordering are preserved without duplication on retries', () => {
  const removed = removeFamilyMemberships({ f: family() }, new Set(['a']));
  const current = { f: family() };
  current.f.children[0] = { personId: 'a', relationType: 'corrected' };
  const restored = restoreFamilyMemberships(current, removed.history, ['a','a']);
  assert.equal(restored.families, current);
  assert.equal(restored.families.f.children[0].relationType, 'corrected');
  assert.deepEqual(restored.remaining, {});
});

test('legacy trash with no relation history restores no guessed families', () => {
  const current = { f: family() };
  const result = restoreFamilyMemberships(current, {}, ['legacy']);
  assert.equal(result.families, current);
  assert.equal(result.skippedFamilyLinks, 0);
});

test('restoring one child leaves the other removed membership available for a later restore', () => {
  const initial = { f: family() };
  const removed = removeFamilyMemberships(initial, new Set(['a','b']));
  const first = restoreFamilyMemberships(removed.families, removed.history, ['b']);
  assert.deepEqual(first.families.f.childrenIds, ['b','c']);
  assert.ok(first.remaining.a);
  const second = restoreFamilyMemberships(first.families, first.remaining, ['a']);
  assert.deepEqual(second.families, initial);
});

test('cloud family serialization clears an explicitly removed parent without clearing omitted fields', () => {
  assert.deepEqual(serializeFamilyForCloud({ id: 'f', husbandId: undefined, wifeId: 'mom', children: [] }),
    { id: 'f', husbandId: null, wifeId: 'mom', children: [] });
  assert.deepEqual(serializeFamilyForCloud({ id: 'f', notes: 'partial' }), { id: 'f', notes: 'partial' });
});
