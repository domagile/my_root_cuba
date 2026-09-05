/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GenealogyDatabase, Person } from '../types/genealogy';
import { normalizeUkrainianSurnameGender, formatClanName, areSurnamesEquivalent } from '../../utils/ukrainianPhonetics';

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
 * Helper to extract birth year for chronological age sorting
 */
export function getPersonBirthYear(p?: Person | null): number {
  if (!p) return 9999;
  if (typeof p.birthYear === 'number' && p.birthYear > 0) return p.birthYear;
  if (p.birthDate) {
    const match = p.birthDate.match(/(\d{4})/);
    if (match) return parseInt(match[1], 10);
  }
  if (p.events && Array.isArray(p.events)) {
    const birthEvent = p.events.find((e: any) => e.type === 'birth' || e.type === 'Birth');
    if (birthEvent) {
      if (typeof birthEvent.year === 'number' && birthEvent.year > 0) return birthEvent.year;
      if (birthEvent.date) {
        const match = birthEvent.date.match(/(\d{4})/);
        if (match) return parseInt(match[1], 10);
      }
    }
  }
  return 9999;
}

/**
 * Compare two persons by age: older persons (earlier birth year) come FIRST (for left-to-right placement)
 * As per user requirement: "зліва показуються старші брати/сестри, а правіше - молодші"
 */
