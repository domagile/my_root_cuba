import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Person } from '../src/types';
import { computePersonDelta, hasMeaningfulPersonDelta } from '../src/utils/personDelta';
const timestamp = '2026-11-25T10:00:00.000Z';
const person = (): Person & { updatedAt: string } => ({ id: 'p1', gender: 'F', firstName: 'Марія', notes: 'Original', updatedAt: timestamp });

test('unchanged values produce no field changes or new timestamp', () => {
  const before = person();
  const delta = computePersonDelta(before, { ...before });
  assert.deepEqual(delta, { id: before.id });
  assert.equal(hasMeaningfulPersonDelta(delta), false);
});

test('editing one field preserves the minimal delta and supplied timestamp', () => {
  const before = person();
  assert.deepEqual(computePersonDelta(before, { ...before, firstName: 'Олена' }), {
    id: before.id, firstName: 'Олена', updatedAt: timestamp
  });
});

test('unchanged shared nested fields are excluded when another field changes', () => {
  const before = { ...person(), customFields: [{ label: 'Source', value: 'Archive record' }] };
  assert.deepEqual(computePersonDelta(before, { ...before, notes: 'Changed' }), {
    id: before.id, notes: 'Changed', updatedAt: timestamp
  });
});

test('equal nested data in different objects is still excluded', () => {
  const before = { ...person(), customFields: [{ label: 'Source', value: 'Record' }] };
  assert.deepEqual(computePersonDelta(before, { ...before, customFields: [{ label: 'Source', value: 'Record' }] }), { id: before.id });
});

test('changed nested data remains in the delta', () => {
  const before = { ...person(), customFields: [{ label: 'Source', value: 'Original' }] };
  const fields = [{ label: 'Source', value: 'Changed' }];
  assert.deepEqual(computePersonDelta(before, { ...before, customFields: fields }), {
    id: before.id, customFields: fields, updatedAt: timestamp
  });
});

test('removed fields still become null so a merge write clears the stored value', () => {
  const before = person();
  const after = { ...before };
  delete after.notes;
  assert.deepEqual(computePersonDelta(before, after), { id: before.id, notes: null, updatedAt: timestamp });
});

test('null and undefined preserve their existing comparison semantics', () => {
  const before = { ...person(), patronymic: undefined };
  assert.deepEqual(computePersonDelta(before, { ...before, patronymic: null as any }), { id: before.id });
});

test('a new person still produces a full independent object', () => {
  const created = person();
  const delta = computePersonDelta(undefined, created);
  assert.deepEqual(delta, created);
  assert.notEqual(delta, created);
});

test('an updatedAt-only change is ignored', () => {
  const before = person();
  const after = { ...before, updatedAt: 'later' };
  assert.deepEqual(computePersonDelta(before, after), { id: before.id });
});
