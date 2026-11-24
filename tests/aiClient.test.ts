import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { requestAiJson } from '../src/services/aiApiClient';
import { aiEntityToPerson } from '../src/utils/aiEntityToPerson';
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('client refuses HTTP failures, explicit failures and demo data', async () => {
  for (const [status, body] of [[503, { error: 'AI unavailable' }], [200, { success: false }], [200, { success: true, fallback: true }]] as const) {
    globalThis.fetch = async () => new Response(JSON.stringify(body), { status });
    await assert.rejects(requestAiJson('/api/test', {}));
  }
});

test('client reports malformed responses instead of saving them', async () => {
  globalThis.fetch = async () => new Response('<html>wrong server</html>');
  await assert.rejects(requestAiJson('/api/test', {}), /некоректну/);
});

test('client cancels a stalled HTTP request', async () => {
  globalThis.fetch = async (_url, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
  });
  await assert.rejects(requestAiJson('/api/test', {}, 10), /очікування/);
});

test('AI candidates have no fabricated birth date, place, sex or confirmed status', () => {
  const person = aiEntityToPerson({ name: 'Коваленко Марія', year: '1822', place: 'Парафія' }, 'Scan 12');
  assert.equal(person.researchStatus, 'needs_verification');
  assert.equal(person.birthYear, undefined);
  assert.equal(person.birthPlace, undefined);
  assert.equal(person.isLiving, undefined);
  assert.equal(person.gender, 'U');
  assert.match(person.notes!, /1822/);
  assert.match(person.notes!, /Парафія/);
  assert.throws(() => aiEntityToPerson({}, 'Scan'), /імені/);
});
