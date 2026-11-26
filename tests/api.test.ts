import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApiApp, type ApiOptions } from '../src/server/api';

async function withApi(options: ApiOptions, run: (base: string) => Promise<void>) {
  const app = createApiApp(options);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  try { await run(`http://127.0.0.1:${(server.address() as any).port}`); }
  finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
}
const image = { imageBase64: 'aW1hZ2U=', mimeType: 'image/jpeg' };
const routes = ['/api/ai/analyze-metric', '/api/nyshporka/htr-analyze', '/api/nyshporka/generate-notes'];
const post = (base: string, route: string, body: any) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

for (const route of routes) {
  test(`${route}: missing key returns 503 without fabricated people or notes`, async () => {
    await withApi({ apiKey: '', generateContent: async () => { throw new Error('must not call provider'); } }, async (base) => {
      const response = await post(base, route, image);
      assert.equal(response.status, 503);
      const body = await response.json();
      assert.equal(body.success, false);
      assert.deepEqual(body.results, []);
      assert.equal(body.entities, undefined);
      assert.equal(body.aiNotes, undefined);
    });
  });
}

test('invalid inputs are rejected before any paid provider call', async () => {
  await withApi({ apiKey: 'test', generateContent: async () => { assert.fail('provider called for invalid input'); } }, async (base) => {
    for (const [route, body] of [[routes[0], {}], [routes[1], { documentContext: 'context is not a scan' }], [routes[2], { label: 'title is not content' }],
      [routes[0], { imageBase64: 42 }], [routes[0], { ...image, existingPersons: [null] }], [routes[1], { imageBase64: 'not-base64' }],
      [routes[1], { ...image, mimeType: 'text/html' }], [routes[0], []]] as const) {
      assert.equal((await post(base, route, body)).status, 400);
    }
  });
});

test('malformed provider JSON cannot be reported as an empty successful search', async () => {
  await withApi({ apiKey: 'test', generateContent: async () => ({ text: '{broken' }) }, async (base) => {
    for (const route of routes.slice(0, 2)) {
      const response = await post(base, route, image);
      assert.equal(response.status, 502);
      assert.equal((await response.json()).code, 'INVALID_AI_RESPONSE');
    }
  });
});

test('provider responses with the wrong shape, confidence or empty notes are rejected', async () => {
  for (const [route, text] of [[routes[0], '{}'], [routes[0], '[{"confidence":101}]'], [routes[1], '{}'], [routes[2], ' ']]) {
    await withApi({ apiKey: 'test', generateContent: async () => ({ text }) }, async (base) => {
      assert.equal((await post(base, route, image)).status, 502);
    });
  }
});

test('provider failures are sanitized and never returned as successful analysis', async () => {
  await withApi({ apiKey: 'test', generateContent: async () => { throw new Error('private upstream diagnostic'); } }, async (base) => {
    const response = await post(base, routes[0], image);
    assert.equal(response.status, 502);
    assert.doesNotMatch(await response.text(), /private upstream diagnostic/);
  });
});

test('a stalled provider has a bounded response time', async () => {
  await withApi({ apiKey: 'test', timeoutMs: 10, generateContent: () => new Promise(() => {}) }, async (base) => {
    const response = await post(base, routes[0], image);
    assert.equal(response.status, 504);
    assert.equal((await response.json()).code, 'AI_TIMEOUT');
  });
});

test('valid empty extraction is distinct from a failed extraction', async () => {
  await withApi({ apiKey: 'test', model: 'test-model', generateContent: async (request) => {
    assert.equal(request.model, 'test-model'); return { text: '[]' };
  } }, async (base) => {
    const response = await post(base, routes[0], { textContent: 'No people in this document' });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, source: 'test-model', results: [] });
  });
});

test('HTR sends the scan as multimodal parts and returns only validated fields', async () => {
  await withApi({ apiKey: 'test', generateContent: async (request) => {
    assert.equal((request.contents as any).parts[0].inlineData.data, image.imageBase64);
    return { text: JSON.stringify({ pysarText: 'Original', modernUkrainian: 'Modern', lines: ['Original'], entities: [{ name: 'Candidate' }], arbitraryField: 'not accepted', success: false }) };
  } }, async (base) => {
    const response = await post(base, routes[1], image);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.pysarText, 'Original');
    assert.equal(body.arbitraryField, undefined);
  });
});

test('invalid JSON and unknown API paths return JSON errors, not the application HTML', async () => {
  await withApi({ apiKey: 'test' }, async (base) => {
    assert.equal((await fetch(base + '/api/missing')).status, 404);
    const response = await fetch(base + routes[0], { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, 'INVALID_JSON');
  });
});

test('production API access is checked before parsing a scan or contacting the model', async () => {
  const { AiAccessError } = await import('../src/server/aiAccess'); let providerCalls = 0;
  await withApi({ apiKey: 'test', requireAuth: true, authorize: async () => { throw new AiAccessError(401, 'SIGN_IN_REQUIRED', 'Sign in'); },
    generateContent: async () => { providerCalls++; return { text: '[]' }; } }, async base => {
    for (const route of routes) assert.equal((await post(base, route, image)).status, 401);
    const malformed = await fetch(base + routes[0], { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' });
    assert.equal(malformed.status, 401); assert.equal(providerCalls, 0);
  });
});
test('only configured frontend origins pass preflight and authorization remains required on the actual request', async () => {
  const { AiAccessError } = await import('../src/server/aiAccess');
  await withApi({ apiKey: 'test', requireAuth: true, allowedOrigins: ['https://synthetic.web.app'], authorize: async () => { throw new AiAccessError(401, 'SIGN_IN_REQUIRED', 'Sign in'); } }, async base => {
    const preflight = await fetch(base + routes[0], { method: 'OPTIONS', headers: { Origin: 'https://synthetic.web.app', 'Access-Control-Request-Method': 'POST' } });
    assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), 'https://synthetic.web.app');
    const denied = await fetch(base + routes[0], { method: 'POST', headers: { Origin: 'https://other.example', 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(denied.status, 403); assert.equal(denied.headers.get('Access-Control-Allow-Origin'), null);
    const actual = await fetch(base + routes[0], { method: 'POST', headers: { Origin: 'https://synthetic.web.app', 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(actual.status, 401); assert.equal(actual.headers.get('Access-Control-Allow-Origin'), 'https://synthetic.web.app');
  });
});
test('an authorized request retains the existing model response contract', async () => {
  await withApi({ apiKey: 'test', requireAuth: true, authorize: async header => { assert.equal(header, 'Bearer synthetic-token'); }, generateContent: async () => ({ text: '[]' }) }, async base => {
    const response = await fetch(base + routes[0], { method: 'POST', headers: { Authorization: 'Bearer synthetic-token', 'Content-Type': 'application/json' }, body: JSON.stringify({ textContent: 'Synthetic' }) });
    assert.equal(response.status, 200); assert.deepEqual((await response.json()).results, []);
  });
});
