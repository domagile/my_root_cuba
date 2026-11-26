import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getTreeViewportBounds } from '../src/rodovid/utils/treeViewport';
import { SpatialTreeIndex } from '../src/rodovid/utils/treeSpatialIndex';
import { cardNode } from './fixtures/treeCardProps';

test('a distant branch remains within bounds at a fractional zoom', () => {
  const bounds = getTreeViewportBounds({ x: -20000, y: -20000 }, 0.2, { width: 1200, height: 800 });
  assert.ok(bounds.minX <= 100000 && bounds.maxX >= 106000);
  assert.ok(bounds.minY <= 100000 && bounds.maxY >= 104000);
});

test('all viewport edges and overscan stay covered across pan directions and zoom levels', () => {
  for (const x of [-1000000, -20000, -100, 0, 100, 20000, 1000000]) {
    for (const y of [-1000000, -20000, 0, 20000, 1000000]) {
      for (const scale of [0.2, 0.24, 0.3, 0.49, 0.95, 1, 1.18, 2.5]) {
        for (const viewport of [{ width: 360, height: 740 }, { width: 1500, height: 900 }]) {
          const bounds = getTreeViewportBounds({ x, y }, scale, viewport);
          assert.ok(bounds.minX <= (-x - 550) / scale);
          assert.ok(bounds.maxX >= (viewport.width - x + 550) / scale);
          assert.ok(bounds.minY <= (-y - 550) / scale);
          assert.ok(bounds.maxY >= (viewport.height - y + 550) / scale);
        }
      }
    }
  }
});

test('small camera movements can reuse the same quantized world bounds', () => {
  const viewport = { width: 1024, height: 1024 };
  assert.deepEqual(getTreeViewportBounds({ x: -1024, y: -1024 }, 1, viewport),
    getTreeViewportBounds({ x: -1023, y: -1023 }, 1, viewport));
});

for (const sign of [-1, 1]) {
  test(`spatial queries retain visible cards and links far in direction ${sign}`, () => {
    const offset = sign * 100000;
    const nodes = Array.from({ length: 30 }, (_, i) => ({ ...cardNode(`node-${i}`), x: offset + i * 250, y: offset }));
    const links = nodes.map((node, i) => ({ id: `link-${i}`, sourceX: node.x, sourceY: node.y,
      targetX: node.x + 100, targetY: node.y + 100, type: 'child' as const }));
    const index = new SpatialTreeIndex();
    index.insertNodes(nodes); index.insertLinks(links);
    const bounds = getTreeViewportBounds({ x: -offset * 0.2, y: -offset * 0.2 }, 0.2, { width: 1200, height: 800 });
    const visible = index.queryVisibleNodes(bounds), visibleLinks = index.queryVisibleLinks(bounds);
    for (const node of nodes.filter(node => node.x <= offset + 6000)) assert.ok(visible.includes(node));
    for (const link of links.filter(link => link.sourceX <= offset + 6000)) assert.ok(visibleLinks.includes(link));
  });
}
