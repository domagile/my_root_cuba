import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const output = process.env.TREE_BROWSER_OUTPUT || path.join(root, 'artifacts', 'ignored-duplicates-browser');
await mkdir(output, { recursive: true });
const server = await createServer({ root, cacheDir: path.join(output, '.vite'),
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'lucide-react', 'zustand'] },
  server: { host: '127.0.0.1', port: 0, open: false, hmr: false } });
const results = [], errors = [], external = [];
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1500, height: 1050 }, serviceWorkers: 'block' });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin || url.protocol === 'data:') return route.continue();
    external.push(url.origin); return route.abort();
  });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
  const ready = () => page.waitForFunction(() => document.querySelector('[data-testid="ready"]')?.textContent === 'ready');
  const count = value => page.waitForFunction(value => document.querySelector('[data-testid="count"]')?.textContent === String(value), value);
  const stats = () => page.evaluate(() => window.ignoredQA.stats());
  async function check(name, run) { await run(); results.push({ name, status: 'PASS' }); }
  await page.goto(origin + '/tests/browser/ignored-duplicates.html'); await ready(); await count(1);
  await check('the real not-a-duplicate button hides the pair without merging people or uploading in manual mode', async () => {
    await page.getByRole('button', { name: 'Порівняти осіб', exact: true }).click();
    await page.getByRole('button', { name: 'Не дублікат', exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, 'choice.png') });
    await page.getByRole('button', { name: 'Не дублікат', exact: true }).click(); await count(0);
    const value = await stats(); assert.equal(value.callbacks, 1); assert.equal(value.merges, 0);
    assert.equal(value.persons, 2); assert.equal(value.uploads, 0); assert.ok(value.pending > 0);
  });
  await check('a repeat scan and old empty cloud list do not restore the suggestion', async () => {
    await page.evaluate(() => { window.ignoredQA.cloud({ keys: [], revision: 0 }); window.ignoredQA.rescan(); }); await count(0);
  });
  await check('the dismissal survives a real page reload before a cloud acknowledgement', async () => {
    await page.reload(); await ready(); await count(0); assert.ok((await stats()).pending > 0);
  });
  await check('explicit manual upload acknowledges the choice and an older download stays ignored', async () => {
    assert.equal((await page.evaluate(() => window.ignoredQA.upload())).success, true);
    assert.equal((await stats()).pending, 0);
    await page.evaluate(() => window.ignoredQA.cloud({ keys: [], revision: 0 })); await count(0);
  });
  await check('the explicit undo remains usable and stale snapshots cannot cancel it', async () => {
    const old = (await stats()).server;
    await page.evaluate(() => window.ignoredQA.undo()); await count(1);
    await page.evaluate(snapshot => window.ignoredQA.cloud(snapshot), old); await count(1);
    assert.equal((await page.evaluate(() => window.ignoredQA.upload())).success, true);
    await page.evaluate(snapshot => window.ignoredQA.cloud(snapshot), old); await count(1);
  });
  await page.goto(origin + '/tests/browser/ignored-duplicates.html?fallback=1'); await ready(); await count(1);
  await check('the modal fallback also persists not-a-duplicate when no parent callback is supplied', async () => {
    await page.getByRole('button', { name: 'Порівняти осіб', exact: true }).click();
    await page.getByRole('button', { name: 'Не дублікат', exact: true }).click(); await count(0);
    assert.equal((await stats()).callbacks, 0); assert.equal((await stats()).merges, 0);
  });
  await check('a failed cloud write retains the dismissal for reload and retry', async () => {
    await page.evaluate(() => window.ignoredQA.fail(true));
    assert.equal((await page.evaluate(() => window.ignoredQA.upload())).success, false);
    await count(0); assert.ok((await stats()).pending > 0);
    await page.reload(); await ready(); await count(0);
    assert.equal((await page.evaluate(() => window.ignoredQA.upload())).success, true);
    assert.equal((await stats()).pending, 0);
  });
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  const report = { browser: await browser.version(), results, pageErrors: errors, externalRequests: external,
    component: 'real SmartMergeModal and duplicate detection; synthetic people and controlled cloud adapter' };
  await writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
} catch (error) {
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ results, pageErrors: errors, externalRequests: external, error: error.message }, null, 2) + '\n'); throw error;
} finally { await browser?.close(); await server.close(); }
