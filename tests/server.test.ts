import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
const entry = fileURLToPath(new URL('../dist/server.mjs', import.meta.url));

async function availablePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as any).port as number;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}
function launch(port: number | string) {
  const env: NodeJS.ProcessEnv = { ...process.env, HOST: '127.0.0.1', PORT: String(port), GEMINI_API_KEY: '' };
  delete env.NODE_ENV;
  return spawn(process.execPath, [entry], { cwd: os.tmpdir(), env, stdio: ['ignore', 'pipe', 'pipe'] });
}

test('built server starts in production without NODE_ENV and serves deep links outside the project directory', { timeout: 15_000 }, async () => {
  const port = await availablePort();
  const child = launch(port);
  let logs = '';
  child.stdout.on('data', (chunk) => { logs += chunk; });
  child.stderr.on('data', (chunk) => { logs += chunk; });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Startup timed out: ${logs}`)), 10_000);
      child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Server exited ${code}: ${logs}`)); });
      child.stdout.on('data', () => { if (logs.includes('Listening on')) { clearTimeout(timer); resolve(); } });
    });
    const base = `http://127.0.0.1:${port}`;
    const health = await fetch(base + '/api/health');
    assert.equal(health.status, 200);
    const unauthorized = await fetch(base + '/api/ai/analyze-metric', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(unauthorized.status, 401);
    await unauthorized.arrayBuffer();
    const serverSource = await (await fetch(base + '/server.mjs')).text();
    assert.doesNotMatch(serverSource, /function createApiApp|GEMINI_API_KEY|identitytoolkit.googleapis.com/);

    await health.arrayBuffer();
    const html = await (await fetch(base + '/?personId=test')).text();
    assert.match(html, /\/assets\//);
    assert.doesNotMatch(html, /@vite\/client/);
    const asset = html.match(/src="([^\"]+\.js)"/)![1];
    const script = await fetch(base + asset);
    assert.equal(script.status, 200);
    // Finish consuming streamed responses before checking graceful shutdown.
    await script.arrayBuffer();
    const missing = await fetch(base + '/api/unknown');
    assert.equal(missing.status, 404);
    await missing.arrayBuffer();
  } finally {
    const exit = once(child, 'exit');
    child.kill('SIGTERM');
    const [code] = await exit;
    assert.equal(code, 0, logs);
  }
});

test('invalid port produces a failed exit for a process supervisor', { timeout: 10_000 }, async () => {
  const child = launch('not-a-port');
  let logs = '';
  child.stderr.on('data', (chunk) => { logs += chunk; });
  const [code] = await once(child, 'exit');
  assert.equal(code, 1);
  assert.match(logs, /PORT must be an integer/);
});

test('an occupied port produces a failed exit instead of a falsely healthy process', { timeout: 10_000 }, async () => {
  const blocker = createServer();
  blocker.listen(0, '127.0.0.1');
  await once(blocker, 'listening');
  try {
    const child = launch((blocker.address() as any).port);
    const [code] = await once(child, 'exit');
    assert.equal(code, 1);
  } finally { await new Promise<void>((resolve) => blocker.close(() => resolve())); }
});
