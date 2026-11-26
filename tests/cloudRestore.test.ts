import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareCloudRestore } from '../src/services/cloudRestoreService';
import type { ProjectSyncData } from '../src/services/cloudSyncService';
function data(): ProjectSyncData {
  return { persons: [], families: {}, sources: {}, events: {}, places: {}, metricRecords: [], documents: [], tasks: [], findings: [], hypotheses: [], requests: [], matrixEntries: [], trashPersons: [] };
}

test('failed local backup blocks a cloud replacement before reading the cloud', async () => {
  await assert.rejects(prepareCloudRestore(data, async () => null, async () => { assert.fail('cloud must not be read'); }), /резервну точку/);
});

test('a local edit while reading the cloud prevents replacement with the old snapshot', async () => {
  let state = data();
  await assert.rejects(prepareCloudRestore(() => state, async () => ({ saved: true }), async () => {
    state = { ...state, persons: [{ id: 'new-local-edit', gender: 'U' }] };
    return { remote: true };
  }), /локальні зміни/);
  assert.equal(state.persons[0].id, 'new-local-edit');
});

test('unchanged local data with a committed backup permits a cloud restore', async () => {
  const state = data();
  const remote = { persons: [{ id: 'remote' }] };
  assert.equal(await prepareCloudRestore(() => state, async () => ({ saved: true }), async () => remote), remote);
});

test('unconfirmed deletion or restoration blocks replacement before backup and cloud reading', async () => {
  await assert.rejects(prepareCloudRestore(data,
    async () => { assert.fail('must not start a backup for blocked replacement'); },
    async () => { assert.fail('must not read'); }, () => true), /невивантажені/);
});

test('a new deletion intention during the read blocks replacement even if entity references did not change', async () => {
  const state = data();
  let pending = false;
  await assert.rejects(prepareCloudRestore(() => state, async () => true,
    async () => { pending = true; return {}; }, () => pending), /невивантажені/);
});
