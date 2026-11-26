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

test('authenticated AI requests carry the current ID token only to a configured API origin', async () => {
  const { setAiTokenProvider } = await import('../src/services/aiApiClient');
  setAiTokenProvider(async () => 'synthetic-id-token');
  try {
    globalThis.fetch = async (url, init) => { assert.equal(url, '/api/test'); assert.equal((init?.headers as any).Authorization, 'Bearer synthetic-id-token'); return Response.json({ success: true }); };
    await requestAiJson('/api/test', {});
  } finally { setAiTokenProvider(null); }
});
test('an unavailable or stalled login cannot send an anonymous paid request', async () => {
  const { setAiTokenProvider } = await import('../src/services/aiApiClient');
  globalThis.fetch = async () => assert.fail('Unexpected API call');
  try {
    setAiTokenProvider(async () => { throw new Error('Sign in required'); }); await assert.rejects(requestAiJson('/api/test', {}), /Sign in/);
    setAiTokenProvider(() => new Promise(() => {})); await assert.rejects(requestAiJson('/api/test', {}, 5), /очікування/);
  } finally { setAiTokenProvider(null); }
});
test('a configured AI origin requires HTTPS and cannot redirect the Firebase ID token to an arbitrary endpoint', async () => {
  const { resolveAiEndpoint } = await import('../src/services/aiApiClient');
  assert.equal(resolveAiEndpoint('/api/ai/analyze-metric', 'https://synthetic.run.app'), 'https://synthetic.run.app/api/ai/analyze-metric');
  for (const base of ['http://other.example', 'https://user:password@other.example', 'https://other.example/path', 'https://other.example?key=value']) assert.throws(() => resolveAiEndpoint('/api/test', base));
  for (const endpoint of ['https://other.example/api/test', '//other.example/api/test', '/login']) assert.throws(() => resolveAiEndpoint(endpoint, 'https://synthetic.run.app'));
});