export function comparePersonsByAge(pA?: Person | null, pB?: Person | null): number {
  if (!pA && !pB) return 0;
  if (!pA) return 1;
  if (!pB) return -1;

  const yearA = getPersonBirthYear(pA);
  const yearB = getPersonBirthYear(pB);

  if (yearA !== yearB) {
    return yearA - yearB; // Earlier year (older) comes first
  }

  // If years are identical and known, compare month/day if available
  if (yearA !== 9999 && pA.birthDate && pB.birthDate) {
    const matchA = pA.birthDate.match(/(\d{1,2})[./-](\d{1,2})/);
    const matchB = pB.birthDate.match(/(\d{1,2})[./-](\d{1,2})/);
    if (matchA && matchB) {
      const mA = parseInt(matchA[2], 10);
      const mB = parseInt(matchB[2], 10);
      if (mA !== mB) return mA - mB;
      const dA = parseInt(matchA[1], 10);
      const dB = parseInt(matchB[1], 10);
      if (dA !== dB) return dA - dB;
    }
  }

  // Stable deterministic fallback by name
  const nameA = `${pA.lastName || pA.name?.surname || ''} ${pA.firstName || pA.name?.given || ''}`;
  const nameB = `${pB.lastName || pB.name?.surname || ''} ${pB.firstName || pB.name?.given || ''}`;
  return nameA.localeCompare(nameB, 'uk');
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

  // 0. Build complete direct backbone: ancestors and direct descendants of root person
  const directAncestors = new Set<string>();
  const collectAncestors = (pId: string) => {
    if (!pId || directAncestors.has(pId)) return;
    directAncestors.add(pId);
    const p = database.persons[pId];
    if (!p) return;
    let fId = p.fatherId || (p.parentFamilyId ? database.families[p.parentFamilyId]?.husbandId : undefined);
    let mId = p.motherId || (p.parentFamilyId ? database.families[p.parentFamilyId]?.wifeId : undefined);
    if (!fId && !mId && database.families) {
      const matchingFam = Object.values(database.families).find(fam => 
        fam.children && fam.children.some((c: any) => (c.personId || c.id) === p.id)
      );
      if (matchingFam) {
        fId = matchingFam.husbandId;
        mId = matchingFam.wifeId;
      }
    }
    if (fId && database.persons[fId]) collectAncestors(fId);
    if (mId && database.persons[mId]) collectAncestors(mId);
  };
  collectAncestors(root.id);

  const directDescendants = new Set<string>();
  const collectDescendants = (pId: string) => {
    if (!pId || directDescendants.has(pId)) return;
    directDescendants.add(pId);
    const p = database.persons[pId];
    if (!p) return;
    const childIds = new Set<string>();
    if (p.childrenIds) p.childrenIds.forEach(c => childIds.add(c));
    if (p.spouseFamilyIds) {
      p.spouseFamilyIds.forEach(fId => {
        const fam = database.families[fId];
        if (fam?.children) fam.children.forEach((c: any) => childIds.add(c.personId || c.id));
      });
    }
    Object.values(database.persons).forEach(cand => {
      if (cand.fatherId === pId || cand.motherId === pId) childIds.add(cand.id);
    });
    childIds.forEach(cId => {
      if (database.persons[cId]) collectDescendants(cId);
    });
  };
  collectDescendants(root.id);

  const isDirectBackbone = (pId: string): boolean => {
    return pId === root.id || directAncestors.has(pId) || directDescendants.has(pId);
  };

  const isSpouseOfBackbone = (pId: string): boolean => {
    const p = database.persons[pId];
    if (!p) return false;
    if (p.spouseIds?.some(sId => isDirectBackbone(sId))) return true;
    if (p.spouseFamilyIds && database.families) {
      for (const fId of p.spouseFamilyIds) {
        const fam = database.families[fId];
        if (fam) {
          if (fam.husbandId && fam.husbandId !== pId && isDirectBackbone(fam.husbandId)) return true;
          if (fam.wifeId && fam.wifeId !== pId && isDirectBackbone(fam.wifeId)) return true;
        }
      }
    }
    return false;
  };

  // Helper to determine if a person belongs to a collapsed sibling group
  const isSiblingOfCollapsed = (pId: string): boolean => {
    if (collapsedSiblings.has(pId)) return true;
    const p = database.persons[pId];
    if (!p) return false;
    const fId = p.fatherId || (p.parentFamilyId ? database.families[p.parentFamilyId]?.husbandId : undefined);
    const mId = p.motherId || (p.parentFamilyId ? database.families[p.parentFamilyId]?.wifeId : undefined);
    for (const cId of collapsedSiblings) {
      if (cId === pId) return true;
      const c = database.persons[cId];
      if (!c) continue;
      const cF = c.fatherId || (c.parentFamilyId ? database.families[c.parentFamilyId]?.husbandId : undefined);
      const cM = c.motherId || (c.parentFamilyId ? database.families[c.parentFamilyId]?.wifeId : undefined);
      if ((fId && cF && fId === cF) || (mId && cM && mId === cM)) return true;
      if (p.siblingIds?.includes(cId) || c.siblingIds?.includes(pId)) return true;
    }
    return false;
  };

  // 1. Calculate relative generation level for all ancestors, descendants, siblings and spouses
  const personGen = new Map<string, number>();
  personGen.set(root.id, 0);

  // BFS Queue to expand lineage and connections
  const queue: { id: string; gen: number }[] = [{ id: root.id, gen: 0 }];
  const processedPersons = new Set<string>();

  const enqueuePerson = (pId: string, pGen: number) => {
    if (!pId || !database.persons[pId]) return;
    // If showSiblings is false: only allow direct backbone or spouses of backbone
    if (!showSiblings && !isDirectBackbone(pId) && !isSpouseOfBackbone(pId)) {
      return;
    }
    // If individual sibling branch is collapsed: do not enqueue collateral siblings or their descendants
    if (isSiblingOfCollapsed(pId) && !isDirectBackbone(pId)) {
      return;
    }
    if (!personGen.has(pId)) {
      personGen.set(pId, pGen);
      queue.push({ id: pId, gen: pGen });
    }
  };

  while (queue.length > 0) {
    const { id, gen } = queue.shift()!;
    if (processedPersons.has(id)) continue;
    processedPersons.add(id);

    const p = database.persons[id];
    if (!p) continue;

    // 1. All spouses of this person (at same generation)
    if (!isSiblingOfCollapsed(id) || isDirectBackbone(id)) {
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
        if (!collapsedSiblings.has(sId)) {
          enqueuePerson(sId, gen);
        }
      });
    }

    // 2. Ancestors (Gen - 1, Gen - 2...) - expandable for ANY person in the tree
    if (showParents && !collapsedParents.has(id) && (!isSiblingOfCollapsed(id) || isDirectBackbone(id))) {
      if (maxGenerations === 0 || Math.abs(gen - 1) <= maxGenerations) {
        let fId = p.fatherId || (p.parentFamilyId ? database.families[p.parentFamilyId]?.husbandId : undefined);
        let mId = p.motherId || (p.parentFamilyId ? database.families[p.parentFamilyId]?.wifeId : undefined);

        // Fallback: check if person is child in any family
        if (!fId && !mId) {
          const matchingFam = Object.values(database.families || {}).find(fam => 
            fam.children && fam.children.some(c => (c.personId || (c as any).id) === p.id)
          );
          if (matchingFam) {
            fId = matchingFam.husbandId;
            mId = matchingFam.wifeId;
          }
        }

        if (fId && database.persons[fId]) enqueuePerson(fId, gen - 1);
        if (mId && database.persons[mId]) enqueuePerson(mId, gen - 1);
      }
    }

    // 3. Descendants (Gen + 1, Gen + 2...) - expandable for ANY person in the tree
    if (showDescendants && !collapsedChildren.has(id) && (!isSiblingOfCollapsed(id) || isDirectBackbone(id))) {
      if (maxGenerations === 0 || (gen + 1) <= maxGenerations) {
        const childIds = new Set<string>();
        if (p.childrenIds) p.childrenIds.forEach(c => childIds.add(c));
        if (p.spouseFamilyIds) {
          p.spouseFamilyIds.forEach(fId => {
            const fam = database.families[fId];
            if (fam?.children) fam.children.forEach(c => childIds.add(c.personId || (c as any).id));
          });
        }
        childIds.forEach(cId => {
          // If in direct mode without siblings, only enqueue the direct line child
          if (!showSiblings && directAncestors.has(id) && !directAncestors.has(cId) && cId !== root.id) {
            return;
          }
          if (isSiblingOfCollapsed(cId) && !isDirectBackbone(cId)) {
            return;
          }
          enqueuePerson(cId, gen + 1);
        });
      }
    }

    // 4. Siblings (at same generation) - expandable when showSiblings is active
    if (showSiblings && !collapsedSiblings.has(id) && !isSiblingOfCollapsed(id)) {
      let fId = p.fatherId || (p.parentFamilyId ? database.families[p.parentFamilyId]?.husbandId : undefined);
      let mId = p.motherId || (p.parentFamilyId ? database.families[p.parentFamilyId]?.wifeId : undefined);

      if (!fId && !mId && database.families) {
        const matchingFam = Object.values(database.families).find(fam => 
          fam.children && fam.children.some(c => (c.personId || (c as any).id) === p.id)
        );
        if (matchingFam) {
          fId = matchingFam.husbandId;
          mId = matchingFam.wifeId;
        }
      }

      if (p.siblingIds) {
        p.siblingIds.forEach(sId => {
          if (!collapsedSiblings.has(sId) && !isSiblingOfCollapsed(sId)) {
            enqueuePerson(sId, gen);
          }
        });
      }

      Object.values(database.persons).forEach(cand => {
        if (cand.id !== p.id && !personGen.has(cand.id)) {
          const cF = cand.fatherId || (cand.parentFamilyId ? database.families[cand.parentFamilyId]?.husbandId : undefined);
          const cM = cand.motherId || (cand.parentFamilyId ? database.families[cand.parentFamilyId]?.wifeId : undefined);
          const isSibling = (fId && cF === fId) || (mId && cM === mId) || (cand.siblingIds && cand.siblingIds.includes(p.id)) || (p.siblingIds && p.siblingIds.includes(cand.id));
          if (isSibling && !collapsedSiblings.has(cand.id) && !isSiblingOfCollapsed(cand.id)) {
            enqueuePerson(cand.id, gen);
          }
        }
      });
    }
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
          cId => database.persons[cId] && normalizedGen.get(cId) === gen + 1 && personGen.has(cId)
        );
        // Sort children by age: oldest to the left, younger to the right
        validUnionChildren.sort((idA, idB) => 
          comparePersonsByAge(database.persons[idA], database.persons[idB])
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
        cId => database.persons[cId] && normalizedGen.get(cId) === gen + 1 && personGen.has(cId)
      );
      // Sort all children by age: oldest to the left, younger to the right
      validAllChildren.sort((idA, idB) => 
        comparePersonsByAge(database.persons[idA], database.persons[idB])
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
    // Sort units within the same generation so older siblings are placed to the left of younger siblings
    units.sort((uA, uB) => {
      const pA = uA.primary;
      const pB = uB.primary;
      const fA = pA.fatherId || (pA.parentFamilyId ? database.families[pA.parentFamilyId]?.husbandId : undefined);
      const mA = pA.motherId || (pA.parentFamilyId ? database.families[pA.parentFamilyId]?.wifeId : undefined);
      const fB = pB.fatherId || (pB.parentFamilyId ? database.families[pB.parentFamilyId]?.husbandId : undefined);
      const mB = pB.motherId || (pB.parentFamilyId ? database.families[pB.parentFamilyId]?.wifeId : undefined);

      const shareParents = (fA && fB && fA === fB) || (mA && mB && mA === mB) ||
        (pA.siblingIds && pA.siblingIds.includes(pB.id)) || (pB.siblingIds && pB.siblingIds.includes(pA.id));
      if (shareParents) {
        return comparePersonsByAge(pA, pB);
      }
      return 0;
    });

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
            // Sort child units chronologically by age: oldest to the left, younger to the right
            childUnitMatches.sort((cuA, cuB) => {
              const childA = pUnit.childrenIds.includes(cuA.primary.id)
                ? cuA.primary
                : cuA.spouses.find(s => pUnit.childrenIds.includes(s.spouse.id))?.spouse || cuA.primary;
              const childB = pUnit.childrenIds.includes(cuB.primary.id)
                ? cuB.primary
                : cuB.spouses.find(s => pUnit.childrenIds.includes(s.spouse.id))?.spouse || cuB.primary;
              return comparePersonsByAge(childA, childB);
            });

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
            // Sort child units chronologically by age: oldest to the left, younger to the right
            childUnitMatches.sort((cuA, cuB) => {
              const childA = pUnit.childrenIds.includes(cuA.primary.id)
                ? cuA.primary
                : cuA.spouses.find(s => pUnit.childrenIds.includes(s.spouse.id))?.spouse || cuA.primary;
              const childB = pUnit.childrenIds.includes(cuB.primary.id)
                ? cuB.primary
                : cuB.spouses.find(s => pUnit.childrenIds.includes(s.spouse.id))?.spouse || cuB.primary;
              return comparePersonsByAge(childA, childB);
            });

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
      childUnits.sort((a, b) => a.x - b.x);
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
    let fId = p.fatherId || (p.parentFamilyId ? database.families[p.parentFamilyId]?.husbandId : undefined);
    let mId = p.motherId || (p.parentFamilyId ? database.families[p.parentFamilyId]?.wifeId : undefined);

    if (!fId && !mId) {
      const matchingFam = Object.values(database.families || {}).find(fam => 
        fam.children && fam.children.some(c => (c.personId || (c as any).id) === p.id)
      );
      if (matchingFam) {
        fId = matchingFam.husbandId;
        mId = matchingFam.wifeId;
      }
    }

    const parentsCount = (fId && database.persons[fId] ? 1 : 0) + (mId && database.persons[mId] ? 1 : 0);
    const hasParents = parentsCount > 0;
    const areParentsVisible = (fId && personGen.has(fId)) || (mId && personGen.has(mId));
    const isParentsCollapsed = collapsedParents.has(p.id) || !showParents || (hasParents && !areParentsVisible);

    let siblingCount = 0;
    let areSiblingsVisible = false;
    const sibs = Object.values(database.persons).filter(cand => 
      cand.id !== p.id && (
        (fId && (cand.fatherId === fId || (cand.parentFamilyId && database.families[cand.parentFamilyId]?.husbandId === fId))) ||
        (mId && (cand.motherId === mId || (cand.parentFamilyId && database.families[cand.parentFamilyId]?.wifeId === mId))) ||
        (p.siblingIds && p.siblingIds.includes(cand.id)) ||
        (cand.siblingIds && cand.siblingIds.includes(p.id))
      )
    );
    siblingCount = sibs.length;
    areSiblingsVisible = sibs.some(s => personGen.has(s.id));
    const hasSiblings = siblingCount > 0;
    const isSiblingsCollapsed = collapsedSiblings.has(p.id) || !showSiblings || (hasSiblings && !areSiblingsVisible) || isSiblingOfCollapsed(p.id);

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
  const trimmed = raw.trim();
  if (!trimmed) return 'Рід';
  const canonical = normalizeUkrainianSurnameGender(trimmed);
  return canonical || trimmed || 'Рід';
}

