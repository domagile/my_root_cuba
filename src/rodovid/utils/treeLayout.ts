/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GenealogyDatabase, Person } from '../types/genealogy';
import { normalizeUkrainianSurnameGender, formatClanName, areSurnamesEquivalent } from '../../utils/ukrainianPhonetics';
import { applyBridgeJumpsToLinks, LineCrossingCutout } from './treeLineBridges';

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
  descendantsCount?: number;
  isDirectAncestor?: boolean;
  isParentsCollapsed?: boolean;
  isPaternalCollapsed?: boolean;
  isMaternalCollapsed?: boolean;
  isSiblingsCollapsed?: boolean;
  isChildrenCollapsed?: boolean;
  areParentsVisible?: boolean;
  areSiblingsVisible?: boolean;
  areChildrenVisible?: boolean;
  fatherId?: string;
  motherId?: string;
}

export interface TreeLayoutFilterOptions {
  showParents?: boolean;
  showSiblings?: boolean;
  showDescendants?: boolean;
  collapsedParents?: Set<string>;
  collapsedSiblings?: Set<string>;
  collapsedChildren?: Set<string>;
  orientation?: 'vertical' | 'horizontal';
  isCompact?: boolean;
  directAncestorsOnly?: boolean;
  enableLineBridges?: boolean;
}

export interface TreeLinkLayout {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  type?: 'marriage' | 'child' | 'orthogonal' | 'bezier' | 'stem' | 'bus' | 'drop';
  path?: string;
  arrow?: 'up' | 'down' | 'right' | 'none';
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
  cutouts?: LineCrossingCutout[];
  crossingCount?: number;
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
export const HORIZONTAL_GENERATION_GAP = 148;
export const HORIZONTAL_SIBLING_GAP = 40;
export const HORIZONTAL_FAMILY_GAP = 76;

// Compact / Dense View Card Dimensions (50% card height for 2.5x more visual density)
export const COMPACT_CARD_WIDTH = 176;
export const COMPACT_CARD_HEIGHT = 68;
export const COMPACT_VERTICAL_GENERATION_GAP = 68;
export const COMPACT_HORIZONTAL_GENERATION_GAP = 72;

/**
 * Robustly resolves direct parents (father and mother) of a person across all database formats:
 * - Direct fatherId / motherId properties
 * - parentFamilyId references
 * - database.families where the person is listed in children or childrenIds
 * - Candidate persons where the person is in childrenIds
 * Validates that candidate parents actually exist in database.persons to avoid ghost collapse states.
 */
export function resolvePersonParents(
  p: Person | null | undefined,
  database: { persons?: Record<string, Person>; families?: Record<string, any> }
): {
  fatherId?: string;
  motherId?: string;
  father: Person | null;
  mother: Person | null;
} {
  if (!p || !database?.persons) return { father: null, mother: null };

  let fId = p.fatherId;
  let mId = p.motherId;

  // 1. Check parentFamilyId if defined
  if (p.parentFamilyId && database.families?.[p.parentFamilyId]) {
    const fam = database.families[p.parentFamilyId];
    if (!fId && fam.husbandId) fId = fam.husbandId;
    if (!mId && fam.wifeId) mId = fam.wifeId;
  }

  // 2. If still missing father or mother, check any family in database.families where p is in children or childrenIds
  if ((!fId || !mId) && database.families) {
    const familiesList = Object.values(database.families);
    for (const fam of familiesList) {
      if (!fam) continue;
      const isChild =
        (Array.isArray(fam.children) && fam.children.some((c: any) => (c?.personId || c?.id) === p.id)) ||
        (Array.isArray(fam.childrenIds) && fam.childrenIds.includes(p.id));
      if (isChild) {
        if (!fId && fam.husbandId) fId = fam.husbandId;
        if (!mId && fam.wifeId) mId = fam.wifeId;
        if (fId && mId) break;
      }
    }
  }

  // 3. Fallback: check if any person has p in childrenIds
  if ((!fId || !mId) && database.persons) {
    for (const cand of Object.values(database.persons)) {
      if (!cand || cand.id === p.id) continue;
      if (cand.childrenIds && cand.childrenIds.includes(p.id)) {
        if (!fId && (cand.gender === 'male' || cand.gender === 'M')) {
          fId = cand.id;
        } else if (!mId && (cand.gender === 'female' || cand.gender === 'F')) {
          mId = cand.id;
        }
      }
      if (fId && mId) break;
    }
  }

  // 4. Validate existence in database.persons
  const father = fId && database.persons[fId] && !database.persons[fId].isDeleted ? database.persons[fId] : null;
  const mother = mId && database.persons[mId] && !database.persons[mId].isDeleted ? database.persons[mId] : null;

  return {
    fatherId: father ? father.id : undefined,
    motherId: mother ? mother.id : undefined,
    father,
    mother
  };
}

/**
 * Robustly resolves direct children IDs of a person across all database formats:
 * - Direct childrenIds property on person
 * - Families where the person is husband or wife (children or childrenIds arrays)
 * - Persons whose fatherId or motherId matches pId
 * - Persons whose parents are resolved via resolvePersonParents
 */
export function resolvePersonChildrenIds(
  pId: string,
  database: { persons?: Record<string, Person>; families?: Record<string, any> }
): string[] {
  if (!pId || !database?.persons?.[pId]) return [];
  const p = database.persons[pId];
  const childIds = new Set<string>();

  if (p.childrenIds) {
    p.childrenIds.forEach(c => childIds.add(c));
  }

  if (database.families) {
    Object.values(database.families).forEach(fam => {
      if (!fam) return;
      if (fam.husbandId === pId || fam.wifeId === pId) {
        if (Array.isArray(fam.children)) {
          fam.children.forEach((c: any) => {
            const cId = typeof c === 'string' ? c : (c?.personId || c?.id);
            if (cId) childIds.add(cId);
          });
        }
        if (Array.isArray(fam.childrenIds)) {
          fam.childrenIds.forEach((cId: string) => childIds.add(cId));
        }
      }
    });
  }

  Object.values(database.persons).forEach(cand => {
    if (!cand || cand.id === pId || cand.isDeleted) return;
    if (cand.fatherId === pId || cand.motherId === pId) {
      childIds.add(cand.id);
      return;
    }
    const { fatherId, motherId } = resolvePersonParents(cand, database);
    if (fatherId === pId || motherId === pId) {
      childIds.add(cand.id);
    }
  });

  return Array.from(childIds).filter(cId => Boolean(database.persons[cId] && !database.persons[cId].isDeleted));
}

/**
 * Robustly resolves all spouse and co-parent IDs for a person:
 * - Direct spouseIds property on person
 * - Families in database where person is husband or wife (partnerId)
 * - Any person with whom this person shares a child in the database
 */
export function resolvePersonSpouseIds(
  pId: string,
  database: { persons?: Record<string, Person>; families?: Record<string, any> }
): string[] {
  if (!pId || !database?.persons?.[pId]) return [];
  const p = database.persons[pId];
  const spouseIds = new Set<string>();

  if (p.spouseIds) {
    p.spouseIds.forEach(s => spouseIds.add(s));
  }

  if (p.spouseFamilyIds && database.families) {
    p.spouseFamilyIds.forEach(fId => {
      const fam = database.families[fId];
      if (fam) {
        const partnerId = fam.husbandId === p.id ? fam.wifeId : fam.husbandId;
        if (partnerId) spouseIds.add(partnerId);
      }
    });
  }

  if (database.families) {
    Object.values(database.families).forEach(fam => {
      if (!fam) return;
      if (fam.husbandId === pId && fam.wifeId) spouseIds.add(fam.wifeId);
      if (fam.wifeId === pId && fam.husbandId) spouseIds.add(fam.husbandId);
    });
  }

  // Co-parents: persons sharing a child with pId in the database
  Object.values(database.persons).forEach(cand => {
    if (!cand || cand.isDeleted) return;
    const { fatherId, motherId } = resolvePersonParents(cand, database);
    if (fatherId === pId && motherId && motherId !== pId) {
      spouseIds.add(motherId);
    } else if (motherId === pId && fatherId && fatherId !== pId) {
      spouseIds.add(fatherId);
    }
  });

  return Array.from(spouseIds).filter(sId => Boolean(database.persons[sId] && !database.persons[sId].isDeleted));
}

/**
 * Calculates total direct descendants count under a person (children, grandchildren, etc.)
 */
export function getTotalDescendantsCount(personId: string, database: GenealogyDatabase): number {
  if (!personId || !database?.persons?.[personId]) return 0;
  const visited = new Set<string>([personId]);
  const queue: string[] = [personId];
  let count = 0;

  while (queue.length > 0) {
    const curId = queue.shift()!;
    const childIds = resolvePersonChildrenIds(curId, database);

    childIds.forEach(cId => {
      if (!visited.has(cId) && database.persons[cId]) {
        visited.add(cId);
        count++;
        queue.push(cId);
      }
    });
  }

  return count;
}

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
  const birth = person.birthYear || (person.birthDate ? String(person.birthDate).slice(0, 4) : null);
  const death = person.deathYear || (person.deathDate ? String(person.deathDate).slice(0, 4) : null);
  
