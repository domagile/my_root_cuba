/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Person } from '../../types';

export interface RelationshipStep {
  fromId: string;
  toId: string;
  relationType: 'parent' | 'child' | 'spouse' | 'sibling';
  description: string;
}

export interface RelationshipPath {
  steps: RelationshipStep[];
  pathIds: string[];
}

export function findRelationshipPath(
  startId: string,
  endId: string,
  persons: Person[]
): RelationshipPath | null {
  if (startId === endId) {
    return { steps: [], pathIds: [startId] };
  }

  const personMap = new Map<string, Person>();
  persons.forEach((p) => personMap.set(p.id, p));

  // BFS search for shortest kinship path
  const queue: { currentId: string; path: RelationshipStep[]; visited: Set<string> }[] = [
    { currentId: startId, path: [], visited: new Set([startId]) }
  ];

  while (queue.length > 0) {
    const { currentId, path, visited } = queue.shift()!;
    if (currentId === endId) {
      return {
        steps: path,
        pathIds: [startId, ...path.map((s) => s.toId)]
      };
    }

    const current = personMap.get(currentId);
    if (!current) continue;

    // Neighbors: parents, children, spouses
    const neighbors: { toId: string; type: RelationshipStep['relationType']; desc: string }[] = [];

    if (current.fatherId) {
      neighbors.push({ toId: current.fatherId, type: 'parent', desc: 'Батько' });
    }
    if (current.motherId) {
      neighbors.push({ toId: current.motherId, type: 'parent', desc: 'Мати' });
    }
    if (Array.isArray(current.spouseIds)) {
      current.spouseIds.forEach((sId) => {
        neighbors.push({ toId: sId, type: 'spouse', desc: 'Подружжя' });
      });
    }
    if (Array.isArray(current.childrenIds)) {
      current.childrenIds.forEach((cId) => {
        neighbors.push({ toId: cId, type: 'child', desc: 'Дитина' });
      });
    }
    // Also look for children pointing back to current
    persons.forEach((p) => {
      if ((p.fatherId === currentId || p.motherId === currentId) && !neighbors.some((n) => n.toId === p.id)) {
        neighbors.push({ toId: p.id, type: 'child', desc: 'Дитина' });
      }
    });

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor.toId)) {
        const nextVisited = new Set(visited);
        nextVisited.add(neighbor.toId);
        queue.push({
          currentId: neighbor.toId,
          path: [
            ...path,
            {
              fromId: currentId,
              toId: neighbor.toId,
              relationType: neighbor.type,
              description: neighbor.desc
            }
          ],
          visited: nextVisited
        });
      }
    }
  }

  return null;
}

export function getSummaryRelationTitle(path: RelationshipPath): string {
  if (!path || path.steps.length === 0) return 'Головна особа (ви)';
  const len = path.steps.length;
  if (len === 1) {
    return path.steps[0].description;
  }
  if (len === 2) {
    if (path.steps[0].relationType === 'parent' && path.steps[1].relationType === 'parent') {
      return 'Дідусь / Бабуся';
    }
    if (path.steps[0].relationType === 'parent' && path.steps[1].relationType === 'child') {
      return 'Брат / Сестра';
    }
    if (path.steps[0].relationType === 'child' && path.steps[1].relationType === 'child') {
      return 'Онук / Онука';
    }
  }
  if (len === 3) {
    if (path.steps[0].relationType === 'parent' && path.steps[1].relationType === 'parent' && path.steps[2].relationType === 'parent') {
      return 'Прадід / Прабабуся';
    }
    if (path.steps[0].relationType === 'parent' && path.steps[1].relationType === 'parent' && path.steps[2].relationType === 'child') {
      return 'Дядько / Тітка';
    }
  }
  return `Родич у ${len}-му колі спорідненості`;
}
