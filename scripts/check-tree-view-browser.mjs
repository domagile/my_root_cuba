import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const output = process.env.TREE_BROWSER_OUTPUT || path.join(root, 'artifacts', 'tree-view-browser');
const stub = path.join(root, 'tests/browser/tree-view-stores.ts');
await mkdir(output, { recursive: true });
const server = await createServer({ root, cacheDir: path.join(output, '.vite'),
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'lucide-react', 'zustand'] },
  resolve: { alias: [
    { find: /^.*\/stores\/useAuthStore$/, replacement: stub },
    { find: /^.*\/stores\/useGenealogyStore$/, replacement: stub },
    { find: /^.*\/lib\/firebase$/, replacement: stub }
  ] }, server: { host: '127.0.0.1', port: 0, open: false, hmr: false } });
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
  const page = await context.newPage();
  page.on('dialog', dialog => dialog.accept()); // The storage layer may warn about a pending local write on reload.
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(10000);
  const world = page.locator('div[style*="translate3d"]');
  const canvas = world.locator('..');
  const active = page.locator('div[title^="Поточна особа"]');
  const parentsToggle = () => active.getByRole('button', { name: 'Вибірково обрати лінію предків', exact: true });
  const siblingsToggle = () => active.getByRole('button', { name: 'Вибірково обрати осіб', exact: true });
  async function load(wide = false, invalidCamera = false, query = '') {
    await page.goto(origin + '/tests/browser/tree-view.html' + (query ? '?' + query : wide ? '?wide=1' : invalidCamera ? '?invalidCamera=1' : ''));
    await page.getByRole('button', { name: 'Вписати', exact: true }).waitFor();
    await page.locator('button[title^="Режим оптимізації LOD"]').click(); // Auto -> full cards.
    await active.waitFor();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await world.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {}))));
  }
  async function check(name, run) {
    try { await run(); results.push({ name, status: 'PASS' }); }
    catch (error) { results.push({ name, status: 'FAIL', error: error.message }); }
  }
  const camera = () => world.evaluate(element => {
    const matrix = new DOMMatrix(element.style.transform);
    return { scale: matrix.m11, pan: { x: matrix.m41, y: matrix.m42 } };
  });
  const sameCamera = (actual, expected) => {
    assert.ok(Math.abs(actual.scale - expected.scale) < 1e-6, JSON.stringify({ actual, expected }));
    assert.ok(Math.abs(actual.pan.x - expected.pan.x) < 0.01 && Math.abs(actual.pan.y - expected.pan.y) < 0.01, JSON.stringify({ actual, expected }));
  };
  const seedQuery = (state, extra = '') => 'authenticated=1&seed=' + encodeURIComponent(JSON.stringify(state)) + (extra ? '&' + extra : '');
  await load();
  await check('parent menu closes on an outside click and retains inside interactions', async () => {
    await parentsToggle().click();
    await active.getByText('Батько', { exact: true }).waitFor();
    await active.getByText('Батько', { exact: true }).click();
    await active.getByText('Батько', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Вписати', exact: true }).click();
    await active.getByText('Батько', { exact: true }).waitFor({ state: 'hidden', timeout: 2000 });
  });
  await load();
  await check('sibling menu closes on an outside click', async () => {
    await siblingsToggle().click();
    await active.getByText('Брати та сестри (2)', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Вписати', exact: true }).click();
    await active.getByText('Брати та сестри (2)', { exact: true }).waitFor({ state: 'hidden', timeout: 2000 });
  });
  await load();
  await check('an open parent menu follows an immutable database edit', async () => {
    await parentsToggle().click();
    await page.evaluate(() => window.treeViewHarness.edit('father', 'Оновлений батько'));
    await active.getByText('Тестовий Оновлений батько', { exact: true }).waitFor();
  });
  await load();
  await check('collapsing a sibling keeps its menu and the anchor card position', async () => {
    await siblingsToggle().click();
    const before = await active.boundingBox(), original = await active.elementHandle();
    const row = active.getByText('Анна Тестова', { exact: true }).locator('../../..');
    await row.getByRole('button', { name: '– Сховати', exact: true }).click();
    await row.getByRole('button', { name: '+ Показати', exact: true }).waitFor();
    await active.getByText('Брати та сестри (2)', { exact: true }).waitFor();
    try {
      await page.waitForFunction(({ x, y }) => {
        const rect = document.querySelector('div[title^="Поточна особа"]').getBoundingClientRect();
        return Math.abs(rect.x - x) <= 1 && Math.abs(rect.y - y) <= 1;
      }, { x: before.x, y: before.y });
    } catch {
      throw new Error(JSON.stringify({ before, after: await active.boundingBox(), canvas: await canvas.boundingBox(), transform: await world.getAttribute('style') }));
    }
    assert.equal(await active.evaluate((element, original) => element === original, original), true);
    await row.getByRole('button', { name: '+ Показати', exact: true }).click();
    await row.getByRole('button', { name: '– Сховати', exact: true }).waitFor();
    await page.waitForFunction(({ x, y }) => {
      const rect = document.querySelector('div[title^="Поточна особа"]').getBoundingClientRect();
      return Math.abs(rect.x - x) <= 1 && Math.abs(rect.y - y) <= 1;
    }, { x: before.x, y: before.y });
    await original.dispose();
  });
  await load();
  await check('mouse dragging moves the camera and preserves the active card DOM', async () => {
    const rect = await canvas.boundingBox();
    const before = await world.evaluate(element => { const m = new DOMMatrix(element.style.transform); return { x: m.m41, y: m.m42 }; });
    const original = await active.elementHandle();
    await page.mouse.move(rect.x + 25, rect.y + 160);
    await page.mouse.down();
    await page.mouse.move(rect.x + 85, rect.y + 200, { steps: 5 });
    await page.mouse.up();
    const after = await world.evaluate(element => { const m = new DOMMatrix(element.style.transform); return { x: m.m41, y: m.m42 }; });
    assert.ok(Math.abs(after.x - before.x - 60) <= 1 && Math.abs(after.y - before.y - 40) <= 1);
    assert.equal(await active.evaluate((element, original) => element === original, original), true);
    await original.dispose();
  });
  await load();
  await check('Ctrl+wheel zoom keeps the world point under the cursor', async () => {
    const rect = await canvas.boundingBox(), cursor = { x: 245, y: 280 };
    const before = await world.evaluate(element => { const m = new DOMMatrix(element.style.transform); return { x: m.m41, y: m.m42, scale: m.m11 }; });
    await canvas.dispatchEvent('wheel', { clientX: rect.x + cursor.x, clientY: rect.y + cursor.y, ctrlKey: true, deltaY: -85 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const after = await world.evaluate(element => { const m = new DOMMatrix(element.style.transform); return { x: m.m41, y: m.m42, scale: m.m11 }; });
    assert.ok(after.scale > before.scale);
    assert.ok(Math.abs((cursor.x - before.x) / before.scale * after.scale + after.x - cursor.x) <= 0.6);
    assert.ok(Math.abs((cursor.y - before.y) / before.scale * after.scale + after.y - cursor.y) <= 0.6);
  });
  await load();
  await check('horizontal orientation places the parent to the left of the child', async () => {
    await page.getByText('Параметри дерева', { exact: true }).click();
    await page.getByText('Горизонтальне 16:9', { exact: true }).click();
    const father = world.locator(':scope > div').filter({ hasText: 'Петро' });
    const parentX = await father.evaluate(element => parseFloat(element.style.left));
    const childX = await active.evaluate(element => parseFloat(element.style.left));
    assert.ok(parentX < childX);
  });
  await load();
  await check('pinch-to-single-finger transition preserves the final pending pan', async () => {
    const movement = await canvas.evaluate(async element => {
      const rect = element.getBoundingClientRect();
      const point = (id, x, y) => new Touch({ identifier: id, target: element, clientX: rect.x + x, clientY: rect.y + y });
      const send = (type, touches) => element.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches, targetTouches: touches, changedTouches: touches }));
      const transform = () => new DOMMatrix(element.querySelector('div[style*="translate3d"]').style.transform);
      send('touchstart', [point(1, 300, 300), point(2, 500, 300)]);
      // End before the queued animation frame applies the last pinch position.
      send('touchmove', [point(1, 350, 330), point(2, 650, 330)]);
      send('touchend', [point(1, 350, 330)]);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const before = transform();
      send('touchmove', [point(1, 351, 331)]);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const after = transform();
      send('touchend', []);
      return { x: after.m41 - before.m41, y: after.m42 - before.m42 };
    });
    assert.ok(Math.abs(movement.x - 1) <= 0.5 && Math.abs(movement.y - 1) <= 0.5, JSON.stringify(movement));
  });
  await load(true);
  await check('culling retains every visible card after zooming and panning to a distant branch', async () => {
    const toggle = page.locator('button[title^="Оптимізація Viewport Culling:"]');
    // Observe the unculled real layout, then compare the same camera with culling on.
    if (!(await toggle.innerText()).includes('Вимк')) await toggle.click();
    const rect = await canvas.boundingBox();
    await canvas.dispatchEvent('wheel', { clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2, ctrlKey: true, deltaY: 2000 });
    await page.waitForFunction(() => document.querySelector('div[style*="translate3d"]').style.transform.includes('scale(0.2)'));
    const delta = await world.evaluate(element => {
      const cards = [...element.children].filter(child => child.tagName === 'DIV');
      const target = cards.reduce((a, b) => a.offsetLeft > b.offsetLeft ? a : b);
      const rect = target.getBoundingClientRect(), container = element.parentElement.getBoundingClientRect();
      return { x: rect.x + rect.width / 2 - container.x - container.width / 2, y: rect.y + rect.height / 2 - container.y - container.height / 2 };
    });
    await canvas.dispatchEvent('wheel', { deltaX: delta.x, deltaY: delta.y });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const expected = await world.evaluate(element => {
      const viewport = element.parentElement.getBoundingClientRect();
      return [...element.children].filter(child => child.tagName === 'DIV').filter(child => {
        const rect = child.getBoundingClientRect();
        return rect.right >= viewport.left && rect.left <= viewport.right && rect.bottom >= viewport.top && rect.top <= viewport.bottom;
      }).map(child => child.style.left + ':' + child.style.top);
    });
    assert.ok(expected.length > 1, 'fixture must contain visible distant relatives');
    await toggle.click();
    const actual = await world.evaluate(element => [...element.children].filter(child => child.tagName === 'DIV').map(child => child.style.left + ':' + child.style.top));
    const missing = expected.filter(key => !actual.includes(key));
    assert.deepEqual(missing, [], `${missing.length} of ${expected.length} visible cards were culled`);
  });
  await load(false, true);
  await check('invalid saved camera settings cannot stall viewport culling on mount', async () => {
    const transform = await world.evaluate(element => {
      const matrix = new DOMMatrix(element.style.transform);
      return [matrix.m11, matrix.m41, matrix.m42];
    });
    assert.ok(transform.every(Number.isFinite));
    assert.ok(Math.abs(transform[0] - 0.95) < 1e-6);
    assert.equal(await active.count(), 1);
  });

  for (const kind of ['parents', 'siblings']) {
    await load();
    await check(`${kind}: keyboard opening exposes the dialog and Escape returns focus`, async () => {
      const trigger = kind === 'parents' ? parentsToggle() : siblingsToggle();
      assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
      await trigger.focus();
      await trigger.press(kind === 'parents' ? 'Enter' : 'Space');
      assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
      const dialog = active.getByRole('dialog');
      assert.equal(await dialog.count(), 1);
      assert.equal(await dialog.getAttribute('id'), await trigger.getAttribute('aria-controls'));
      assert.equal(await dialog.evaluate(element => element === document.activeElement), true);
      await page.keyboard.press('Escape');
      assert.equal(await dialog.count(), 0);
      assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
      assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
    });
    await load();
    await check(`${kind}: the close button is keyboard accessible and returns focus`, async () => {
      const trigger = kind === 'parents' ? parentsToggle() : siblingsToggle();
      await trigger.focus(); await trigger.press('Enter');
      await page.keyboard.press('Tab');
      const close = active.getByRole('button', { name: kind === 'parents' ? 'Закрити меню ліній предків' : 'Закрити меню братів та сестер', exact: true });
      assert.equal(await close.evaluate(element => element === document.activeElement), true);
      await close.press('Enter');
      assert.equal(await active.getByRole('dialog').count(), 0);
      assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
    });
  }
  await load();
  await check('Tab leaving a popup closes it without taking focus back', async () => {
    await parentsToggle().click();
    await active.getByRole('dialog').getByRole('button').last().focus();
    await page.keyboard.press('Tab');
    assert.equal(await active.getByRole('dialog').count(), 0);
    assert.equal(await parentsToggle().evaluate(element => element === document.activeElement), false);
  });
  await load();
  await check('an outside click keeps focus on the clicked control', async () => {
    await parentsToggle().click();
    const outside = page.getByRole('button', { name: 'Вписати', exact: true });
    await outside.click();
    assert.equal(await active.getByRole('dialog').count(), 0);
    assert.equal(await outside.evaluate(element => element === document.activeElement), true);
  });
  await load(false, false, seedQuery({ selectedPersonId: 'root', pan: { x: 10, y: 20 }, scale: 1.2 }));
  await check('legacy saved camera survives initial centering', async () => {
    sameCamera(await camera(), { pan: { x: 10, y: 20 }, scale: 1.2 });
  });
  await load(false, false, seedQuery({ selectedPersonId: 'root', viewport: { version: 1, personId: 'root', pan: { x: 0, y: 0 }, scale: 1.2 } }));
  await check('a versioned camera can restore the world origin exactly', async () => {
    sameCamera(await camera(), { pan: { x: 0, y: 0 }, scale: 1.2 });
  });
  await load(false, false, seedQuery({ selectedPersonId: 'root', pan: { x: 10, y: 20 }, scale: 1.2 }, 'strict=1'));
  await check('closing and reopening before autosave restores the committed camera in StrictMode', async () => {
    await canvas.dispatchEvent('wheel', { deltaX: -35, deltaY: -15 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const expected = await camera();
    await page.evaluate(() => window.treeViewHarness.show(false));
    await page.evaluate(() => window.treeViewHarness.show(true));
    await active.waitFor();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    sameCamera(await camera(), expected);
  });
  await load(false, false, 'authenticated=1');
  await check('page reload restores the last camera even before the debounce completes', async () => {
    const rect = await canvas.boundingBox();
    await canvas.dispatchEvent('wheel', { clientX: rect.x + 400, clientY: rect.y + 300, ctrlKey: true, deltaY: -55 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const expected = await camera();
    await page.reload();
    await active.waitFor();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    sameCamera(await camera(), expected);
  });
  await check('explicitly choosing a new root centers it rather than restoring the old root camera', async () => {
    await page.evaluate(() => window.treeViewHarness.changeRoot('child'));
    await page.waitForFunction(() => Math.abs(new DOMMatrix(document.querySelector('div[style*="translate3d"]').style.transform).m11 - 0.95) < 1e-6);
    assert.ok((await active.innerText()).includes('Іван'));
  });
  for (const reason of ['different-root', 'empty-viewport']) {
    await load(false, false, seedQuery({ selectedPersonId: 'root', viewport: { version: 1,
      personId: reason === 'different-root' ? 'removed' : 'root', pan: { x: -100000, y: -100000 }, scale: 1.2 } }));
    await check(`saved camera fallback: ${reason}`, async () => {
      assert.ok(Math.abs((await camera()).scale - 0.95) < 1e-6);
      const a = await active.boundingBox(), c = await canvas.boundingBox();
      assert.ok(a.x >= c.x && a.y >= c.y && a.x + a.width <= c.x + c.width && a.y + a.height <= c.y + c.height);
    });
  }
  await load(false, false, 'authenticated=1&secondUser=1');
  await check('another user does not inherit the saved camera of the first user', async () => {
    assert.ok(Math.abs((await camera()).scale - 0.95) < 1e-6);
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  await page.screenshot({ path: path.join(output, 'tree-view.png') });
  const report = { browser: await browser.version(), results, pageErrors: errors, externalRequests: external,
    component: 'real TreeView with synthetic relationships and stubbed cloud/auth stores' };
  await writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  if (results.some(result => result.status === 'FAIL')) process.exitCode = 1;
} catch (error) {
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ results, pageErrors: errors, externalRequests: external, error: error.message }, null, 2) + '\n');
  throw error;
} finally { await browser?.close(); await server.close(); }