  if (person.isLiving) {
    return birth ? `${birth}–зараз` : 'Живий/а';
  }
  if (birth && death) {
    return `${birth}–${death}`;
  }
  if (birth && !death) {
    return `${birth}–?`;
  }
  if (!birth && death) {
    return `?–${death}`;
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
    const match = String(p.birthDate).match(/(\d{4})/);
    if (match) return parseInt(match[1], 10);
  }
  if (p.events && Array.isArray(p.events)) {
    const birthEvent = p.events.find((e: any) => e.type === 'birth' || e.type === 'Birth');
    if (birthEvent) {
      if (typeof birthEvent.year === 'number' && birthEvent.year > 0) return birthEvent.year;
      if (birthEvent.date) {
        const match = String(birthEvent.date).match(/(\d{4})/);
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
    const matchA = String(pA.birthDate).match(/(\d{1,2})[./-](\d{1,2})/);
    const matchB = String(pB.birthDate).match(/(\d{1,2})[./-](\d{1,2})/);
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
  if (options?.orientation === 'horizontal') {
    return calculateHorizontalFamilyTreeLayout(database, rootPersonId, maxGenerations, options);
  }

  const isCompact = options?.isCompact ?? false;
  const directAncestorsOnly = options?.directAncestorsOnly ?? false;
  const cardWidth = isCompact ? COMPACT_CARD_WIDTH : CLASSIC_CARD_WIDTH;
  const cardHeight = isCompact ? COMPACT_CARD_HEIGHT : CLASSIC_CARD_HEIGHT;
  const verticalGenGap = isCompact ? COMPACT_VERTICAL_GENERATION_GAP : VERTICAL_GENERATION_GAP;

  const nodes: TreeNodeLayout[] = [];
  const links: TreeLinkLayout[] = [];

  const showParents = options?.showParents ?? true;
  const showSiblings = directAncestorsOnly ? false : (options?.showSiblings ?? true);
  const showDescendants = directAncestorsOnly ? false : (options?.showDescendants ?? true);
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
    const { father, mother } = resolvePersonParents(p, database);
    if (father) collectAncestors(father.id);
    if (mother) collectAncestors(mother.id);
  };
  collectAncestors(root.id);

  const directDescendants = new Set<string>();
  const collectDescendants = (pId: string) => {
    if (!pId || directDescendants.has(pId)) return;
    directDescendants.add(pId);
    const childIds = resolvePersonChildrenIds(pId, database);
    childIds.forEach(cId => {
      collectDescendants(cId);
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
  const isPersonACollapsedSibling = (pId: string): boolean => {
    if (!pId) return false;
    // Direct backbone or spouses of backbone are NEVER collapsed as collateral siblings!
    if (isDirectBackbone(pId) || isSpouseOfBackbone(pId)) return false;
    return collapsedSiblings.has(pId);
  };

  // Helper to check if a person's children/descendants are marked as collapsed (including via spouse)
  const isPersonChildrenCollapsed = (pId: string): boolean => {
    if (!showDescendants) return true;
    if (collapsedChildren.has(pId)) return true;
    const p = database.persons[pId];
    if (!p) return false;
    if (p.spouseIds && p.spouseIds.some(sId => collapsedChildren.has(sId))) {
      return true;
    }
    if (p.spouseFamilyIds && database.families) {
      for (const fId of p.spouseFamilyIds) {
        const fam = database.families[fId];
        if (fam) {
          if (fam.husbandId && collapsedChildren.has(fam.husbandId)) return true;
          if (fam.wifeId && collapsedChildren.has(fam.wifeId)) return true;
        }
      }
    }
    return false;
  };

  // Helper to collect all direct children of a person across all database relationship formats
  const getDirectChildrenIds = (pId: string): string[] => {
    return resolvePersonChildrenIds(pId, database);
  };

  // Helper to collect all direct parents of a person across all database relationship formats
  const getDirectParentIds = (pId: string): string[] => {
    const p = database.persons[pId];
    if (!p) return [];
    const { father, mother } = resolvePersonParents(p, database);
    const parents: string[] = [];
    if (father) parents.push(father.id);
    if (mother) parents.push(mother.id);
    return parents;
  };

  // Collect all persons that must be hidden because their parent or ancestor has collapsed children
  const collapsedDescendantIds = new Set<string>();
  const collapsedChildrenParentsList = Object.keys(database.persons).filter(pId => isPersonChildrenCollapsed(pId));
  
  if (collapsedChildrenParentsList.length > 0) {
    const q: string[] = [];
    collapsedChildrenParentsList.forEach(parId => {
      getDirectChildrenIds(parId).forEach(cId => {
        if (!collapsedDescendantIds.has(cId)) {
          collapsedDescendantIds.add(cId);
          q.push(cId);
        }
      });
    });

    while (q.length > 0) {
      const curId = q.shift()!;
      getDirectChildrenIds(curId).forEach(cId => {
        if (!collapsedDescendantIds.has(cId)) {
          collapsedDescendantIds.add(cId);
          q.push(cId);
        }
      });
    }

    // Also include spouses of collapsed descendants if they are only in the tree through the collapsed branch
    collapsedDescendantIds.forEach(dId => {
      const d = database.persons[dId];
      if (d?.spouseIds) {
        d.spouseIds.forEach(sId => {
          if (!directAncestors.has(sId) && !isPersonChildrenCollapsed(sId)) {
            collapsedDescendantIds.add(sId);
          }
        });
      }
    });
  }

  // Collect all persons that must be hidden because their child or descendant has collapsed parents
  const collapsedAncestorIds = new Set<string>();
  if (collapsedParents.size > 0) {
    const q: string[] = [];
    collapsedParents.forEach(entry => {
      if (entry.startsWith('pat_')) {
        const childId = entry.replace('pat_', '');
        const p = database.persons[childId];
        const { father } = resolvePersonParents(p, database);
        if (father && !collapsedAncestorIds.has(father.id)) {
          collapsedAncestorIds.add(father.id);
          q.push(father.id);
        }
      } else if (entry.startsWith('mat_')) {
        const childId = entry.replace('mat_', '');
        const p = database.persons[childId];
        const { mother } = resolvePersonParents(p, database);
        if (mother && !collapsedAncestorIds.has(mother.id)) {
          collapsedAncestorIds.add(mother.id);
          q.push(mother.id);
        }
      } else {
        getDirectParentIds(entry).forEach(parId => {
          if (!collapsedAncestorIds.has(parId)) {
            collapsedAncestorIds.add(parId);
            q.push(parId);
          }
        });
      }
    });

    while (q.length > 0) {
      const curId = q.shift()!;
      getDirectParentIds(curId).forEach(parId => {
        if (!collapsedAncestorIds.has(parId)) {
          collapsedAncestorIds.add(parId);
          q.push(parId);
        }
      });
    }

    // Also include spouses of collapsed ancestors if they are only in the tree through the collapsed branch
    const isUncollapsedParentOfSomeone = (sId: string): boolean => {
      return Object.values(database.persons).some(cand => {
        if (collapsedAncestorIds.has(cand.id)) return false;
        const fId = cand.fatherId || (cand.parentFamilyId ? database.families[cand.parentFamilyId]?.husbandId : undefined);
        const mId = cand.motherId || (cand.parentFamilyId ? database.families[cand.parentFamilyId]?.wifeId : undefined);
        if (fId === sId) return !collapsedParents.has(cand.id) && !collapsedParents.has(`pat_${cand.id}`);
        if (mId === sId) return !collapsedParents.has(cand.id) && !collapsedParents.has(`mat_${cand.id}`);
        return false;
      });
    };

    collapsedAncestorIds.forEach(aId => {
      const a = database.persons[aId];
      if (a?.spouseIds) {
        a.spouseIds.forEach(sId => {
          if (!directDescendants.has(sId) && !collapsedParents.has(sId) && sId !== root.id && !isUncollapsedParentOfSomeone(sId)) {
            collapsedAncestorIds.add(sId);
          }
        });
      }
      if (a?.spouseFamilyIds && database.families) {
        a.spouseFamilyIds.forEach(fId => {
          const fam = database.families[fId];
          if (fam) {
            if (fam.husbandId && !directDescendants.has(fam.husbandId) && !collapsedParents.has(fam.husbandId) && fam.husbandId !== root.id && !isUncollapsedParentOfSomeone(fam.husbandId)) {
              collapsedAncestorIds.add(fam.husbandId);
            }
            if (fam.wifeId && !directDescendants.has(fam.wifeId) && !collapsedParents.has(fam.wifeId) && fam.wifeId !== root.id && !isUncollapsedParentOfSomeone(fam.wifeId)) {
              collapsedAncestorIds.add(fam.wifeId);
            }
          }
        });
      }
    });
  }

  // If root person itself is cut off by an ancestor having collapsed children,
  // find the closest cut ancestor to serve as the effective root for the visible tree
  let effectiveRoot = root;
  if (collapsedDescendantIds.has(root.id)) {
    const visited = new Set<string>();
    const findCutAncestor = (pId: string): Person | null => {
      const p = database.persons[pId];
      if (!p) return null;
      const parents: string[] = [];
      if (p.fatherId) parents.push(p.fatherId);
      if (p.motherId) parents.push(p.motherId);
      if (p.parentFamilyId && database.families) {
        const fam = database.families[p.parentFamilyId];
        if (fam?.husbandId) parents.push(fam.husbandId);
        if (fam?.wifeId) parents.push(fam.wifeId);
      }
      for (const parId of parents) {
        if (visited.has(parId)) continue;
        visited.add(parId);
        if (isPersonChildrenCollapsed(parId)) {
          return database.persons[parId] || null;
        }
        const higher = findCutAncestor(parId);
        if (higher) return higher;
      }
      return null;
    };
    const cutAncestor = findCutAncestor(root.id);
    if (cutAncestor) {
      effectiveRoot = cutAncestor;
    }
  }

  // If effectiveRoot itself is cut off by a descendant having collapsed parents,
  // find the closest cut descendant to serve as the effective root for the visible tree
  if (collapsedAncestorIds.has(effectiveRoot.id)) {
    const visited = new Set<string>();
    const findCutDescendant = (pId: string): Person | null => {
      const children = getDirectChildrenIds(pId);
      for (const cId of children) {
        if (visited.has(cId)) continue;
        visited.add(cId);
        if (collapsedParents.has(cId)) {
          return database.persons[cId] || null;
        }
        const lower = findCutDescendant(cId);
        if (lower) return lower;
      }
      return null;
    };
    const cutDescendant = findCutDescendant(effectiveRoot.id);
    if (cutDescendant) {
      effectiveRoot = cutDescendant;
    }
  }

  // 1. Calculate relative generation level for all ancestors, descendants, siblings and spouses
  const personGen = new Map<string, number>();
  personGen.set(effectiveRoot.id, 0);

  // BFS Queue to expand lineage and connections
  const queue: { id: string; gen: number }[] = [{ id: effectiveRoot.id, gen: 0 }];
  const processedPersons = new Set<string>();

  const enqueuePerson = (pId: string, pGen: number) => {
    if (!pId || !database.persons[pId]) return;
    // If directAncestorsOnly: only allow direct ancestors of root person (or root itself)
    if (directAncestorsOnly && !directAncestors.has(pId) && pId !== effectiveRoot.id && pId !== root.id) {
      return;
    }
    // If this person is marked as a collapsed descendant, do not enqueue!
    if (collapsedDescendantIds.has(pId)) {
      return;
    }
    // If this person is marked as a collapsed ancestor, do not enqueue!
    if (collapsedAncestorIds.has(pId)) {
      return;
    }
    // If individual sibling branch is collapsed: do not enqueue collateral siblings
    if (isPersonACollapsedSibling(pId)) {
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
    if (!isPersonACollapsedSibling(id)) {
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
        if (!isPersonACollapsedSibling(sId)) {
          if (directAncestorsOnly && !directAncestors.has(sId) && sId !== effectiveRoot.id && sId !== root.id) {
            return;
          }
          enqueuePerson(sId, gen);
        }
      });
    }

    // 2. Ancestors (Gen - 1, Gen - 2...) - expandable for ANY person in the tree
    const { father, mother } = resolvePersonParents(p, database);
    const fId = father?.id;
    const mId = mother?.id;
    const isPaternalDirectlyCollapsed = Boolean(fId && (collapsedParents.has(`pat_${id}`) || collapsedParents.has(id)));
    const isMaternalDirectlyCollapsed = Boolean(mId && (collapsedParents.has(`mat_${id}`) || collapsedParents.has(id)));
    const isBothCollapsed = (fId && mId)
      ? (isPaternalDirectlyCollapsed && isMaternalDirectlyCollapsed)
      : (fId ? isPaternalDirectlyCollapsed : isMaternalDirectlyCollapsed);

    if (showParents && !isBothCollapsed && !isPersonACollapsedSibling(id)) {
      const canExpandAncestors = maxGenerations === 0 || Math.abs(gen - 1) <= maxGenerations || !isBothCollapsed;
      if (canExpandAncestors) {
        if (father && !isPaternalDirectlyCollapsed && !collapsedAncestorIds.has(father.id)) {
          enqueuePerson(father.id, gen - 1);
        }
        if (mother && !isMaternalDirectlyCollapsed && !collapsedAncestorIds.has(mother.id)) {
          enqueuePerson(mother.id, gen - 1);
        }
      }
    }

    // 3. Descendants (Gen + 1, Gen + 2...) - expandable for ANY person in the tree
    if (showDescendants && !directAncestorsOnly && !isPersonChildrenCollapsed(id) && !isPersonACollapsedSibling(id)) {
      if (maxGenerations === 0 || (gen + 1) <= maxGenerations) {
        const childIds = getDirectChildrenIds(id);
        childIds.forEach(cId => {
          if (collapsedDescendantIds.has(cId)) return;
          // If in direct mode without siblings, only enqueue the direct line child
          if (!showSiblings && directAncestors.has(id) && !directAncestors.has(cId) && cId !== effectiveRoot.id) {
            return;
          }
          if (isPersonACollapsedSibling(cId)) {
            return;
          }
          enqueuePerson(cId, gen + 1);
        });
      }
    }

    // 4. Siblings (at same generation) - expandable when showSiblings is active
    if (showSiblings && !directAncestorsOnly && !collapsedSiblings.has(id) && !isPersonACollapsedSibling(id)) {
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
          if (!isPersonACollapsedSibling(sId)) {
            enqueuePerson(sId, gen);
          }
        });
      }

      if (database.families) {
        Object.values(database.families).forEach((fam) => {
          const isChild = (fam.children && fam.children.some((c: any) => (c.personId || c.id) === p.id)) ||
                          (Array.isArray(fam.childrenIds) && fam.childrenIds.includes(p.id));
          if (isChild) {
            const rawChildren = [
              ...(Array.isArray(fam.children) ? fam.children : []),
              ...(Array.isArray(fam.childrenIds) ? fam.childrenIds : [])
            ].map((c: any) => typeof c === 'string' ? c : c?.personId || c?.id).filter(Boolean);

            rawChildren.forEach((sibId) => {
              if (sibId !== p.id && !isPersonACollapsedSibling(sibId)) {
                enqueuePerson(sibId, gen);
              }
            });
          }
        });
      }

      Object.values(database.persons).forEach(cand => {
        if (cand.id !== p.id && !personGen.has(cand.id)) {
          const cF = cand.fatherId || (cand.parentFamilyId ? database.families[cand.parentFamilyId]?.husbandId : undefined);
          const cM = cand.motherId || (cand.parentFamilyId ? database.families[cand.parentFamilyId]?.wifeId : undefined);
          const isSibling = (fId && cF === fId) || (mId && cM === mId) || (cand.siblingIds && cand.siblingIds.includes(p.id)) || (p.siblingIds && p.siblingIds.includes(cand.id)) || (p.parentFamilyId && cand.parentFamilyId && p.parentFamilyId === cand.parentFamilyId);
          if (isSibling && !isPersonACollapsedSibling(cand.id)) {
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

      // Find all spouses and co-parents for this person in this generation
      const spouseIdsSet = new Set<string>(resolvePersonSpouseIds(p.id, database));

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
        if (matchedFam?.childrenIds) {
          matchedFam.childrenIds.forEach((cId: string) => unionChildren.add(cId));
        }
        if (matchedFam?.children) {
          matchedFam.children.forEach((c: any) => {
            const cId = typeof c === 'string' ? c : (c?.personId || c?.id);
            if (cId) unionChildren.add(cId);
          });
        }
        // Also check if any children have both p and sp as parents, or belong to this family
        Object.values(database.persons).forEach(candChild => {
          if (!candChild || candChild.id === p.id || candChild.id === sp.id || candChild.isDeleted) return;
          const { fatherId, motherId } = resolvePersonParents(candChild, database);

          if (
            (fatherId === p.id && motherId === sp.id) ||
            (fatherId === sp.id && motherId === p.id) ||
            (matchedFam?.id && candChild.parentFamilyId === matchedFam.id)
          ) {
            unionChildren.add(candChild.id);
            return;
          }

          // If this is the only spouse in the unit, link children where single known parent is p or sp
          if (rawSpouses.length === 1) {
            if ((fatherId === p.id && !motherId) || (motherId === p.id && !fatherId)) {
              unionChildren.add(candChild.id);
            } else if ((fatherId === sp.id && !motherId) || (motherId === sp.id && !fatherId)) {
              unionChildren.add(candChild.id);
            }
          }
        });

        const validUnionChildren = Array.from(unionChildren).filter(
          cId => database.persons[cId] && personGen.has(cId) && (normalizedGen.get(cId) ?? 0) > gen
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

      // All children of primary person & spouses
      const allChildren = new Set<string>();
      resolvePersonChildrenIds(p.id, database).forEach(cId => allChildren.add(cId));
      rawSpouses.forEach(sp => {
        resolvePersonChildrenIds(sp.id, database).forEach(cId => allChildren.add(cId));
      });
      spousesInfo.forEach(s => s.childrenIds.forEach(c => allChildren.add(c)));

      const validAllChildren = Array.from(allChildren).filter(
        cId => database.persons[cId] && personGen.has(cId) && (normalizedGen.get(cId) ?? 0) > gen
      );
      // Sort all children by age: oldest to the left, younger to the right
      validAllChildren.sort((idA, idB) => 
        comparePersonsByAge(database.persons[idA], database.persons[idB])
      );

      const totalMembers = 1 + spousesInfo.length;
      const unitWidth = cardWidth * totalMembers + SPOUSE_GAP * (totalMembers - 1);

      processed.add(p.id);
      spousesInfo.forEach(s => processed.add(s.spouse.id));

      if (spousesInfo.length === 0) {
        units.push({
          type: 'single',
          primary: p,
          spouses: [],
          width: cardWidth,
          x: 0,
          y: gen * (cardHeight + verticalGenGap) + 80,
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
          width: cardWidth * 2 + SPOUSE_GAP,
          x: 0,
          y: gen * (cardHeight + verticalGenGap) + 80,
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
          y: gen * (cardHeight + verticalGenGap) + 80,
          childrenIds: validAllChildren
        });
      }
    });

    genUnits.set(gen, units);
  });

  // Position units across generations with family sorting and multi-pass alignment
  let maxTreeWidth = 1600;
  let maxTreeHeight = totalGens * (cardHeight + verticalGenGap) + 200;

  // Helpers for sibling detection and accurate person coordinate calculations
  const getParentsOfPerson = (pId: string) => {
    const p = database.persons[pId];
    if (!p) return { fatherId: undefined, motherId: undefined };
    let fId = p.fatherId || (p.parentFamilyId ? database.families[p.parentFamilyId]?.husbandId : undefined);
    let mId = p.motherId || (p.parentFamilyId ? database.families[p.parentFamilyId]?.wifeId : undefined);
    if ((!fId || !mId) && database.families) {
      for (const fam of Object.values(database.families)) {
        const rawChildren = [
          ...(Array.isArray(fam.children) ? fam.children : []),
          ...(Array.isArray(fam.childrenIds) ? fam.childrenIds : [])
        ].map((c: any) => typeof c === 'string' ? c : (c?.personId || c?.id)).filter(Boolean);
        if (rawChildren.includes(p.id) || (p.parentFamilyId && fam.id === p.parentFamilyId)) {
          if (!fId && fam.husbandId) fId = fam.husbandId;
          if (!mId && fam.wifeId) mId = fam.wifeId;
        }
      }
    }
    if ((!fId || !mId) && database.persons) {
      for (const parentCandidate of Object.values(database.persons)) {
        const cIds = parentCandidate.childrenIds || [];
        if (cIds.includes(p.id)) {
          if (parentCandidate.gender === 'female' || parentCandidate.gender === 'F') {
            if (!mId) mId = parentCandidate.id;
          } else {
            if (!fId) fId = parentCandidate.id;
          }
        }
      }
    }
    return { fatherId: fId, motherId: mId };
  };

  const areSiblings = (pId1: string, pId2: string): boolean => {
    if (!pId1 || !pId2 || pId1 === pId2) return false;
    const p1 = database.persons[pId1];
    const p2 = database.persons[pId2];
    if (!p1 || !p2) return false;
    if (p1.siblingIds?.includes(pId2) || p2.siblingIds?.includes(pId1)) return true;
    if (p1.parentFamilyId && p2.parentFamilyId && p1.parentFamilyId === p2.parentFamilyId) return true;
    const par1 = getParentsOfPerson(pId1);
    const par2 = getParentsOfPerson(pId2);
    if ((par1.fatherId && par1.fatherId === par2.fatherId) ||
        (par1.motherId && par1.motherId === par2.motherId)) {
      return true;
    }
    if (database.families) {
      for (const fam of Object.values(database.families)) {
        const rawChildren = [
          ...(Array.isArray(fam.children) ? fam.children : []),
          ...(Array.isArray(fam.childrenIds) ? fam.childrenIds : [])
        ].map((c: any) => typeof c === 'string' ? c : (c?.personId || c?.id)).filter(Boolean);
        if (rawChildren.includes(pId1) && rawChildren.includes(pId2)) return true;
      }
    }
    return false;
  };

  const unitsAreSiblings = (u1: Unit, u2: Unit): boolean => {
    if (!u1 || !u2 || u1 === u2) return false;
    const ids1 = [u1.primary.id, ...(u1.spouses?.map(s => s.spouse.id) || [])];
    const ids2 = [u2.primary.id, ...(u2.spouses?.map(s => s.spouse.id) || [])];
    for (const id1 of ids1) {
      for (const id2 of ids2) {
        if (areSiblings(id1, id2)) return true;
      }
    }
    return false;
  };

  const getPersonCenterXInUnits = (personId: string, uList: Unit[]): number | undefined => {
    for (const u of uList) {
      if (u.primary.id === personId) {
        return u.x + cardWidth / 2;
      }
      if (u.spouses) {
        for (let sIdx = 0; sIdx < u.spouses.length; sIdx++) {
          if (u.spouses[sIdx].spouse.id === personId) {
            return u.x + (sIdx + 1) * (cardWidth + SPOUSE_GAP) + cardWidth / 2;
          }
        }
      }
    }
    return undefined;
  };

  // Family Cluster definition for strictly keeping siblings contiguous
  interface FamilyCluster {
    key: string;
    parentUnit?: Unit;
    parentSpouseId?: string;
    parentUnitIndex: number;
    units: Unit[];
    width: number;
    x: number;
  }

  interface ParentMatch {
    parentUnit: Unit;
    spouseId?: string;
  }

  const getParentMatchForPerson = (personId: string, parentUnits: Unit[]): ParentMatch | undefined => {
    // 1. Direct union check
    for (const pu of parentUnits) {
      if (pu.spouses && pu.spouses.length > 0) {
        for (const sp of pu.spouses) {
          if (sp.childrenIds && sp.childrenIds.includes(personId)) {
            return { parentUnit: pu, spouseId: sp.spouse.id };
          }
        }
      }
      if (pu.childrenIds && pu.childrenIds.includes(personId)) {
        return { parentUnit: pu, spouseId: pu.spouses?.[0]?.spouse.id };
      }
    }

    // 2. Father & Mother lookup
    const { fatherId, motherId } = getParentsOfPerson(personId);
    for (const pu of parentUnits) {
      const isPrimaryFather = fatherId && pu.primary.id === fatherId;
      const isPrimaryMother = motherId && pu.primary.id === motherId;
      if (isPrimaryFather || isPrimaryMother) {
        const matchingSpouse = pu.spouses?.find(sp => (motherId && sp.spouse.id === motherId) || (fatherId && sp.spouse.id === fatherId));
        return { parentUnit: pu, spouseId: matchingSpouse?.spouse.id || pu.spouses?.[0]?.spouse.id };
      }
      if (pu.spouses) {
        for (const sp of pu.spouses) {
          if ((fatherId && sp.spouse.id === fatherId) || (motherId && sp.spouse.id === motherId)) {
            return { parentUnit: pu, spouseId: sp.spouse.id };
          }
        }
      }
    }

    // 3. Family lookup
    if (database.families) {
      for (const fam of Object.values(database.families)) {
        const rawChildren = [
          ...(Array.isArray(fam.children) ? fam.children : []),
          ...(Array.isArray(fam.childrenIds) ? fam.childrenIds : [])
        ].map((c: any) => typeof c === 'string' ? c : (c?.personId || c?.id)).filter(Boolean);
        if (rawChildren.includes(personId)) {
          for (const pu of parentUnits) {
            const hasHusband = fam.husbandId && (pu.primary.id === fam.husbandId || pu.spouses?.some(s => s.spouse.id === fam.husbandId));
            const hasWife = fam.wifeId && (pu.primary.id === fam.wifeId || pu.spouses?.some(s => s.spouse.id === fam.wifeId));
            if (hasHusband || hasWife) {
              const spouse = pu.spouses?.find(s => s.spouse.id === fam.husbandId || s.spouse.id === fam.wifeId);
              return { parentUnit: pu, spouseId: spouse?.spouse.id || pu.spouses?.[0]?.spouse.id };
            }
          }
        }
      }
    }
    return undefined;
  };

  const getParentUnitForPerson = (personId: string, parentUnits: Unit[]): Unit | undefined => {
    return getParentMatchForPerson(personId, parentUnits)?.parentUnit;
  };

  const getParentStemX = (pUnit: Unit, spouseId?: string): number => {
    if (pUnit.type === 'single' || !pUnit.spouses || pUnit.spouses.length === 0) {
      return pUnit.x + cardWidth / 2;
    }
    if (spouseId) {
      const spIdx = pUnit.spouses.findIndex(s => s.spouse.id === spouseId);
      if (spIdx !== -1) {
        return pUnit.x + (cardWidth + SPOUSE_GAP) * spIdx + cardWidth + SPOUSE_GAP / 2;
      }
    }
    return pUnit.x + cardWidth + SPOUSE_GAP / 2;
  };

  const getChildPersonInUnit = (u: Unit, pUnit?: Unit): Person => {
    if (!pUnit) return u.primary;
    if (pUnit.childrenIds && pUnit.childrenIds.includes(u.primary.id)) return u.primary;
    if (u.spouses) {
      for (const sp of u.spouses) {
        if (pUnit.childrenIds && pUnit.childrenIds.includes(sp.spouse.id)) return sp.spouse;
        if (sp.childrenIds && sp.childrenIds.includes(u.primary.id)) return u.primary;
      }
    }
    const { fatherId, motherId } = getParentsOfPerson(u.primary.id);
    const puIds = [pUnit.primary.id, ...(pUnit.spouses?.map(s => s.spouse.id) || [])];
    if ((fatherId && puIds.includes(fatherId)) || (motherId && puIds.includes(motherId))) {
      return u.primary;
    }
    if (u.spouses) {
      for (const sp of u.spouses) {
        const spPars = getParentsOfPerson(sp.spouse.id);
        if ((spPars.fatherId && puIds.includes(spPars.fatherId)) || (spPars.motherId && puIds.includes(spPars.motherId))) {
          return sp.spouse;
        }
      }
    }
    return u.primary;
  };

  // Initial horizontal placement per generation with strict family-aware clustering
  const genClusters = new Map<number, FamilyCluster[]>();

  for (let gen = 0; gen < totalGens; gen++) {
    const units = genUnits.get(gen) || [];
    if (units.length === 0) continue;

    if (gen === 0) {
      // Oldest generation (no parents above in tree)
      const clusters: FamilyCluster[] = [];
      const usedPrimaries = new Set<string>();

      // Group sibling units together
      units.forEach(u => {
        if (usedPrimaries.has(u.primary.id)) return;
        const sibs = units.filter(cand => !usedPrimaries.has(cand.primary.id) && (cand.primary.id === u.primary.id || unitsAreSiblings(u, cand)));
        sibs.forEach(s => usedPrimaries.add(s.primary.id));
        sibs.sort((a, b) => comparePersonsByAge(a.primary, b.primary));
        const cWidth = sibs.reduce((acc, s) => acc + s.width, 0) + (sibs.length - 1) * SIBLING_GAP;
        clusters.push({
          key: `c_gen0_${u.primary.id}`,
          parentUnitIndex: clusters.length,
          units: sibs,
          width: cWidth,
          x: 100
        });
      });

      let curX = 100;
      clusters.forEach(c => {
        c.x = curX;
        let unitX = c.x;
        c.units.forEach(u => {
          u.x = unitX;
          unitX += u.width + SIBLING_GAP;
        });
        curX += c.width + FAMILY_GAP;
      });

      genClusters.set(gen, clusters);
      units.splice(0, units.length, ...clusters.flatMap(c => c.units));
    } else {
      const parentUnits = genUnits.get(gen - 1) || [];
      const clusterMap = new Map<string, FamilyCluster>();

      units.forEach(u => {
        // 1. Direct parent unit lookup for primary and spouse
        let parentMatch = getParentMatchForPerson(u.primary.id, parentUnits);
        if (!parentMatch && u.spouses) {
          for (const sp of u.spouses) {
            const m = getParentMatchForPerson(sp.spouse.id, parentUnits);
            if (m) {
              parentMatch = m;
              break;
            }
          }
        }

        // 2. Sibling unity: check if u is a sibling of an already clustered unit
        let siblingClusterKey: string | undefined;
        let siblingParentUnit: Unit | undefined;
        let siblingSpouseId: string | undefined;

        for (const [existingKey, existingCluster] of clusterMap.entries()) {
          if (existingCluster.units.some(eu => unitsAreSiblings(u, eu))) {
            siblingClusterKey = existingKey;
            siblingParentUnit = existingCluster.parentUnit;
            siblingSpouseId = existingCluster.parentSpouseId;
            break;
          }
        }

        let chosenParentUnit: Unit | undefined;
        let chosenSpouseId: string | undefined;
        let clusterKey: string;

        if (siblingClusterKey && clusterMap.has(siblingClusterKey)) {
          // Keep strictly with siblings!
          clusterKey = siblingClusterKey;
          chosenParentUnit = siblingParentUnit;
          chosenSpouseId = siblingSpouseId;
        } else if (parentMatch) {
          chosenParentUnit = parentMatch.parentUnit;
          chosenSpouseId = parentMatch.spouseId;
          clusterKey = `parent_${chosenParentUnit.primary.id}_${chosenSpouseId || 'single'}`;
        } else {
          // Check if any sibling in the same generation has a parent match
          for (const otherUnit of units) {
            if (otherUnit !== u && unitsAreSiblings(u, otherUnit)) {
              const otherMatch = getParentMatchForPerson(otherUnit.primary.id, parentUnits) ||
                (otherUnit.spouses?.[0] ? getParentMatchForPerson(otherUnit.spouses[0].spouse.id, parentUnits) : undefined);
              if (otherMatch) {
                chosenParentUnit = otherMatch.parentUnit;
                chosenSpouseId = otherMatch.spouseId;
                break;
              }
            }
          }

          if (chosenParentUnit) {
            clusterKey = `parent_${chosenParentUnit.primary.id}_${chosenSpouseId || 'single'}`;
          } else {
            // Find canonical sibling ID among unaffiliated siblings so they stay together
            const siblingIds = units
              .filter(cand => cand === u || unitsAreSiblings(u, cand))
              .map(cand => cand.primary.id)
              .sort();
            clusterKey = `unaffiliated_sibs_${siblingIds[0] || u.primary.id}`;
          }
        }

        if (!clusterMap.has(clusterKey)) {
          const parentIdx = chosenParentUnit
            ? parentUnits.findIndex(pu => pu.primary.id === chosenParentUnit!.primary.id)
            : 9999;
          clusterMap.set(clusterKey, {
            key: clusterKey,
            parentUnit: chosenParentUnit,
            parentSpouseId: chosenSpouseId,
            parentUnitIndex: parentIdx !== -1 ? parentIdx : 9999,
            units: [],
            width: 0,
            x: 0
          });
        }
        clusterMap.get(clusterKey)!.units.push(u);
      });

      const clusters = Array.from(clusterMap.values());

      // Sort units WITHIN each cluster chronologically by child age (oldest to youngest)
      clusters.forEach(c => {
        c.units.sort((uA, uB) => {
          const childA = getChildPersonInUnit(uA, c.parentUnit);
          const childB = getChildPersonInUnit(uB, c.parentUnit);
          return comparePersonsByAge(childA, childB);
        });

        c.width = c.units.reduce((acc, u) => acc + u.width, 0) + (c.units.length - 1) * SIBLING_GAP;
      });

      // Sort clusters strictly by their parent's stem X coordinate to prevent crossings
      clusters.sort((cA, cB) => {
        if (cA.parentUnit && cB.parentUnit) {
          const stemA = getParentStemX(cA.parentUnit, cA.parentSpouseId);
          const stemB = getParentStemX(cB.parentUnit, cB.parentSpouseId);
          if (stemA !== stemB) return stemA - stemB;
          return (cA.parentSpouseId || '').localeCompare(cB.parentSpouseId || '');
        }
        if (cA.parentUnit) return -1;
        if (cB.parentUnit) return 1;
        return cA.key.localeCompare(cB.key);
      });

      let minClusterX = 100;
      clusters.forEach(c => {
        if (c.parentUnit) {
          const stemX = getParentStemX(c.parentUnit, c.parentSpouseId);
          c.x = stemX - c.width / 2;
        } else {
          c.x = minClusterX;
        }
        if (c.x < minClusterX) {
          c.x = minClusterX;
        }
        minClusterX = c.x + c.width + FAMILY_GAP;

        let curUnitX = c.x;
        c.units.forEach(u => {
          u.x = curUnitX;
          curUnitX += u.width + SIBLING_GAP;
        });
      });

      genClusters.set(gen, clusters);
      units.splice(0, units.length, ...clusters.flatMap(c => c.units));
    }
  }

  // Center levels relative to each other (align parents above children & children under parents)
  // Preserving unbroken sibling clusters!
  for (let pass = 0; pass < 3; pass++) {
    // Bottom-up pass: align parents above their children clusters
    for (let gen = totalGens - 2; gen >= 0; gen--) {
      const parentUnits = genUnits.get(gen) || [];
      const childClusters = genClusters.get(gen + 1) || [];

      parentUnits.forEach((pUnit) => {
        const matchedClusters = childClusters.filter(c => c.parentUnit && c.parentUnit.primary.id === pUnit.primary.id);
        if (matchedClusters.length > 0) {
          const minX = Math.min(...matchedClusters.map(c => c.x));
          const maxX = Math.max(...matchedClusters.map(c => c.x + c.width));
          const childrenCenter = (minX + maxX) / 2;
          pUnit.x = childrenCenter - pUnit.width / 2;
        }
      });

      // Prevent overlapping while preserving parent order
      let pMinX = 100;
      for (let i = 0; i < parentUnits.length; i++) {
        const pu = parentUnits[i];
        if (pu.x < pMinX) pu.x = pMinX;
        const nextGap = (i < parentUnits.length - 1 && unitsAreSiblings(pu, parentUnits[i + 1]))
          ? SIBLING_GAP
          : FAMILY_GAP;
        pMinX = pu.x + pu.width + nextGap;
      }
    }

    // Top-down pass: align child clusters under parent units
    for (let gen = 0; gen < totalGens - 1; gen++) {
      const childClusters = genClusters.get(gen + 1) || [];

      childClusters.forEach((c) => {
        if (c.parentUnit) {
          const stemX = getParentStemX(c.parentUnit, c.parentSpouseId);
          c.x = stemX - c.width / 2;
        }
      });

      // Sort clusters strictly preserving parent stem order so lines never invert or cross!
      childClusters.sort((a, b) => {
        if (a.parentUnit && b.parentUnit) {
          const stemA = getParentStemX(a.parentUnit, a.parentSpouseId);
          const stemB = getParentStemX(b.parentUnit, b.parentSpouseId);
          if (Math.abs(stemA - stemB) > 2) {
            return stemA - stemB;
          }
          if (a.parentSpouseId && b.parentSpouseId && a.parentSpouseId !== b.parentSpouseId) {
            return a.parentSpouseId.localeCompare(b.parentSpouseId);
          }
        }
        if (a.parentUnit) return -1;
        if (b.parentUnit) return 1;
        return a.x - b.x;
      });

      // Prevent overlapping while preserving cluster order
      let cMinX = 100;
      for (let i = 0; i < childClusters.length; i++) {
        const c = childClusters[i];
        if (c.x < cMinX) c.x = cMinX;
        cMinX = c.x + c.width + FAMILY_GAP;

        let curUnitX = c.x;
        c.units.forEach((u) => {
          u.x = curUnitX;
          curUnitX += u.width + SIBLING_GAP;
        });
      }

      // Update genUnits order to match sorted clusters
      const genUnitsList = genUnits.get(gen + 1);
      if (genUnitsList) {
        genUnitsList.splice(0, genUnitsList.length, ...childClusters.flatMap(c => c.units));
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
    const { father, mother } = resolvePersonParents(p, database);
    const fId = father?.id;
    const mId = mother?.id;

    const parentsCount = (father ? 1 : 0) + (mother ? 1 : 0);
    const hasParents = parentsCount > 0;
    const isPaternalDirectlyCollapsed = Boolean(fId && (collapsedParents.has(`pat_${p.id}`) || collapsedParents.has(p.id)));
    const isMaternalDirectlyCollapsed = Boolean(mId && (collapsedParents.has(`mat_${p.id}`) || collapsedParents.has(p.id)));
    const isPaternalVisible = Boolean(fId && personGen.has(fId));
    const isMaternalVisible = Boolean(mId && personGen.has(mId));

    const isPaternalCollapsed = Boolean(fId && (isPaternalDirectlyCollapsed || !showParents || !isPaternalVisible));
    const isMaternalCollapsed = Boolean(mId && (isMaternalDirectlyCollapsed || !showParents || !isMaternalVisible));

    const areParentsVisible = Boolean((fId && isPaternalVisible) || (mId && isMaternalVisible));
    const isParentsCollapsed = collapsedParents.has(p.id) ||
      (hasParents && (
        (fId && mId ? isPaternalCollapsed && isMaternalCollapsed : (fId ? isPaternalCollapsed : isMaternalCollapsed))
      )) ||
      !showParents ||
      (hasParents && !areParentsVisible);

    let siblingCount = 0;
    let areSiblingsVisible = false;
    const sibs = Object.values(database.persons).filter(cand => 
      cand.id !== p.id && (
        (fId && (cand.fatherId === fId || (cand.parentFamilyId && database.families[cand.parentFamilyId]?.husbandId === fId))) ||
        (mId && (cand.motherId === mId || (cand.parentFamilyId && database.families[cand.parentFamilyId]?.wifeId === mId))) ||
        (p.siblingIds && p.siblingIds.includes(cand.id)) ||
        (cand.siblingIds && cand.siblingIds.includes(p.id)) ||
        (p.parentFamilyId && cand.parentFamilyId && p.parentFamilyId === cand.parentFamilyId) ||
        (database.families && Object.values(database.families).some(fam => {
          const rawChildren = [
            ...(Array.isArray(fam.children) ? fam.children : []),
            ...(Array.isArray(fam.childrenIds) ? fam.childrenIds : [])
          ].map((c: any) => typeof c === 'string' ? c : c?.personId || c?.id).filter(Boolean);
          return rawChildren.includes(p.id) && rawChildren.includes(cand.id);
        }))
      )
    );
    siblingCount = sibs.length;
    areSiblingsVisible = sibs.some(s => personGen.has(s.id));
    const hasSiblings = siblingCount > 0;
    const isSiblingsCollapsed = collapsedSiblings.has(p.id) || !showSiblings || (hasSiblings && !areSiblingsVisible) || isPersonACollapsedSibling(p.id);

    const validChildren = getDirectChildrenIds(p.id);
    const childrenCount = validChildren.length;
    const hasChildren = childrenCount > 0;
    const areChildrenVisible = validChildren.some(cId => personGen.has(cId));
    const isChildrenCollapsed = isPersonChildrenCollapsed(p.id) || !showDescendants || (hasChildren && !areChildrenVisible);

    const descendantsCount = getTotalDescendantsCount(p.id, database);
    const isDirectAncestor = directAncestors.has(p.id) || p.id === root.id;

    return {
      hasParents,
      hasSiblings,
      hasChildren,
      parentsCount,
      siblingsCount: siblingCount,
      childrenCount,
      descendantsCount,
      isDirectAncestor,
      isParentsCollapsed,
      isPaternalCollapsed,
      isMaternalCollapsed,
      isSiblingsCollapsed,
      isChildrenCollapsed,
      areParentsVisible: Boolean(areParentsVisible),
      areSiblingsVisible,
      areChildrenVisible,
      fatherId: fId,
      motherId: mId
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
          width: cardWidth,
          height: cardHeight,
          generation: gen,
          spouseId: unit.spouses[0].spouse.id,
          ...hFlags
        });
        nodeMap.set(unit.primary.id, {
          x: hX,
          y: hY,
          width: cardWidth,
          height: cardHeight,
          centerX: hX + cardWidth / 2,
          centerY: hY + cardHeight / 2
        });

        // Wife / Spouse (right)
        const spInfo = unit.spouses[0];
        const wX = unit.x + cardWidth + SPOUSE_GAP;
        const wY = unit.y;
        const wFlags = getNodeFlags(spInfo.spouse);
        nodes.push({
          id: spInfo.spouse.id,
          person: spInfo.spouse,
          x: wX,
          y: wY,
          width: cardWidth,
          height: cardHeight,
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
          width: cardWidth,
          height: cardHeight,
          centerX: wX + cardWidth / 2,
          centerY: wY + cardHeight / 2
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
          width: cardWidth,
          height: cardHeight,
          generation: gen,
          spouseId: unit.spouses[0]?.spouse.id,
          ...pFlags
        });
        nodeMap.set(unit.primary.id, {
          x: curX,
          y: pY,
          width: cardWidth,
          height: cardHeight,
          centerX: curX + cardWidth / 2,
          centerY: pY + cardHeight / 2
        });
        curX += cardWidth + SPOUSE_GAP;

        unit.spouses.forEach((spInfo) => {
          const sFlags = getNodeFlags(spInfo.spouse);
          nodes.push({
            id: spInfo.spouse.id,
            person: spInfo.spouse,
            x: curX,
            y: pY,
            width: cardWidth,
            height: cardHeight,
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
            width: cardWidth,
            height: cardHeight,
            centerX: curX + cardWidth / 2,
            centerY: pY + cardHeight / 2
          });
          curX += cardWidth + SPOUSE_GAP;
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
          width: cardWidth,
          height: cardHeight,
          generation: gen,
          ...sFlags
        });
        nodeMap.set(unit.primary.id, {
          x: pX,
          y: pY,
          width: cardWidth,
          height: cardHeight,
          centerX: pX + cardWidth / 2,
          centerY: pY + cardHeight / 2
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
      const baseJunctionY = pY + cardHeight + (isCompact ? 18 : 32);
      const junctionY = baseJunctionY + (unitIdx % 6) * (isCompact ? 12 : 20);

      if ((unit.type === 'couple' || unit.type === 'multi_spouse') && unit.spouses.length > 0) {
        unit.spouses.forEach((spInfo, spIdx) => {
          const pNode = nodeMap.get(unit.primary.id);
          const sNode = nodeMap.get(spInfo.spouse.id);
          if (!pNode || !sNode) return;

          const leftCardRightEdge = Math.min(pNode.x, sNode.x) + cardWidth;
          const rightCardLeftEdge = Math.max(pNode.x, sNode.x);
          const marriageMidX = (leftCardRightEdge + rightCardLeftEdge) / 2;
          const marriageMidY = pNode.y + cardHeight / 2;

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
          const unionChildren = (spInfo.childrenIds.length > 0 ? spInfo.childrenIds : (unit.spouses.length === 1 ? unit.childrenIds : [])).filter(cId => nodeMap.has(cId));
          if (unionChildren.length > 0) {
            const childCoords = unionChildren
              .map(cId => ({ id: cId, ...nodeMap.get(cId)! }))
              .filter(c => c && c.centerX !== undefined);

            if (childCoords.length > 0) {
              const unionJunctionY = junctionY + (spIdx * (isCompact ? 10 : 16));

              if (childCoords.length === 1) {
                // Single child: direct clean drop line (straight or clean orthogonal step)
                const child = childCoords[0];
                const isDirectLine = Math.abs(marriageMidX - child.centerX) < 3;
                const pathStr = isDirectLine
                  ? `M ${marriageMidX} ${marriageMidY} L ${child.centerX} ${child.y}`
                  : `M ${marriageMidX} ${marriageMidY} L ${marriageMidX} ${unionJunctionY} L ${child.centerX} ${unionJunctionY} L ${child.centerX} ${child.y}`;

                links.push({
                  id: `drop_${spInfo.spouse.id}_${child.id}`,
                  sourceX: marriageMidX,
                  sourceY: marriageMidY,
                  targetX: child.centerX,
                  targetY: child.y,
                  type: 'drop',
                  color: unitColor,
                  familyId: spInfo.family?.id || unit.primary.id,
                  sourcePersonId: unit.primary.id,
                  targetPersonId: spInfo.spouse.id,
                  childPersonId: child.id,
                  arrow: 'down',
                  arrowX: child.centerX,
                  arrowY: child.y,
                  path: pathStr
                });
              } else {
                // Multiple siblings: vertical stem, horizontal sibling bus bar, perpendicular drops
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
          }
        });
      } else {
        // Single parent
        const pNode = nodeMap.get(unit.primary.id);
        if (!pNode) return;
        const stemX = pNode.centerX;
        const stemY = pNode.y + cardHeight;

        if (unit.childrenIds.length > 0) {
          const childCoords = unit.childrenIds
            .map(cId => ({ id: cId, ...nodeMap.get(cId)! }))
            .filter(c => c && c.centerX !== undefined);

          if (childCoords.length > 0) {
            if (childCoords.length === 1) {
              const child = childCoords[0];
              const isDirectLine = Math.abs(stemX - child.centerX) < 3;
              const pathStr = isDirectLine
                ? `M ${stemX} ${stemY} L ${child.centerX} ${child.y}`
                : `M ${stemX} ${stemY} L ${stemX} ${junctionY} L ${child.centerX} ${junctionY} L ${child.centerX} ${child.y}`;

              links.push({
                id: `drop_${unit.primary.id}_${child.id}`,
                sourceX: stemX,
                sourceY: stemY,
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
                path: pathStr
              });
            } else {
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
      }
    });
  });

  // 3. Third Pass (Safety Net): Guarantee that every child on canvas with visible parents has a connecting link and marriage link
  nodes.forEach(cNode => {
    const p = cNode.person;
    const { father, mother } = resolvePersonParents(p, database);
    const fNode = father ? nodeMap.get(father.id) : null;
    const mNode = mother ? nodeMap.get(mother.id) : null;
    const childCenterX = cNode.x + cNode.width / 2;

    // 3a. If both father and mother are on canvas, make sure a marriage link connects them!
    if (father && mother && fNode && mNode) {
      const hasMarriage = links.some(l =>
        l.type === 'marriage' &&
        ((l.sourcePersonId === father.id && l.targetPersonId === mother.id) ||
         (l.sourcePersonId === mother.id && l.targetPersonId === father.id))
      );
      if (!hasMarriage) {
        const leftCardRightEdge = Math.min(fNode.x, mNode.x) + cardWidth;
        const rightCardLeftEdge = Math.max(fNode.x, mNode.x);
        const marriageMidX = (leftCardRightEdge + rightCardLeftEdge) / 2;
        const marriageMidY = fNode.y + cardHeight / 2;
        links.push({
          id: `m_${father.id}_${mother.id}`,
          sourceX: leftCardRightEdge,
          sourceY: marriageMidY,
          targetX: rightCardLeftEdge,
          targetY: marriageMidY,
          type: 'marriage',
          color: '#a1a1aa',
          sourcePersonId: father.id,
          targetPersonId: mother.id,
          path: `M ${leftCardRightEdge} ${marriageMidY} L ${rightCardLeftEdge} ${marriageMidY}`
        });
      }
    }

    // 3b. Check if this child already has a connecting drop link
    const hasDropLink = links.some(l =>
      l.childPersonId === cNode.id ||
      ((l.type === 'drop' || l.type === 'child') && l.targetPersonId === cNode.id)
    );

    if (!hasDropLink && (fNode || mNode)) {
      if (father && mother && fNode && mNode) {
        const leftCardRightEdge = Math.min(fNode.x, mNode.x) + cardWidth;
        const rightCardLeftEdge = Math.max(fNode.x, mNode.x);
        const marriageMidX = (leftCardRightEdge + rightCardLeftEdge) / 2;
        const marriageMidY = fNode.y + cardHeight / 2;
        const dropY = cNode.y;
        const junctionY = (marriageMidY + dropY) / 2;

        const pathStr = Math.abs(marriageMidX - childCenterX) < 3
          ? `M ${marriageMidX} ${marriageMidY} L ${childCenterX} ${dropY}`
          : `M ${marriageMidX} ${marriageMidY} L ${marriageMidX} ${junctionY} L ${childCenterX} ${junctionY} L ${childCenterX} ${dropY}`;

        links.push({
          id: `safety_drop_${father.id}_${mother.id}_${cNode.id}`,
          sourceX: marriageMidX,
          sourceY: marriageMidY,
          targetX: childCenterX,
          targetY: dropY,
          type: 'drop',
          color: '#38bdf8',
          sourcePersonId: father.id,
          targetPersonId: mother.id,
          childPersonId: cNode.id,
          arrow: 'down',
          arrowX: childCenterX,
          arrowY: dropY,
          path: pathStr
        });
      } else {
        const parId = father ? father.id : mother!.id;
        const parNode = (fNode || mNode)!;
        const stemX = parNode.centerX;
        const stemY = parNode.y + cardHeight;
        const dropY = cNode.y;
        const junctionY = (stemY + dropY) / 2;

        const pathStr = Math.abs(stemX - childCenterX) < 3
          ? `M ${stemX} ${stemY} L ${childCenterX} ${dropY}`
          : `M ${stemX} ${stemY} L ${stemX} ${junctionY} L ${childCenterX} ${junctionY} L ${childCenterX} ${dropY}`;

        links.push({
          id: `safety_drop_${parId}_${cNode.id}`,
          sourceX: stemX,
          sourceY: stemY,
          targetX: childCenterX,
          targetY: dropY,
          type: 'drop',
          color: '#38bdf8',
          sourcePersonId: parId,
          childPersonId: cNode.id,
          arrow: 'down',
          arrowX: childCenterX,
          arrowY: dropY,
          path: pathStr
        });
      }
    }
  });

  // Recalculate full dimensions
  let finalMaxX = 1400;
  let finalMaxY = 900;
  nodes.forEach(n => {
    finalMaxX = Math.max(finalMaxX, n.x + n.width + 120);
    finalMaxY = Math.max(finalMaxY, n.y + n.height + 120);
  });

  // Guarantee strictly unique node and link IDs within layout
  const seenNodeIds = new Map<string, number>();
  nodes.forEach((n, idx) => {
    const count = (seenNodeIds.get(n.id) || 0) + 1;
    seenNodeIds.set(n.id, count);
    if (count > 1) {
      n.id = `${n.id}__node_${count}_${idx}`;
    }
  });
  const seenLinkIds = new Map<string, number>();
  links.forEach((l, idx) => {
    const count = (seenLinkIds.get(l.id) || 0) + 1;
    seenLinkIds.set(l.id, count);
    if (count > 1) {
      l.id = `${l.id}__link_${count}_${idx}`;
    }
  });

  const bridgeResult = applyBridgeJumpsToLinks(links, {
    orientation: 'vertical',
    enableBridges: options?.enableLineBridges ?? true
  });

  return {
    nodes,
    links: bridgeResult.links,
    width: finalMaxX,
    height: finalMaxY,
    cutouts: bridgeResult.cutouts,
    crossingCount: bridgeResult.crossingCount
  };
}

/**
 * Build widescreen 16:9 horizontal family tree layout (Left-to-right: Ancestors on the Left ➔ Descendants on the Right)
 * Optimized for computer monitors with wide aspect ratios and natural vertical scrolling.
 */
export function calculateHorizontalFamilyTreeLayout(
  database: GenealogyDatabase,
  rootPersonId: string,
  maxGenerations: number = 0,
  options?: TreeLayoutFilterOptions
): TreeLayoutResult {
  const nodes: TreeNodeLayout[] = [];
  const links: TreeLinkLayout[] = [];

  const isCompact = options?.isCompact ?? false;
  const directAncestorsOnly = options?.directAncestorsOnly ?? false;
  const cardWidth = isCompact ? COMPACT_CARD_WIDTH : CLASSIC_CARD_WIDTH;
  const cardHeight = isCompact ? COMPACT_CARD_HEIGHT : CLASSIC_CARD_HEIGHT;
  const horizontalGenGap = isCompact ? COMPACT_HORIZONTAL_GENERATION_GAP : HORIZONTAL_GENERATION_GAP;

  const showParents = options?.showParents ?? true;
  const showSiblings = directAncestorsOnly ? false : (options?.showSiblings ?? true);
  const showDescendants = directAncestorsOnly ? false : (options?.showDescendants ?? true);
  const collapsedParents = options?.collapsedParents || new Set<string>();
  const collapsedSiblings = options?.collapsedSiblings || new Set<string>();
  const collapsedChildren = options?.collapsedChildren || new Set<string>();

  let root = database.persons[rootPersonId];
  if (!root) {
    const allPersons = Object.values(database.persons);
    if (allPersons.length === 0) {
      return { nodes: [], links: [], width: 1200, height: 800 };
    }
    root = allPersons[0];
  }

  // 1. Collect direct backbone (ancestors & descendants of root)
  const directAncestors = new Set<string>();
  const collectAncestors = (pId: string) => {
    const p = database.persons[pId];
    if (!p) return;
    const { father, mother } = resolvePersonParents(p, database);
    if (father && !directAncestors.has(father.id)) {
      directAncestors.add(father.id);
      collectAncestors(father.id);
    }
    if (mother && !directAncestors.has(mother.id)) {
      directAncestors.add(mother.id);
      collectAncestors(mother.id);
    }
  };
  collectAncestors(root.id);

  const directDescendants = new Set<string>();
  const collectDescendants = (pId: string) => {
    if (!pId || directDescendants.has(pId)) return;
    directDescendants.add(pId);
    const childIds = resolvePersonChildrenIds(pId, database);
    childIds.forEach(cId => {
      collectDescendants(cId);
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

  const isPersonACollapsedSibling = (pId: string): boolean => {
    if (!pId) return false;
    if (isDirectBackbone(pId) || isSpouseOfBackbone(pId)) return false;
    return collapsedSiblings.has(pId);
  };

  const isPersonChildrenCollapsed = (pId: string): boolean => {
    if (!showDescendants) return true;
    if (collapsedChildren.has(pId)) return true;
    const p = database.persons[pId];
    if (!p) return false;
    if (p.spouseIds && p.spouseIds.some(sId => collapsedChildren.has(sId))) {
      return true;
    }
    if (p.spouseFamilyIds && database.families) {
      for (const fId of p.spouseFamilyIds) {
        const fam = database.families[fId];
        if (fam) {
          if (fam.husbandId && collapsedChildren.has(fam.husbandId)) return true;
          if (fam.wifeId && collapsedChildren.has(fam.wifeId)) return true;
        }
      }
    }
    return false;
  };

  const getDirectChildrenIds = (pId: string): string[] => {
    return resolvePersonChildrenIds(pId, database);
  };

  // Helper to collect all direct parents of a person across all database relationship formats
  const getDirectParentIds = (pId: string): string[] => {
    const p = database.persons[pId];
    if (!p) return [];
    const { father, mother } = resolvePersonParents(p, database);
    const parents: string[] = [];
    if (father) parents.push(father.id);
    if (mother) parents.push(mother.id);
    return parents;
  };

  // Collect collapsed descendants
  const collapsedDescendantIds = new Set<string>();
  const collapsedParentsList = Object.keys(database.persons).filter(pId => isPersonChildrenCollapsed(pId));
  if (collapsedParentsList.length > 0) {
    const q: string[] = [];
    collapsedParentsList.forEach(parId => {
      getDirectChildrenIds(parId).forEach(cId => {
        if (!collapsedDescendantIds.has(cId)) {
          collapsedDescendantIds.add(cId);
          q.push(cId);
        }
      });
    });
    while (q.length > 0) {
      const curId = q.shift()!;
      getDirectChildrenIds(curId).forEach(cId => {
        if (!collapsedDescendantIds.has(cId)) {
          collapsedDescendantIds.add(cId);
          q.push(cId);
        }
      });
    }
    collapsedDescendantIds.forEach(dId => {
      const d = database.persons[dId];
      if (d?.spouseIds) {
        d.spouseIds.forEach(sId => {
          if (!directAncestors.has(sId) && !isPersonChildrenCollapsed(sId)) {
            collapsedDescendantIds.add(sId);
          }
        });
      }
    });
  }

  // Collect all persons that must be hidden because their child or descendant has collapsed parents
  const collapsedAncestorIds = new Set<string>();
  if (collapsedParents.size > 0) {
    const q: string[] = [];
    collapsedParents.forEach(entry => {
      if (entry.startsWith('pat_')) {
        const childId = entry.replace('pat_', '');
        const p = database.persons[childId];
        const fId = p?.fatherId || (p?.parentFamilyId ? database.families[p.parentFamilyId]?.husbandId : undefined);
        if (fId && !collapsedAncestorIds.has(fId)) {
          collapsedAncestorIds.add(fId);
          q.push(fId);
        }
      } else if (entry.startsWith('mat_')) {
        const childId = entry.replace('mat_', '');
        const p = database.persons[childId];
        const mId = p?.motherId || (p?.parentFamilyId ? database.families[p.parentFamilyId]?.wifeId : undefined);
        if (mId && !collapsedAncestorIds.has(mId)) {
          collapsedAncestorIds.add(mId);
          q.push(mId);
        }
      } else {
        getDirectParentIds(entry).forEach(parId => {
          if (!collapsedAncestorIds.has(parId)) {
            collapsedAncestorIds.add(parId);
            q.push(parId);
          }
        });
      }
    });

    while (q.length > 0) {
      const curId = q.shift()!;
      getDirectParentIds(curId).forEach(parId => {
        if (!collapsedAncestorIds.has(parId)) {
          collapsedAncestorIds.add(parId);
          q.push(parId);
        }
      });
    }

    // Also include spouses of collapsed ancestors if they are only in the tree through the collapsed branch
    const isUncollapsedParentOfSomeone = (sId: string): boolean => {
      return Object.values(database.persons).some(cand => {
        if (collapsedAncestorIds.has(cand.id)) return false;
        const fId = cand.fatherId || (cand.parentFamilyId ? database.families[cand.parentFamilyId]?.husbandId : undefined);
        const mId = cand.motherId || (cand.parentFamilyId ? database.families[cand.parentFamilyId]?.wifeId : undefined);
        if (fId === sId) return !collapsedParents.has(cand.id) && !collapsedParents.has(`pat_${cand.id}`);
        if (mId === sId) return !collapsedParents.has(cand.id) && !collapsedParents.has(`mat_${cand.id}`);
        return false;
      });
    };

    collapsedAncestorIds.forEach(aId => {
      const a = database.persons[aId];
      if (a?.spouseIds) {
        a.spouseIds.forEach(sId => {
          if (!directDescendants.has(sId) && !collapsedParents.has(sId) && sId !== root.id && !isUncollapsedParentOfSomeone(sId)) {
            collapsedAncestorIds.add(sId);
          }
        });
      }
      if (a?.spouseFamilyIds && database.families) {
        a.spouseFamilyIds.forEach(fId => {
          const fam = database.families[fId];
          if (fam) {
            if (fam.husbandId && !directDescendants.has(fam.husbandId) && !collapsedParents.has(fam.husbandId) && fam.husbandId !== root.id && !isUncollapsedParentOfSomeone(fam.husbandId)) {
              collapsedAncestorIds.add(fam.husbandId);
            }
            if (fam.wifeId && !directDescendants.has(fam.wifeId) && !collapsedParents.has(fam.wifeId) && fam.wifeId !== root.id && !isUncollapsedParentOfSomeone(fam.wifeId)) {
              collapsedAncestorIds.add(fam.wifeId);
            }
          }
        });
      }
    });
  }

  let effectiveRoot = root;
  if (collapsedDescendantIds.has(root.id)) {
    const visited = new Set<string>();
    const findCutAncestor = (pId: string): Person | null => {
      const p = database.persons[pId];
      if (!p) return null;
      const parents: string[] = [];
      if (p.fatherId) parents.push(p.fatherId);
      if (p.motherId) parents.push(p.motherId);
      if (p.parentFamilyId && database.families) {
        const fam = database.families[p.parentFamilyId];
        if (fam?.husbandId) parents.push(fam.husbandId);
        if (fam?.wifeId) parents.push(fam.wifeId);
      }
      for (const parId of parents) {
        if (visited.has(parId)) continue;
        visited.add(parId);
        if (isPersonChildrenCollapsed(parId)) {
          return database.persons[parId] || null;
        }
        const higher = findCutAncestor(parId);
        if (higher) return higher;
      }
      return null;
    };
    const cutAncestor = findCutAncestor(root.id);
    if (cutAncestor) effectiveRoot = cutAncestor;
  }

  // If effectiveRoot itself is cut off by a descendant having collapsed parents,
  // find the closest cut descendant to serve as the effective root for the visible tree
  if (collapsedAncestorIds.has(effectiveRoot.id)) {
    const visited = new Set<string>();
    const findCutDescendant = (pId: string): Person | null => {
      const children = getDirectChildrenIds(pId);
      for (const cId of children) {
        if (visited.has(cId)) continue;
        visited.add(cId);
        if (collapsedParents.has(cId)) {
          return database.persons[cId] || null;
        }
        const lower = findCutDescendant(cId);
        if (lower) return lower;
      }
      return null;
    };
    const cutDescendant = findCutDescendant(effectiveRoot.id);
    if (cutDescendant) effectiveRoot = cutDescendant;
  }

  // BFS generation assignment
  const personGen = new Map<string, number>();
  const queue: { id: string; gen: number }[] = [{ id: effectiveRoot.id, gen: 0 }];
  personGen.set(effectiveRoot.id, 0);

  const enqueuePerson = (id: string, gen: number) => {
    if (directAncestorsOnly && !directAncestors.has(id) && id !== effectiveRoot.id && id !== root.id) {
      return;
    }
    if (collapsedDescendantIds.has(id)) {
      return;
    }
    if (collapsedAncestorIds.has(id)) {
      return;
    }
    if (!personGen.has(id)) {
      personGen.set(id, gen);
      queue.push({ id, gen });
    }
  };

  while (queue.length > 0) {
    const { id, gen } = queue.shift()!;
    const p = database.persons[id];
    if (!p) continue;

    // Spouses at same generation
    const spouseIds = new Set<string>();
    if (p.spouseIds) p.spouseIds.forEach(s => spouseIds.add(s));
    if (p.spouseFamilyIds && database.families) {
      p.spouseFamilyIds.forEach(fId => {
        const fam = database.families[fId];
        if (fam) {
          const partnerId = fam.husbandId === id ? fam.wifeId : fam.husbandId;
          if (partnerId) spouseIds.add(partnerId);
        }
      });
    }
    spouseIds.forEach(sId => {
      if (database.persons[sId] && !collapsedDescendantIds.has(sId)) {
        if (directAncestorsOnly && !directAncestors.has(sId) && sId !== effectiveRoot.id && sId !== root.id) {
          return;
        }
        enqueuePerson(sId, gen);
      }
    });

    // Ancestors (Gen - 1)
    const { father, mother } = resolvePersonParents(p, database);
    const fId = father?.id;
    const mId = mother?.id;
    const isPaternalDirectlyCollapsed = Boolean(fId && (collapsedParents.has(`pat_${id}`) || collapsedParents.has(id)));
    const isMaternalDirectlyCollapsed = Boolean(mId && (collapsedParents.has(`mat_${id}`) || collapsedParents.has(id)));
    const isBothCollapsed = (fId && mId)
      ? (isPaternalDirectlyCollapsed && isMaternalDirectlyCollapsed)
      : (fId ? isPaternalDirectlyCollapsed : isMaternalDirectlyCollapsed);

    if (showParents && !isBothCollapsed) {
      const canExpandAncestors = maxGenerations === 0 || Math.abs(gen - 1) <= maxGenerations || !isBothCollapsed;
      if (canExpandAncestors) {
        if (father && !isPaternalDirectlyCollapsed && !collapsedAncestorIds.has(father.id)) {
          enqueuePerson(father.id, gen - 1);
        }
        if (mother && !isMaternalDirectlyCollapsed && !collapsedAncestorIds.has(mother.id)) {
          enqueuePerson(mother.id, gen - 1);
        }
      }
    }

    // Descendants (Gen + 1)
    if (showDescendants && !directAncestorsOnly && !isPersonChildrenCollapsed(id) && !isPersonACollapsedSibling(id)) {
      if (maxGenerations === 0 || (gen + 1) <= maxGenerations) {
        const childIds = getDirectChildrenIds(id);
        childIds.forEach(cId => {
          if (collapsedDescendantIds.has(cId)) return;
          if (!showSiblings && directAncestors.has(id) && !directAncestors.has(cId) && cId !== effectiveRoot.id) {
            return;
          }
          if (isPersonACollapsedSibling(cId)) return;
          enqueuePerson(cId, gen + 1);
        });
      }
    }

    // Siblings (Gen)
    if (showSiblings && !directAncestorsOnly && !collapsedSiblings.has(id) && !isPersonACollapsedSibling(id)) {
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
          if (!isPersonACollapsedSibling(sId)) enqueuePerson(sId, gen);
        });
      }
      if (database.families) {
        Object.values(database.families).forEach((fam) => {
          const isChild = (fam.children && fam.children.some((c: any) => (c.personId || c.id) === p.id)) ||
                          (Array.isArray(fam.childrenIds) && fam.childrenIds.includes(p.id));
          if (isChild) {
            const rawChildren = [
              ...(Array.isArray(fam.children) ? fam.children : []),
              ...(Array.isArray(fam.childrenIds) ? fam.childrenIds : [])
            ].map((c: any) => typeof c === 'string' ? c : c?.personId || c?.id).filter(Boolean);

            rawChildren.forEach((sibId) => {
              if (sibId !== p.id && !isPersonACollapsedSibling(sibId)) {
                enqueuePerson(sibId, gen);
              }
            });
          }
        });
      }
      Object.values(database.persons).forEach(cand => {
        if (cand.id !== p.id && !personGen.has(cand.id)) {
          const cF = cand.fatherId || (cand.parentFamilyId ? database.families[cand.parentFamilyId]?.husbandId : undefined);
          const cM = cand.motherId || (cand.parentFamilyId ? database.families[cand.parentFamilyId]?.wifeId : undefined);
          const isSibling = (fId && cF === fId) || (mId && cM === mId) || (cand.siblingIds && cand.siblingIds.includes(p.id)) || (p.siblingIds && p.siblingIds.includes(cand.id)) || (p.parentFamilyId && cand.parentFamilyId && p.parentFamilyId === cand.parentFamilyId);
          if (isSibling && !isPersonACollapsedSibling(cand.id)) {
            enqueuePerson(cand.id, gen);
          }
        }
      });
    }
  }

  // Normalize generations: Gen 0 = Oldest Ancestors (Left side)
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
    if (p) genGroups.get(gen)?.push(p);
  });

  interface SpouseInfo {
    spouse: Person;
    family?: any;
    marriageOrder?: number;
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
    height: number;
    x: number;
    y: number;
    childrenIds: string[];
  }

  const genUnits: Map<number, Unit[]> = new Map();

  genGroups.forEach((personsInGen, gen) => {
    const units: Unit[] = [];
    const processed = new Set<string>();

    const genX = 80 + gen * (cardWidth + horizontalGenGap);

    personsInGen.forEach(p => {
      if (processed.has(p.id)) return;

      // Find all spouses and co-parents for this person in this generation
      const spouseIdsSet = new Set<string>(resolvePersonSpouseIds(p.id, database));

      const rawSpouses: Person[] = [];
      spouseIdsSet.forEach(sId => {
        const sp = database.persons[sId];
        if (sp && normalizedGen.get(sId) === gen && !processed.has(sId)) {
          rawSpouses.push(sp);
        }
      });

      const spousesInfo: SpouseInfo[] = rawSpouses.map((sp, idx) => {
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

        const unionChildren = new Set<string>();
        if (matchedFam?.childrenIds) {
          matchedFam.childrenIds.forEach((cId: string) => unionChildren.add(cId));
        }
        if (matchedFam?.children) {
          matchedFam.children.forEach((c: any) => {
            const cId = typeof c === 'string' ? c : (c?.personId || c?.id);
            if (cId) unionChildren.add(cId);
          });
        }
        Object.values(database.persons).forEach(candChild => {
          if (!candChild || candChild.id === p.id || candChild.id === sp.id || candChild.isDeleted) return;
          const { fatherId, motherId } = resolvePersonParents(candChild, database);

          if (
            (fatherId === p.id && motherId === sp.id) ||
            (fatherId === sp.id && motherId === p.id) ||
            (matchedFam?.id && candChild.parentFamilyId === matchedFam.id)
          ) {
            unionChildren.add(candChild.id);
            return;
          }

          // If this is the only spouse in the unit, link children where single known parent is p or sp
          if (rawSpouses.length === 1) {
            if ((fatherId === p.id && !motherId) || (motherId === p.id && !fatherId)) {
              unionChildren.add(candChild.id);
            } else if ((fatherId === sp.id && !motherId) || (motherId === sp.id && !fatherId)) {
              unionChildren.add(candChild.id);
            }
          }
        });

        const validUnionChildren = Array.from(unionChildren).filter(
          cId => database.persons[cId] && personGen.has(cId) && (normalizedGen.get(cId) ?? 0) > gen
        );
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

      spousesInfo.sort((a, b) => {
        const yearA = a.marriageYear || (a.marriageDate ? parseInt(a.marriageDate.match(/\d{4}/)?.[0] || '0', 10) : 0);
        const yearB = b.marriageYear || (b.marriageDate ? parseInt(b.marriageDate.match(/\d{4}/)?.[0] || '0', 10) : 0);
        if (yearA && yearB) return yearA - yearB;
        return 0;
      });
      spousesInfo.forEach((s, idx) => {
        s.marriageOrder = idx + 1;
      });

      const allChildren = new Set<string>();
      resolvePersonChildrenIds(p.id, database).forEach(cId => allChildren.add(cId));
      rawSpouses.forEach(sp => {
        resolvePersonChildrenIds(sp.id, database).forEach(cId => allChildren.add(cId));
      });
      spousesInfo.forEach(s => s.childrenIds.forEach(c => allChildren.add(c)));

      const validAllChildren = Array.from(allChildren).filter(
        cId => database.persons[cId] && personGen.has(cId) && (normalizedGen.get(cId) ?? 0) > gen
      );
      validAllChildren.sort((idA, idB) =>
        comparePersonsByAge(database.persons[idA], database.persons[idB])
      );

      const totalMembers = 1 + spousesInfo.length;
      // In horizontal layout, spouses in couple are stacked vertically along Y
      const unitHeight = cardHeight * totalMembers + SPOUSE_GAP * (totalMembers - 1);

      processed.add(p.id);
      spousesInfo.forEach(s => processed.add(s.spouse.id));

      if (spousesInfo.length === 0) {
        units.push({
          type: 'single',
          primary: p,
          spouses: [],
          width: cardWidth,
          height: cardHeight,
          x: genX,
          y: 0,
          childrenIds: validAllChildren
        });
      } else if (spousesInfo.length === 1) {
        const isMale = p.gender === 'male' || p.gender === 'M';
        const spouse = spousesInfo[0].spouse;
        const spouseIsMale = spouse.gender === 'male' || spouse.gender === 'M';

        let primaryPerson = p;
        let spousePerson = spousesInfo[0];
        if (!isMale && spouseIsMale) {
          primaryPerson = spouse;
          spousePerson = { ...spousesInfo[0], spouse: p };
        }

        units.push({
          type: 'couple',
          primary: primaryPerson,
          spouses: [spousePerson],
          width: cardWidth,
          height: unitHeight,
          x: genX,
          y: 0,
          childrenIds: validAllChildren
        });
      } else {
        units.push({
          type: 'multi_spouse',
          primary: p,
          spouses: spousesInfo,
          width: cardWidth,
          height: unitHeight,
          x: genX,
          y: 0,
          childrenIds: validAllChildren
        });
      }
    });

    genUnits.set(gen, units);
  });

  // Helpers for sibling detection
  const getParentsOfPerson = (pId: string) => {
    const p = database.persons[pId];
    if (!p) return { fatherId: undefined, motherId: undefined };
    let fId = p.fatherId || (p.parentFamilyId ? database.families[p.parentFamilyId]?.husbandId : undefined);
    let mId = p.motherId || (p.parentFamilyId ? database.families[p.parentFamilyId]?.wifeId : undefined);
    if ((!fId || !mId) && database.families) {
      for (const fam of Object.values(database.families)) {
        const rawChildren = [
          ...(Array.isArray(fam.children) ? fam.children : []),
          ...(Array.isArray(fam.childrenIds) ? fam.childrenIds : [])
        ].map((c: any) => typeof c === 'string' ? c : (c?.personId || c?.id)).filter(Boolean);
        if (rawChildren.includes(p.id) || (p.parentFamilyId && fam.id === p.parentFamilyId)) {
          if (!fId && fam.husbandId) fId = fam.husbandId;
          if (!mId && fam.wifeId) mId = fam.wifeId;
        }
      }
    }
    if ((!fId || !mId) && database.persons) {
      for (const parentCandidate of Object.values(database.persons)) {
        const cIds = parentCandidate.childrenIds || [];
        if (cIds.includes(p.id)) {
          if (parentCandidate.gender === 'female' || parentCandidate.gender === 'F') {
            if (!mId) mId = parentCandidate.id;
          } else {
            if (!fId) fId = parentCandidate.id;
          }
        }
      }
    }
    return { fatherId: fId, motherId: mId };
  };

  const areSiblings = (pId1: string, pId2: string): boolean => {
    if (!pId1 || !pId2 || pId1 === pId2) return false;
    const p1 = database.persons[pId1];
    const p2 = database.persons[pId2];
    if (!p1 || !p2) return false;
    if (p1.siblingIds?.includes(pId2) || p2.siblingIds?.includes(pId1)) return true;
    if (p1.parentFamilyId && p2.parentFamilyId && p1.parentFamilyId === p2.parentFamilyId) return true;
    const par1 = getParentsOfPerson(pId1);
    const par2 = getParentsOfPerson(pId2);
    if ((par1.fatherId && par1.fatherId === par2.fatherId) ||
        (par1.motherId && par1.motherId === par2.motherId)) {
      return true;
    }
    if (database.families) {
      for (const fam of Object.values(database.families)) {
        const rawChildren = [
          ...(Array.isArray(fam.children) ? fam.children : []),
          ...(Array.isArray(fam.childrenIds) ? fam.childrenIds : [])
        ].map((c: any) => typeof c === 'string' ? c : (c?.personId || c?.id)).filter(Boolean);
        if (rawChildren.includes(pId1) && rawChildren.includes(pId2)) return true;
      }
    }
    return false;
  };

  const unitsAreSiblings = (u1: Unit, u2: Unit): boolean => {
    if (!u1 || !u2 || u1 === u2) return false;
    const ids1 = [u1.primary.id, ...(u1.spouses?.map(s => s.spouse.id) || [])];
    const ids2 = [u2.primary.id, ...(u2.spouses?.map(s => s.spouse.id) || [])];
    for (const id1 of ids1) {
      for (const id2 of ids2) {
        if (areSiblings(id1, id2)) return true;
      }
    }
    return false;
  };

  const getPersonCenterYInUnits = (personId: string, uList: Unit[]): number | undefined => {
    for (const u of uList) {
      if (u.primary.id === personId) {
        return u.y + CLASSIC_CARD_HEIGHT / 2;
      }
      if (u.spouses) {
        for (let sIdx = 0; sIdx < u.spouses.length; sIdx++) {
          if (u.spouses[sIdx].spouse.id === personId) {
            return u.y + (sIdx + 1) * (CLASSIC_CARD_HEIGHT + SPOUSE_GAP) + CLASSIC_CARD_HEIGHT / 2;
          }
        }
      }
    }
    return undefined;
  };

  // Family Cluster definition for strictly keeping siblings contiguous in horizontal layout
  interface HorizontalFamilyCluster {
    key: string;
    parentUnit?: Unit;
    parentUnitIndex: number;
    units: Unit[];
    height: number;
    y: number;
  }

  const getParentUnitForPersonH = (personId: string, parentUnits: Unit[]): Unit | undefined => {
    for (const pu of parentUnits) {
      if (pu.childrenIds && pu.childrenIds.includes(personId)) return pu;
      if (pu.spouses) {
        for (const sp of pu.spouses) {
          if (sp.childrenIds && sp.childrenIds.includes(personId)) return pu;
        }
      }
    }
    const { fatherId, motherId } = getParentsOfPerson(personId);
    for (const pu of parentUnits) {
      const puIds = [pu.primary.id, ...(pu.spouses?.map(s => s.spouse.id) || [])];
      if ((fatherId && puIds.includes(fatherId)) || (motherId && puIds.includes(motherId))) {
        return pu;
      }
    }
    if (database.families) {
      for (const fam of Object.values(database.families)) {
        const rawChildren = [
          ...(Array.isArray(fam.children) ? fam.children : []),
          ...(Array.isArray(fam.childrenIds) ? fam.childrenIds : [])
        ].map((c: any) => typeof c === 'string' ? c : (c?.personId || c?.id)).filter(Boolean);
        if (rawChildren.includes(personId)) {
          for (const pu of parentUnits) {
            const puIds = [pu.primary.id, ...(pu.spouses?.map(s => s.spouse.id) || [])];
            if ((fam.husbandId && puIds.includes(fam.husbandId)) || (fam.wifeId && puIds.includes(fam.wifeId))) {
              return pu;
            }
          }
        }
      }
    }
    return undefined;
  };

  const getChildPersonInUnitH = (u: Unit, pUnit?: Unit): Person => {
    if (!pUnit) return u.primary;
    if (pUnit.childrenIds && pUnit.childrenIds.includes(u.primary.id)) return u.primary;
    if (u.spouses) {
      for (const sp of u.spouses) {
        if (pUnit.childrenIds && pUnit.childrenIds.includes(sp.spouse.id)) return sp.spouse;
        if (sp.childrenIds && sp.childrenIds.includes(u.primary.id)) return u.primary;
      }
    }
    const { fatherId, motherId } = getParentsOfPerson(u.primary.id);
    const puIds = [pUnit.primary.id, ...(pUnit.spouses?.map(s => s.spouse.id) || [])];
    if ((fatherId && puIds.includes(fatherId)) || (motherId && puIds.includes(motherId))) {
      return u.primary;
    }
    if (u.spouses) {
      for (const sp of u.spouses) {
        const spPars = getParentsOfPerson(sp.spouse.id);
        if ((spPars.fatherId && puIds.includes(spPars.fatherId)) || (spPars.motherId && puIds.includes(spPars.motherId))) {
          return sp.spouse;
        }
      }
    }
    return u.primary;
  };

  // Initial vertical placement per generation with strict family-aware clustering
  const genClustersH = new Map<number, HorizontalFamilyCluster[]>();

  for (let gen = 0; gen < totalGens; gen++) {
    const units = genUnits.get(gen) || [];
    if (units.length === 0) continue;

    if (gen === 0) {
      const clusters: HorizontalFamilyCluster[] = [];
      const usedPrimaries = new Set<string>();

      // Group sibling units together
      units.forEach(u => {
        if (usedPrimaries.has(u.primary.id)) return;
        const sibs = units.filter(cand => !usedPrimaries.has(cand.primary.id) && (cand.primary.id === u.primary.id || unitsAreSiblings(u, cand)));
        sibs.forEach(s => usedPrimaries.add(s.primary.id));
        sibs.sort((a, b) => comparePersonsByAge(a.primary, b.primary));
        const cHeight = sibs.reduce((acc, s) => acc + s.height, 0) + (sibs.length - 1) * HORIZONTAL_SIBLING_GAP;
        clusters.push({
          key: `c_gen0_${u.primary.id}`,
          parentUnitIndex: clusters.length,
          units: sibs,
          height: cHeight,
          y: 80
        });
      });

      let curY = 80;
      clusters.forEach(c => {
        c.y = curY;
        let unitY = c.y;
        c.units.forEach(u => {
          u.y = unitY;
          unitY += u.height + HORIZONTAL_SIBLING_GAP;
        });
        curY += c.height + HORIZONTAL_FAMILY_GAP;
      });

      genClustersH.set(gen, clusters);
      units.splice(0, units.length, ...clusters.flatMap(c => c.units));
    } else {
      const parentUnits = genUnits.get(gen - 1) || [];
      const clusterMap = new Map<string, HorizontalFamilyCluster>();

      units.forEach(u => {
        // 1. Direct parent unit lookup for primary and spouse
        const pUnitForPrimary = getParentUnitForPersonH(u.primary.id, parentUnits);
        let pUnitForSpouse: Unit | undefined;
        if (u.spouses) {
          for (const sp of u.spouses) {
            const found = getParentUnitForPersonH(sp.spouse.id, parentUnits);
            if (found) {
              pUnitForSpouse = found;
              break;
            }
          }
        }

        // 2. Sibling unity: check if u is a sibling of an already clustered unit
        let siblingParentUnit: Unit | undefined;
        let siblingClusterKey: string | undefined;
        for (const [existingKey, existingCluster] of clusterMap.entries()) {
          if (existingCluster.units.some(eu => unitsAreSiblings(u, eu))) {
            siblingParentUnit = existingCluster.parentUnit;
            siblingClusterKey = existingKey;
            break;
          }
        }

        let chosenParentUnit: Unit | undefined;
        let clusterKey: string;

        if (siblingClusterKey && clusterMap.has(siblingClusterKey)) {
          clusterKey = siblingClusterKey;
          chosenParentUnit = siblingParentUnit;
        } else {
          if (pUnitForPrimary && pUnitForSpouse && pUnitForPrimary !== pUnitForSpouse) {
            const primarySibCount = units.filter(cand => cand !== u && cand.primary.id !== u.primary.id && (cand.primary.id === pUnitForPrimary.primary.id || unitsAreSiblings(u, cand))).length;
            const spouseSibCount = units.filter(cand => cand !== u && cand.primary.id !== u.primary.id && (cand.primary.id === pUnitForSpouse!.primary.id || unitsAreSiblings(u, cand))).length;
            if (primarySibCount >= spouseSibCount) {
              chosenParentUnit = pUnitForPrimary;
            } else {
              chosenParentUnit = pUnitForSpouse;
            }
          } else {
            chosenParentUnit = pUnitForPrimary || pUnitForSpouse;
          }

          if (!chosenParentUnit) {
            for (const otherUnit of units) {
              if (otherUnit !== u && unitsAreSiblings(u, otherUnit)) {
                const otherPUnit = getParentUnitForPersonH(otherUnit.primary.id, parentUnits) ||
                  (otherUnit.spouses?.[0] ? getParentUnitForPersonH(otherUnit.spouses[0].spouse.id, parentUnits) : undefined);
                if (otherPUnit) {
                  chosenParentUnit = otherPUnit;
                  break;
                }
              }
            }
          }

          if (chosenParentUnit) {
            clusterKey = `parent_${chosenParentUnit.primary.id}`;
          } else {
            const siblingIds = units
              .filter(cand => cand === u || unitsAreSiblings(u, cand))
              .map(cand => cand.primary.id)
              .sort();
            clusterKey = `unaffiliated_sibs_${siblingIds[0] || u.primary.id}`;
          }
        }

        if (!clusterMap.has(clusterKey)) {
          const parentIdx = chosenParentUnit
            ? parentUnits.findIndex(pu => pu.primary.id === chosenParentUnit!.primary.id)
            : 9999;
          clusterMap.set(clusterKey, {
            key: clusterKey,
            parentUnit: chosenParentUnit,
            parentUnitIndex: parentIdx !== -1 ? parentIdx : 9999,
            units: [],
            height: 0,
            y: 0
          });
        }
        clusterMap.get(clusterKey)!.units.push(u);
      });

      const clusters = Array.from(clusterMap.values());
      clusters.sort((cA, cB) => cA.parentUnitIndex - cB.parentUnitIndex);

      // Sort units WITHIN each cluster chronologically by child age (oldest to youngest)
      clusters.forEach(c => {
        c.units.sort((uA, uB) => {
          const childA = getChildPersonInUnitH(uA, c.parentUnit);
          const childB = getChildPersonInUnitH(uB, c.parentUnit);
          return comparePersonsByAge(childA, childB);
        });

        c.height = c.units.reduce((acc, u) => acc + u.height, 0) + (c.units.length - 1) * HORIZONTAL_SIBLING_GAP;
      });

      let minClusterY = 80;
      clusters.forEach(c => {
        if (c.parentUnit) {
          const pCenter = c.parentUnit.y + c.parentUnit.height / 2;
          c.y = pCenter - c.height / 2;
        } else {
          c.y = minClusterY;
        }
        if (c.y < minClusterY) {
          c.y = minClusterY;
        }
        minClusterY = c.y + c.height + HORIZONTAL_FAMILY_GAP;

        let curUnitY = c.y;
        c.units.forEach(u => {
          u.y = curUnitY;
          curUnitY += u.height + HORIZONTAL_SIBLING_GAP;
        });
      });

      genClustersH.set(gen, clusters);
      units.splice(0, units.length, ...clusters.flatMap(c => c.units));
    }
  }

  // Vertical Centering & Alignment passes
  for (let pass = 0; pass < 3; pass++) {
    // Bottom-up pass: align parents to children's vertical center
    for (let gen = totalGens - 2; gen >= 0; gen--) {
      const parentUnits = genUnits.get(gen) || [];
      const childClusters = genClustersH.get(gen + 1) || [];

      parentUnits.forEach((pUnit) => {
        const matchedCluster = childClusters.find(c => c.parentUnit && c.parentUnit.primary.id === pUnit.primary.id);
        if (matchedCluster) {
          const clusterCenter = matchedCluster.y + matchedCluster.height / 2;
          pUnit.y = clusterCenter - pUnit.height / 2;
        }
      });

      // Prevent overlapping along Y while preserving parent order
      let pMinY = 80;
      for (let i = 0; i < parentUnits.length; i++) {
        const pu = parentUnits[i];
        if (pu.y < pMinY) pu.y = pMinY;
        const nextGap = (i < parentUnits.length - 1 && unitsAreSiblings(pu, parentUnits[i + 1]))
          ? HORIZONTAL_SIBLING_GAP
          : HORIZONTAL_FAMILY_GAP;
        pMinY = pu.y + pu.height + nextGap;
      }
    }

    // Top-down pass: align children under parents
    for (let gen = 0; gen < totalGens - 1; gen++) {
      const childClusters = genClustersH.get(gen + 1) || [];

      childClusters.forEach((c) => {
        if (c.parentUnit) {
          const parentCenter = c.parentUnit.y + c.parentUnit.height / 2;
          c.y = parentCenter - c.height / 2;
        }
      });

      // Sort clusters preserving parent order so horizontal lines never invert or cross!
      childClusters.sort((a, b) => {
        if (a.parentUnit && b.parentUnit) {
          const stemA = a.parentUnit.y + a.parentUnit.height / 2;
          const stemB = b.parentUnit.y + b.parentUnit.height / 2;
          if (Math.abs(stemA - stemB) > 2) {
            return stemA - stemB;
          }
        }
        if (a.parentUnit) return -1;
        if (b.parentUnit) return 1;
        return a.y - b.y;
      });

      // Prevent overlapping along Y while preserving cluster order
      let cMinY = 80;
      for (let i = 0; i < childClusters.length; i++) {
        const c = childClusters[i];
        if (c.y < cMinY) c.y = cMinY;
        cMinY = c.y + c.height + HORIZONTAL_FAMILY_GAP;

        let curUnitY = c.y;
        c.units.forEach((u) => {
          u.y = curUnitY;
          curUnitY += u.height + HORIZONTAL_SIBLING_GAP;
        });
      }
    }
  }

  // Ensure minimum top margin of 80px
  let globalMinY = Infinity;
  genUnits.forEach(units => {
    units.forEach(u => {
      globalMinY = Math.min(globalMinY, u.y);
    });
  });
  if (globalMinY < 80) {
    const shift = 80 - globalMinY;
    genUnits.forEach(units => {
      units.forEach(u => {
        u.y += shift;
      });
    });
  }

  // Node Map for recording absolute positions
  const nodeMap = new Map<string, { x: number; y: number; width: number; height: number; centerX: number; centerY: number }>();

  const getNodeFlags = (p: Person) => {
    const { father, mother } = resolvePersonParents(p, database);
    const fId = father?.id;
    const mId = mother?.id;

    const parentsCount = (father ? 1 : 0) + (mother ? 1 : 0);
    const hasParents = parentsCount > 0;
    const isPaternalDirectlyCollapsed = Boolean(fId && (collapsedParents.has(`pat_${p.id}`) || collapsedParents.has(p.id)));
    const isMaternalDirectlyCollapsed = Boolean(mId && (collapsedParents.has(`mat_${p.id}`) || collapsedParents.has(p.id)));
    const isPaternalVisible = Boolean(fId && personGen.has(fId));
    const isMaternalVisible = Boolean(mId && personGen.has(mId));

    const isPaternalCollapsed = Boolean(fId && (isPaternalDirectlyCollapsed || !showParents || !isPaternalVisible));
    const isMaternalCollapsed = Boolean(mId && (isMaternalDirectlyCollapsed || !showParents || !isMaternalVisible));

    const areParentsVisible = Boolean((fId && isPaternalVisible) || (mId && isMaternalVisible));
    const isParentsCollapsed = collapsedParents.has(p.id) ||
      (hasParents && (
        (fId && mId ? isPaternalCollapsed && isMaternalCollapsed : (fId ? isPaternalCollapsed : isMaternalCollapsed))
      )) ||
      !showParents ||
      (hasParents && !areParentsVisible);

    let siblingCount = 0;
    let areSiblingsVisible = false;
    const sibs = Object.values(database.persons).filter(cand =>
      cand.id !== p.id && (
        (fId && (cand.fatherId === fId || (cand.parentFamilyId && database.families[cand.parentFamilyId]?.husbandId === fId))) ||
        (mId && (cand.motherId === mId || (cand.parentFamilyId && database.families[cand.parentFamilyId]?.wifeId === mId))) ||
        (p.siblingIds && p.siblingIds.includes(cand.id)) ||
        (cand.siblingIds && cand.siblingIds.includes(p.id)) ||
        (p.parentFamilyId && cand.parentFamilyId && p.parentFamilyId === cand.parentFamilyId) ||
        (database.families && Object.values(database.families).some(fam => {
          const rawChildren = [
            ...(Array.isArray(fam.children) ? fam.children : []),
            ...(Array.isArray(fam.childrenIds) ? fam.childrenIds : [])
          ].map((c: any) => typeof c === 'string' ? c : c?.personId || c?.id).filter(Boolean);
          return rawChildren.includes(p.id) && rawChildren.includes(cand.id);
        }))
      )
    );
    siblingCount = sibs.length;
    areSiblingsVisible = sibs.some(s => personGen.has(s.id));
    const hasSiblings = siblingCount > 0;
    const isSiblingsCollapsed = collapsedSiblings.has(p.id) || !showSiblings || (hasSiblings && !areSiblingsVisible) || isPersonACollapsedSibling(p.id);

    const validChildren = getDirectChildrenIds(p.id);
    const childrenCount = validChildren.length;
    const hasChildren = childrenCount > 0;
    const areChildrenVisible = validChildren.some(cId => personGen.has(cId));
    const isChildrenCollapsed = isPersonChildrenCollapsed(p.id) || !showDescendants || (hasChildren && !areChildrenVisible);

    const descendantsCount = getTotalDescendantsCount(p.id, database);
    const isDirectAncestor = directAncestors.has(p.id) || p.id === root.id;

    return {
      hasParents,
      hasSiblings,
      hasChildren,
      parentsCount,
      siblingsCount: siblingCount,
      childrenCount,
      descendantsCount,
      isDirectAncestor,
      isParentsCollapsed,
      isPaternalCollapsed,
      isMaternalCollapsed,
      isSiblingsCollapsed,
      isChildrenCollapsed,
      areParentsVisible: Boolean(areParentsVisible),
      areSiblingsVisible,
      areChildrenVisible,
      fatherId: fId,
      motherId: mId
    };
  };

  // 1. First Pass: Create nodes
  genUnits.forEach((units, gen) => {
    units.forEach((unit) => {
      if (unit.type === 'couple' && unit.spouses.length === 1) {
        // Husband / Primary
        const hX = unit.x;
        const hY = unit.y;
        const hFlags = getNodeFlags(unit.primary);
        nodes.push({
          id: unit.primary.id,
          person: unit.primary,
          x: hX,
          y: hY,
          width: cardWidth,
          height: cardHeight,
          generation: gen,
          spouseId: unit.spouses[0].spouse.id,
          ...hFlags
        });
        nodeMap.set(unit.primary.id, {
          x: hX,
          y: hY,
          width: cardWidth,
          height: cardHeight,
          centerX: hX + cardWidth / 2,
          centerY: hY + cardHeight / 2
        });

        // Wife / Spouse (stacked vertically below husband)
        const spInfo = unit.spouses[0];
        const wX = unit.x;
        const wY = unit.y + cardHeight + SPOUSE_GAP;
        const wFlags = getNodeFlags(spInfo.spouse);
        nodes.push({
          id: spInfo.spouse.id,
          person: spInfo.spouse,
          x: wX,
          y: wY,
          width: cardWidth,
          height: cardHeight,
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
          width: cardWidth,
          height: cardHeight,
          centerX: wX + cardWidth / 2,
          centerY: wY + cardHeight / 2
        });
      } else if (unit.type === 'multi_spouse') {
        let curY = unit.y;
        const pFlags = getNodeFlags(unit.primary);
        nodes.push({
          id: unit.primary.id,
          person: unit.primary,
          x: unit.x,
          y: curY,
          width: cardWidth,
          height: cardHeight,
          generation: gen,
          spouseId: unit.spouses[0]?.spouse.id,
          ...pFlags
        });
        nodeMap.set(unit.primary.id, {
          x: unit.x,
          y: curY,
          width: cardWidth,
          height: cardHeight,
          centerX: unit.x + cardWidth / 2,
          centerY: curY + cardHeight / 2
        });
        curY += cardHeight + SPOUSE_GAP;

        unit.spouses.forEach((spInfo) => {
          const sFlags = getNodeFlags(spInfo.spouse);
          nodes.push({
            id: spInfo.spouse.id,
            person: spInfo.spouse,
            x: unit.x,
            y: curY,
            width: cardWidth,
            height: cardHeight,
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
            x: unit.x,
            y: curY,
            width: cardWidth,
            height: cardHeight,
            centerX: unit.x + cardWidth / 2,
            centerY: curY + cardHeight / 2
          });
          curY += cardHeight + SPOUSE_GAP;
        });
      } else {
        // Single person
        const sFlags = getNodeFlags(unit.primary);
        nodes.push({
          id: unit.primary.id,
          person: unit.primary,
          x: unit.x,
          y: unit.y,
          width: cardWidth,
          height: cardHeight,
          generation: gen,
          ...sFlags
        });
        nodeMap.set(unit.primary.id, {
          x: unit.x,
          y: unit.y,
          width: cardWidth,
          height: cardHeight,
          centerX: unit.x + cardWidth / 2,
          centerY: unit.y + cardHeight / 2
        });
      }
    });
  });

  // 2. Second Pass: Generate orthogonal links (Ancestors Left ➔ Descendants Right)
  genUnits.forEach((units, gen) => {
    units.forEach((unit, unitIdx) => {
      const unitColor = FAMILY_LINE_COLORS[(gen * 3 + unitIdx) % FAMILY_LINE_COLORS.length];

      if ((unit.type === 'couple' || unit.type === 'multi_spouse') && unit.spouses.length > 0) {
        unit.spouses.forEach((spInfo, spIdx) => {
          const pNode = nodeMap.get(unit.primary.id);
          const sNode = nodeMap.get(spInfo.spouse.id);
          if (!pNode || !sNode) return;

          // Vertical marriage link connecting husband bottom to wife top
          const topCard = pNode.y < sNode.y ? pNode : sNode;
          const bottomCard = pNode.y < sNode.y ? sNode : pNode;
          const marriageMidY = (topCard.y + topCard.height + bottomCard.y) / 2;

          links.push({
            id: `marriage_${unit.primary.id}_${spInfo.spouse.id}`,
            sourceX: topCard.centerX,
            sourceY: topCard.y + topCard.height,
            targetX: bottomCard.centerX,
            targetY: bottomCard.y,
            type: 'marriage',
            marriageOrder: spInfo.marriageOrder,
            marriageStatus: spInfo.relationshipType,
            familyId: spInfo.family?.id,
            sourcePersonId: unit.primary.id,
            targetPersonId: spInfo.spouse.id,
            path: `M ${topCard.centerX} ${topCard.y + topCard.height} L ${bottomCard.centerX} ${bottomCard.y}`
          });

          // Children branching to the right
          if (spInfo.childrenIds.length > 0) {
            const unionColor = FAMILY_LINE_COLORS[(gen * 3 + unitIdx + spIdx) % FAMILY_LINE_COLORS.length];
            const stemStartX = Math.max(pNode.x, sNode.x) + cardWidth;
            const stemStartY = marriageMidY;
            const junctionX = stemStartX + (isCompact ? 20 : 36) + ((unitIdx + spIdx) % 6) * (isCompact ? 14 : 22);

            const childNodes = spInfo.childrenIds
              .filter(cId => nodeMap.has(cId))
              .map(cId => ({ id: cId, ...nodeMap.get(cId)! }))
              .filter(c => c && c.centerY !== undefined);

            if (childNodes.length > 0) {
              const minChildY = Math.min(...childNodes.map(c => c.centerY));
              const maxChildY = Math.max(...childNodes.map(c => c.centerY));
              const busTop = Math.min(stemStartY, minChildY);
              const busBottom = Math.max(stemStartY, maxChildY);

              // Horizontal stem going right
              links.push({
                id: `stem_${unit.primary.id}_${spInfo.spouse.id}`,
                sourceX: stemStartX,
                sourceY: stemStartY,
                targetX: junctionX,
                targetY: stemStartY,
                type: 'stem',
                color: unionColor,
                sourcePersonId: unit.primary.id,
                targetPersonId: spInfo.spouse.id,
                path: `M ${stemStartX} ${stemStartY} L ${junctionX} ${stemStartY}`
              });

              // Vertical bus bar
              links.push({
                id: `bus_${unit.primary.id}_${spInfo.spouse.id}`,
                sourceX: junctionX,
                sourceY: busTop,
                targetX: junctionX,
                targetY: busBottom,
                type: 'bus',
                color: unionColor,
                sourcePersonId: unit.primary.id,
                targetPersonId: spInfo.spouse.id,
                path: `M ${junctionX} ${busTop} L ${junctionX} ${busBottom}`
              });

              // Horizontal drop into each child card
              childNodes.forEach((child) => {
                links.push({
                  id: `drop_${spInfo.family?.id || 'f'}_${child.id}`,
                  sourceX: junctionX,
                  sourceY: child.centerY,
                  targetX: child.x,
                  targetY: child.centerY,
                  type: 'drop',
                  color: unionColor,
                  arrow: 'right',
                  arrowX: child.x,
                  arrowY: child.centerY,
                  familyId: spInfo.family?.id,
                  childPersonId: child.id,
                  sourcePersonId: unit.primary.id,
                  targetPersonId: spInfo.spouse.id,
                  path: `M ${junctionX} ${child.centerY} L ${child.x} ${child.centerY}`
                });
              });
            }
          }
        });
      } else {
        // Single parent children branching right
        const pNode = nodeMap.get(unit.primary.id);
        if (pNode && unit.childrenIds.length > 0) {
          const stemStartX = pNode.x + cardWidth;
          const stemStartY = pNode.centerY;
          const junctionX = stemStartX + (isCompact ? 20 : 36) + (unitIdx % 4) * (isCompact ? 12 : 20);

          const childNodes = unit.childrenIds
            .map(cId => ({ id: cId, ...nodeMap.get(cId)! }))
            .filter(c => c && c.centerY !== undefined);

          if (childNodes.length > 0) {
            const minChildY = Math.min(...childNodes.map(c => c.centerY));
            const maxChildY = Math.max(...childNodes.map(c => c.centerY));
            const busTop = Math.min(stemStartY, minChildY);
            const busBottom = Math.max(stemStartY, maxChildY);

            links.push({
              id: `stem_single_${unit.primary.id}`,
              sourceX: stemStartX,
              sourceY: stemStartY,
              targetX: junctionX,
              targetY: stemStartY,
              type: 'stem',
              color: unitColor,
              sourcePersonId: unit.primary.id,
              path: `M ${stemStartX} ${stemStartY} L ${junctionX} ${stemStartY}`
            });

            links.push({
              id: `bus_single_${unit.primary.id}`,
              sourceX: junctionX,
              sourceY: busTop,
              targetX: junctionX,
              targetY: busBottom,
              type: 'bus',
              color: unitColor,
              sourcePersonId: unit.primary.id,
              path: `M ${junctionX} ${busTop} L ${junctionX} ${busBottom}`
            });

            childNodes.forEach((child) => {
              links.push({
                id: `drop_single_${unit.primary.id}_${child.id}`,
                sourceX: junctionX,
                sourceY: child.centerY,
                targetX: child.x,
                targetY: child.centerY,
                type: 'drop',
                color: unitColor,
                arrow: 'right',
                arrowX: child.x,
                arrowY: child.centerY,
                childPersonId: child.id,
                sourcePersonId: unit.primary.id,
                path: `M ${junctionX} ${child.centerY} L ${child.x} ${child.centerY}`
              });
            });
          }
        }
      }
    });
  });

  // 3. Third Pass (Safety Net): Guarantee that every child on canvas with visible parents has a connecting link and marriage link
  nodes.forEach(cNode => {
    const p = cNode.person;
    const { father, mother } = resolvePersonParents(p, database);
    const fNode = father ? nodeMap.get(father.id) : null;
    const mNode = mother ? nodeMap.get(mother.id) : null;
    const childCenterY = cNode.y + cNode.height / 2;

    if (father && mother && fNode && mNode) {
      const hasMarriage = links.some(l =>
        l.type === 'marriage' &&
        ((l.sourcePersonId === father.id && l.targetPersonId === mother.id) ||
         (l.sourcePersonId === mother.id && l.targetPersonId === father.id))
      );
      if (!hasMarriage) {
        const topCard = fNode.y < mNode.y ? fNode : mNode;
        const bottomCard = fNode.y < mNode.y ? mNode : fNode;
        links.push({
          id: `marriage_${father.id}_${mother.id}`,
          sourceX: topCard.centerX,
          sourceY: topCard.y + topCard.height,
          targetX: bottomCard.centerX,
          targetY: bottomCard.y,
          type: 'marriage',
          color: '#a1a1aa',
          sourcePersonId: father.id,
          targetPersonId: mother.id,
          path: `M ${topCard.centerX} ${topCard.y + topCard.height} L ${bottomCard.centerX} ${bottomCard.y}`
        });
      }
    }

    const hasDropLink = links.some(l =>
      l.childPersonId === cNode.id ||
      ((l.type === 'drop' || l.type === 'child') && l.targetPersonId === cNode.id)
    );

    if (!hasDropLink && (fNode || mNode)) {
      if (father && mother && fNode && mNode) {
        const stemStartX = Math.max(fNode.x, mNode.x) + cardWidth;
        const stemStartY = (fNode.centerY + mNode.centerY) / 2;
        const junctionX = (stemStartX + cNode.x) / 2;

        const pathStr = Math.abs(stemStartY - childCenterY) < 3
          ? `M ${stemStartX} ${stemStartY} L ${cNode.x} ${childCenterY}`
          : `M ${stemStartX} ${stemStartY} L ${junctionX} ${stemStartY} L ${junctionX} ${childCenterY} L ${cNode.x} ${childCenterY}`;

        links.push({
          id: `safety_drop_h_${father.id}_${mother.id}_${cNode.id}`,
          sourceX: stemStartX,
          sourceY: stemStartY,
          targetX: cNode.x,
          targetY: childCenterY,
          type: 'drop',
          color: '#38bdf8',
          sourcePersonId: father.id,
          targetPersonId: mother.id,
          childPersonId: cNode.id,
          arrow: 'right',
          arrowX: cNode.x,
          arrowY: childCenterY,
          path: pathStr
        });
      } else {
        const parId = father ? father.id : mother!.id;
        const parNode = (fNode || mNode)!;
        const stemStartX = parNode.x + cardWidth;
        const stemStartY = parNode.centerY;
        const junctionX = (stemStartX + cNode.x) / 2;

        const pathStr = Math.abs(stemStartY - childCenterY) < 3
          ? `M ${stemStartX} ${stemStartY} L ${cNode.x} ${childCenterY}`
          : `M ${stemStartX} ${stemStartY} L ${junctionX} ${stemStartY} L ${junctionX} ${childCenterY} L ${cNode.x} ${childCenterY}`;

        links.push({
          id: `safety_drop_h_${parId}_${cNode.id}`,
          sourceX: stemStartX,
          sourceY: stemStartY,
          targetX: cNode.x,
          targetY: childCenterY,
          type: 'drop',
          color: '#38bdf8',
          sourcePersonId: parId,
          childPersonId: cNode.id,
          arrow: 'right',
          arrowX: cNode.x,
          arrowY: childCenterY,
          path: pathStr
        });
      }
    }
  });

  // Calculate full dimensions
  let finalMaxX = 1400;
  let finalMaxY = 900;
  nodes.forEach(n => {
    finalMaxX = Math.max(finalMaxX, n.x + n.width + 160);
    finalMaxY = Math.max(finalMaxY, n.y + n.height + 160);
  });

  // Guarantee strictly unique node and link IDs within layout
  const seenNodeIds = new Map<string, number>();
  nodes.forEach((n, idx) => {
    const count = (seenNodeIds.get(n.id) || 0) + 1;
    seenNodeIds.set(n.id, count);
    if (count > 1) {
      n.id = `${n.id}__node_${count}_${idx}`;
    }
  });
  const seenLinkIds = new Map<string, number>();
  links.forEach((l, idx) => {
    const count = (seenLinkIds.get(l.id) || 0) + 1;
    seenLinkIds.set(l.id, count);
    if (count > 1) {
      l.id = `${l.id}__link_${count}_${idx}`;
    }
  });

  const bridgeResult = applyBridgeJumpsToLinks(links, {
    orientation: 'horizontal',
    enableBridges: options?.enableLineBridges ?? true
  });

  return {
    nodes,
    links: bridgeResult.links,
    width: finalMaxX,
    height: finalMaxY,
    cutouts: bridgeResult.cutouts,
    crossingCount: bridgeResult.crossingCount
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
  // Check explicit clan / rod override first
  if (person.clan && person.clan.trim()) {
    const clanTrimmed = person.clan.trim();
    const stripped = clanTrimmed.replace(/^рід\s+/i, '');
    return stripped || clanTrimmed;
  }
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
    const customClan = (p.clan || '').trim().replace(/^рід\s+/i, '');
    const rawSurname = customClan || (p.name?.surname || p.lastName || p.name?.maidenName || p.maidenName || '').trim();
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
      if (p.clan && p.clan.trim()) {
        map[p.clan.trim().toLowerCase()] = color;
        map[p.clan.trim()] = color;
      }
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
