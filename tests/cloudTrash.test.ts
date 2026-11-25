import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcileCloudTrash } from '../src/services/cloudTrashService';
import type { Person } from '../src/types';
const person = (id: string): Person => ({ id, firstName: 'Марія', lastName: 'Тестова', gender: 'F' });
const trashed = (id: string): Person => ({ ...person(id), isDeleted: true, deletedAt: '2026-11-25' });

test('a confirmed active record and removed server marker release a stale local trash entry', () => {
  const state = { persons: [person('local')], trashPersons: [trashed('restored'), trashed('keep')] };
  const next = reconcileCloudTrash(state, ['keep'], [person('restored')]);
  assert.deepEqual(next.persons.map(p => p.id), ['local','restored']);
  assert.deepEqual(next.trashPersons.map(p => p.id), ['keep']);
  assert.equal(next.persons[1].isDeleted, false);
  assert.equal(state.trashPersons.length, 2);
});

test('an absent marker alone cannot resurrect a trashed person with no confirmed active document', () => {
  const state = { persons: [], trashPersons: [trashed('missing')] };
  assert.equal(reconcileCloudTrash(state, [], []), state);
  assert.equal(reconcileCloudTrash(state, [], [trashed('missing')]), state);
});

test('pending local deletion wins over an old active remote record', () => {
  const state = { persons: [], trashPersons: [trashed('pending')] };
  assert.equal(reconcileCloudTrash(state, [], [person('pending')], { pending: { deleted: true, token: 'newer' } }), state);
});

test('pending local restoration wins over the old confirmed server marker', () => {
  const state = { persons: [person('pending')], trashPersons: [] };
  assert.equal(reconcileCloudTrash(state, ['pending'], [], { pending: { deleted: false, token: 'newer' } }), state);
});

test('merged duplicates remain excluded even when a stale cloud document exists', () => {
  const state = { persons: [], trashPersons: [trashed('merged')] };
  assert.equal(reconcileCloudTrash(state, [], [person('merged')], {}, new Set(['merged'])), state);
});

test('a confirmed remote deletion keeps a local recoverable copy and is idempotent', () => {
  const state = { persons: [person('deleted'), person('keep')], trashPersons: [] };
  const next = reconcileCloudTrash(state, ['deleted'], [], {}, new Set(), 'known-time');
  assert.deepEqual(next.persons.map(p => p.id), ['keep']);
  assert.deepEqual(next.trashPersons, [{ ...person('deleted'), isDeleted: true, deletedAt: 'known-time' }]);
  assert.equal(reconcileCloudTrash(next, ['deleted']), next);
});

test('a partial active snapshot leaves unrelated trash intact', () => {
  const state = { persons: [], trashPersons: [trashed('seen'), trashed('unseen')] };
  const next = reconcileCloudTrash(state, [], [person('seen')]);
  assert.deepEqual(next.trashPersons.map(p => p.id), ['unseen']);
});

test('a person missing from the remote collection is not considered deleted', () => {
  const state = { persons: [person('local-only')], trashPersons: [] };
  assert.equal(reconcileCloudTrash(state, [], []), state);
});

test('an already active record is preserved when removing its stale trash duplicate', () => {
  const active = { ...person('same'), firstName: 'Newer local' };
  const next = reconcileCloudTrash({ persons: [active], trashPersons: [trashed('same')] }, [], [person('same')]);
  assert.equal(next.persons.length, 1);
  assert.equal(next.persons[0], active);
  assert.equal(next.trashPersons.length, 0);
});

test('two independent client states converge after deletion and restoration without mutating the original states', () => {
  const originalA = { persons: [person('p')], trashPersons: [] };
  const originalB = { persons: [person('p')], trashPersons: [] };
  const deletedA = reconcileCloudTrash(originalA, ['p']);
  const deletedB = reconcileCloudTrash(originalB, ['p']);
  const restoredA = reconcileCloudTrash(deletedA, [], [person('p')]);
  const restoredB = reconcileCloudTrash(deletedB, [], [person('p')]);
  assert.deepEqual(restoredA, restoredB);
  assert.equal(originalA.persons[0].isDeleted, undefined);
  assert.equal(originalB.trashPersons.length, 0);
  assert.equal(restoredA.trashPersons.length, 0);
});
