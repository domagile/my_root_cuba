/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Person, GenealogyDatabase } from '../types/genealogy';

export function getFullName(person?: Person | null): string {
  if (!person) return 'Невідома особа';
  const surname = person.name?.surname || person.lastName || '';
  const given = person.name?.given || person.firstName || '';
  const patronymic = person.name?.patronymic || person.patronymic || '';
  const maiden = person.name?.maidenName || person.maidenName || '';
  const parts = [surname, given, patronymic].filter(Boolean);
  const isFemale = person.gender === 'female' || person.gender === 'F';
  if (maiden && isFemale) {
    return `${parts.join(' ')} / ${maiden}`;
  }
  return parts.join(' ') || 'Без імені';
}

export function getPersonBirthYearNum(p?: Person | null): number {
  if (!p) return -999999;
  if (p.birthYear && !isNaN(Number(p.birthYear))) {
    return Number(p.birthYear);
  }
  if (p.birthDate) {
    const m = String(p.birthDate).match(/\b(1\d{3}|20\d{2})\b/);
    if (m) return parseInt(m[1], 10);
  }
  return -999999;
}

export function sortPersonsBySurnameAndBirthDesc(persons: Person[]): Person[] {
  return [...persons].sort((a, b) => {
    const surnameA = (a.name?.surname || a.lastName || '').trim();
    const surnameB = (b.name?.surname || b.lastName || '').trim();
    const surnameCmp = surnameA.localeCompare(surnameB, 'uk', { sensitivity: 'base' });
    if (surnameCmp !== 0) return surnameCmp;

    // By birth year descending (youngest / most recently born on top)
    const yearA = getPersonBirthYearNum(a);
    const yearB = getPersonBirthYearNum(b);
    if (yearA !== yearB) return yearB - yearA;

    // By given name
    const givenA = (a.name?.given || a.firstName || '').trim();
    const givenB = (b.name?.given || b.firstName || '').trim();
    return givenA.localeCompare(givenB, 'uk', { sensitivity: 'base' });
  });
}

export function getPersonFatherId(person: Person, database: GenealogyDatabase): string | undefined {
  if (person.fatherId) return person.fatherId;
  if (person.parentFamilyId && database.families[person.parentFamilyId]) {
    return database.families[person.parentFamilyId].husbandId;
  }
  return undefined;
}

export function getPersonMotherId(person: Person, database: GenealogyDatabase): string | undefined {
  if (person.motherId) return person.motherId;
  if (person.parentFamilyId && database.families[person.parentFamilyId]) {
    return database.families[person.parentFamilyId].wifeId;
  }
  return undefined;
}

export interface KinshipPathStep {
  personId: string;
  relationFromPrevious?: string;
}

export interface KinshipCalculationResult {
  relationship: string;
  relationshipName: string;
  degree: number;
  degreeOfConsanguinity: number;
  coefficient: number;
  description: string;
  personA: Person | null;
  personB: Person | null;
  commonAncestors: Person[];
  path: KinshipPathStep[];
}

