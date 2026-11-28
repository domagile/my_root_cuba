import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const image = process.argv[2];
if (!image || !/^[a-zA-Z0-9_./:@-]+$/.test(image)) throw new Error('Specify a production image');
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
const id = docker('run', '--detach', '--publish', '127.0.0.1::8080', image);
try {
  const port = docker('port', id, '8080/tcp').match(/^127\.0\.0\.1:(\d+)$/)?.[1];
  if (!port) throw new Error('No loopback container port');
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try { const response = await fetch(base + '/api/health', { signal: AbortSignal.timeout(1000) }); ready = response.ok; await response.arrayBuffer(); if (ready) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, 'Container never became healthy');
  const response = await fetch(base + '/?personId=synthetic');
  assert.equal(response.status, 200); const html = await response.text();
  assert.match(html, /\/assets\//); assert.doesNotMatch(html, /@vite\/client/);
  const asset = html.match(/src="([^"]+\.js)"/)?.[1]; assert.ok(asset);
  const script = await fetch(base + asset); assert.equal(script.status, 200); await script.arrayBuffer();
  const denied = await fetch(base + '/api/ai/analyze-metric', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(denied.status, 401); await denied.arrayBuffer();
  const source = await (await fetch(base + '/server.mjs')).text(); assert.doesNotMatch(source, /GEMINI_API_KEY|function createApiApp/);
  assert.notEqual(docker('exec', id, 'id', '-u'), '0', 'Production container runs as root');
  console.log('Production container: HTTP, assets, authenticated API, private server code and non-root user verified.');
} finally { docker('rm', '--force', id); }
