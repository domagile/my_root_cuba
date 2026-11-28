import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authorizeAiRequest, AiAccessError } from '../src/server/aiAccess';
const profile = { localId: 'synthetic-user', email: 'member@example.com', emailVerified: true };
const membership = (role = 'editor', status = 'active', email = profile.email) => ({ fields: {
  email: { stringValue: email }, role: { stringValue: role }, status: { stringValue: status }
} });
const denied = (status: number) => (error: unknown) => error instanceof AiAccessError && error.status === status;
function requests(user = profile, row: unknown = membership(), httpStatus = 200) {
  const calls: any[] = [];
  const request = async (url: any, init: any) => {
    calls.push({ url, init });
    return calls.length === 1 ? Response.json({ users: [user] }) : Response.json(row, { status: httpStatus });
  };
  return { request: request as typeof fetch, calls };
}
test('missing, malformed and oversized credentials are rejected without contacting Google', async () => {
  for (const header of [undefined, '', 'Basic token', 'Bearer a b', 'Bearer ' + 'x'.repeat(8193)]) {
    await assert.rejects(authorizeAiRequest(header, { request: async () => assert.fail('unexpected request') }), denied(401));
  }
});
test('Google validates the ID token before an authorized member can use AI', async () => {
  const server = requests(); await authorizeAiRequest('Bearer synthetic-token', server);
  assert.match(server.calls[0].url, /^https:\/\/identitytoolkit.googleapis.com\/v1\/accounts:lookup\?key=/);
  assert.deepEqual(JSON.parse(server.calls[0].init.body), { idToken: 'synthetic-token' });
  assert.match(server.calls[1].url, /\/projects\/defaultProject\/whitelist\/member_example_com$/);
  assert.equal(server.calls[1].init.headers.Authorization, 'Bearer synthetic-token');
});
for (const role of ['admin', 'editor', 'researcher']) test(`${role}: active verified members can use AI`, async () => {
  await authorizeAiRequest('Bearer synthetic-token', requests(profile, membership(role)));
});
for (const role of ['viewer', 'guest', 'unknown']) test(`${role}: a read-only or unsupported role cannot spend the AI key`, async () => {
  await assert.rejects(authorizeAiRequest('Bearer synthetic-token', requests(profile, membership(role))), denied(403));
});
test('suspended membership, a conflicting email and an unverified account are rejected', async () => {
  await assert.rejects(authorizeAiRequest('Bearer token', requests(profile, membership('admin', 'suspended'))), denied(403));
  await assert.rejects(authorizeAiRequest('Bearer token', requests(profile, membership('admin', 'active', 'different@example.com'))), denied(403));
  await assert.rejects(authorizeAiRequest('Bearer token', requests({ ...profile, emailVerified: false })), denied(403));
});
test('the existing verified owners follow the same defaultProject exception as Firestore rules', async () => {
  const owner = requests({ ...profile, email: 'DOMAGILE@gmail.com' }); await authorizeAiRequest('Bearer token', owner);
  assert.equal(owner.calls.length, 1);
});
test('expired or foreign credentials rejected by Google never reach membership or AI calls', async () => {
  let calls = 0;
  await assert.rejects(authorizeAiRequest('Bearer token', { request: async () => { calls++; return Response.json({}, { status: 400 }); } }), denied(401));
  assert.equal(calls, 1);
});
test('missing or inaccessible membership does not grant access', async () => {
  for (const status of [401, 403, 404]) await assert.rejects(authorizeAiRequest('Bearer token', requests(profile, {}, status)), denied(403));
});
test('Google/Firestore failure, malformed response and a stalled check fail closed with sanitized errors', async () => {
  for (const request of [async () => Response.json({}, { status: 503 }), async () => new Response('broken'), async () => { throw new Error('private diagnostic'); }]) {
    await assert.rejects(authorizeAiRequest('Bearer token', { request: request as typeof fetch }), error => denied(503)(error) && !String(error).includes('private diagnostic'));
  }
  await assert.rejects(authorizeAiRequest('Bearer token', { timeoutMs: 5, request: async (_url, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('private timeout')), { once: true });
  }) }), denied(503));
});
