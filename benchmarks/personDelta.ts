import { performance } from 'node:perf_hooks';
import type { Person } from '../src/types';
import { computePersonDelta } from '../src/utils/personDelta';
const before: Person & { updatedAt: string } = { id: 'synthetic', gender: 'U', firstName: 'Before', updatedAt: 'fixed',
  notes: 'Synthetic note. '.repeat(10_000),
  customFields: Array.from({ length: 2_000 }, (_, i) => ({ label: `Field ${i}`, value: 'Shared source information' })) };
const after = { ...before, firstName: 'After' };
const iterations = 500;
for (let i = 0; i < 10; i++) computePersonDelta(before, after);
const samples: number[] = [];
for (let pass = 0; pass < 5; pass++) {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) computePersonDelta(before, after);
  samples.push(Number((performance.now() - start).toFixed(2)));
}
console.log(JSON.stringify({ iterations, noteCharacters: before.notes!.length,
  nestedFields: before.customFields!.length, milliseconds: samples, medianMs: [...samples].sort((a, b) => a - b)[2] }));