/**
 * Build a stable surname-to-color mapping for all persons in the database
 */
export function getLineageColorMap(database: GenealogyDatabase): Record<string, string> {
  const map: Record<string, string> = {};
  let colorIdx = 0;
  const canonicalList: string[] = [];

  // Prioritize root and direct ancestors
  Object.values(database.persons).forEach((p) => {
    const rawSurname = (p.name?.surname || p.lastName || p.name?.maidenName || p.maidenName || '').trim();
    if (!rawSurname) return;
    const canonical = normalizeUkrainianSurnameGender(rawSurname) || rawSurname;
    if (canonical && canonical !== 'Рід') {
      const canonicalKey = canonical.toLowerCase();

      // Check if an equivalent canonical surname already has an assigned color
      const existingCanonical = canonicalList.find(
        (c) => c.toLowerCase() === canonicalKey || areSurnamesEquivalent(canonical, c)
      );

      let color: string;
      if (!existingCanonical) {
        canonicalList.push(canonical);
        color = LINEAGE_PALETTE[colorIdx % LINEAGE_PALETTE.length];
        colorIdx++;
      } else {
        color = map[existingCanonical.toLowerCase()] || map[existingCanonical] || LINEAGE_PALETTE[0];
      }

      map[canonicalKey] = color;
      map[canonical] = color;
      // Also map original raw forms (e.g. female ending "пірковська" maps to the same color as "пірковський")
      map[rawSurname.toLowerCase()] = color;
      map[rawSurname] = color;
    }
  });

  return map;
}

