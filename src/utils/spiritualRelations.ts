import { Person, GodparentItem } from '../types';

export interface SpiritualPersonSummary {
  id: string;
  fullName: string;
  lifespan?: string;
  gender?: string;
}

export interface LinkedGodchildResult {
  person: Person;
  gpRecord?: GodparentItem;
  roleLabel: string;
  notes?: string;
  parentsLabel?: string;
  coGodparents?: string[];
}

export interface LinkedWitnessedResult {
  person: Person;
  gpRecord?: GodparentItem;
  roleLabel: string;
  notes?: string;
  eventLabel?: string;
  coWitnesses?: string[];
}

/**
 * Normalizes person name for loose matching (lowercase, trims, ignores patronymic if only 2 words)
 */
export function normalizeNameForMatch(name?: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[,\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Formats a person's full name with optional lifespan
 */
export function formatPersonDisplayName(person: Person): string {
  const parts = [
    person.name?.surname || person.lastName || '',
    person.name?.given || person.firstName || '',
    person.name?.patronymic || person.patronymic || ''
  ].filter(Boolean);

  return parts.join(' ').trim() || 'Без імені';
}

/**
 * Formats a person's lifespan (e.g. "(1890–1955)")
 */
export function formatPersonLifespan(person: Person): string {
  const birth = person.birthYear || (person.birthDate ? person.birthDate.slice(0, 4) : '');
  const death = person.deathYear || (person.deathDate ? person.deathDate.slice(0, 4) : '');

  if (birth && death) return `(${birth}–${death})`;
  if (birth) return `(нар. ${birth})`;
  if (death) return `(пом. ${death})`;
  return '';
}

/**
 * Checks if a string representation matches a person entity
 */
export function isNameMatchingPerson(rawName: string, person: Person): boolean {
  if (!rawName || !person) return false;
  const n1 = normalizeNameForMatch(rawName);
  const n2 = normalizeNameForMatch(formatPersonDisplayName(person));
  if (!n1 || !n2) return false;

  if (n1 === n2) return true;

  // Also check surname + given name match (without patronymic)
  const pGiven = (person.name?.given || person.firstName || '').toLowerCase().trim();
  const pSurname = (person.name?.surname || person.lastName || '').toLowerCase().trim();
  if (pGiven && pSurname && n1.includes(pSurname) && n1.includes(pGiven)) {
    return true;
  }

  return false;
}

/**
 * Returns all godchildren for a given person (bidirectionally):
 * - Anyone where this person is in their `godparents` (role != 'witness')
 * - Anyone where this person is in their `godparentIds`
 * - Anyone who is in this person's `godchildrenIds`
 * - Anyone whose godparent record name matches this person
 */
export function getBidirectionalGodchildren(
  personId: string,
  personName: string,
  persons: Person[],
  currentPerson?: Person | null
): LinkedGodchildResult[] {
  if (!personId && !personName) return [];

  const results: LinkedGodchildResult[] = [];
  const seenIds = new Set<string>();

  const targetPerson = currentPerson || persons.find((p) => p.id === personId);
  const myGodchildrenIds = new Set(targetPerson?.godchildrenIds || []);

  persons.forEach((child) => {
    if (child.id === personId) return;

    // Check 1: In child's godparents array
    const matchingGp = (child.godparents || []).find((gp) => {
      const isWitness =
        gp.role === 'witness' ||
        /свідок|поручитель/i.test(gp.role || '') ||
        /свідок|поручитель/i.test(gp.notes || '');
      if (isWitness) return false;

      if (gp.personId && personId && gp.personId === personId) return true;
      if (targetPerson && gp.name && isNameMatchingPerson(gp.name, targetPerson)) return true;
      if (personName && gp.name && isNameMatchingPerson(gp.name, { id: '', gender: 'male', lastName: personName } as Person)) return true;
      return false;
    });

    // Check 2: In child's godparentIds
    const isInChildGpIds = personId ? (child.godparentIds || []).includes(personId) : false;

    // Check 3: In this person's godchildrenIds
    const isInMyGodchildren = myGodchildrenIds.has(child.id);

    if (matchingGp || isInChildGpIds || isInMyGodchildren) {
      if (seenIds.has(child.id)) return;
      seenIds.add(child.id);

      // Determine role label
      let roleLabel = 'Хрещеник';
      if (child.gender === 'female') {
        roleLabel = 'Хрещениця';
      }

      // Find parents (куми для хресного)
      const parentNames: string[] = [];
      if (child.fatherId) {
        const father = persons.find((p) => p.id === child.fatherId);
        if (father) parentNames.push(`${formatPersonDisplayName(father)} (батько)`);
      }
      if (child.motherId) {
        const mother = persons.find((p) => p.id === child.motherId);
        if (mother) parentNames.push(`${formatPersonDisplayName(mother)} (мати)`);
      }

      // Find co-godparents (інші хрещені цієї дитини)
      const coGps = (child.godparents || [])
        .filter((g) => {
          if (g.personId && g.personId === personId) return false;
          if (targetPerson && g.name && isNameMatchingPerson(g.name, targetPerson)) return false;
          const isWitness =
            g.role === 'witness' ||
            /свідок|поручитель/i.test(g.role || '') ||
            /свідок|поручитель/i.test(g.notes || '');
          return !isWitness;
        })
        .map((g) => g.name);

      results.push({
        person: child,
        gpRecord: matchingGp,
        roleLabel,
        notes: matchingGp?.notes || '',
        parentsLabel: parentNames.length > 0 ? parentNames.join(', ') : undefined,
        coGodparents: coGps.length > 0 ? coGps : undefined
      });
    }
  });

  return results;
}

/**
 * Returns all persons where this person was a witness/guarantor (bidirectionally)
 */
export function getBidirectionalWitnessedPersons(
  personId: string,
  personName: string,
  persons: Person[],
  currentPerson?: Person | null
): LinkedWitnessedResult[] {
  if (!personId && !personName) return [];

  const results: LinkedWitnessedResult[] = [];
  const seenIds = new Set<string>();

  const targetPerson = currentPerson || persons.find((p) => p.id === personId);
  const myWitnessedIds = new Set(targetPerson?.witnessedPersonIds || []);

  persons.forEach((p) => {
    if (p.id === personId) return;

    // Check 1: In person's godparents array as witness
    const matchingWitness = (p.godparents || []).find((gp) => {
      const isWitness =
        gp.role === 'witness' ||
        /свідок|поручитель/i.test(gp.role || '') ||
        /свідок|поручитель/i.test(gp.notes || '');
      if (!isWitness) return false;

      if (gp.personId && personId && gp.personId === personId) return true;
      if (targetPerson && gp.name && isNameMatchingPerson(gp.name, targetPerson)) return true;
      if (personName && gp.name && isNameMatchingPerson(gp.name, { id: '', gender: 'male', lastName: personName } as Person)) return true;
      return false;
    });

    // Check 2: In person's witnessIds
    const isInWitnessIds = personId ? (p.witnessIds || []).includes(personId) : false;

    // Check 3: In this person's witnessedPersonIds
    const isInMyWitnessed = myWitnessedIds.has(p.id);

    if (matchingWitness || isInWitnessIds || isInMyWitnessed) {
      if (seenIds.has(p.id)) return;
      seenIds.add(p.id);

      // Event label
      let eventLabel = 'Запис у метричній книзі';
      if (matchingWitness?.notes) {
        if (/шлюб|вінчан/i.test(matchingWitness.notes)) {
          eventLabel = 'Свідок при вінчанні (шлюбі)';
        } else if (/хрещ/i.test(matchingWitness.notes)) {
          eventLabel = 'Восприємник / свідок при хрещенні';
        }
      }

      // Other witnesses for this person
      const coW = (p.godparents || [])
        .filter((g) => {
          if (g.personId && g.personId === personId) return false;
          if (targetPerson && g.name && isNameMatchingPerson(g.name, targetPerson)) return false;
          const isWitness =
            g.role === 'witness' ||
            /свідок|поручитель/i.test(g.role || '') ||
            /свідок|поручитель/i.test(g.notes || '');
          return isWitness;
        })
        .map((g) => g.name);

      results.push({
        person: p,
        gpRecord: matchingWitness,
        roleLabel: 'Свідок / Поручитель',
        notes: matchingWitness?.notes || '',
        eventLabel,
        coWitnesses: coW.length > 0 ? coW : undefined
      });
    }
  });

  return results;
}

/**
 * For a given godparent, finds all other godchildren they baptized in the tree
 */
export function getGodparentOtherGodchildren(
  gpPersonId: string | undefined,
  gpName: string,
  excludeChildId: string,
  persons: Person[]
): SpiritualPersonSummary[] {
  if (!gpPersonId && !gpName) return [];

  const found: SpiritualPersonSummary[] = [];
  const seenIds = new Set<string>();

  const targetGpPerson = gpPersonId ? persons.find((p) => p.id === gpPersonId) : null;

  persons.forEach((p) => {
    if (p.id === excludeChildId) return;

    let isGodchild = false;

    // 1. Check p.godparents
    if (p.godparents && p.godparents.length > 0) {
      const match = p.godparents.find((gp) => {
        const isWitness =
          gp.role === 'witness' ||
          /свідок|поручитель/i.test(gp.role || '') ||
          /свідок|поручитель/i.test(gp.notes || '');
        if (isWitness) return false;

        if (gpPersonId && gp.personId === gpPersonId) return true;
        if (targetGpPerson && gp.name && isNameMatchingPerson(gp.name, targetGpPerson)) return true;
        if (gpName && gp.name && normalizeNameForMatch(gp.name) === normalizeNameForMatch(gpName)) return true;
        return false;
      });
      if (match) isGodchild = true;
    }

    // 2. Check p.godparentIds
    if (!isGodchild && gpPersonId && (p.godparentIds || []).includes(gpPersonId)) {
      isGodchild = true;
    }

    // 3. Check targetGpPerson.godchildrenIds
    if (!isGodchild && targetGpPerson && (targetGpPerson.godchildrenIds || []).includes(p.id)) {
      isGodchild = true;
    }

    if (isGodchild && !seenIds.has(p.id)) {
      seenIds.add(p.id);
      found.push({
        id: p.id,
        fullName: formatPersonDisplayName(p),
        lifespan: formatPersonLifespan(p),
        gender: p.gender
      });
    }
  });

  return found;
}

/**
 * For a given witness, finds all other persons where they acted as a witness in the tree
 */
export function getWitnessOtherWitnessed(
  witnessPersonId: string | undefined,
  witnessName: string,
  excludePersonId: string,
  persons: Person[]
): SpiritualPersonSummary[] {
  if (!witnessPersonId && !witnessName) return [];

  const found: SpiritualPersonSummary[] = [];
  const seenIds = new Set<string>();

  const targetWitnessPerson = witnessPersonId ? persons.find((p) => p.id === witnessPersonId) : null;

  persons.forEach((p) => {
    if (p.id === excludePersonId) return;

    let isWitnessed = false;

    // 1. Check p.godparents for witness role
    if (p.godparents && p.godparents.length > 0) {
      const match = p.godparents.find((gp) => {
        const isWitness =
          gp.role === 'witness' ||
          /свідок|поручитель/i.test(gp.role || '') ||
          /свідок|поручитель/i.test(gp.notes || '');
        if (!isWitness) return false;

        if (witnessPersonId && gp.personId === witnessPersonId) return true;
        if (targetWitnessPerson && gp.name && isNameMatchingPerson(gp.name, targetWitnessPerson)) return true;
        if (witnessName && gp.name && normalizeNameForMatch(gp.name) === normalizeNameForMatch(witnessName)) return true;
        return false;
      });
      if (match) isWitnessed = true;
    }

    // 2. Check p.witnessIds
    if (!isWitnessed && witnessPersonId && (p.witnessIds || []).includes(witnessPersonId)) {
      isWitnessed = true;
    }

    // 3. Check targetWitnessPerson.witnessedPersonIds
    if (!isWitnessed && targetWitnessPerson && (targetWitnessPerson.witnessedPersonIds || []).includes(p.id)) {
      isWitnessed = true;
    }

    if (isWitnessed && !seenIds.has(p.id)) {
      seenIds.add(p.id);
      found.push({
        id: p.id,
        fullName: formatPersonDisplayName(p),
        lifespan: formatPersonLifespan(p),
        gender: p.gender
      });
    }
  });

  return found;
}

/**
 * Returns merged godparents for a person, synthesizing any godparents who have this person
 * in their `godchildrenIds` if they weren't explicitly stored in person.godparents.
 */
export function getMergedGodparents(
  currentPerson: Person | null | undefined,
  localGodparents: GodparentItem[],
  persons: Person[]
): GodparentItem[] {
  const merged = [...localGodparents];
  const existingPersonIds = new Set(merged.map((g) => g.personId).filter(Boolean));

  if (!currentPerson?.id) return merged;

  // Scan for any person in the tree who marked currentPerson as their godchild
  persons.forEach((other) => {
    if (other.id === currentPerson.id) return;
    if (existingPersonIds.has(other.id)) return;

    if (other.godchildrenIds && other.godchildrenIds.includes(currentPerson.id)) {
      const isFem = other.gender === 'female' || other.gender === 'F';
      merged.push({
        id: `auto-gp-${other.id}`,
        personId: other.id,
        name: formatPersonDisplayName(other),
        role: isFem ? 'godmother' : 'godfather',
        notes: 'Зв\'язок відновлено автоматично за списком хресників'
      });
      existingPersonIds.add(other.id);
    }
  });

  return merged;
}
