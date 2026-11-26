import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB } from 'fake-indexeddb';
import { readSavedTreeViewport, treeViewportHasVisibleNode, type SavedTreeViewport } from '../src/utils/treeViewportState';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
  removeItem(key: string) { this.values.delete(key); }
}
const memory = new MemoryStorage();
Object.assign(globalThis, { indexedDB, window: Object.assign(new EventTarget(), { indexedDB }), localStorage: memory });
const storage = await import('../src/utils/indexedDbStorage');
const { getSavedUserTreeState, saveUserTreeState, clearUserTreeState } = await import('../src/utils/userTreeState');
afterEach(async () => { await storage.flushPendingLocalWrites(); });
const viewport = (pan = { x: 10, y: 20 }): SavedTreeViewport => ({ version: 1, personId: 'root', pan, scale: 1.2 });

test('versioned cameras retain valid zero and historical placeholder positions', () => {
  for (const pan of [{ x: 0, y: 0 }, { x: 80, y: 80 }, { x: -1000.5, y: 250 }]) {
    assert.deepEqual(readSavedTreeViewport({ viewport: viewport(pan) }, 'root'), viewport(pan));
  }
});
test('legacy cameras remain readable, excluding their old uncentered placeholders', () => {
  assert.equal(readSavedTreeViewport({ selectedPersonId: 'root', pan: { x: 0, y: 0 }, scale: 1 }, 'root'), null);
  assert.equal(readSavedTreeViewport({ selectedPersonId: 'root', pan: { x: 80, y: 80 }, scale: 1 }, 'root'), null);
  assert.deepEqual(readSavedTreeViewport({ selectedPersonId: 'root', pan: { x: 10, y: 20 }, scale: 1.2 }, 'root'), viewport());
});
test('a changed selection cannot give a new root the previous camera', () => {
  assert.equal(readSavedTreeViewport({ selectedPersonId: 'child', viewport: viewport() }, 'child'), null);
  assert.equal(readSavedTreeViewport({ selectedPersonId: 'removed', pan: { x: 10, y: 20 }, scale: 1 }, 'root'), null);
});
test('corrupt cameras and unsupported versions do not fall back to stale legacy fields', () => {
  for (const value of [null, [], { ...viewport(), version: 2 }, { ...viewport(), scale: 1e-308 }, { ...viewport(), scale: 3 },
    { ...viewport(), scale: NaN }, { ...viewport(), pan: { x: 1, y: null } }, { ...viewport(), pan: { x: '1', y: 2 } },
    { ...viewport(), pan: { x: Infinity, y: 0 } }]) {
    assert.equal(readSavedTreeViewport({ selectedPersonId: 'root', pan: { x: 10, y: 20 }, scale: 1, viewport: value }, 'root'), null);
  }
});
test('camera visibility accepts partly visible relatives and rejects a completely empty viewport', () => {
  const nodes = [{ x: 100, y: 200, width: 176, height: 192 }];
  const size = { width: 360, height: 740 };
  assert.equal(treeViewportHasVisibleNode(viewport({ x: 0, y: 0 }), nodes, size), true);
  assert.equal(treeViewportHasVisibleNode(viewport({ x: -200, y: 0 }), nodes, size), true);
  assert.equal(treeViewportHasVisibleNode(viewport({ x: -5000, y: 0 }), nodes, size), false);
  assert.equal(treeViewportHasVisibleNode(viewport(), [], size), false);
});
test('successive preference writes read pending state before its durable commit', () => {
  saveUserTreeState('pending@example.invalid', { selectedPersonId: 'root', viewport: viewport(), scale: 1.2 });
  saveUserTreeState('pending@example.invalid', { selectedPersonId: 'child' });
  const saved = getSavedUserTreeState('pending@example.invalid')!;
  assert.equal(saved.selectedPersonId, 'child');
  assert.deepEqual(saved.viewport, viewport());
  assert.equal(readSavedTreeViewport(saved, 'child'), null);
});
test('preferences are scoped to normalized user emails', () => {
  saveUserTreeState(' USER-A@example.invalid ', { selectedPersonId: 'root', viewport: viewport() });
  saveUserTreeState('user-b@example.invalid', { selectedPersonId: 'other' });
  assert.deepEqual(getSavedUserTreeState('user-a@example.invalid')?.viewport, viewport());
  assert.equal(getSavedUserTreeState('user-b@example.invalid')?.selectedPersonId, 'other');
  assert.equal(getSavedUserTreeState('new-user@example.invalid'), null);
});
test('versioned zero pan survives a durable commit and its localStorage mirror', async () => {
  saveUserTreeState('zero@example.invalid', { selectedPersonId: 'root', pan: { x: 0, y: 0 }, viewport: viewport({ x: 0, y: 0 }) });
  await storage.flushPendingLocalWrites();
  const saved = JSON.parse(memory.getItem('rodovid_user_tree_state_zero@example.invalid')!);
  assert.deepEqual(saved.pan, { x: 0, y: 0 });
  assert.deepEqual(readSavedTreeViewport(saved, 'root'), viewport({ x: 0, y: 0 }));
});
test('filtering legacy placeholders does not mutate the pending storage snapshot', () => {
  const key = 'rodovid_user_tree_state_legacy@example.invalid';
  storage.persistLocalData(key, { selectedPersonId: 'root', pan: { x: 0, y: 0 } });
  assert.equal(getSavedUserTreeState('legacy@example.invalid')?.pan, undefined);
  assert.deepEqual(storage.readLocalDataSync<any>(key).pan, { x: 0, y: 0 });
});
test('malformed saved preferences are ignored', () => {
  memory.setItem('rodovid_user_tree_state_bad-json@example.invalid', '{');
  memory.setItem('rodovid_user_tree_state_bad-shape@example.invalid', '[]');
  assert.equal(getSavedUserTreeState('bad-json@example.invalid'), null);
  assert.equal(getSavedUserTreeState('bad-shape@example.invalid'), null);
});
test('clearing preferences supersedes an earlier queued save without clearing another user', async () => {
  saveUserTreeState('clear@example.invalid', { selectedPersonId: 'root', viewport: viewport() });
  saveUserTreeState('keep@example.invalid', { selectedPersonId: 'other' });
  clearUserTreeState('clear@example.invalid');
  assert.equal(getSavedUserTreeState('clear@example.invalid'), null);
  await storage.flushPendingLocalWrites();
  assert.equal(getSavedUserTreeState('clear@example.invalid'), null);
  assert.equal(getSavedUserTreeState('keep@example.invalid')?.selectedPersonId, 'other');
});
