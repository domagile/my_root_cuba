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
  marriageOrder?: number;
  marriageStatus?: string;
  marriageDate?: string;
  marriageYear?: number;
  divorceDate?: string;
  divorceYear?: number;
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
  marriageOrder?: number;
  marriageStatus?: string;
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

      // Include all spouses of ancestors at the same generation (e.g. 1st wife, 2nd wife)
      const ancSpouseIds = new Set<string>();
      if (p.spouseIds) p.spouseIds.forEach(s => ancSpouseIds.add(s));
      if (p.spouseFamilyIds) {
        p.spouseFamilyIds.forEach(fId => {
          const fam = database.families[fId];
          if (fam) {
            if (fam.husbandId && fam.husbandId !== p.id) ancSpouseIds.add(fam.husbandId);
            if (fam.wifeId && fam.wifeId !== p.id) ancSpouseIds.add(fam.wifeId);
          }
        });
      }
      ancSpouseIds.forEach(sId => {
        if (database.persons[sId] && !personGen.has(sId)) {
          personGen.set(sId, gen);
        }
      });
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

  // Also include siblings for active ancestors and root (collapsible collateral lines)
  if (showSiblings) {
    const baseIds = Array.from(personGen.keys());
    baseIds.forEach((pId) => {
      // If this person has siblings collapsed, skip expanding their siblings
      if (collapsedSiblings.has(pId)) return;

      const p = database.persons[pId];
      if (!p) return;
      const gen = personGen.get(pId)!;
      const fId = p.fatherId || (p.parentFamilyId ? database.families[p.parentFamilyId]?.husbandId : undefined);
      const mId = p.motherId || (p.parentFamilyId ? database.families[p.parentFamilyId]?.wifeId : undefined);

      if (fId || mId) {
        Object.values(database.persons).forEach(cand => {
          if (cand.id !== p.id && !personGen.has(cand.id)) {
            const cF = cand.fatherId || (cand.parentFamilyId ? database.families[cand.parentFamilyId]?.husbandId : undefined);
            const cM = cand.motherId || (cand.parentFamilyId ? database.families[cand.parentFamilyId]?.wifeId : undefined);
            if ((fId && cF === fId) || (mId && cM === mId)) {
              // If candidate itself or sibling cohort is collapsed, don't show
              if (collapsedSiblings.has(cand.id)) return;

              personGen.set(cand.id, gen);
              // Also include candidate's spouse(s) if present
              const candSpouseIds = new Set<string>();
              if (cand.spouseIds) cand.spouseIds.forEach(s => candSpouseIds.add(s));
              if (cand.spouseFamilyIds) {
                cand.spouseFamilyIds.forEach(f => {
                  const fam = database.families[f];
                  if (fam) {
                    if (fam.husbandId && fam.husbandId !== cand.id) candSpouseIds.add(fam.husbandId);
                    if (fam.wifeId && fam.wifeId !== cand.id) candSpouseIds.add(fam.wifeId);
                  }
                });
              }
              candSpouseIds.forEach(sId => {
                if (database.persons[sId] && !personGen.has(sId)) {
                  personGen.set(sId, gen);
                }
              });
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

  // Multi-spouse support structure for layout positioning
  interface SpouseInfo {
    spouse: Person;
    family?: any;
    marriageOrder: number;
    relationshipType?: string;
    marriageDate?: string;
    marriageYear?: number;
    divorceDate?: string;
    divorceYear?: number;
    childrenIds: string[];
  }

  interface Unit {
    type: 'single' | 'couple' | 'multi_spouse';
    primary: Person;
    spouses: SpouseInfo[];
    width: number;
    x: number;
    y: number;
    childrenIds: string[];
  }

  const genUnits: Map<number, Unit[]> = new Map();

  genGroups.forEach((personsInGen, gen) => {
    const units: Unit[] = [];
    const processed = new Set<string>();

    personsInGen.forEach(p => {
      if (processed.has(p.id)) return;

      // Find all spouses for this person in this generation
      const spouseIdsSet = new Set<string>();
      if (p.spouseIds) p.spouseIds.forEach(s => spouseIdsSet.add(s));
      if (p.spouseFamilyIds) {
        p.spouseFamilyIds.forEach(fId => {
          const fam = database.families[fId];
          if (fam) {
            const partnerId = fam.husbandId === p.id ? fam.wifeId : fam.husbandId;
            if (partnerId) spouseIdsSet.add(partnerId);
          }
        });
      }

      const rawSpouses: Person[] = [];
      spouseIdsSet.forEach(sId => {
        const sp = database.persons[sId];
        if (sp && normalizedGen.get(sId) === gen && !processed.has(sId)) {
          rawSpouses.push(sp);
        }
      });

      // Build enriched spouse info (with family metadata, marriage order, dates, divorce status)
      const spousesInfo: SpouseInfo[] = rawSpouses.map((sp, idx) => {
        // Find family connecting p and sp
        let matchedFam: any = undefined;
        if (p.spouseFamilyIds) {
          for (const fId of p.spouseFamilyIds) {
            const fam = database.families[fId];
            if (fam && ((fam.husbandId === p.id && fam.wifeId === sp.id) || (fam.husbandId === sp.id && fam.wifeId === p.id))) {
              matchedFam = fam;
              break;
            }
          }
        }
        if (!matchedFam && database.families) {
          matchedFam = Object.values(database.families).find((fam: any) => 
            (fam.husbandId === p.id && fam.wifeId === sp.id) || (fam.husbandId === sp.id && fam.wifeId === p.id)
          );
        }

        // Determine children for this specific marriage union
        const unionChildren = new Set<string>();
        if (matchedFam?.children) {
          matchedFam.children.forEach((c: any) => unionChildren.add(c.personId || c.id));
        }
        // Also check if any children have both p and sp as parents
        Object.values(database.persons).forEach(candChild => {
          if (
            (candChild.fatherId === p.id && candChild.motherId === sp.id) ||
            (candChild.fatherId === sp.id && candChild.motherId === p.id)
          ) {
            unionChildren.add(candChild.id);
          }
        });

        const validUnionChildren = Array.from(unionChildren).filter(
          cId => database.persons[cId] && normalizedGen.get(cId) === gen + 1
        );

        return {
          spouse: sp,
          family: matchedFam,
          marriageOrder: idx + 1,
          relationshipType: matchedFam?.relationshipType || 'Married',
          marriageDate: matchedFam?.marriageDate,
          marriageYear: matchedFam?.marriageYear,
          divorceDate: matchedFam?.divorceDate,
          divorceYear: matchedFam?.divorceYear,
          childrenIds: validUnionChildren
        };
      });

      // Sort spouses chronologically by marriage year if available
      spousesInfo.sort((a, b) => {
        const yearA = a.marriageYear || (a.marriageDate ? parseInt(a.marriageDate.match(/\d{4}/)?.[0] || '0', 10) : 0);
        const yearB = b.marriageYear || (b.marriageDate ? parseInt(b.marriageDate.match(/\d{4}/)?.[0] || '0', 10) : 0);
        if (yearA && yearB) return yearA - yearB;
        return 0;
      });

      // Re-assign accurate 1-indexed marriage order
      spousesInfo.forEach((s, idx) => {
        s.marriageOrder = idx + 1;
      });

      // All children of primary person
      const allChildren = new Set<string>();
      if (p.childrenIds) p.childrenIds.forEach(c => allChildren.add(c));
      spousesInfo.forEach(s => s.childrenIds.forEach(c => allChildren.add(c)));
      if (p.spouseFamilyIds) {
        p.spouseFamilyIds.forEach(fId => {
          const fam = database.families[fId];
          if (fam?.children) fam.children.forEach((c: any) => allChildren.add(c.personId || c.id));
        });
      }
      const validAllChildren = Array.from(allChildren).filter(
        cId => database.persons[cId] && normalizedGen.get(cId) === gen + 1
      );

      const totalMembers = 1 + spousesInfo.length;
      const unitWidth = CLASSIC_CARD_WIDTH * totalMembers + SPOUSE_GAP * (totalMembers - 1);

      processed.add(p.id);
      spousesInfo.forEach(s => processed.add(s.spouse.id));

      if (spousesInfo.length === 0) {
        units.push({
          type: 'single',
          primary: p,
          spouses: [],
          width: CLASSIC_CARD_WIDTH,
          x: 0,
          y: gen * (CLASSIC_CARD_HEIGHT + VERTICAL_GENERATION_GAP) + 80,
          childrenIds: validAllChildren
        });
      } else if (spousesInfo.length === 1) {
        // Standard couple: husband on left, wife on right
        const isMale = p.gender === 'male' || p.gender === 'M';
        const spouse = spousesInfo[0].spouse;
        const spouseIsMale = spouse.gender === 'male' || spouse.gender === 'M';

        let primaryPerson = p;
        let spousePerson = spousesInfo[0];

        if (!isMale && spouseIsMale) {
          primaryPerson = spouse;
          spousePerson = {
            ...spousesInfo[0],
            spouse: p
          };
        }

        units.push({
          type: 'couple',
          primary: primaryPerson,
          spouses: [spousePerson],
          width: CLASSIC_CARD_WIDTH * 2 + SPOUSE_GAP,
          x: 0,
          y: gen * (CLASSIC_CARD_HEIGHT + VERTICAL_GENERATION_GAP) + 80,
          childrenIds: validAllChildren
        });
      } else {
        // Multiple spouses (e.g. 1st wife, 2nd wife)
        units.push({
          type: 'multi_spouse',
          primary: p,
          spouses: spousesInfo,
          width: unitWidth,
          x: 0,
          y: gen * (CLASSIC_CARD_HEIGHT + VERTICAL_GENERATION_GAP) + 80,
          childrenIds: validAllChildren
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
            pUnit.childrenIds.includes(cu.primary.id) || (cu.spouses && cu.spouses.some(s => pUnit.childrenIds.includes(s.spouse.id)))
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
            pUnit.childrenIds.includes(cu.primary.id) || (cu.spouses && cu.spouses.some(s => pUnit.childrenIds.includes(s.spouse.id)))
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
      if (unit.type === 'couple' && unit.spouses.length === 1) {
        // Husband / Primary (left)
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
          spouseId: unit.spouses[0].spouse.id,
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

        // Wife / Spouse (right)
        const spInfo = unit.spouses[0];
        const wX = unit.x + CLASSIC_CARD_WIDTH + SPOUSE_GAP;
        const wY = unit.y;
        const wFlags = getNodeFlags(spInfo.spouse);
        nodes.push({
          id: spInfo.spouse.id,
          person: spInfo.spouse,
          x: wX,
          y: wY,
          width: CLASSIC_CARD_WIDTH,
          height: CLASSIC_CARD_HEIGHT,
          generation: gen,
          spouseId: unit.primary.id,
          isSpouseNode: true,
          marriageOrder: spInfo.marriageOrder,
          marriageStatus: spInfo.relationshipType,
          marriageDate: spInfo.marriageDate,
          marriageYear: spInfo.marriageYear,
          divorceDate: spInfo.divorceDate,
          divorceYear: spInfo.divorceYear,
          ...wFlags
        });
        nodeMap.set(spInfo.spouse.id, {
          x: wX,
          y: wY,
          width: CLASSIC_CARD_WIDTH,
          height: CLASSIC_CARD_HEIGHT,
          centerX: wX + CLASSIC_CARD_WIDTH / 2,
          centerY: wY + CLASSIC_CARD_HEIGHT / 2
        });
      } else if (unit.type === 'multi_spouse') {
        // Multi-spouse family unit: Primary person followed by 1st wife/husband, 2nd wife/husband etc.
        let curX = unit.x;
        const pY = unit.y;
        const pFlags = getNodeFlags(unit.primary);
        nodes.push({
          id: unit.primary.id,
          person: unit.primary,
          x: curX,
          y: pY,
          width: CLASSIC_CARD_WIDTH,
          height: CLASSIC_CARD_HEIGHT,
          generation: gen,
          spouseId: unit.spouses[0]?.spouse.id,
          ...pFlags
        });
        nodeMap.set(unit.primary.id, {
          x: curX,
          y: pY,
          width: CLASSIC_CARD_WIDTH,
          height: CLASSIC_CARD_HEIGHT,
          centerX: curX + CLASSIC_CARD_WIDTH / 2,
          centerY: pY + CLASSIC_CARD_HEIGHT / 2
        });
        curX += CLASSIC_CARD_WIDTH + SPOUSE_GAP;

        unit.spouses.forEach((spInfo) => {
          const sFlags = getNodeFlags(spInfo.spouse);
          nodes.push({
            id: spInfo.spouse.id,
            person: spInfo.spouse,
            x: curX,
            y: pY,
            width: CLASSIC_CARD_WIDTH,
            height: CLASSIC_CARD_HEIGHT,
            generation: gen,
            spouseId: unit.primary.id,
            isSpouseNode: true,
            marriageOrder: spInfo.marriageOrder,
            marriageStatus: spInfo.relationshipType,
            marriageDate: spInfo.marriageDate,
            marriageYear: spInfo.marriageYear,
            divorceDate: spInfo.divorceDate,
            divorceYear: spInfo.divorceYear,
            ...sFlags
          });
          nodeMap.set(spInfo.spouse.id, {
            x: curX,
            y: pY,
            width: CLASSIC_CARD_WIDTH,
            height: CLASSIC_CARD_HEIGHT,
            centerX: curX + CLASSIC_CARD_WIDTH / 2,
            centerY: pY + CLASSIC_CARD_HEIGHT / 2
          });
          curX += CLASSIC_CARD_WIDTH + SPOUSE_GAP;
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

      if ((unit.type === 'couple' || unit.type === 'multi_spouse') && unit.spouses.length > 0) {
        unit.spouses.forEach((spInfo, spIdx) => {
          const pNode = nodeMap.get(unit.primary.id);
          const sNode = nodeMap.get(spInfo.spouse.id);
          if (!pNode || !sNode) return;

          const leftCardRightEdge = Math.min(pNode.x, sNode.x) + CLASSIC_CARD_WIDTH;
          const rightCardLeftEdge = Math.max(pNode.x, sNode.x);
          const marriageMidX = (leftCardRightEdge + rightCardLeftEdge) / 2;
          const marriageMidY = pNode.y + CLASSIC_CARD_HEIGHT / 2;

          // Marriage link between primary and this spouse
          links.push({
            id: `m_${unit.primary.id}_${spInfo.spouse.id}`,
            sourceX: leftCardRightEdge,
            sourceY: marriageMidY,
            targetX: rightCardLeftEdge,
            targetY: marriageMidY,
            type: 'marriage',
            color: '#a1a1aa',
            sourcePersonId: unit.primary.id,
            targetPersonId: spInfo.spouse.id,
            marriageOrder: spInfo.marriageOrder,
            marriageStatus: spInfo.relationshipType,
            path: `M ${leftCardRightEdge} ${marriageMidY} L ${rightCardLeftEdge} ${marriageMidY}`
          });

          // Children born from this specific union
          const unionChildren = spInfo.childrenIds.length > 0 ? spInfo.childrenIds : (unit.spouses.length === 1 ? unit.childrenIds : []);
          if (unionChildren.length > 0) {
            const childCoords = unionChildren
              .map(cId => ({ id: cId, ...nodeMap.get(cId)! }))
              .filter(c => c && c.centerX !== undefined);

            if (childCoords.length > 0) {
              const unionJunctionY = junctionY + (spIdx * 16);
              // Vertical stem from marriage midpoint down to staggered junctionY
              links.push({
                id: `stem_${unit.primary.id}_${spInfo.spouse.id}`,
                sourceX: marriageMidX,
                sourceY: marriageMidY,
                targetX: marriageMidX,
                targetY: unionJunctionY,
                type: 'stem',
                color: unitColor,
                familyId: spInfo.family?.id || unit.primary.id,
                sourcePersonId: unit.primary.id,
                targetPersonId: spInfo.spouse.id,
                marriageOrder: spInfo.marriageOrder,
                path: `M ${marriageMidX} ${marriageMidY} L ${marriageMidX} ${unionJunctionY}`
              });

              // Calculate horizontal span of bus bar
              const minChildX = Math.min(...childCoords.map(c => c.centerX));
              const maxChildX = Math.max(...childCoords.map(c => c.centerX));
              const busLeft = Math.min(marriageMidX, minChildX);
              const busRight = Math.max(marriageMidX, maxChildX);

              // Horizontal sibling bus bar (only for this specific family)
              if (busLeft !== busRight || childCoords.length > 1) {
                links.push({
                  id: `bus_${unit.primary.id}_${spInfo.spouse.id}`,
                  sourceX: busLeft,
                  sourceY: unionJunctionY,
                  targetX: busRight,
                  targetY: unionJunctionY,
                  type: 'bus',
                  color: unitColor,
                  familyId: spInfo.family?.id || unit.primary.id,
                  sourcePersonId: unit.primary.id,
                  marriageOrder: spInfo.marriageOrder,
                  path: `M ${busLeft} ${unionJunctionY} L ${busRight} ${unionJunctionY}`
                });
              }

              // Drop lines to each child
              childCoords.forEach(child => {
                links.push({
                  id: `drop_${spInfo.spouse.id}_${child.id}`,
                  sourceX: child.centerX,
                  sourceY: unionJunctionY,
                  targetX: child.centerX,
                  targetY: child.y,
                  type: 'drop',
                  color: unitColor,
                  familyId: spInfo.family?.id || unit.primary.id,
                  sourcePersonId: unit.primary.id,
                  childPersonId: child.id,
                  arrow: 'down',
                  arrowX: child.centerX,
                  arrowY: child.y,
                  path: `M ${child.centerX} ${unionJunctionY} L ${child.centerX} ${child.y}`
                });
              });
            }
          }
        });
      } else {
        // Single parent
        const pNode = nodeMap.get(unit.primary.id);
        if (!pNode) return;
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

export type FanColorMode = 'clans' | 'grandparents' | 'greatgrandparents' | 'gender' | 'generation';

export interface FanChartClan {
  id: string;
  name: string;
  color: string;
  count: number;
  persons: Person[];
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
  side?: 'ancestor' | 'spouse' | 'child';
  clanId?: string;
  clanName?: string;
  clanColor?: string;
  relationshipLabel?: string;
  isDescendant?: boolean;
  isSpouse?: boolean;
  rodName?: string;
}

// Distinct, vibrant lineage colors for family branches and rods matching user screenshot
export const LINEAGE_PALETTE = [
  '#059669', // Emerald Green (Болотный)
  '#0284c7', // Rich Cyan (Болотна/Лазаренко)
  '#d97706', // Amber Gold (Надточей)
  '#ea580c', // Bright Orange (Бычихин)
  '#7c3aed', // Royal Violet (Яковлева)
  '#e11d48', // Vibrant Rose/Red
  '#0891b2', // Teal Blue (Дядькин)
  '#be123c', // Bordeaux Crimson (Балдинов)
  '#a855f7', // Lilac (Зеленский)
  '#16a34a', // Forest Green (Кармазин)
  '#9333ea', // Deep Violet (Кармазина)
  '#d97706', // Golden Ochre (Пирковский)
  '#475569', // Slate Gray (Лазаренко)
  '#2563eb', // Royal Blue (Бом)
  '#ca8a04', // Golden Olive
  '#db2777', // Deep Rose
  '#0f766e', // Deep Teal
  '#1e40af', // Navy Blue
];

// Helper to get normalized rod / surname name
export function getPersonRodName(person?: Person | null): string {
  if (!person) return 'Рід';
  const raw = person.name?.surname || person.lastName || person.name?.maidenName || person.maidenName || '';
  return raw.trim() || 'Рід';
}

/**
 * Build a stable surname-to-color mapping for all persons in the database
 */
export function getLineageColorMap(database: GenealogyDatabase): Record<string, string> {
  const map: Record<string, string> = {};
  let colorIdx = 0;

  // Prioritize root and direct ancestors
  const seen = new Set<string>();
  Object.values(database.persons).forEach((p) => {
    const rod = getPersonRodName(p);
    if (rod && rod !== 'Рід' && !seen.has(rod.toLowerCase())) {
      seen.add(rod.toLowerCase());
      map[rod.toLowerCase()] = LINEAGE_PALETTE[colorIdx % LINEAGE_PALETTE.length];
      map[rod] = LINEAGE_PALETTE[colorIdx % LINEAGE_PALETTE.length];
      colorIdx++;
    }
  });

  return map;
}

export function extractFanChartClans(sectors: FanChartSector[]): FanChartClan[] {
  const clanMap = new Map<string, FanChartClan>();

  sectors.forEach((sec) => {
    if (!sec.person) return;
    const rawRod = getPersonRodName(sec.person);
    const clanId = sec.clanId || rawRod;
    const clanName = sec.clanName || (clanId.startsWith('Рід ') ? clanId : `Рід ${clanId}`);
    const clanColor = sec.clanColor || sec.fillColor || sec.color || '#2563eb';

    if (!clanMap.has(clanId)) {
      clanMap.set(clanId, {
        id: clanId,
        name: clanName,
        color: clanColor,
        count: 0,
        persons: []
      });
    }

    const item = clanMap.get(clanId)!;
    item.count += 1;
    if (!item.persons.some((p) => p.id === sec.person.id)) {
      item.persons.push(sec.person);
    }
  });

  return Array.from(clanMap.values()).sort((a, b) => b.count - a.count);
}

export interface FanChartOptions {
  generations?: number;
  customInnerRadius?: number;
  customRingWidth?: number;
  colorMode?: FanColorMode | 'lineage' | 'familysearch' | 'gender' | 'generation';
  includeDescendantsAndSpouses?: boolean;
}

export function calculateFanChart(
  database: GenealogyDatabase,
  rootPersonId: string,
  generations: number = 0,
  colorModeOrCustomInner?: FanColorMode | number | FanChartOptions,
  customRingWidth?: number,
  options?: FanChartOptions
): FanChartSector[] {
  const sectors: FanChartSector[] = [];
  const root = database.persons[rootPersonId];
  if (!root) return sectors;

  let colorMode: FanColorMode = 'clans';
  let customInnerRadius: number | undefined = undefined;

  if (typeof colorModeOrCustomInner === 'string') {
    if (colorModeOrCustomInner === 'lineage' as any) {
      colorMode = 'clans';
    } else if (colorModeOrCustomInner === 'familysearch' as any) {
      colorMode = 'grandparents';
    } else {
      colorMode = colorModeOrCustomInner as FanColorMode;
    }
  } else if (typeof colorModeOrCustomInner === 'number') {
    customInnerRadius = colorModeOrCustomInner;
  } else if (colorModeOrCustomInner && typeof colorModeOrCustomInner === 'object') {
    if (colorModeOrCustomInner.colorMode) {
      colorMode = colorModeOrCustomInner.colorMode === 'lineage' ? 'clans' : (colorModeOrCustomInner.colorMode as FanColorMode);
    }
    if (colorModeOrCustomInner.customInnerRadius !== undefined) {
      customInnerRadius = colorModeOrCustomInner.customInnerRadius;
    }
    if (colorModeOrCustomInner.customRingWidth !== undefined) {
      customRingWidth = colorModeOrCustomInner.customRingWidth;
    }
  }

  if (options?.colorMode) {
    colorMode = options.colorMode === 'lineage' ? 'clans' : (options.colorMode as FanColorMode);
  }

  const lineageColorMap = getLineageColorMap(database);

  // Spacious, clear ring sizing matching user screenshot layout
  const innerRadiusBase = customInnerRadius !== undefined ? customInnerRadius : 110;
  const ringWidth = customRingWidth !== undefined ? customRingWidth : 85;

  function getSectorColor(ahnentafel: number, gen: number, person: Person): string {
    if (gen === 0) {
      const rod = getPersonRodName(person);
      return lineageColorMap[rod.toLowerCase()] || '#2563eb';
    }

    if (colorMode === 'gender') {
      return person.gender === 'female' || person.gender === 'F' ? '#e11d48' : '#2563eb';
    }

    if (colorMode === 'generation') {
      const genColors = ['#2563eb', '#059669', '#0284c7', '#7c3aed', '#ea580c', '#d97706', '#e11d48', '#10b981'];
      return genColors[gen % genColors.length];
    }

    if (colorMode === 'grandparents') {
      if (gen === 1) {
        return person.gender === 'female' || person.gender === 'F' ? '#0284c7' : '#059669';
      }
      let anc2 = ahnentafel;
      while (anc2 >= 8) {
        anc2 = Math.floor(anc2 / 2);
      }
      if (anc2 === 4) return '#d97706'; // Amber (Paternal Grandfather)
      if (anc2 === 5) return '#2563eb'; // Blue (Paternal Grandmother)
      if (anc2 === 6) return '#0891b2'; // Cyan (Maternal Grandfather)
      if (anc2 === 7) return '#ea580c'; // Orange (Maternal Grandmother)
      return person.gender === 'female' || person.gender === 'F' ? '#e11d48' : '#2563eb';
    }

    if (colorMode === 'greatgrandparents') {
      if (gen === 1 || gen === 2) {
        return person.gender === 'female' || person.gender === 'F' ? '#0284c7' : '#059669';
      }
      let anc3 = ahnentafel;
      while (anc3 >= 16) {
        anc3 = Math.floor(anc3 / 2);
      }
      const eightBranchColors: Record<number, string> = {
        8: '#1d4ed8',
        9: '#3b82f6',
        10: '#0284c7',
        11: '#06b6d4',
        12: '#d97706',
        13: '#ea580c',
        14: '#e11d48',
        15: '#be123c',
      };
      if (eightBranchColors[anc3]) return eightBranchColors[anc3];
    }

    // Default: 'clans' (unique color per rod/surname)
    const rod = getPersonRodName(person);
    const mapped = lineageColorMap[rod.toLowerCase()] || lineageColorMap[rod];
    if (mapped) return mapped;

    return LINEAGE_PALETTE[ahnentafel % LINEAGE_PALETTE.length];
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
    const branchColor = getSectorColor(ahnentafel, gen, person);
    const rod = getPersonRodName(person);

    sectors.push({
      ahnentafelNumber: ahnentafel,
      person,
      generation: gen,
      innerRadius,
      outerRadius,
      startAngle,
      endAngle,
      fillColor: branchColor,
      color: branchColor,
      side: 'ancestor',
      clanId: rod,
      clanName: `Рід ${rod}`,
      clanColor: branchColor,
      rodName: rod
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

  // Add Ancestor tree in top semicircle (PI to 2*PI)
  addAncestorToFan(root, 0, 1, Math.PI, 2 * Math.PI);

  return sectors;
}
