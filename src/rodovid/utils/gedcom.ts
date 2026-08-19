/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GenealogyDatabase, Person, Family } from '../types/genealogy';

export function parseGedcom(text: string): GenealogyDatabase {
  const lines = text.split(/\r?\n/);
  const persons: Record<string, Person> = {};
  const families: Record<string, Family> = {};

  let currentId: string | null = null;
  let currentType: 'INDI' | 'FAM' | null = null;
  let currentPerson: Partial<Person> = {};
  let currentFamily: Partial<Family> = {};
  let lastTag: string = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(' ');
    const level = parseInt(parts[0], 10);
    const tagOrId = parts[1];
    const value = parts.slice(2).join(' ');

    if (level === 0) {
      // Save previous entity
      if (currentType === 'INDI' && currentId) {
        const given = currentPerson.firstName || currentPerson.name?.given || 'Невідоме';
        const surname = currentPerson.lastName || currentPerson.name?.surname || '';
        persons[currentId] = {
          id: currentId,
          name: {
            given,
            surname,
            patronymic: currentPerson.patronymic,
            maidenName: currentPerson.maidenName
          },
          firstName: given,
          lastName: surname,
          gender: currentPerson.gender || 'M',
          birthDate: currentPerson.birthDate,
          birthPlace: currentPerson.birthPlace,
          deathDate: currentPerson.deathDate,
          deathPlace: currentPerson.deathPlace,
          notes: currentPerson.notes,
          ...currentPerson
        } as Person;
      } else if (currentType === 'FAM' && currentId) {
        const childrenIds = currentFamily.childrenIds || [];
        families[currentId] = {
          id: currentId,
          husbandId: currentFamily.husbandId,
          wifeId: currentFamily.wifeId,
          relationshipType: 'Married',
          children: childrenIds.map((cId: string) => ({ personId: cId, relationType: 'Biological' })),
          childrenIds,
          marriageDate: currentFamily.marriageDate,
          marriagePlace: currentFamily.marriagePlace
        };
      }

      // Check if new record
      if (parts[2] === 'INDI') {
        currentId = tagOrId.replace(/@/g, '');
        currentType = 'INDI';
        currentPerson = { id: currentId, childrenIds: [], spouseIds: [] };
      } else if (parts[2] === 'FAM') {
        currentId = tagOrId.replace(/@/g, '');
        currentType = 'FAM';
        currentFamily = { id: currentId, childrenIds: [] };
      } else {
        currentId = null;
        currentType = null;
      }
      lastTag = '';
      continue;
    }

    if (currentType === 'INDI') {
      if (tagOrId === 'NAME') {
        const nameParts = value.split('/');
        currentPerson.firstName = nameParts[0]?.trim() || '';
        currentPerson.lastName = nameParts[1]?.trim() || '';
      } else if (tagOrId === 'SEX') {
        currentPerson.gender = value.toUpperCase() === 'F' ? 'female' : 'male';
      } else if (tagOrId === 'BIRT' || tagOrId === 'DEAT') {
        lastTag = tagOrId;
      } else if (tagOrId === 'DATE') {
        if (lastTag === 'BIRT') currentPerson.birthDate = value;
        if (lastTag === 'DEAT') currentPerson.deathDate = value;
      } else if (tagOrId === 'PLAC') {
        if (lastTag === 'BIRT') currentPerson.birthPlace = value;
        if (lastTag === 'DEAT') currentPerson.deathPlace = value;
      } else if (tagOrId === 'NOTE') {
        currentPerson.notes = (currentPerson.notes ? currentPerson.notes + ' ' : '') + value;
      }
    } else if (currentType === 'FAM') {
      if (tagOrId === 'HUSB') {
        currentFamily.husbandId = value.replace(/@/g, '');
      } else if (tagOrId === 'WIFE') {
        currentFamily.wifeId = value.replace(/@/g, '');
      } else if (tagOrId === 'CHIL') {
        if (!currentFamily.childrenIds) currentFamily.childrenIds = [];
        currentFamily.childrenIds.push(value.replace(/@/g, ''));
      } else if (tagOrId === 'MARR') {
        lastTag = 'MARR';
      } else if (tagOrId === 'DATE' && lastTag === 'MARR') {
        currentFamily.marriageDate = value;
      } else if (tagOrId === 'PLAC' && lastTag === 'MARR') {
        currentFamily.marriagePlace = value;
      }
    }
  }

  // Save last record
  if (currentType === 'INDI' && currentId && currentPerson.firstName) {
    persons[currentId] = {
      id: currentId,
      firstName: currentPerson.firstName || 'Невідоме',
      lastName: currentPerson.lastName || '',
      gender: currentPerson.gender || 'male',
      ...currentPerson
    } as Person;
  } else if (currentType === 'FAM' && currentId) {
    families[currentId] = {
      id: currentId,
      husbandId: currentFamily.husbandId,
      wifeId: currentFamily.wifeId,
      childrenIds: currentFamily.childrenIds || [],
      ...currentFamily
    } as Family;
  }

  // Link family parents to person objects
  Object.values(families).forEach((fam) => {
    fam.childrenIds.forEach((childId) => {
      if (persons[childId]) {
        if (fam.husbandId) persons[childId].fatherId = fam.husbandId;
        if (fam.wifeId) persons[childId].motherId = fam.wifeId;
      }
    });
    if (fam.husbandId && persons[fam.husbandId] && fam.wifeId) {
      persons[fam.husbandId].spouseIds = Array.from(new Set([...(persons[fam.husbandId].spouseIds || []), fam.wifeId]));
    }
    if (fam.wifeId && persons[fam.wifeId] && fam.husbandId) {
      persons[fam.wifeId].spouseIds = Array.from(new Set([...(persons[fam.wifeId].spouseIds || []), fam.husbandId]));
    }
  });

  return {
    persons,
    families,
    sources: {},
    events: {},
    metadata: {
      title: 'Імпортований архів GEDCOM',
      lastModified: new Date().toISOString(),
      author: 'Користувач'
    }
  };
}

