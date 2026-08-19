/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GenealogyDatabase, Person } from '../types/genealogy';

export interface TreeNodeLayout {
  id: string;
  person: Person;
  x: number;
  y: number;
  width: number;
  height: number;
  generation: number;
}

export interface TreeLinkLayout {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}

export interface TreeLayoutResult {
  nodes: TreeNodeLayout[];
  links: TreeLinkLayout[];
  width: number;
  height: number;
}

export interface FanChartSector {
  ahnentafelNumber: number;
  person: Person;
  generation: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  fillColor?: string;
}

const NODE_WIDTH = 220;
const NODE_HEIGHT = 110;
const HORIZONTAL_GAP = 50;
const VERTICAL_GAP = 90;

export function calculateAncestorsLayout(
  database: GenealogyDatabase,
  rootPersonId: string,
  maxGenerations: number = 5
): TreeLayoutResult {
  const nodes: TreeNodeLayout[] = [];
  const links: TreeLinkLayout[] = [];
  const root = database.persons[rootPersonId];

  if (!root) {
    return { nodes: [], links: [], width: 800, height: 600 };
  }

  // Build generation levels for ancestors
  const levels: Map<number, Person[]> = new Map();
  const visited = new Set<string>();

  function traverseAncestors(person: Person, gen: number) {
    if (gen > maxGenerations || visited.has(person.id)) return;
    visited.add(person.id);

    if (!levels.has(gen)) {
      levels.set(gen, []);
    }
    levels.get(gen)!.push(person);

    const fId = person.fatherId || (person.parentFamilyId ? database.families[person.parentFamilyId]?.husbandId : undefined);
    const mId = person.motherId || (person.parentFamilyId ? database.families[person.parentFamilyId]?.wifeId : undefined);

    if (fId && database.persons[fId]) {
      traverseAncestors(database.persons[fId], gen + 1);
    }
    if (mId && database.persons[mId]) {
      traverseAncestors(database.persons[mId], gen + 1);
    }
  }

  traverseAncestors(root, 0);

  const nodeMap = new Map<string, { x: number; y: number }>();
  let maxX = 1200;
  let maxY = 800;

  // Place nodes level by level
  const totalGenerations = Math.max(...Array.from(levels.keys()), 0);

  levels.forEach((personsInLevel, gen) => {
    const y = (totalGenerations - gen) * (NODE_HEIGHT + VERTICAL_GAP) + 60;
    const totalWidthForLevel = personsInLevel.length * (NODE_WIDTH + HORIZONTAL_GAP);
    const startX = Math.max(60, 600 - totalWidthForLevel / 2);

    personsInLevel.forEach((p, idx) => {
      const x = startX + idx * (NODE_WIDTH + HORIZONTAL_GAP);
      nodeMap.set(p.id, { x, y });
      nodes.push({
        id: p.id,
        person: p,
        x,
        y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        generation: gen
      });

      maxX = Math.max(maxX, x + NODE_WIDTH + 100);
      maxY = Math.max(maxY, y + NODE_HEIGHT + 100);
    });
  });

  // Create links between parents and children
  nodes.forEach((node) => {
    const p = node.person;
    const fId = p.fatherId || (p.parentFamilyId ? database.families[p.parentFamilyId]?.husbandId : undefined);
    const mId = p.motherId || (p.parentFamilyId ? database.families[p.parentFamilyId]?.wifeId : undefined);

    if (fId && nodeMap.has(fId)) {
      const parentPos = nodeMap.get(fId)!;
      links.push({
        id: `${fId}->${p.id}`,
        sourceX: parentPos.x + NODE_WIDTH / 2,
        sourceY: parentPos.y + NODE_HEIGHT,
        targetX: node.x + NODE_WIDTH / 2,
        targetY: node.y
      });
    }
    if (mId && nodeMap.has(mId)) {
      const parentPos = nodeMap.get(mId)!;
      links.push({
        id: `${mId}->${p.id}`,
        sourceX: parentPos.x + NODE_WIDTH / 2,
        sourceY: parentPos.y + NODE_HEIGHT,
        targetX: node.x + NODE_WIDTH / 2,
        targetY: node.y
      });
    }
  });

  return {
    nodes,
    links,
    width: Math.max(maxX, 1400),
    height: Math.max(maxY, 900)
  };
}

