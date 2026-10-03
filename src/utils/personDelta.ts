/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Smart Incremental Delta Computation for Person Entities
 */

import { Person } from '../types';

/**
 * Computes the delta (changed fields only) between previous and next person states.
 * Used for smart incremental save in Firestore to minimize bandwidth and quota consumption.
 */
export function computePersonDelta(
  prevPerson: Person | undefined,
  nextPerson: Person
): Partial<Person> {
  if (!prevPerson) {
    return { ...nextPerson };
  }

  const delta: any = { id: nextPerson.id };
  let changeCount = 0;

  const allKeys = new Set([
    ...Object.keys(prevPerson),
    ...Object.keys(nextPerson)
  ]);

  for (const key of allKeys) {
    if (key === 'id' || key === 'updatedAt') continue;

    const prevVal = (prevPerson as any)[key];
    const nextVal = (nextPerson as any)[key];

    // Deep compare via JSON representation
    const prevJson = JSON.stringify(prevVal ?? null);
    const nextJson = JSON.stringify(nextVal ?? null);

    if (prevJson !== nextJson) {
      // If removed or undefined in nextPerson, set to null so Firestore { merge: true } clears it
      delta[key] = nextVal !== undefined ? nextVal : null;
      changeCount++;
    }
  }

  if (changeCount > 0) {
    delta.updatedAt = (nextPerson as any).updatedAt || new Date().toISOString();
  }

  return delta;
}

/**
 * Checks if the computed delta contains actual field modifications
 */
export function hasMeaningfulPersonDelta(delta: Partial<Person>): boolean {
  if (!delta) return false;
  const keys = Object.keys(delta).filter(k => k !== 'id' && k !== 'updatedAt');
  return keys.length > 0;
}
