import { performance } from 'node:perf_hooks';
import type { GenealogyDatabase } from '../src/types';
import { calculateClassicFamilyTreeLayout, clearTreeLayoutCache } from '../src/rodovid/utils/treeLayout';

// Synthetic input only. This measures warm-cache lookup cost, not browser rendering.
const personCount = 10_000;
const iterations = 1_000;
const database: GenealogyDatabase = {
  persons: Object.fromEntries(Array.from({ length: personCount }, (_, i) => [
    `p${i}`, { id: `p${i}`, firstName: `Person ${i}`, lastName: 'Synthetic', gender: 'M' }
  ])),
  families: {}, sources: {}, events: {}, lastModified: 'fixed'
};
clearTreeLayoutCache();
calculateClassicFamilyTreeLayout(database, 'p0', 2);
const samples: number[] = [];
for (let pass = 0; pass < 5; pass++) {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) calculateClassicFamilyTreeLayout(database, 'p0', 2);
  samples.push(Number((performance.now() - start).toFixed(2)));
}
console.log(JSON.stringify({ personCount, iterations, milliseconds: samples, medianMs: [...samples].sort((a, b) => a - b)[2] }));