export function exportToGedcom(database: GenealogyDatabase): string {
  let ged = '';
  ged += '0 HEAD\n';
  ged += '1 SOUR RODOVID_APP\n';
  ged += '1 GEDC\n';
  ged += '2 VERS 5.5.1\n';
  ged += '2 FORM LINEAGE-LINKED\n';
  ged += '1 CHAR UTF-8\n';

  // Individuals
  Object.values(database.persons).forEach((p) => {
    ged += `0 @${p.id}@ INDI\n`;
    ged += `1 NAME ${p.firstName || ''} /${p.lastName || ''}/\n`;
    ged += `1 SEX ${p.gender === 'female' || p.gender === 'F' ? 'F' : 'M'}\n`;
    if (p.birthDate || p.birthPlace) {
      ged += '1 BIRT\n';
      if (p.birthDate) ged += `2 DATE ${p.birthDate}\n`;
      if (p.birthPlace) ged += `2 PLAC ${p.birthPlace}\n`;
    }
    if (p.deathDate || p.deathPlace) {
      ged += '1 DEAT\n';
      if (p.deathDate) ged += `2 DATE ${p.deathDate}\n`;
      if (p.deathPlace) ged += `2 PLAC ${p.deathPlace}\n`;
    }
    if (p.occupation) {
      ged += `1 OCCU ${p.occupation}\n`;
    }
    if (p.notes) {
      ged += `1 NOTE ${p.notes}\n`;
    }
  });

  // Families
  Object.values(database.families).forEach((fam) => {
    ged += `0 @${fam.id}@ FAM\n`;
    if (fam.husbandId) ged += `1 HUSB @${fam.husbandId}@\n`;
    if (fam.wifeId) ged += `1 WIFE @${fam.wifeId}@\n`;
    fam.childrenIds.forEach((childId) => {
      ged += `1 CHIL @${childId}@\n`;
    });
    if (fam.marriageDate || fam.marriagePlace) {
      ged += '1 MARR\n';
      if (fam.marriageDate) ged += `2 DATE ${fam.marriageDate}\n`;
      if (fam.marriagePlace) ged += `2 PLAC ${fam.marriagePlace}\n`;
    }
  });

  ged += '0 TRLR\n';
  return ged;
}