export function calculateKinship(
  arg1: any,
  arg2: any,
  arg3?: any
): KinshipCalculationResult {
  let db: GenealogyDatabase;
  let p1Id: string;
  let p2Id: string;

  if (typeof arg1 === 'object' && arg1.persons) {
    db = arg1;
    p1Id = arg2;
    p2Id = arg3;
  } else if (typeof arg3 === 'object' && arg3.persons) {
    p1Id = arg1;
    p2Id = arg2;
    db = arg3;
  } else {
    db = { persons: {}, families: {}, sources: {}, events: {} };
    p1Id = arg1;
    p2Id = arg2;
  }

  const p1 = db.persons?.[p1Id] || null;
  const p2 = db.persons?.[p2Id] || null;

  if (!p1 || !p2) {
    return {
      relationship: 'Не знайдено',
      relationshipName: 'Не знайдено',
      degree: 0,
      degreeOfConsanguinity: 0,
      coefficient: 0,
      description: 'Одну або обидві особи не знайдено в базі даних.',
      personA: p1,
      personB: p2,
      commonAncestors: [],
      path: []
    };
  }

  if (p1Id === p2Id) {
    return {
      relationship: 'Та сама особа',
      relationshipName: 'Та сама особа',
      degree: 0,
      degreeOfConsanguinity: 0,
      coefficient: 100,
      description: 'Вибрано одну й ту саму особу.',
      personA: p1,
      personB: p2,
      commonAncestors: [p1],
      path: [{ personId: p1Id, relationFromPrevious: 'Сама особа' }]
    };
  }

  const p1IsMale = p1.gender === 'male' || p1.gender === 'M';
  const p2IsMale = p2.gender === 'male' || p2.gender === 'M';
  const p2FatherId = getPersonFatherId(p2, db);
  const p2MotherId = getPersonMotherId(p2, db);
  const p1FatherId = getPersonFatherId(p1, db);
  const p1MotherId = getPersonMotherId(p1, db);

  // Check parent-child
  if (p2FatherId === p1.id || p2MotherId === p1.id) {
    const rel = p1IsMale ? 'Батько' : 'Мати';
    return {
      relationship: rel,
      relationshipName: rel,
      degree: 1,
      degreeOfConsanguinity: 1,
      coefficient: 50,
      description: `${getFullName(p1)} є ${p1IsMale ? 'батьком' : 'матір\'ю'} для ${getFullName(p2)}.`,
      personA: p1,
      personB: p2,
      commonAncestors: [p1],
      path: [
        { personId: p1.id, relationFromPrevious: 'Початок' },
        { personId: p2.id, relationFromPrevious: p2IsMale ? 'Син' : 'Донька' }
      ]
    };
  }

  if (p1FatherId === p2.id || p1MotherId === p2.id) {
    const rel = p1IsMale ? 'Син' : 'Донька';
    return {
      relationship: rel,
      relationshipName: rel,
      degree: 1,
      degreeOfConsanguinity: 1,
      coefficient: 50,
      description: `${getFullName(p1)} є ${p1IsMale ? 'сином' : 'донькою'} для ${getFullName(p2)}.`,
      personA: p1,
      personB: p2,
      commonAncestors: [p2],
      path: [
        { personId: p1.id, relationFromPrevious: 'Початок' },
        { personId: p2.id, relationFromPrevious: p2IsMale ? 'Батько' : 'Мати' }
      ]
    };
  }

  // Check spouse
  const p1Spouses = new Set<string>(p1.spouseIds || []);
  if (p1.spouseFamilyIds) {
    p1.spouseFamilyIds.forEach((fId) => {
      const fam = db.families[fId];
      if (fam) {
        if (fam.husbandId && fam.husbandId !== p1.id) p1Spouses.add(fam.husbandId);
        if (fam.wifeId && fam.wifeId !== p1.id) p1Spouses.add(fam.wifeId);
      }
    });
  }

  if (p1Spouses.has(p2.id)) {
    const rel = p2IsMale ? 'Чоловік' : 'Дружина';
    return {
      relationship: rel,
      relationshipName: rel,
      degree: 0,
      degreeOfConsanguinity: 1,
      coefficient: 0,
      description: `${getFullName(p1)} та ${getFullName(p2)} є подружжям.`,
      personA: p1,
      personB: p2,
      commonAncestors: [],
      path: [
        { personId: p1.id, relationFromPrevious: 'Початок' },
        { personId: p2.id, relationFromPrevious: rel }
      ]
    };
  }

  // Check siblings (same father or mother)
  const sharedFather = p1FatherId && p1FatherId === p2FatherId;
  const sharedMother = p1MotherId && p1MotherId === p2MotherId;
  if (sharedFather || sharedMother) {
    const rel = p2IsMale ? 'Рідний брат' : 'Рідна сестра';
    const commonAncestors = [
      sharedFather && db.persons[p1FatherId!] ? db.persons[p1FatherId!] : null,
      sharedMother && db.persons[p1MotherId!] ? db.persons[p1MotherId!] : null
    ].filter(Boolean) as Person[];

    return {
      relationship: rel,
      relationshipName: rel,
      degree: 2,
      degreeOfConsanguinity: 2,
      coefficient: 50,
      description: `${getFullName(p1)} та ${getFullName(p2)} мають спільних батьків.`,
      personA: p1,
      personB: p2,
      commonAncestors,
      path: [
        { personId: p1.id, relationFromPrevious: 'Початок' },
        { personId: (p1FatherId || p1MotherId)!, relationFromPrevious: 'Спільний батько/мати' },
        { personId: p2.id, relationFromPrevious: rel }
      ]
    };
  }

  // Check Grandparent - Grandchild
  const p1Father = p1FatherId ? db.persons[p1FatherId] : null;
  const p1Mother = p1MotherId ? db.persons[p1MotherId] : null;
  const p1GF1 = p1Father ? getPersonFatherId(p1Father, db) : null;
  const p1GM1 = p1Father ? getPersonMotherId(p1Father, db) : null;
  const p1GF2 = p1Mother ? getPersonFatherId(p1Mother, db) : null;
  const p1GM2 = p1Mother ? getPersonMotherId(p1Mother, db) : null;

  if (p1GF1 === p2.id || p1GM1 === p2.id || p1GF2 === p2.id || p1GM2 === p2.id) {
    const rel = p2IsMale ? 'Дідусь' : 'Бабуся';
    return {
      relationship: rel,
      relationshipName: rel,
      degree: 2,
      degreeOfConsanguinity: 2,
      coefficient: 25,
      description: `${getFullName(p2)} є ${rel.toLowerCase()} для ${getFullName(p1)}.`,
      personA: p1,
      personB: p2,
      commonAncestors: [p2],
      path: [
        { personId: p1.id, relationFromPrevious: 'Початок' },
        { personId: (p1Father ? p1Father.id : p1Mother?.id)!, relationFromPrevious: 'Батько/Мати' },
        { personId: p2.id, relationFromPrevious: rel }
      ]
    };
  }

  const p2Father = p2FatherId ? db.persons[p2FatherId] : null;
  const p2Mother = p2MotherId ? db.persons[p2MotherId] : null;
  const p2GF1 = p2Father ? getPersonFatherId(p2Father, db) : null;
  const p2GM1 = p2Father ? getPersonMotherId(p2Father, db) : null;
  const p2GF2 = p2Mother ? getPersonFatherId(p2Mother, db) : null;
  const p2GM2 = p2Mother ? getPersonMotherId(p2Mother, db) : null;

  if (p2GF1 === p1.id || p2GM1 === p1.id || p2GF2 === p1.id || p2GM2 === p1.id) {
    const rel = p2IsMale ? 'Онук' : 'Онука';
    return {
      relationship: rel,
      relationshipName: rel,
      degree: 2,
      degreeOfConsanguinity: 2,
      coefficient: 25,
      description: `${getFullName(p2)} є ${rel.toLowerCase()} для ${getFullName(p1)}.`,
      personA: p1,
      personB: p2,
      commonAncestors: [p1],
      path: [
        { personId: p1.id, relationFromPrevious: 'Початок' },
        { personId: (p2Father ? p2Father.id : p2Mother?.id)!, relationFromPrevious: 'Дитина' },
        { personId: p2.id, relationFromPrevious: rel }
      ]
    };
  }

  return {
    relationship: 'Далекий родич або спільне дерево',
    relationshipName: 'Далекий родич',
    degree: 3,
    degreeOfConsanguinity: 3,
    coefficient: 12.5,
    description: `Особи ${getFullName(p1)} та ${getFullName(p2)} належать до одного родоводу.`,
    personA: p1,
    personB: p2,
    commonAncestors: [],
    path: [
      { personId: p1.id, relationFromPrevious: 'Початок' },
      { personId: p2.id, relationFromPrevious: 'Родинний зв\'язок' }
    ]
  };
}
