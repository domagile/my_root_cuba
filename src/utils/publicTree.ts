import type { Family, GenealogyDatabase, Person } from '../types';

// Public records deliberately exclude biographies, notes, scans, sources and
// free-form metadata: those may identify living relatives of a deceased person.
export type PublicPerson = Pick<Person,
  'id' | 'gender' | 'firstName' | 'lastName' | 'patronymic' | 'maidenName' |
  'birthDate' | 'birthYear' | 'birthPlace' | 'deathDate' | 'deathYear' |
  'deathPlace' | 'fatherId' | 'motherId' | 'parentFamilyId'
> & { isLiving: false };
export type PublicFamily = Pick<Family, 'id' | 'husbandId' | 'wifeId'>;

export function isConfirmedDeceased(person: Person): boolean {
  if (person.isDeleted || person.isLiving === true) return false;
  // Unknown status stays private. Age and deathPlace alone do not prove death.
  return person.isLiving === false || [person.deathDate, person.deathYear].some(value => {
    const year = typeof value === 'number' ? value
      : typeof value === 'string' ? Number(value.match(/\b(\d{3,4})\b/)?.[1]) : NaN;
    return Number.isInteger(year) && year > 0 && year <= new Date().getFullYear();
  });
}

export function createPublicTree(database: Pick<GenealogyDatabase, 'persons' | 'families'>) {
  const persons: Record<string, PublicPerson> = {};
  const families: Record<string, PublicFamily> = {};
  for (const [id, person] of Object.entries(database.persons)) {
    if (!isConfirmedDeceased(person)) continue;
    const safe: PublicPerson = { id, gender: person.gender || 'U', isLiving: false };
    const values = {
      firstName: person.name?.given || person.firstName,
      lastName: person.name?.surname || person.lastName,
      patronymic: person.name?.patronymic || person.patronymic,
      maidenName: person.name?.maidenName || person.maidenName,
      birthDate: person.birthDate, birthYear: person.birthYear, birthPlace: person.birthPlace,
      deathDate: person.deathDate, deathYear: person.deathYear, deathPlace: person.deathPlace
    };
    for (const [key, value] of Object.entries(values)) {
      if (typeof value === 'string' || (typeof value === 'number' && Number.isInteger(value))) {
        (safe as any)[key] = value;
      }
    }
    persons[id] = safe;
  }

  for (const [id, family] of Object.entries(database.families || {})) {
    const husbandId = persons[family.husbandId] ? family.husbandId : undefined;
    const wifeId = persons[family.wifeId] ? family.wifeId : undefined;
    if (!husbandId && !wifeId) continue;
    const safe: PublicFamily = { id };
    if (husbandId) safe.husbandId = husbandId;
    if (wifeId) safe.wifeId = wifeId;
    families[id] = safe;
    const children = new Set([
      ...(family.children || []).map(child => child.personId), ...(family.childrenIds || [])
    ]);
    for (const childId of children) {
      const child = persons[childId];
      if (!child) continue;
      child.parentFamilyId = id;
      if (husbandId) child.fatherId = husbandId;
      if (wifeId) child.motherId = wifeId;
    }
  }

  for (const [id, safe] of Object.entries(persons)) {
    const original = database.persons[id];
    if (persons[original.fatherId]) safe.fatherId = original.fatherId;
    if (persons[original.motherId]) safe.motherId = original.motherId;
    if (families[original.parentFamilyId]) safe.parentFamilyId = original.parentFamilyId;
  }
  return { persons, families };
}

export function restorePublicTree(
  publicPersons: PublicPerson[], publicFamilies: PublicFamily[], rootPersonId: string
): GenealogyDatabase {
  const persons: Record<string, Person> = Object.fromEntries(publicPersons.map(person => [person.id, {
    ...person, name: { given: person.firstName || '', surname: person.lastName || '',
      patronymic: person.patronymic, maidenName: person.maidenName },
    spouseFamilyIds: [], spouseIds: [], childrenIds: []
  }]));
  const families: Record<string, Family> = {};
  for (const family of publicFamilies) {
    families[family.id] = { ...family, children: [] };
    for (const id of [family.husbandId, family.wifeId]) {
      const person = persons[id];
      if (!person) continue;
      person.spouseFamilyIds.push(family.id);
      person.spouseIds.push(...[family.husbandId, family.wifeId].filter(other => other !== id && !!persons[other]));
    }
  }
  for (const person of Object.values(persons)) {
    const family = families[person.parentFamilyId];
    if (!family) continue;
    family.children.push({ personId: person.id });
    for (const id of [family.husbandId, family.wifeId]) {
      if (persons[id]) persons[id].childrenIds.push(person.id);
    }
  }
  return { persons, families, sources: {}, events: {},
    rootPersonId: persons[rootPersonId] ? rootPersonId : Object.keys(persons)[0] || '' };
}
