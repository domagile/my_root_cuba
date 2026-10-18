/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Person, Family, GenealogyDatabase } from '../types/genealogy';

export const UNKNOWN_NAME_REGEX = /^(невідомо|невідомий|невідома|unknown|\?|—|-|без імені|не вказано|не вказаний|не вказана)$/i;

/**
 * Checks if a string value represents an unknown name token
 */
export function isUnknownNameValue(val?: string | null): boolean {
  if (!val) return true;
  const trimmed = String(val).trim();
  if (!trimmed) return true;
  return UNKNOWN_NAME_REGEX.test(trimmed);
}

/**
 * Checks if a person is an "unknown" placeholder person created when ancestors were not specified.
 * Rule: "Якщо немає вказаних предків, то не треба створювати особу Невідомо. І видали таких осіб"
 */
export function isUnknownPlaceholderPerson(p: Person | Partial<Person> | null | undefined): boolean {
  if (!p) return false;

  const first = (p.firstName || p.name?.given || '').trim();
  const last = (p.lastName || p.name?.surname || '').trim();
  const patronymic = (p.patronymic || p.name?.patronymic || '').trim();
  const full = `${last} ${first}`.trim();

  const isFirstUnknown = isUnknownNameValue(first);
  const isLastUnknown = isUnknownNameValue(last);
  const isFullUnknown = isUnknownNameValue(full);

  // Check if they have specified ancestors (parents)
  const hasNoAncestors = !p.fatherId && !p.motherId;

  // 1. Both first and last are empty or "Невідомо"
  if (isFirstUnknown && isLastUnknown) {
    return true;
  }

  // 2. Full name is literally "Невідомо" / "Невідомий" / "Невідома" / "Unknown"
  if (isFullUnknown) {
    return true;
  }

  // 3. First name is unknown and last name is missing/empty, or vice-versa
  if ((isFirstUnknown && !last) || (isLastUnknown && !first)) {
    return true;
  }

  // 4. Person has no specified ancestors, and first name or last name is an unknown placeholder
  if (hasNoAncestors && (isFirstUnknown || isLastUnknown)) {
    return true;
  }

  return false;
}

/**
 * Purges all unknown placeholder persons from the database / list of persons and families.
 * Also cleans up all bidirectional links (fatherId, motherId, spouseIds, childrenIds, families).
 */
export function purgeUnknownPlaceholderPersons<
  P extends { id: string; fatherId?: string; motherId?: string; spouseIds?: string[]; childrenIds?: string[]; [key: string]: any },
  F extends { id: string; husbandId?: string; wifeId?: string; childrenIds?: string[]; children?: any[]; [key: string]: any }
>(
  persons: P[],
  families: Record<string, F>
): {
  cleanedPersons: P[];
  cleanedFamilies: Record<string, F>;
  deletedIds: string[];
} {
  let currentPersons = [...persons];
  let currentFamilies = { ...families };
  const allDeletedIds: string[] = [];

  let changed = true;
  let iterations = 0;
  // Loop to handle cascading deletions (e.g. unknown parent of unknown ancestor)
  while (changed && iterations < 10) {
    iterations++;
    changed = false;
    const toDeleteIds = new Set<string>();

    for (const p of currentPersons) {
      if (isUnknownPlaceholderPerson(p as any)) {
        toDeleteIds.add(p.id);
      }
    }

    if (toDeleteIds.size === 0) {
      break;
    }

    changed = true;
    toDeleteIds.forEach((id) => allDeletedIds.push(id));

    // Remove deleted persons
    currentPersons = currentPersons.filter((p) => !toDeleteIds.has(p.id));

    // Clean up references in remaining persons
    currentPersons = currentPersons.map((p) => {
      let updated = { ...p };
      if (updated.fatherId && toDeleteIds.has(updated.fatherId)) {
        updated.fatherId = undefined;
      }
      if (updated.motherId && toDeleteIds.has(updated.motherId)) {
        updated.motherId = undefined;
      }
      if (updated.spouseIds && updated.spouseIds.some((id: string) => toDeleteIds.has(id))) {
        updated.spouseIds = updated.spouseIds.filter((id: string) => !toDeleteIds.has(id));
      }
      if (updated.childrenIds && updated.childrenIds.some((id: string) => toDeleteIds.has(id))) {
        updated.childrenIds = updated.childrenIds.filter((id: string) => !toDeleteIds.has(id));
      }
      return updated;
    });

    // Clean up references in families
    const nextFamilies: Record<string, F> = {};
    for (const [fId, fam] of Object.entries(currentFamilies)) {
      const updatedFam = { ...fam };
      if (updatedFam.husbandId && toDeleteIds.has(updatedFam.husbandId)) {
        updatedFam.husbandId = undefined;
      }
      if (updatedFam.wifeId && toDeleteIds.has(updatedFam.wifeId)) {
        updatedFam.wifeId = undefined;
      }
      if (updatedFam.childrenIds && updatedFam.childrenIds.some((id: string) => toDeleteIds.has(id))) {
        updatedFam.childrenIds = updatedFam.childrenIds.filter((id: string) => !toDeleteIds.has(id));
      }
      if (updatedFam.children && updatedFam.children.some((c: any) => toDeleteIds.has(c.personId))) {
        updatedFam.children = updatedFam.children.filter((c: any) => !toDeleteIds.has(c.personId));
      }

      // If family still has at least one parent or child, keep it
      const hasAnyMember =
        Boolean(updatedFam.husbandId) ||
        Boolean(updatedFam.wifeId) ||
        (Array.isArray(updatedFam.childrenIds) && updatedFam.childrenIds.length > 0);

      if (hasAnyMember) {
        nextFamilies[fId] = updatedFam;
      }
    }
    currentFamilies = nextFamilies;
  }

  return {
    cleanedPersons: currentPersons,
    cleanedFamilies: currentFamilies,
    deletedIds: Array.from(new Set(allDeletedIds))
  };
}

/**
 * Cleans an entire GenealogyDatabase by removing unknown placeholder persons.
 */
export function cleanDatabaseFromUnknownPersons(db: GenealogyDatabase): GenealogyDatabase {
  if (!db || !db.persons) return db;

  const { cleanedPersons, cleanedFamilies } = purgeUnknownPlaceholderPersons(
    Object.values(db.persons),
    db.families || {}
  );

  const newPersons: Record<string, Person> = {};
  cleanedPersons.forEach((p) => {
    newPersons[p.id] = p;
  });

  let rootPersonId = db.rootPersonId;
  if (rootPersonId && !newPersons[rootPersonId]) {
    rootPersonId = cleanedPersons[0]?.id;
  }

  return {
    ...db,
    persons: newPersons,
    families: cleanedFamilies,
    rootPersonId
  };
}