/**
 * Resolves the clan/lineage color for a specific person, matching the fan chart clan colors
 */
export function getPersonClanColor(person?: Person | null, colorMap?: Record<string, string>): string {
  if (!person) return '#64748b';
  const rawSurname = (person.name?.surname || person.lastName || person.name?.maidenName || person.maidenName || '').trim();
  if (!rawSurname) return '#64748b';
  const canonical = normalizeUkrainianSurnameGender(rawSurname) || rawSurname;
  const rod = getPersonRodName(person);

  if (colorMap) {
    const color =
      colorMap[canonical.toLowerCase()] ||
      colorMap[canonical] ||
      colorMap[rod.toLowerCase()] ||
      colorMap[rod] ||
      colorMap[rawSurname.toLowerCase()] ||
      colorMap[rawSurname];
    if (color) return color;
  }

  // Fallback to stable hash index from LINEAGE_PALETTE
  let hash = 0;
  for (let i = 0; i < canonical.length; i++) {
    hash = (hash << 5) - hash + canonical.charCodeAt(i);
    hash |= 0;
  }
  return LINEAGE_PALETTE[Math.abs(hash) % LINEAGE_PALETTE.length];
}

export function extractFanChartClans(sectors: FanChartSector[]): FanChartClan[] {
  const clans: FanChartClan[] = [];

  sectors.forEach((sec) => {
    if (!sec.person) return;
    const rawRod = getPersonRodName(sec.person);
    const canonical = normalizeUkrainianSurnameGender(sec.clanId || rawRod) || rawRod;
    const clanId = canonical;
    const clanName = formatClanName(canonical);
    const clanColor = sec.clanColor || sec.fillColor || sec.color || '#2563eb';

    // Check if an existing clan matches by canonical ID, raw rod name, or phonetic/gender equivalence
    let matchedClan = clans.find(
      (c) =>
        c.id.toLowerCase() === clanId.toLowerCase() ||
        areSurnamesEquivalent(clanId, c.id) ||
        areSurnamesEquivalent(rawRod, c.id) ||
        areSurnamesEquivalent(clanName, c.name)
    );

    if (!matchedClan) {
      matchedClan = {
        id: clanId,
        name: clanName,
        color: clanColor,
        count: 0,
        persons: []
      };
      clans.push(matchedClan);
    }

    matchedClan.count += 1;
    if (!matchedClan.persons.some((p) => p.id === sec.person.id)) {
      matchedClan.persons.push(sec.person);
    }
  });

  return clans.sort((a, b) => b.count - a.count);
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

  const includeDescendantsAndSpouses = Boolean(
    options?.includeDescendantsAndSpouses ??
    (typeof colorModeOrCustomInner === 'object' ? colorModeOrCustomInner?.includeDescendantsAndSpouses : false)
  );

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
    const canonicalRod = normalizeUkrainianSurnameGender(rod) || rod;
    const clanName = formatClanName(canonicalRod);

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
      clanId: canonicalRod,
      clanName,
      clanColor: branchColor,
      rodName: canonicalRod
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

  // When "All Relatives" mode is enabled, add Spouses, Siblings, and Descendants in bottom semicircle (0 to PI)
  if (includeDescendantsAndSpouses) {
    // Collect Spouses of root
    const rootFamilies = Object.values(database.families || {}).filter(
      (f) => f.husbandId === root.id || f.wifeId === root.id
    );
    const spouses: Person[] = [];
    rootFamilies.forEach((f) => {
      const spId = f.husbandId === root.id ? f.wifeId : f.husbandId;
      if (spId && database.persons[spId] && !spouses.some((p) => p.id === spId)) {
        spouses.push(database.persons[spId]);
      }
    });

    // Collect Siblings of root (collateral line from parent family)
    const parentFam = (root.parentFamilyId && database.families[root.parentFamilyId]) ||
      Object.values(database.families || {}).find((f) => (f.childrenIds || []).includes(root.id));
    const siblings: Person[] = [];
    if (parentFam?.childrenIds) {
      parentFam.childrenIds.forEach((cId) => {
        if (cId !== root.id && database.persons[cId] && !siblings.some((p) => p.id === cId)) {
          siblings.push(database.persons[cId]);
        }
      });
    }

    // Collect Children of root
    const children: Person[] = [];
    rootFamilies.forEach((f) => {
      (f.childrenIds || []).forEach((cId) => {
        if (cId && database.persons[cId] && !children.some((p) => p.id === cId)) {
          children.push(database.persons[cId]);
        }
      });
    });

    // Collect Grandchildren of root
    const grandchildren: Person[] = [];
    children.forEach((ch) => {
      const chFamilies = Object.values(database.families || {}).filter(
        (f) => f.husbandId === ch.id || f.wifeId === ch.id
      );
      chFamilies.forEach((f) => {
        (f.childrenIds || []).forEach((gcId) => {
          if (gcId && database.persons[gcId] && !grandchildren.some((p) => p.id === gcId)) {
            grandchildren.push(database.persons[gcId]);
          }
        });
      });
    });

    // Ring 1 (Bottom semicircle, 0 to PI): Spouses and Siblings
    const ring1Items: { person: Person; side: 'spouse' | 'child'; label: string; ahn: number }[] = [];
    spouses.forEach((sp, idx) => {
      const isFem = sp.gender === 'female' || sp.gender === 'F';
      ring1Items.push({
        person: sp,
        side: 'spouse',
        label: isFem ? 'Дружина' : 'Чоловік',
        ahn: -10 - idx
      });
    });
    siblings.forEach((sib, idx) => {
      const isFem = sib.gender === 'female' || sib.gender === 'F';
      ring1Items.push({
        person: sib,
        side: 'child',
        label: isFem ? 'Сестра' : 'Брат',
        ahn: -50 - idx
      });
    });

    const childrenStartRing = ring1Items.length > 0 ? 2 : 1;

    if (ring1Items.length > 0) {
      const innerRadius = innerRadiusBase;
      const outerRadius = innerRadiusBase + ringWidth;
      const total = ring1Items.length;
      const slice = Math.PI / total;

      ring1Items.forEach((item, idx) => {
        const startAngle = idx * slice;
        const endAngle = (idx + 1) * slice;
        const rod = getPersonRodName(item.person);
        const canonicalRod = normalizeUkrainianSurnameGender(rod) || rod;
        const branchColor = getSectorColor(item.ahn, 1, item.person);

        sectors.push({
          ahnentafelNumber: item.ahn,
          person: item.person,
          generation: -1,
          innerRadius,
          outerRadius,
          startAngle,
          endAngle,
          fillColor: branchColor,
          color: branchColor,
          side: item.side,
          relationshipLabel: item.label,
          clanId: canonicalRod,
          clanName: formatClanName(canonicalRod),
          clanColor: branchColor,
          rodName: canonicalRod
        });
      });
    }

    // Children Ring
    if (children.length > 0) {
      const innerRadius = innerRadiusBase + (childrenStartRing - 1) * ringWidth;
      const outerRadius = innerRadiusBase + childrenStartRing * ringWidth;
      const total = children.length;
      const slice = Math.PI / total;

      children.forEach((child, idx) => {
        const startAngle = idx * slice;
        const endAngle = (idx + 1) * slice;
        const isFem = child.gender === 'female' || child.gender === 'F';
        const label = isFem ? 'Донька' : 'Син';
        const rod = getPersonRodName(child);
        const canonicalRod = normalizeUkrainianSurnameGender(rod) || rod;
        const branchColor = getSectorColor(-100 - idx, 2, child);

        sectors.push({
          ahnentafelNumber: -100 - idx,
          person: child,
          generation: -childrenStartRing,
          innerRadius,
          outerRadius,
          startAngle,
          endAngle,
          fillColor: branchColor,
          color: branchColor,
          side: 'child',
          relationshipLabel: label,
          clanId: canonicalRod,
          clanName: formatClanName(canonicalRod),
          clanColor: branchColor,
          rodName: canonicalRod
        });
      });
    }

    // Grandchildren Ring
    if (grandchildren.length > 0 && (generations === 0 || generations >= childrenStartRing + 1)) {
      const gcRing = childrenStartRing + 1;
      const innerRadius = innerRadiusBase + (gcRing - 1) * ringWidth;
      const outerRadius = innerRadiusBase + gcRing * ringWidth;
      const total = grandchildren.length;
      const slice = Math.PI / total;

      grandchildren.forEach((gc, idx) => {
        const startAngle = idx * slice;
        const endAngle = (idx + 1) * slice;
        const isFem = gc.gender === 'female' || gc.gender === 'F';
        const label = isFem ? 'Онука' : 'Онук';
        const rod = getPersonRodName(gc);
        const canonicalRod = normalizeUkrainianSurnameGender(rod) || rod;
        const branchColor = getSectorColor(-200 - idx, 3, gc);

        sectors.push({
          ahnentafelNumber: -200 - idx,
          person: gc,
          generation: -gcRing,
          innerRadius,
          outerRadius,
          startAngle,
          endAngle,
          fillColor: branchColor,
          color: branchColor,
          side: 'child',
          relationshipLabel: label,
          clanId: canonicalRod,
          clanName: formatClanName(canonicalRod),
          clanColor: branchColor,
          rodName: canonicalRod
        });
      });
    }
  }

  return sectors;
}
