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
    return `${parts.join(' ')} (до шлюбу ${maiden})`;
  }
  return parts.join(' ') || 'Без імені';
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

export function calculateKinship(
  person1Id: string,
  person2Id: string,
  database: GenealogyDatabase
): {
  relationship: string;
  degree: number;
  coefficient: number;
  description: string;
  path?: string[];
} {
  if (person1Id === person2Id) {
    return {
      relationship: 'Та сама особа',
      degree: 0,
      coefficient: 100,
      description: 'Вибрано одного й того самого користувача.',
      path: [person1Id]
    };
  }

  const p1 = database.persons[person1Id];
  const p2 = database.persons[person2Id];
  if (!p1 || !p2) {
    return {
      relationship: 'Не знайдено',
      degree: 0,
      coefficient: 0,
      description: 'Одну або обидві особи не знайдено в базі даних.'
    };
  }

  const p1IsMale = p1.gender === 'male' || p1.gender === 'M';
  const p2FatherId = getPersonFatherId(p2, database);
  const p2MotherId = getPersonMotherId(p2, database);
  const p1FatherId = getPersonFatherId(p1, database);
  const p1MotherId = getPersonMotherId(p1, database);

  // Check parent-child
  if (p2FatherId === p1.id || p2MotherId === p1.id) {
    return {
      relationship: p1IsMale ? 'Батько' : 'Мати',
      degree: 1,
      coefficient: 50,
      description: `${getFullName(p1)} є ${p1IsMale ? 'батьком' : 'матір\'ю'} для ${getFullName(p2)}.`,
      path: [p1.id, p2.id]
    };
  }

  if (p1FatherId === p2.id || p1MotherId === p2.id) {
    return {
      relationship: p1IsMale ? 'Син' : 'Донька',
      degree: 1,
      coefficient: 50,
      description: `${getFullName(p1)} є ${p1IsMale ? 'сином' : 'донькою'} для ${getFullName(p2)}.`,
      path: [p1.id, p2.id]
    };
  }

  // Check spouse
  const p1Spouses = new Set<string>(p1.spouseIds || []);
  if (p1.spouseFamilyIds) {
    p1.spouseFamilyIds.forEach((fId) => {
      const fam = database.families[fId];
      if (fam) {
        if (fam.husbandId && fam.husbandId !== p1.id) p1Spouses.add(fam.husbandId);
        if (fam.wifeId && fam.wifeId !== p1.id) p1Spouses.add(fam.wifeId);
      }
    });
  }

  if (p1Spouses.has(p2.id)) {
    return {
      relationship: p1IsMale ? 'Чоловік' : 'Дружина',
      degree: 0,
      coefficient: 0,
      description: `${getFullName(p1)} та ${getFullName(p2)} є подружжям.`,
      path: [p1.id, p2.id]
    };
  }

  // Check siblings (same father or mother)
  const sharedFather = p1FatherId && p1FatherId === p2FatherId;
  const sharedMother = p1MotherId && p1MotherId === p2MotherId;
  if (sharedFather || sharedMother) {
    return {
      relationship: p1IsMale ? 'Рідний брат' : 'Рідна сестра',
      degree: 2,
      coefficient: 50,
      description: `${getFullName(p1)} та ${getFullName(p2)} мають спільних батьків.`,
      path: [p1.id, (p1FatherId || p1MotherId)!, p2.id]
    };
  }

  // Check Grandparent - Grandchild
  const p1Father = p1FatherId ? database.persons[p1FatherId] : null;
  const p1Mother = p1MotherId ? database.persons[p1MotherId] : null;
  const p1GF1 = p1Father ? getPersonFatherId(p1Father, database) : null;
  const p1GM1 = p1Father ? getPersonMotherId(p1Father, database) : null;
  const p1GF2 = p1Mother ? getPersonFatherId(p1Mother, database) : null;
  const p1GM2 = p1Mother ? getPersonMotherId(p1Mother, database) : null;

  if (p1GF1 === p2.id || p1GM1 === p2.id || p1GF2 === p2.id || p1GM2 === p2.id) {
    return {
      relationship: p1IsMale ? 'Онук' : 'Онука',
      degree: 2,
      coefficient: 25,
      description: `${getFullName(p1)} є онуком/онукою для ${getFullName(p2)}.`,
      path: [p1.id, (p1Father ? p1Father.id : p1Mother?.id)!, p2.id]
    };
  }

  const p2Father = p2FatherId ? database.persons[p2FatherId] : null;
  const p2Mother = p2MotherId ? database.persons[p2MotherId] : null;
  const p2GF1 = p2Father ? getPersonFatherId(p2Father, database) : null;
  const p2GM1 = p2Father ? getPersonMotherId(p2Father, database) : null;
  const p2GF2 = p2Mother ? getPersonFatherId(p2Mother, database) : null;
  const p2GM2 = p2Mother ? getPersonMotherId(p2Mother, database) : null;

  if (p2GF1 === p1.id || p2GM1 === p1.id || p2GF2 === p1.id || p2GM2 === p1.id) {
    return {
      relationship: p1IsMale ? 'Дідусь' : 'Бабуся',
      degree: 2,
      coefficient: 25,
      description: `${getFullName(p1)} є ${p1IsMale ? 'дідусем' : 'бабусею'} для ${getFullName(p2)}.`,
      path: [p1.id, (p2Father ? p2Father.id : p2Mother?.id)!, p2.id]
    };
  }

  return {
    relationship: 'Далекий родич або зв\'язок через кілька поколінь',
    degree: 3,
    coefficient: 12.5,
    description: `Особи ${getFullName(p1)} та ${getFullName(p2)} належать до одного родоводу.`,
    path: [p1.id, p2.id]
  };
}
