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

interface AdjacencyNeighbor {
  toId: string;
  type: RelationshipStep['relationType'];
  desc: string;
}

// Module-level graph cache to avoid rebuilding adjacency list on every call
let cachedPersonsRef: Person[] | null = null;
let cachedAdjacency: Map<string, AdjacencyNeighbor[]> = new Map();
let cachedPersonMap: Map<string, Person> = new Map();

function getOrBuildAdjacency(persons: Person[]): {
  personMap: Map<string, Person>;
  adj: Map<string, AdjacencyNeighbor[]>;
} {
  if (cachedPersonsRef === persons && cachedAdjacency.size > 0) {
    return { personMap: cachedPersonMap, adj: cachedAdjacency };
  }

  const personMap = new Map<string, Person>();
  const adj = new Map<string, AdjacencyNeighbor[]>();
  const childrenMap = new Map<string, string[]>();

  // 1. Index persons and populate childrenMap
  for (let i = 0; i < persons.length; i++) {
    const p = persons[i];
    personMap.set(p.id, p);
    adj.set(p.id, []);

    if (p.fatherId) {
      let list = childrenMap.get(p.fatherId);
      if (!list) {
        list = [];
        childrenMap.set(p.fatherId, list);
      }
      list.push(p.id);
    }
    if (p.motherId) {
      let list = childrenMap.get(p.motherId);
      if (!list) {
        list = [];
        childrenMap.set(p.motherId, list);
      }
      list.push(p.id);
    }
  }

  // 2. Build adjacency edges without quadratic scans
  for (let i = 0; i < persons.length; i++) {
    const p = persons[i];
    const neighbors = adj.get(p.id)!;
    const seen = new Set<string>();

    if (p.fatherId && personMap.has(p.fatherId)) {
      neighbors.push({ toId: p.fatherId, type: 'parent', desc: 'Батько' });
      seen.add(p.fatherId);
    }
    if (p.motherId && personMap.has(p.motherId)) {
      neighbors.push({ toId: p.motherId, type: 'parent', desc: 'Мати' });
      seen.add(p.motherId);
    }
    if (Array.isArray(p.spouseIds)) {
      for (const sId of p.spouseIds) {
        if (!seen.has(sId) && personMap.has(sId)) {
          neighbors.push({ toId: sId, type: 'spouse', desc: 'Подружжя' });
          seen.add(sId);
        }
      }
    }
    if (Array.isArray(p.childrenIds)) {
      for (const cId of p.childrenIds) {
        if (!seen.has(cId) && personMap.has(cId)) {
          neighbors.push({ toId: cId, type: 'child', desc: 'Дитина' });
          seen.add(cId);
        }
      }
    }

    const implicitChildren = childrenMap.get(p.id);
    if (implicitChildren) {
      for (const cId of implicitChildren) {
        if (!seen.has(cId) && personMap.has(cId)) {
          neighbors.push({ toId: cId, type: 'child', desc: 'Дитина' });
          seen.add(cId);
        }
      }
    }
  }

  cachedPersonsRef = persons;
  cachedPersonMap = personMap;
  cachedAdjacency = adj;
  return { personMap, adj };
}

/**
 * Shortest kinship path between two persons using BFS with O(1) queue pointer
 */
export function findRelationshipPath(
  startId: string,
  endId: string,
  persons: Person[]
): RelationshipPath | null {
  if (startId === endId) {
    return { steps: [], pathIds: [startId] };
  }

  const { personMap, adj } = getOrBuildAdjacency(persons);
  if (!personMap.has(startId) || !personMap.has(endId)) return null;

  // Track parent pointer to reconstruct path with minimal memory
  const parentMap = new Map<string, { fromId: string; step: RelationshipStep }>();
  const visited = new Set<string>([startId]);
  const queue: string[] = [startId];
  let head = 0;
  let found = false;

  while (head < queue.length) {
    const currentId = queue[head++];
    if (currentId === endId) {
      found = true;
      break;
    }

    const neighbors = adj.get(currentId) || [];
    for (let i = 0; i < neighbors.length; i++) {
      const neighbor = neighbors[i];
      if (!visited.has(neighbor.toId)) {
        visited.add(neighbor.toId);
        parentMap.set(neighbor.toId, {
          fromId: currentId,
          step: {
            fromId: currentId,
            toId: neighbor.toId,
            relationType: neighbor.type,
            description: neighbor.desc
          }
        });
        queue.push(neighbor.toId);
      }
    }
  }

  if (!found) return null;

  // Reconstruct path backwards
  const steps: RelationshipStep[] = [];
  const pathIds: string[] = [endId];
  let curr = endId;

  while (curr !== startId) {
    const info = parentMap.get(curr);
    if (!info) break;
    steps.unshift(info.step);
    pathIds.unshift(info.fromId);
    curr = info.fromId;
  }

  return { steps, pathIds };
}

/**
 * Computes relationship titles from a single central person to ALL persons in ONE BFS traversal (O(V + E)).
 * Replaces N separate BFS calls with a single lightning-fast traversal.
 */
export function findAllRelationshipPathsFromSource(
  centralId: string,
  persons: Person[]
): Map<string, string> {
  const result = new Map<string, string>();
  if (!centralId || persons.length === 0) return result;

  const { personMap, adj } = getOrBuildAdjacency(persons);
  if (!personMap.has(centralId)) return result;

  result.set(centralId, 'Центральна особа 👑');

  // BFS with depth / steps tracker
  const queue: { id: string; steps: RelationshipStep[] }[] = [{ id: centralId, steps: [] }];
  const visited = new Set<string>([centralId]);
  let head = 0;

  while (head < queue.length) {
    const { id: currentId, steps } = queue[head++];
    const neighbors = adj.get(currentId) || [];

    for (let i = 0; i < neighbors.length; i++) {
      const neighbor = neighbors[i];
      if (!visited.has(neighbor.toId)) {
        visited.add(neighbor.toId);
        const nextSteps: RelationshipStep[] = [
          ...steps,
          {
            fromId: currentId,
            toId: neighbor.toId,
            relationType: neighbor.type,
            description: neighbor.desc
          }
        ];

        const title = getSummaryRelationTitle({ steps: nextSteps, pathIds: [] });
        result.set(neighbor.toId, title);

        queue.push({ id: neighbor.toId, steps: nextSteps });
      }
    }
  }

  // Set default label for unreachable persons
  for (let i = 0; i < persons.length; i++) {
    const pId = persons[i].id;
    if (!result.has(pId)) {
      result.set(pId, 'Далекий родич / без прямого зв’язку');
    }
  }

  return result;
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
