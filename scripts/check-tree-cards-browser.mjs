import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';

// Optional browser QA: reuse an installed Playwright package without changing app dependencies.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const output = process.env.TREE_BROWSER_OUTPUT || path.join(root, 'artifacts', 'tree-cards-browser');
await mkdir(output, { recursive: true });
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0, open: false, hmr: false } });
let browser;
const results = [];
const errors = [];
const blocked = [];
try {
  await server.listen();
  const address = server.httpServer.address();
  const origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1500, height: 1050 }, serviceWorkers: 'block' });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin || url.protocol === 'data:') return route.continue();
    blocked.push(url.origin);
    return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + '/tests/browser/tree-cards.html');
  await page.waitForFunction(() => window.treeHarness && document.body.innerText.includes('Старий батько'));
  const card = page.locator('[data-testid="canvas"] > div').first();
  const patch = update => page.evaluate(update => window.treeHarness.patch(update), update);
  async function check(name, run) {
    try { await run(); results.push({ name, status: 'PASS' }); }
    catch (error) { results.push({ name, status: 'FAIL', error: error.message }); throw error; }
  }

  await check('parent edits update an already open menu', async () => {
    await patch({ parentsVersion: 1 });
    await page.waitForFunction(() => document.body.innerText.includes('Новий батько'));
    assert.equal(await page.getByText('Старий батько', { exact: false }).count(), 0);
  });
  await check('moving a node preserves its DOM element and focused button', async () => {
    const button = card.locator('button').first();
    await button.focus();
    await page.evaluate(() => {
      window.savedTreeCard = document.querySelector('[data-testid="canvas"] > div');
      window.savedTreeFocus = document.activeElement;
    });
    await patch({ x: 390, y: 290 });
    assert.equal(await page.evaluate(() => window.savedTreeCard === document.querySelector('[data-testid="canvas"] > div')), true);
    assert.equal(await page.evaluate(() => window.savedTreeFocus === document.activeElement), true);
    assert.equal(await card.evaluate(element => element.style.left), '390px');
  });
  await check('sibling edits and collapse state update the open sibling menu', async () => {
    await patch({ menu: 'siblings' });
    await page.waitForFunction(() => document.body.innerText.includes('Стара сестра'));
    await patch({ siblingsVersion: 1, collapsed: true });
    await page.waitForFunction(() => document.body.innerText.includes('Нова сестра'));
    assert.equal(await card.getByText('Стара сестра', { exact: false }).count(), 0);
    assert.ok(await card.getByRole('button', { name: '+ Показати', exact: true }).count());
  });
  await check('stable handlers invoke the latest committed callback', async () => {
    await patch({ menu: '', revision: 7 });
    await card.click({ position: { x: 80, y: 95 } });
    const action = await page.evaluate(() => window.treeHarness.log.filter(item => item.action === 'onSelectPerson').at(-1));
    assert.equal(action.revision, 7);
    assert.deepEqual(action.args, ['p0']);
  });
  await check('optional edit handlers retain the selection fallback when unavailable', async () => {
    await patch({ menu: '', revision: 8, optionalActions: false });
    const edit = card.getByRole('button', { name: 'Редагувати особу', exact: true });
    await edit.click();
    let action = await page.evaluate(() => window.treeHarness.log.at(-1));
    assert.equal(action.action, 'onSelectPerson');
    assert.equal(action.revision, 8);
    await patch({ revision: 9, optionalActions: true });
    await edit.click();
    action = await page.evaluate(() => window.treeHarness.log.at(-1));
    assert.equal(action.action, 'onEditPerson');
    assert.equal(action.revision, 9);
    await patch({ revision: 10, optionalActions: false });
    await edit.click();
    action = await page.evaluate(() => window.treeHarness.log.at(-1));
    assert.equal(action.action, 'onSelectPerson');
    assert.equal(action.revision, 10);
  });
  await check('camera-only updates retain all card DOM elements without internal mutations', async () => {
    const observation = await page.evaluate(async () => {
      const cards = [...document.querySelector('[data-testid="canvas"]').children];
      let mutations = 0;
      const observer = new MutationObserver(records => { mutations += records.length; });
      for (const item of cards) observer.observe(item, { subtree: true, childList: true, attributes: true, characterData: true });
      const elapsedMs = window.treeHarness.cameraTicks(50);
      await new Promise(resolve => setTimeout(resolve, 0));
      observer.disconnect();
      return { elapsedMs, mutations, count: cards.length, sameElements: cards.every((item, i) => item === document.querySelector('[data-testid="canvas"]').children[i]) };
    });
    assert.equal(observation.count, 40);
    assert.equal(observation.sameElements, true);
    assert.equal(observation.mutations, 0);
    results.push({ name: 'camera timing (not FPS)', ...observation });
  });
  await check('level-of-detail variants preserve identity when moved', async () => {
    for (const lod of ['pill','micro','full']) {
      await patch({ lod });
      await page.evaluate(() => { window.savedTreeCard = document.querySelector('[data-testid="canvas"] > div'); });
      await patch({ x: 400 });
      assert.equal(await page.evaluate(() => window.savedTreeCard === document.querySelector('[data-testid="canvas"] > div')), true, lod);
      await patch({ x: 390 });
    }
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(blocked, []);
  await patch({ menu: 'parents' });
  await page.screenshot({ path: path.join(output, 'tree-cards.png'), fullPage: false });
  const report = { browser: await browser.version(), results, pageErrors: errors, externalRequests: blocked, fixtureOnly: true };
  await writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} catch (error) {
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ results, pageErrors: errors, externalRequests: blocked, error: error.message }, null, 2) + '\n');
  throw error;
} finally {
  await browser?.close();
  await server.close();
}
