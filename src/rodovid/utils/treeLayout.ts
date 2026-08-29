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
  spouseId?: string;
  isSpouseNode?: boolean;
  hasParents?: boolean;
  hasSiblings?: boolean;
  hasChildren?: boolean;
  parentsCount?: number;
  siblingsCount?: number;
  childrenCount?: number;
  isParentsCollapsed?: boolean;
  isSiblingsCollapsed?: boolean;
  isChildrenCollapsed?: boolean;
  areParentsVisible?: boolean;
  areSiblingsVisible?: boolean;
  areChildrenVisible?: boolean;
}

export interface TreeLayoutFilterOptions {
  showParents?: boolean;
  showSiblings?: boolean;
  showDescendants?: boolean;
  collapsedParents?: Set<string>;
  collapsedSiblings?: Set<string>;
  collapsedChildren?: Set<string>;
}

export interface TreeLinkLayout {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  type?: 'marriage' | 'child' | 'orthogonal' | 'bezier' | 'stem' | 'bus' | 'drop';
  path?: string;
  arrow?: 'up' | 'down' | 'none';
  arrowX?: number;
  arrowY?: number;
  color?: string;
  familyId?: string;
  sourcePersonId?: string;
  targetPersonId?: string;
  childPersonId?: string;
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
  color?: string;
}

// Distinct, vibrant lineage colors for family branches
export const FAMILY_LINE_COLORS = [
  '#0284c7', // Sky Blue
  '#059669', // Emerald Green
  '#d97706', // Amber Gold
  '#7c3aed', // Purple Violet
  '#e11d48', // Rose Coral
  '#0d9488', // Teal
  '#4f46e5', // Indigo
  '#ea580c', // Orange
  '#0891b2', // Cyan
  '#65a30d', // Lime Green
];

// Classic FamilySearch / Pedigree Card Dimensions
export const CLASSIC_CARD_WIDTH = 176;
export const CLASSIC_CARD_HEIGHT = 192;
export const SPOUSE_GAP = 20;
export const SIBLING_GAP = 54;
export const FAMILY_GAP = 96;
export const VERTICAL_GENERATION_GAP = 148;

/**
 * Format FamilySearch-style 7-character unique genealogy code
 */
