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
}

export interface TreeLinkLayout {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  type?: 'marriage' | 'child' | 'orthogonal' | 'bezier';
  path?: string;
  arrow?: 'up' | 'down' | 'none';
  arrowX?: number;
  arrowY?: number;
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

// Classic FamilySearch / Pedigree Card Dimensions
export const CLASSIC_CARD_WIDTH = 156;
export const CLASSIC_CARD_HEIGHT = 190;
export const SPOUSE_GAP = 18;
export const SIBLING_GAP = 28;
export const FAMILY_GAP = 54;
export const VERTICAL_GENERATION_GAP = 85;

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
 * Build classic pedigree / family tree layout with orthogonal links, grouped spouses & siblings
 */
export function calculateClassicFamilyTreeLayout(
  database: GenealogyDatabase,
  rootPersonId: string,
  maxGenerations: number = 8
): TreeLayoutResult {
  const nodes: TreeNodeLayout[] = [];
  const links: TreeLinkLayout[] = [];

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

  // Traverse ancestors (negative or positive generations; let's set root = Gen 0, parents = Gen -1, grandparents = Gen -2)
  const queueAnc: { id: string; gen: number }[] = [{ id: root.id, gen: 0 }];
  const visitedAnc = new Set<string>([root.id]);

  while (queueAnc.length > 0) {
    const { id, gen } = queueAnc.shift()!;
    if (Math.abs(gen) >= maxGenerations) continue;
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

  // Traverse descendants (gen + 1, +2 ...)
  const queueDesc: { id: string; gen: number }[] = [{ id: root.id, gen: 0 }];
  const visitedDesc = new Set<string>([root.id]);

  while (queueDesc.length > 0) {
    const { id, gen } = queueDesc.shift()!;
    if (gen >= maxGenerations) continue;
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

  // Also include siblings for active ancestors and root
  Array.from(personGen.entries()).forEach(([pId, gen]) => {
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

  // Position units across generations
  let maxTreeWidth = 1400;
  let maxTreeHeight = totalGens * (CLASSIC_CARD_HEIGHT + VERTICAL_GENERATION_GAP) + 160;

  // Initial horizontal placement per generation with centering
  genUnits.forEach((units, gen) => {
    let currentX = 80;
    units.forEach((unit) => {
      unit.x = currentX;
      currentX += unit.width + SIBLING_GAP;
    });
    maxTreeWidth = Math.max(maxTreeWidth, currentX + 80);
  });

  // Center levels relative to each other (align parents above their children)
  for (let pass = 0; pass < 2; pass++) {
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
        if (curr.x < prev.x + prev.width + SIBLING_GAP) {
          curr.x = prev.x + prev.width + SIBLING_GAP;
        }
      }
    }
  }

  // Ensure minimum left margin of 80px across all units
  let globalMinX = Infinity;
  genUnits.forEach(units => {
    units.forEach(u => {
      globalMinX = Math.min(globalMinX, u.x);
    });
  });

  if (globalMinX < 80) {
    const shift = 80 - globalMinX;
    genUnits.forEach(units => {
      units.forEach(u => {
        u.x += shift;
      });
    });
  }

  // Create node layouts and record coordinates
  const nodeMap = new Map<string, { x: number; y: number; width: number; height: number; centerX: number; centerY: number }>();

  genUnits.forEach((units, gen) => {
    units.forEach((unit) => {
      if (unit.type === 'couple' && unit.spouse) {
        // Husband (left)
        const hX = unit.x;
        const hY = unit.y;
        nodes.push({
          id: unit.primary.id,
          person: unit.primary,
          x: hX,
          y: hY,
          width: CLASSIC_CARD_WIDTH,
          height: CLASSIC_CARD_HEIGHT,
          generation: gen,
          spouseId: unit.spouse.id
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
        nodes.push({
          id: unit.spouse.id,
          person: unit.spouse,
          x: wX,
          y: wY,
          width: CLASSIC_CARD_WIDTH,
          height: CLASSIC_CARD_HEIGHT,
          generation: gen,
          spouseId: unit.primary.id,
          isSpouseNode: true
        });
        nodeMap.set(unit.spouse.id, {
          x: wX,
          y: wY,
          width: CLASSIC_CARD_WIDTH,
          height: CLASSIC_CARD_HEIGHT,
          centerX: wX + CLASSIC_CARD_WIDTH / 2,
          centerY: wY + CLASSIC_CARD_HEIGHT / 2
        });

        // Marriage orthogonal connector line between husband & wife cards
        const marriageMidX = (hX + CLASSIC_CARD_WIDTH + wX) / 2;
        const marriageMidY = hY + CLASSIC_CARD_HEIGHT / 2;

        links.push({
          id: `m_${unit.primary.id}_${unit.spouse.id}`,
          sourceX: hX + CLASSIC_CARD_WIDTH,
          sourceY: marriageMidY,
          targetX: wX,
          targetY: marriageMidY,
          type: 'marriage',
          path: `M ${hX + CLASSIC_CARD_WIDTH} ${marriageMidY} L ${wX} ${marriageMidY}`
        });

        // If couple has children, create classic orthogonal family tree branch
        if (unit.childrenIds.length > 0) {
          const childNodeCoords = unit.childrenIds
            .map(cId => nodeMap.get(cId))
            .filter(Boolean) as { x: number; y: number; width: number; height: number; centerX: number; centerY: number }[];

          const junctionY = hY + CLASSIC_CARD_HEIGHT + VERTICAL_GENERATION_GAP / 2;

          // Vertical stem down from midpoint of marriage
          links.push({
            id: `stem_${unit.primary.id}_${unit.spouse.id}`,
            sourceX: marriageMidX,
            sourceY: marriageMidY,
            targetX: marriageMidX,
            targetY: junctionY,
            type: 'orthogonal',
            path: `M ${marriageMidX} ${marriageMidY} L ${marriageMidX} ${junctionY}`
          });
        }
      } else {
        // Single person
        const pX = unit.x;
        const pY = unit.y;
        nodes.push({
          id: unit.primary.id,
          person: unit.primary,
          x: pX,
          y: pY,
          width: CLASSIC_CARD_WIDTH,
          height: CLASSIC_CARD_HEIGHT,
          generation: gen
        });
        nodeMap.set(unit.primary.id, {
          x: pX,
          y: pY,
          width: CLASSIC_CARD_WIDTH,
          height: CLASSIC_CARD_HEIGHT,
          centerX: pX + CLASSIC_CARD_WIDTH / 2,
          centerY: pY + CLASSIC_CARD_HEIGHT / 2
        });

        // Vertical stem down if single parent has children
        if (unit.childrenIds.length > 0) {
          const junctionY = pY + CLASSIC_CARD_HEIGHT + VERTICAL_GENERATION_GAP / 2;
          links.push({
            id: `stem_${unit.primary.id}`,
            sourceX: pX + CLASSIC_CARD_WIDTH / 2,
            sourceY: pY + CLASSIC_CARD_HEIGHT,
            targetX: pX + CLASSIC_CARD_WIDTH / 2,
            targetY: junctionY,
            type: 'orthogonal',
            path: `M ${pX + CLASSIC_CARD_WIDTH / 2} ${pY + CLASSIC_CARD_HEIGHT} L ${pX + CLASSIC_CARD_WIDTH / 2} ${junctionY}`
          });
        }
      }
    });
  });

  // Second pass: Connect child cards to parent stems via horizontal sibling bus bars
  genUnits.forEach((units) => {
    units.forEach((unit) => {
      if (unit.childrenIds.length > 0) {
        const childCoords = unit.childrenIds
          .map(cId => ({ id: cId, ...nodeMap.get(cId)! }))
          .filter(c => c && c.centerX !== undefined);

        if (childCoords.length === 0) return;

        const pY = unit.y;
        const junctionY = pY + CLASSIC_CARD_HEIGHT + VERTICAL_GENERATION_GAP / 2;

        let stemX = unit.x + unit.width / 2;
        if (unit.type === 'couple' && unit.spouse) {
          stemX = unit.x + CLASSIC_CARD_WIDTH + SPOUSE_GAP / 2;
        }

        const minChildX = Math.min(...childCoords.map(c => c.centerX));
        const maxChildX = Math.max(...childCoords.map(c => c.centerX));

        const busLeft = Math.min(stemX, minChildX);
        const busRight = Math.max(stemX, maxChildX);

        // Horizontal sibling bus bar
        links.push({
          id: `bus_${unit.primary.id}`,
          sourceX: busLeft,
          sourceY: junctionY,
          targetX: busRight,
          targetY: junctionY,
          type: 'orthogonal',
          path: `M ${busLeft} ${junctionY} L ${busRight} ${junctionY}`
        });

        // Vertical drop lines down to top of each child card (with arrowheads)
        childCoords.forEach(child => {
          links.push({
            id: `drop_${unit.primary.id}_${child.id}`,
            sourceX: child.centerX,
            sourceY: junctionY,
            targetX: child.centerX,
            targetY: child.y,
            type: 'orthogonal',
            arrow: 'down',
            arrowX: child.centerX,
            arrowY: child.y,
            path: `M ${child.centerX} ${junctionY} L ${child.centerX} ${child.y}`
          });
        });
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
  maxGenerations: number = 8
): TreeLayoutResult {
  // Delegate directly to the classic orthogonal family pedigree layout for pristine presentation!
  return calculateClassicFamilyTreeLayout(database, rootPersonId, maxGenerations);
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
  generations: number = 5,
  innerRadiusBase: number = 60,
  ringWidth: number = 75
): FanChartSector[] {
  const sectors: FanChartSector[] = [];
  const root = database.persons[rootPersonId];
  if (!root) return sectors;

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
    if (gen >= generations) return;

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
