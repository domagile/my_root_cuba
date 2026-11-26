import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('..', import.meta.url)), output = process.env.TREE_BROWSER_OUTPUT || path.join(root, 'artifacts', 'safe-merge-browser');
await mkdir(output, { recursive: true });
const stub = path.join(root, 'tests/browser/safe-merge-adapters.ts');
const server = await createServer({ root, cacheDir: path.join(output, '.vite'),
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'lucide-react', 'zustand'] },
  resolve: { alias: [/^.*useAuthStore$/, /^.*\/context\/GenealogyContext$/, /^.*\/lib\/firebase$/, /^.*\/services\/githubService$/, /^.*\/components\/Tree\/PersonDetailModal$/].map(find => ({ find, replacement: stub })) },
  server: { host: '127.0.0.1', port: 0, open: false, hmr: false } });
const results = [], errors = [], external = [];
let browser;
try {
  await server.listen(); const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true });
  async function check(name, view, run) {
    const context = await browser.newContext({ viewport: { width: 1500, height: 1050 }, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === origin || url.protocol === 'data:') return route.continue(); external.push(url.origin); return route.abort();
    });
    const page = await context.newPage(); page.setDefaultTimeout(12000);
    page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
    try {
      await page.goto(origin + '/tests/browser/safe-merge.html?view=' + view);
      await page.waitForFunction(() => document.querySelector('[data-testid="ready"]')?.textContent === 'ready');
      await run(page); results.push({ name, status: 'PASS' });
    } catch (error) { console.log(JSON.stringify({ name, error: error.message, pageErrors: errors })); results.push({ name, status: 'FAIL', error: error.message }); await page.screenshot({ path: path.join(output, `failure-${results.length}.png`) }); }
    finally { await context.close(); }
    if (errors.length) throw new Error(errors[0]);
  }
  const stats = page => page.evaluate(() => window.mergeQA.stats());
  const count = (page, value) => page.waitForFunction(value => document.querySelector('[data-testid="persons"]')?.textContent === String(value), value);
  const open = page => page.getByRole('button', { name: 'Порівняти', exact: true }).click();
  const submit = page => page.getByRole('button', { name: 'Виконати злиття та оновити дерево', exact: true }).click();
  const undo = page => page.getByRole('button', { name: 'Скасувати останнє злиття', exact: true }).click();
  await check('checkpoint failure keeps the comparison open and the pair active; retry succeeds', 'smart', async page => {
    await open(page); await page.evaluate(() => window.mergeQA.fail(true)); await submit(page);
    await page.getByRole('alert').filter({ hasText: 'Злиття не виконано' }).waitFor(); await count(page, 3);
    assert.equal((await stats(page)).ignored, false); assert.equal((await stats(page)).checkpoint, null);
    await page.screenshot({ path: path.join(output, 'backup-failure.png') });
    await page.evaluate(() => window.mergeQA.fail(false)); await submit(page); await count(page, 2);
    assert.equal((await stats(page)).ignored, false); assert.ok((await stats(page)).checkpoint);
  });
  await check('a successful merge survives reload and the real undo button restores people and family links', 'smart', async page => {
    await open(page); await submit(page); await count(page, 2);
    const after = await stats(page); assert.equal(after.families['qa-family'].husbandId, 'qa-merge-a');
    await page.reload(); await page.waitForFunction(() => document.querySelector('[data-testid="ready"]')?.textContent === 'ready'); await count(page, 2);
    await undo(page); await count(page, 3);
    const restored = await stats(page); assert.equal(restored.families['qa-family'].husbandId, 'qa-merge-b'); assert.deepEqual(restored.mapping, {}); assert.equal(restored.ignored, false);
    await page.getByRole('status').waitFor(); await page.screenshot({ path: path.join(output, 'merge-undone.png') });
  });
  await check('undo refuses to overwrite a later edit and leaves the checkpoint available', 'smart', async page => {
    await open(page); await submit(page); await count(page, 2); await page.evaluate(() => window.mergeQA.edit()); await undo(page);
    await page.getByRole('alert').filter({ hasText: 'записи змінилися' }).waitFor(); await count(page, 2); assert.ok((await stats(page)).checkpoint);
    assert.equal((await stats(page)).persons.find(person => person.id === 'qa-child').notes, 'Later edit');
  });
  await check('stale comparison data is rejected visibly without merging or dismissing the pair', 'smart', async page => {
    await open(page); await page.evaluate(() => {
      const state = window.mergeQA;
      // Changing a compared record is simulated through the fixture’s controlled edit hook.
      state.editCompared();
    });
    await submit(page); await page.getByRole('alert').filter({ hasText: 'Дані осіб змінилися' }).waitFor(); await count(page, 3); assert.equal((await stats(page)).ignored, false);
  });
  await check('quick merge by ID honors the selected primary ID and supports undo', 'by-id', async page => {
    await open(page); await page.getByRole('radio').nth(1).check(); await page.getByRole('button', { name: 'Обʼєднати особи', exact: true }).click(); await count(page, 2);
    assert.equal((await stats(page)).selected, 'qa-merge-b'); assert.equal((await stats(page)).mapping['qa-merge-a'], 'qa-merge-b'); await undo(page); await count(page, 3);
  });
  await check('the detailed by-ID wizard uses its own primary ID choice when selecting the merged person', 'by-id', async page => {
    await open(page); await page.getByRole('button', { name: 'Вибрати поля', exact: true }).click();
    await page.getByRole('button', { name: /Основна:.*qa-merge-b/ }).click(); await submit(page); await count(page, 2);
    assert.equal((await stats(page)).selected, 'qa-merge-b'); assert.equal((await stats(page)).mapping['qa-merge-a'], 'qa-merge-b'); assert.equal((await stats(page)).ignored, false);
  });
  await check('the audit view quick action awaits the safe merge and removes resolved suggestions', 'conflicts', async page => {
    await page.getByRole('button', { name: 'Швидке злиття', exact: true }).first().click(); await count(page, 2);
    assert.equal((await stats(page)).ignored, false); assert.ok((await stats(page)).checkpoint); await undo(page); await count(page, 3);
  });
  await check('batch merge in the audit view creates one recoverable operation', 'conflicts', async page => {
    await page.getByRole('button', { name: /Авто-злиття безпечних/ }).click(); await page.getByRole('button', { name: /Підтвердити об/ }).click(); await count(page, 2);
    assert.equal((await stats(page)).ignored, false); await undo(page); await count(page, 3);
  });
  await check('the audit view detailed wizard also keeps failed merges available for retry', 'conflicts', async page => {
    await page.getByRole('button', { name: 'Майстер злиття', exact: true }).first().click(); await page.evaluate(() => window.mergeQA.fail(true)); await submit(page);
    await page.getByRole('alert').filter({ hasText: 'Злиття не виконано' }).waitFor(); await count(page, 3);
    await page.evaluate(() => window.mergeQA.fail(false)); await submit(page); await count(page, 2); assert.equal((await stats(page)).ignored, false);
  });
  assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.ok(results.every(result => result.status === 'PASS'));
} catch (error) { errors.push(error.message); }
finally {
  const report = { browser: browser ? await browser.version() : null, results, pageErrors: errors, externalRequests: external,
    component: 'real merge dialogs, ConflictsView, Zustand genealogy store, IndexedDB and undo button; synthetic data and blocked cloud transport' };
  await writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
  await browser?.close(); await server.close(); if (errors.length || results.some(result => result.status !== 'PASS')) process.exitCode = 1;
}