export function getGenealogyCode(person: Person): string {
  if (person.customFields) {
    if (Array.isArray(person.customFields)) {
      const found = person.customFields.find((f: any) => f.key === 'fs_code' || f.label === 'ID' || f.key === 'id_code');
      if (found?.value) return found.value;
    } else if (typeof person.customFields === 'object' && (person.customFields as any).fs_code) {
      return (person.customFields as any).fs_code;
    }
  }

  // Derive a deterministic 7-character code: PXXX-XXX
  let hash = 0;
  const str = person.id || `${person.firstName}_${person.lastName}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  const chars = '23456789BCDFGHJKLMNPQRSTVWXYZ';
  let p1 = 'P';
  let absHash = Math.abs(hash);
  for (let i = 0; i < 3; i++) {
    p1 += chars[(absHash >> (i * 5)) % chars.length];
  }
  let p2 = '';
  for (let i = 0; i < 3; i++) {
    p2 += chars[(absHash >> ((i + 3) * 4)) % chars.length];
  }
  return `${p1}-${p2}`;
}

/**
 * Format Lifespan string matching classic genealogical notation (e.g. "1882–1928" or "1874–Померла")
 */
export function formatLifespan(person: Person): string {
  const isFemale = person.gender === 'female' || person.gender === 'F';
  const birth = person.birthYear || (person.birthDate ? person.birthDate.slice(0, 4) : '?');
  
  if (person.isLiving) {
    return birth !== '?' ? `${birth}–зараз` : 'Живий/а';
  }
  const death = person.deathYear || (person.deathDate ? person.deathDate.slice(0, 4) : null);
  if (death) {
    return `${birth}–${death}`;
  }
  if (birth !== '?') {
    return `${birth}–${isFemale ? 'Померла' : 'Помер'}`;
  }
  return '—';
}

/**
 * Helper to calculate max ancestor depth from root person in database
 */
export function getMaxAncestorGenerations(database: GenealogyDatabase, rootPersonId: string): number {
  const root = database.persons[rootPersonId];
  if (!root) return 0;

  function getDepth(person: Person, currentGen: number): number {
    const fId = person.fatherId || (person.parentFamilyId ? database.families[person.parentFamilyId]?.husbandId : undefined);
    const mId = person.motherId || (person.parentFamilyId ? database.families[person.parentFamilyId]?.wifeId : undefined);

    let maxChildDepth = currentGen;
    if (fId && database.persons[fId]) {
      maxChildDepth = Math.max(maxChildDepth, getDepth(database.persons[fId], currentGen + 1));
    }
    if (mId && database.persons[mId]) {
      maxChildDepth = Math.max(maxChildDepth, getDepth(database.persons[mId], currentGen + 1));
    }
    return maxChildDepth;
  }

  return getDepth(root, 1);
}

/**
 * Build classic pedigree / family tree layout with orthogonal links, grouped spouses & siblings
 */
export function calculateClassicFamilyTreeLayout(
  database: GenealogyDatabase,
  rootPersonId: string,
  maxGenerations: number = 0,
  options?: TreeLayoutFilterOptions
): TreeLayoutResult {
  const nodes: TreeNodeLayout[] = [];
  const links: TreeLinkLayout[] = [];

  const showParents = options?.showParents ?? true;
  const showSiblings = options?.showSiblings ?? true;
  const showDescendants = options?.showDescendants ?? true;
  const collapsedParents = options?.collapsedParents || new Set<string>();
  const collapsedSiblings = options?.collapsedSiblings || new Set<string>();
  const collapsedChildren = options?.collapsedChildren || new Set<string>();

  let root = database.persons[rootPersonId];
  if (!root) {
    root = database.persons['p_bom_olga'] || Object.values(database.persons)[0];
  }
  if (!root) {
    return { nodes: [], links: [], width: 1000, height: 800 };
  }

  // 1. Calculate relative generation level for all ancestors and descendants
  const personGen = new Map<string, number>();
  personGen.set(root.id, 0);

  // Traverse ancestors (Gen -1, Gen -2...)
  if (showParents) {
    const queueAnc: { id: string; gen: number }[] = [{ id: root.id, gen: 0 }];
    const visitedAnc = new Set<string>([root.id]);

    while (queueAnc.length > 0) {
      const { id, gen } = queueAnc.shift()!;
      if (maxGenerations > 0 && Math.abs(gen) >= maxGenerations) continue;
      // If this individual's parent branch is collapsed, do not traverse upward
      if (collapsedParents.has(id)) continue;

      const p = database.persons[id];
      if (!p) continue;

      const fId = p.fatherId || (p.parentFamilyId ? database.families[p.parentFamilyId]?.husbandId : undefined);
      const mId = p.motherId || (p.parentFamilyId ? database.families[p.parentFamilyId]?.wifeId : undefined);

      if (fId && database.persons[fId] && !visitedAnc.has(fId)) {
        visitedAnc.add(fId);
        personGen.set(fId, gen - 1);
        queueAnc.push({ id: fId, gen: gen - 1 });
      }
      if (mId && database.persons[mId] && !visitedAnc.has(mId)) {
        visitedAnc.add(mId);
        personGen.set(mId, gen - 1);
        queueAnc.push({ id: mId, gen: gen - 1 });
      }
    }
  }

  // Traverse descendants (gen + 1, +2 ...)
  if (showDescendants) {
    const queueDesc: { id: string; gen: number }[] = [{ id: root.id, gen: 0 }];
    const visitedDesc = new Set<string>([root.id]);

    while (queueDesc.length > 0) {
      const { id, gen } = queueDesc.shift()!;
      if (maxGenerations > 0 && gen >= maxGenerations) continue;
      // If this individual's children branch is collapsed, do not traverse downward
      if (collapsedChildren.has(id)) continue;

      const p = database.persons[id];
      if (!p) continue;

      const childIds = new Set<string>();
      if (p.childrenIds) p.childrenIds.forEach(c => childIds.add(c));
      if (p.spouseFamilyIds) {
        p.spouseFamilyIds.forEach(fId => {
          const fam = database.families[fId];
          if (fam?.children) fam.children.forEach(c => childIds.add(c.personId));
        });
      }

      childIds.forEach(cId => {
        if (database.persons[cId] && !visitedDesc.has(cId)) {
          visitedDesc.add(cId);
          personGen.set(cId, gen + 1);
          queueDesc.push({ id: cId, gen: gen + 1 });
        }
      });

      // Add spouses at same generation
      const spouseIds = new Set<string>();
      if (p.spouseIds) p.spouseIds.forEach(s => spouseIds.add(s));
      if (p.spouseFamilyIds) {
        p.spouseFamilyIds.forEach(fId => {
          const fam = database.families[fId];
          if (fam) {
            if (fam.husbandId && fam.husbandId !== p.id) spouseIds.add(fam.husbandId);
            if (fam.wifeId && fam.wifeId !== p.id) spouseIds.add(fam.wifeId);
          }
        });
      }
      spouseIds.forEach(sId => {
        if (database.persons[sId] && !personGen.has(sId)) {
          personGen.set(sId, gen);
        }
      });
    }
  }

  // Also include siblings for active ancestors and root
  if (showSiblings) {
    Array.from(personGen.entries()).forEach(([pId, gen]) => {
      // If this person has siblings collapsed, skip expanding their siblings
      if (collapsedSiblings.has(pId)) return;

      const p = database.persons[pId];
      if (!p) return;
      const fId = p.fatherId || (p.parentFamilyId ? database.families[p.parentFamilyId]?.husbandId : undefined);
      const mId = p.motherId || (p.parentFamilyId ? database.families[p.parentFamilyId]?.wifeId : undefined);

      if (fId || mId) {
        Object.values(database.persons).forEach(cand => {
          if (cand.id !== p.id && !personGen.has(cand.id)) {
            const cF = cand.fatherId || (cand.parentFamilyId ? database.families[cand.parentFamilyId]?.husbandId : undefined);
            const cM = cand.motherId || (cand.parentFamilyId ? database.families[cand.parentFamilyId]?.wifeId : undefined);
            if ((fId && cF === fId) || (mId && cM === mId)) {
              personGen.set(cand.id, gen);
              // also include cand's spouse if present
              if (cand.spouseIds) {
                cand.spouseIds.forEach(sId => {
                  if (database.persons[sId] && !personGen.has(sId)) {
                    personGen.set(sId, gen);
                  }
                });
              }
            }
          }
        });
      }
    });
  }

  // Normalize generations so top-most ancestor level is 0
  const minGen = Math.min(...Array.from(personGen.values()));
  const normalizedGen = new Map<string, number>();
  personGen.forEach((g, pId) => {
    normalizedGen.set(pId, g - minGen);
  });

  const totalGens = Math.max(...Array.from(normalizedGen.values()), 0) + 1;

  // Group persons by generation
  const genGroups: Map<number, Person[]> = new Map();
  for (let g = 0; g < totalGens; g++) {
    genGroups.set(g, []);
  }

  normalizedGen.forEach((gen, pId) => {
    const p = database.persons[pId];
    if (p) {
      genGroups.get(gen)?.push(p);
    }
  });

  // Helper structure for layout positioning
  interface Unit {
    type: 'couple' | 'single';
    primary: Person;
    spouse?: Person;
    width: number;
    x: number;
    y: number;
    childrenIds: string[];
    familyId?: string;
  }

  const genUnits: Map<number, Unit[]> = new Map();

  genGroups.forEach((personsInGen, gen) => {
    const units: Unit[] = [];
    const processed = new Set<string>();

    // 1. First pair up spouses
    personsInGen.forEach(p => {
      if (processed.has(p.id)) return;

      let spouse: Person | undefined = undefined;
      const spouseIds = p.spouseIds || [];
      for (const sId of spouseIds) {
        const sp = database.persons[sId];
        if (sp && normalizedGen.get(sId) === gen && !processed.has(sId)) {
          spouse = sp;
          break;
        }
      }

      // Check families table if spouseIds wasn't populated
      if (!spouse && p.spouseFamilyIds) {
        for (const fId of p.spouseFamilyIds) {
          const fam = database.families[fId];
          if (fam) {
            const partnerId = fam.husbandId === p.id ? fam.wifeId : fam.husbandId;
            if (partnerId && database.persons[partnerId] && normalizedGen.get(partnerId) === gen && !processed.has(partnerId)) {
              spouse = database.persons[partnerId];
              break;
            }
          }
        }
      }

      const isMale = p.gender === 'male' || p.gender === 'M';
      let primary = p;
      let secondary = spouse;

      // Always order husband on left, wife on right for standard pedigree view
      if (spouse && !isMale && (spouse.gender === 'male' || spouse.gender === 'M')) {
        primary = spouse;
        secondary = p;
      }

      // Find children of this couple or single person
      const childrenSet = new Set<string>();
      if (primary.childrenIds) primary.childrenIds.forEach(c => childrenSet.add(c));
      if (secondary?.childrenIds) secondary.childrenIds.forEach(c => childrenSet.add(c));

      if (primary.spouseFamilyIds) {
        primary.spouseFamilyIds.forEach(fId => {
          const fam = database.families[fId];
          if (fam?.children) fam.children.forEach(c => childrenSet.add(c.personId));
        });
      }

      const validChildren = Array.from(childrenSet).filter(cId => database.persons[cId] && normalizedGen.get(cId) === gen + 1);

      if (secondary) {
        processed.add(primary.id);
        processed.add(secondary.id);
        units.push({
          type: 'couple',
          primary,
          spouse: secondary,
          width: CLASSIC_CARD_WIDTH * 2 + SPOUSE_GAP,
          x: 0,
          y: gen * (CLASSIC_CARD_HEIGHT + VERTICAL_GENERATION_GAP) + 80,
          childrenIds: validChildren
        });
      } else {
        processed.add(primary.id);
        units.push({
          type: 'single',
          primary,
          width: CLASSIC_CARD_WIDTH,
          x: 0,
          y: gen * (CLASSIC_CARD_HEIGHT + VERTICAL_GENERATION_GAP) + 80,
          childrenIds: validChildren
        });
      }
    });

    genUnits.set(gen, units);
  });

  // Position units across generations with family sorting and multi-pass alignment
  let maxTreeWidth = 1600;
  let maxTreeHeight = totalGens * (CLASSIC_CARD_HEIGHT + VERTICAL_GENERATION_GAP) + 200;

  // Initial horizontal placement per generation with generous family spacing
  genUnits.forEach((units, gen) => {
    let currentX = 100;
    units.forEach((unit, idx) => {
      unit.x = currentX;
      const isNextDifferentFamily = idx < units.length - 1 && units[idx + 1].primary.parentFamilyId !== unit.primary.parentFamilyId;
      currentX += unit.width + (isNextDifferentFamily ? FAMILY_GAP : SIBLING_GAP);
    });
    maxTreeWidth = Math.max(maxTreeWidth, currentX + 100);
  });

  // Center levels relative to each other (align parents above their children & children under parents)
  for (let pass = 0; pass < 3; pass++) {
    // Bottom-up pass: align parents above children
    for (let gen = totalGens - 2; gen >= 0; gen--) {
      const parentUnits = genUnits.get(gen) || [];
      const childUnits = genUnits.get(gen + 1) || [];

      parentUnits.forEach((pUnit) => {
        if (pUnit.childrenIds.length > 0) {
          const childUnitMatches = childUnits.filter(cu => 
            pUnit.childrenIds.includes(cu.primary.id) || (cu.spouse && pUnit.childrenIds.includes(cu.spouse.id))
          );

          if (childUnitMatches.length > 0) {
            const firstChildX = childUnitMatches[0].x;
            const lastChildX = childUnitMatches[childUnitMatches.length - 1].x + childUnitMatches[childUnitMatches.length - 1].width;
            const childrenCenterX = (firstChildX + lastChildX) / 2;
            const idealParentX = childrenCenterX - pUnit.width / 2;
            pUnit.x = idealParentX;
          }
        }
      });

      // Prevent overlapping within the same generation
      for (let i = 1; i < parentUnits.length; i++) {
        const prev = parentUnits[i - 1];
        const curr = parentUnits[i];
        const gap = (prev.primary.parentFamilyId && curr.primary.parentFamilyId && prev.primary.parentFamilyId === curr.primary.parentFamilyId)
          ? SIBLING_GAP
          : FAMILY_GAP;
        if (curr.x < prev.x + prev.width + gap) {
          curr.x = prev.x + prev.width + gap;
        }
      }
    }

    // Top-down pass: align child groups under parent units
    for (let gen = 0; gen < totalGens - 1; gen++) {
      const parentUnits = genUnits.get(gen) || [];
      const childUnits = genUnits.get(gen + 1) || [];

      parentUnits.forEach((pUnit) => {
        if (pUnit.childrenIds.length > 0) {
          const childUnitMatches = childUnits.filter(cu => 
            pUnit.childrenIds.includes(cu.primary.id) || (cu.spouse && pUnit.childrenIds.includes(cu.spouse.id))
          );

          if (childUnitMatches.length > 0) {
            const parentCenterX = pUnit.x + pUnit.width / 2;
            const totalChildGroupWidth = childUnitMatches.reduce((acc, cu) => acc + cu.width, 0) + (childUnitMatches.length - 1) * SIBLING_GAP;
            let startChildX = parentCenterX - totalChildGroupWidth / 2;

            childUnitMatches.forEach((cu) => {
              cu.x = startChildX;
              startChildX += cu.width + SIBLING_GAP;
            });
          }
        }
      });

      // Prevent overlapping in children generation
      for (let i = 1; i < childUnits.length; i++) {
        const prev = childUnits[i - 1];
        const curr = childUnits[i];
        const gap = (prev.primary.parentFamilyId && curr.primary.parentFamilyId && prev.primary.parentFamilyId === curr.primary.parentFamilyId)
          ? SIBLING_GAP
          : FAMILY_GAP;
        if (curr.x < prev.x + prev.width + gap) {
          curr.x = prev.x + prev.width + gap;
        }
      }
    }
  }

  // Ensure minimum left margin of 100px across all units
  let globalMinX = Infinity;
  genUnits.forEach(units => {
    units.forEach(u => {
      globalMinX = Math.min(globalMinX, u.x);
    });
  });

  if (globalMinX < 100) {
    const shift = 100 - globalMinX;
    genUnits.forEach(units => {
      units.forEach(u => {
        u.x += shift;
      });
    });
  }

  // Create node layouts and record coordinates
  const nodeMap = new Map<string, { x: number; y: number; width: number; height: number; centerX: number; centerY: number }>();

  // Helper to compute relationship collapse/expand flags
  const getNodeFlags = (p: Person) => {
    const fId = p.fatherId || (p.parentFamilyId ? database.families[p.parentFamilyId]?.husbandId : undefined);
    const mId = p.motherId || (p.parentFamilyId ? database.families[p.parentFamilyId]?.wifeId : undefined);
    const parentsCount = (fId && database.persons[fId] ? 1 : 0) + (mId && database.persons[mId] ? 1 : 0);
    const hasParents = parentsCount > 0;
    const areParentsVisible = (fId && personGen.has(fId)) || (mId && personGen.has(mId));
    const isParentsCollapsed = collapsedParents.has(p.id) || !showParents || (hasParents && !areParentsVisible);

    let siblingCount = 0;
    let areSiblingsVisible = false;
    if (fId || mId) {
      const sibs = Object.values(database.persons).filter(cand => 
        cand.id !== p.id && (
          (fId && (cand.fatherId === fId || (cand.parentFamilyId && database.families[cand.parentFamilyId]?.husbandId === fId))) ||
          (mId && (cand.motherId === mId || (cand.parentFamilyId && database.families[cand.parentFamilyId]?.wifeId === mId)))
        )
      );
      siblingCount = sibs.length;
      areSiblingsVisible = sibs.some(s => personGen.has(s.id));
    }
    const hasSiblings = siblingCount > 0;
    const isSiblingsCollapsed = collapsedSiblings.has(p.id) || !showSiblings || (hasSiblings && !areSiblingsVisible);

    const childIds = new Set<string>();
    if (p.childrenIds) p.childrenIds.forEach(c => childIds.add(c));
    if (p.spouseFamilyIds) {
      p.spouseFamilyIds.forEach(fId => {
        const fam = database.families[fId];
        if (fam?.children) fam.children.forEach(c => childIds.add(c.personId));
      });
    }
    const validChildren = Array.from(childIds).filter(cId => database.persons[cId]);
    const childrenCount = validChildren.length;
    const hasChildren = childrenCount > 0;
    const areChildrenVisible = validChildren.some(cId => personGen.has(cId));
    const isChildrenCollapsed = collapsedChildren.has(p.id) || !showDescendants || (hasChildren && !areChildrenVisible);

    return {
      hasParents,
      hasSiblings,
      hasChildren,
      parentsCount,
      siblingsCount: siblingCount,
      childrenCount,
      isParentsCollapsed,
      isSiblingsCollapsed,
      isChildrenCollapsed,
      areParentsVisible: Boolean(areParentsVisible),
      areSiblingsVisible,
      areChildrenVisible
    };
  };

  // 1. First Pass: create all node objects and populate nodeMap
  genUnits.forEach((units, gen) => {
    units.forEach((unit) => {
      if (unit.type === 'couple' && unit.spouse) {
        // Husband (left)
        const hX = unit.x;
        const hY = unit.y;
        const hFlags = getNodeFlags(unit.primary);
        nodes.push({
          id: unit.primary.id,
          person: unit.primary,
          x: hX,
          y: hY,
          width: CLASSIC_CARD_WIDTH,
          height: CLASSIC_CARD_HEIGHT,
          generation: gen,
          spouseId: unit.spouse.id,
          ...hFlags
        });
        nodeMap.set(unit.primary.id, {
          x: hX,
          y: hY,
          width: CLASSIC_CARD_WIDTH,
          height: CLASSIC_CARD_HEIGHT,
          centerX: hX + CLASSIC_CARD_WIDTH / 2,
          centerY: hY + CLASSIC_CARD_HEIGHT / 2
        });

        // Wife (right)
        const wX = unit.x + CLASSIC_CARD_WIDTH + SPOUSE_GAP;
        const wY = unit.y;
        const wFlags = getNodeFlags(unit.spouse);
        nodes.push({
          id: unit.spouse.id,
          person: unit.spouse,
          x: wX,
          y: wY,
          width: CLASSIC_CARD_WIDTH,
          height: CLASSIC_CARD_HEIGHT,
          generation: gen,
          spouseId: unit.primary.id,
          isSpouseNode: true,
          ...wFlags
        });
        nodeMap.set(unit.spouse.id, {
          x: wX,
          y: wY,
          width: CLASSIC_CARD_WIDTH,
          height: CLASSIC_CARD_HEIGHT,
          centerX: wX + CLASSIC_CARD_WIDTH / 2,
          centerY: wY + CLASSIC_CARD_HEIGHT / 2
        });
      } else {
        // Single person
        const pX = unit.x;
        const pY = unit.y;
        const sFlags = getNodeFlags(unit.primary);
        nodes.push({
          id: unit.primary.id,
          person: unit.primary,
          x: pX,
          y: pY,
          width: CLASSIC_CARD_WIDTH,
          height: CLASSIC_CARD_HEIGHT,
          generation: gen,
          ...sFlags
        });
        nodeMap.set(unit.primary.id, {
          x: pX,
          y: pY,
          width: CLASSIC_CARD_WIDTH,
          height: CLASSIC_CARD_HEIGHT,
          centerX: pX + CLASSIC_CARD_WIDTH / 2,
          centerY: pY + CLASSIC_CARD_HEIGHT / 2
        });
      }
    });
  });

  // 2. Second Pass: Generate all orthogonal marriage, stem, bus and drop links with distinct colors and staggered Y levels
  genUnits.forEach((units, gen) => {
    units.forEach((unit, unitIdx) => {
      // Pick unique, distinct lineage color for this parent unit
      const unitColor = FAMILY_LINE_COLORS[(gen * 3 + unitIdx) % FAMILY_LINE_COLORS.length];
      const pY = unit.y;
      // Stagger horizontal junction Y levels so neighboring family bus bars NEVER overlap horizontally
      const baseJunctionY = pY + CLASSIC_CARD_HEIGHT + 36;
      const junctionY = baseJunctionY + (unitIdx % 4) * 22;

      if (unit.type === 'couple' && unit.spouse) {
        const hNode = nodeMap.get(unit.primary.id)!;
        const wNode = nodeMap.get(unit.spouse.id)!;
        const marriageMidX = (hNode.x + CLASSIC_CARD_WIDTH + wNode.x) / 2;
        const marriageMidY = hNode.y + CLASSIC_CARD_HEIGHT / 2;

        // Marriage link between husband and wife
        links.push({
          id: `m_${unit.primary.id}_${unit.spouse.id}`,
          sourceX: hNode.x + CLASSIC_CARD_WIDTH,
          sourceY: marriageMidY,
          targetX: wNode.x,
          targetY: marriageMidY,
          type: 'marriage',
          color: '#a1a1aa',
          sourcePersonId: unit.primary.id,
          targetPersonId: unit.spouse.id,
          path: `M ${hNode.x + CLASSIC_CARD_WIDTH} ${marriageMidY} L ${wNode.x} ${marriageMidY}`
        });

        // If couple has children, create stem and bus down
        if (unit.childrenIds.length > 0) {
          const childCoords = unit.childrenIds
            .map(cId => ({ id: cId, ...nodeMap.get(cId)! }))
            .filter(c => c && c.centerX !== undefined);

          if (childCoords.length > 0) {
            // Vertical stem from marriage midpoint down to staggered junctionY
            links.push({
              id: `stem_${unit.primary.id}_${unit.spouse.id}`,
              sourceX: marriageMidX,
              sourceY: marriageMidY,
              targetX: marriageMidX,
              targetY: junctionY,
              type: 'stem',
              color: unitColor,
              familyId: unit.primary.id,
              sourcePersonId: unit.primary.id,
              targetPersonId: unit.spouse.id,
              path: `M ${marriageMidX} ${marriageMidY} L ${marriageMidX} ${junctionY}`
            });

            // Calculate horizontal span of bus bar
            const minChildX = Math.min(...childCoords.map(c => c.centerX));
            const maxChildX = Math.max(...childCoords.map(c => c.centerX));
            const busLeft = Math.min(marriageMidX, minChildX);
            const busRight = Math.max(marriageMidX, maxChildX);

            // Horizontal sibling bus bar (only for this specific family)
            if (busLeft !== busRight || childCoords.length > 1) {
              links.push({
                id: `bus_${unit.primary.id}_${unit.spouse.id}`,
                sourceX: busLeft,
                sourceY: junctionY,
                targetX: busRight,
                targetY: junctionY,
                type: 'bus',
                color: unitColor,
                familyId: unit.primary.id,
                sourcePersonId: unit.primary.id,
                path: `M ${busLeft} ${junctionY} L ${busRight} ${junctionY}`
              });
            }

            // Drop lines to each child
            childCoords.forEach(child => {
              links.push({
                id: `drop_${unit.primary.id}_${child.id}`,
                sourceX: child.centerX,
                sourceY: junctionY,
                targetX: child.centerX,
                targetY: child.y,
                type: 'drop',
                color: unitColor,
                familyId: unit.primary.id,
                sourcePersonId: unit.primary.id,
                childPersonId: child.id,
                arrow: 'down',
                arrowX: child.centerX,
                arrowY: child.y,
                path: `M ${child.centerX} ${junctionY} L ${child.centerX} ${child.y}`
              });
            });
          }
        }
      } else {
        // Single parent
        const pNode = nodeMap.get(unit.primary.id)!;
        const stemX = pNode.centerX;
        const stemY = pNode.y + CLASSIC_CARD_HEIGHT;

        if (unit.childrenIds.length > 0) {
          const childCoords = unit.childrenIds
            .map(cId => ({ id: cId, ...nodeMap.get(cId)! }))
            .filter(c => c && c.centerX !== undefined);

          if (childCoords.length > 0) {
            // Vertical stem down to staggered junctionY
            links.push({
              id: `stem_${unit.primary.id}`,
              sourceX: stemX,
              sourceY: stemY,
              targetX: stemX,
              targetY: junctionY,
              type: 'stem',
              color: unitColor,
              familyId: unit.primary.id,
              sourcePersonId: unit.primary.id,
              path: `M ${stemX} ${stemY} L ${stemX} ${junctionY}`
            });

            const minChildX = Math.min(...childCoords.map(c => c.centerX));
            const maxChildX = Math.max(...childCoords.map(c => c.centerX));
            const busLeft = Math.min(stemX, minChildX);
            const busRight = Math.max(stemX, maxChildX);

            if (busLeft !== busRight || childCoords.length > 1) {
              links.push({
                id: `bus_${unit.primary.id}`,
                sourceX: busLeft,
                sourceY: junctionY,
                targetX: busRight,
                targetY: junctionY,
                type: 'bus',
                color: unitColor,
                familyId: unit.primary.id,
                sourcePersonId: unit.primary.id,
                path: `M ${busLeft} ${junctionY} L ${busRight} ${junctionY}`
              });
            }

            childCoords.forEach(child => {
              links.push({
                id: `drop_${unit.primary.id}_${child.id}`,
                sourceX: child.centerX,
                sourceY: junctionY,
                targetX: child.centerX,
                targetY: child.y,
                type: 'drop',
                color: unitColor,
                familyId: unit.primary.id,
                sourcePersonId: unit.primary.id,
                childPersonId: child.id,
                arrow: 'down',
                arrowX: child.centerX,
                arrowY: child.y,
                path: `M ${child.centerX} ${junctionY} L ${child.centerX} ${child.y}`
              });
            });
          }
        }
      }
    });
  });

  // Recalculate full dimensions
  let finalMaxX = 1400;
  let finalMaxY = 900;
  nodes.forEach(n => {
    finalMaxX = Math.max(finalMaxX, n.x + n.width + 120);
    finalMaxY = Math.max(finalMaxY, n.y + n.height + 120);
  });

  return {
    nodes,
    links,
    width: finalMaxX,
    height: finalMaxY
  };
}

/**
 * Ancestors Layout (Classic vertical or tree structure)
 */
export function calculateAncestorsLayout(
  database: GenealogyDatabase,
  rootPersonId: string,
  maxGenerations: number = 8,
  options?: TreeLayoutFilterOptions
): TreeLayoutResult {
  // Delegate directly to the classic orthogonal family pedigree layout for pristine presentation!
  return calculateClassicFamilyTreeLayout(database, rootPersonId, maxGenerations, options);
}

/**
 * Descendants Layout (Top-down descendants with orthogonal links)
 */
export function calculateDescendantsLayout(
  database: GenealogyDatabase,
  rootPersonId: string,
  maxGenerations: number = 8
): TreeLayoutResult {
  return calculateClassicFamilyTreeLayout(database, rootPersonId, maxGenerations);
}

export function calculateHourglassLayout(
  database: GenealogyDatabase,
  rootPersonId: string,
  maxGenerations: number = 6
): TreeLayoutResult {
  return calculateClassicFamilyTreeLayout(database, rootPersonId, maxGenerations);
}

export function calculateFanChart(
  database: GenealogyDatabase,
  rootPersonId: string,
  generations: number = 0,
  customInnerRadius?: number,
  customRingWidth?: number
): FanChartSector[] {
  const sectors: FanChartSector[] = [];
  const root = database.persons[rootPersonId];
  if (!root) return sectors;

  // Determine actual max depth for adaptive sizing
  const maxAvailableGens = getMaxAncestorGenerations(database, rootPersonId);
  const effectiveGens = generations > 0 ? generations : maxAvailableGens;

  // Adaptive ring sizing based on number of generations to fit perfectly
  let innerRadiusBase = customInnerRadius !== undefined ? customInnerRadius : 60;
  let ringWidth = customRingWidth !== undefined ? customRingWidth : 72;

  if (customRingWidth === undefined) {
    if (effectiveGens <= 4) {
      innerRadiusBase = 65;
      ringWidth = 80;
    } else if (effectiveGens === 5) {
      innerRadiusBase = 60;
      ringWidth = 72;
    } else if (effectiveGens === 6) {
      innerRadiusBase = 56;
      ringWidth = 64;
    } else if (effectiveGens === 7) {
      innerRadiusBase = 52;
      ringWidth = 56;
    } else if (effectiveGens === 8) {
      innerRadiusBase = 48;
      ringWidth = 50;
    } else if (effectiveGens === 9) {
      innerRadiusBase = 45;
      ringWidth = 46;
    } else {
      innerRadiusBase = 40;
      ringWidth = Math.max(36, Math.floor(450 / Math.max(effectiveGens, 10)));
    }
  }

  function getBranchColor(ahnentafel: number, gen: number, person: Person): string {
    if (gen === 0) return '#059669';
    if (gen === 1) {
      return person.gender === 'female' || person.gender === 'F' ? '#EC4899' : '#3B82F6';
    }
    let anc2 = ahnentafel;
    while (anc2 >= 8) {
      anc2 = Math.floor(anc2 / 2);
    }
    if (anc2 === 4) return '#2563EB'; // Blue (Paternal Grandfather)
    if (anc2 === 5) return '#06B6D4'; // Cyan (Paternal Grandmother)
    if (anc2 === 6) return '#F97316'; // Amber (Maternal Grandfather)
    if (anc2 === 7) return '#E11D48'; // Rose (Maternal Grandmother)

    return person.gender === 'female' || person.gender === 'F' ? '#F43F5E' : '#3B82F6';
  }

  function addAncestorToFan(
    person: Person,
    gen: number,
    ahnentafel: number,
    startAngle: number,
    endAngle: number
  ) {
    if (generations > 0 && gen >= generations) return;

    const innerRadius = gen === 0 ? 0 : innerRadiusBase + (gen - 1) * ringWidth;
    const outerRadius = innerRadiusBase + gen * ringWidth;
    const branchColor = getBranchColor(ahnentafel, gen, person);

    sectors.push({
      ahnentafelNumber: ahnentafel,
      person,
      generation: gen,
      innerRadius,
      outerRadius,
      startAngle,
      endAngle,
      fillColor: branchColor
    });

    const midAngle = (startAngle + endAngle) / 2;
    const fId = person.fatherId || (person.parentFamilyId ? database.families[person.parentFamilyId]?.husbandId : undefined);
    const mId = person.motherId || (person.parentFamilyId ? database.families[person.parentFamilyId]?.wifeId : undefined);

    if (fId && database.persons[fId]) {
      addAncestorToFan(database.persons[fId], gen + 1, ahnentafel * 2, startAngle, midAngle);
    }
    if (mId && database.persons[mId]) {
      addAncestorToFan(database.persons[mId], gen + 1, ahnentafel * 2 + 1, midAngle, endAngle);
    }
  }

  addAncestorToFan(root, 0, 1, Math.PI, 2 * Math.PI);
  return sectors;
}