export function calculateDescendantsLayout(
  database: GenealogyDatabase,
  rootPersonId: string,
  maxGenerations: number = 5
): TreeLayoutResult {
  const nodes: TreeNodeLayout[] = [];
  const links: TreeLinkLayout[] = [];
  const root = database.persons[rootPersonId];

  if (!root) {
    return { nodes: [], links: [], width: 800, height: 600 };
  }

  const levels: Map<number, Person[]> = new Map();
  const visited = new Set<string>();

  function traverseDescendants(person: Person, gen: number) {
    if (gen > maxGenerations || visited.has(person.id)) return;
    visited.add(person.id);

    if (!levels.has(gen)) {
      levels.set(gen, []);
    }
    levels.get(gen)!.push(person);

    const childrenIds = new Set<string>();
    if (person.childrenIds) {
      person.childrenIds.forEach((c) => childrenIds.add(c));
    }
    if (person.spouseFamilyIds) {
      person.spouseFamilyIds.forEach((fId) => {
        const fam = database.families[fId];
        if (fam && fam.children) {
          fam.children.forEach((c) => childrenIds.add(c.personId));
        }
      });
    }

    childrenIds.forEach((childId) => {
      const child = database.persons[childId];
      if (child) {
        traverseDescendants(child, gen + 1);
      }
    });
  }

  traverseDescendants(root, 0);

  const nodeMap = new Map<string, { x: number; y: number }>();
  let maxX = 1200;
  let maxY = 800;

  levels.forEach((personsInLevel, gen) => {
    const y = gen * (NODE_HEIGHT + VERTICAL_GAP) + 60;
    const totalWidthForLevel = personsInLevel.length * (NODE_WIDTH + HORIZONTAL_GAP);
    const startX = Math.max(60, 600 - totalWidthForLevel / 2);

    personsInLevel.forEach((p, idx) => {
      const x = startX + idx * (NODE_WIDTH + HORIZONTAL_GAP);
      nodeMap.set(p.id, { x, y });
      nodes.push({
        id: p.id,
        person: p,
        x,
        y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        generation: gen
      });

      maxX = Math.max(maxX, x + NODE_WIDTH + 100);
      maxY = Math.max(maxY, y + NODE_HEIGHT + 100);
    });
  });

  nodes.forEach((node) => {
    const p = node.person;
    const childrenIds = new Set<string>();
    if (p.childrenIds) p.childrenIds.forEach((c) => childrenIds.add(c));
    if (p.spouseFamilyIds) {
      p.spouseFamilyIds.forEach((fId) => {
        const fam = database.families[fId];
        if (fam && fam.children) fam.children.forEach((c) => childrenIds.add(c.personId));
      });
    }

    childrenIds.forEach((cId) => {
      if (nodeMap.has(cId)) {
        const childPos = nodeMap.get(cId)!;
        links.push({
          id: `${p.id}->${cId}`,
          sourceX: node.x + NODE_WIDTH / 2,
          sourceY: node.y + NODE_HEIGHT,
          targetX: childPos.x + NODE_WIDTH / 2,
          targetY: childPos.y
        });
      }
    });
  });

  return {
    nodes,
    links,
    width: Math.max(maxX, 1400),
    height: Math.max(maxY, 900)
  };
}

export function calculateHourglassLayout(
  database: GenealogyDatabase,
  rootPersonId: string,
  maxGenerations: number = 4
): TreeLayoutResult {
  const ancestors = calculateAncestorsLayout(database, rootPersonId, maxGenerations);
  const descendants = calculateDescendantsLayout(database, rootPersonId, maxGenerations);

  const combinedNodes = [...ancestors.nodes];
  const combinedLinks = [...ancestors.links];

  descendants.nodes.forEach((dNode) => {
    if (!combinedNodes.some((n) => n.id === dNode.id)) {
      combinedNodes.push(dNode);
    }
  });

  descendants.links.forEach((dLink) => {
    if (!combinedLinks.some((l) => l.id === dLink.id)) {
      combinedLinks.push(dLink);
    }
  });

  return {
    nodes: combinedNodes,
    links: combinedLinks,
    width: Math.max(ancestors.width, descendants.width),
    height: Math.max(ancestors.height + descendants.height / 2, 1200)
  };
}

export function calculateFanChart(
  database: GenealogyDatabase,
  rootPersonId: string,
  generations: number = 5,
  innerRadiusBase: number = 60,
  ringWidth: number = 75
): FanChartSector[] {
  const sectors: FanChartSector[] = [];
  const root = database.persons[rootPersonId];
  if (!root) return sectors;

  function addAncestorToFan(
    person: Person,
    gen: number,
    ahnentafel: number,
    startAngle: number,
    endAngle: number
  ) {
    if (gen >= generations) return;

    const innerRadius = gen === 0 ? 0 : innerRadiusBase + (gen - 1) * ringWidth;
    const outerRadius = innerRadiusBase + gen * ringWidth;

    sectors.push({
      ahnentafelNumber: ahnentafel,
      person,
      generation: gen,
      innerRadius,
      outerRadius,
      startAngle,
      endAngle,
      fillColor: person.gender === 'female' || person.gender === 'F' ? '#F43F5E' : '#3B82F6'
    });

    const midAngle = (startAngle + endAngle) / 2;

    const fId = person.fatherId || (person.parentFamilyId ? database.families[person.parentFamilyId]?.husbandId : undefined);
    const mId = person.motherId || (person.parentFamilyId ? database.families[person.parentFamilyId]?.wifeId : undefined);

    if (fId && database.persons[fId]) {
      addAncestorToFan(
        database.persons[fId],
        gen + 1,
        ahnentafel * 2,
        startAngle,
        midAngle
      );
    }
    if (mId && database.persons[mId]) {
      addAncestorToFan(
        database.persons[mId],
        gen + 1,
        ahnentafel * 2 + 1,
        midAngle,
        endAngle
      );
    }
  }

  addAncestorToFan(root, 0, 1, 0, 360);
  return sectors;
}
