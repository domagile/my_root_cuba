/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GenealogyDatabase, Person, Family } from '../types/genealogy';
import { detectGenderFromName } from '../../utils/genderUtils';

/**
 * Robust GEDCOM 5.5 / 5.5.1 / 7.0 Parser
 */
export function parseGedcom(text: string): GenealogyDatabase {
  // Strip UTF-8 BOM if present
  const cleanText = text.replace(/^\uFEFF/, '');
  const lines = cleanText.split(/\r?\n/);

  const persons: Record<string, Person> = {};
  const families: Record<string, Family> = {};

  let currentId: string | null = null;
  let currentType: 'INDI' | 'FAM' | null = null;
  let currentPerson: Partial<Person> = {};
  let currentFamily: Partial<Family> = {};
  let lastMainTag: string = '';
  let lastSubTag: string = '';

  const saveCurrentEntity = () => {
    if (currentType === 'INDI' && currentId) {
      const given = (currentPerson.firstName || currentPerson.name?.given || 'Невідомо').trim();
      const surname = (currentPerson.lastName || currentPerson.name?.surname || '').trim();
      const detected = detectGenderFromName(given, surname, currentPerson.patronymic, currentPerson.maidenName);
      const resolvedGender = currentPerson.gender || (detected === 'female' ? 'female' : 'male');

      // Auto-extract years if not present
      let birthYear = currentPerson.birthYear;
      if (!birthYear && currentPerson.birthDate) {
        const match = currentPerson.birthDate.match(/\b(1\d{3}|20\d{2}|\d{3,4})\b/);
        if (match) birthYear = parseInt(match[1], 10);
      }

      let deathYear = currentPerson.deathYear;
      if (!deathYear && currentPerson.deathDate) {
        const match = currentPerson.deathDate.match(/\b(1\d{3}|20\d{2}|\d{3,4})\b/);
        if (match) deathYear = parseInt(match[1], 10);
      }

      persons[currentId] = {
        id: currentId,
        firstName: given,
        lastName: surname,
        patronymic: currentPerson.patronymic,
        maidenName: currentPerson.maidenName,
        name: {
          given,
          surname,
          patronymic: currentPerson.patronymic,
          maidenName: currentPerson.maidenName
        },
        gender: resolvedGender,
        birthDate: currentPerson.birthDate,
        birthYear,
        birthPlace: currentPerson.birthPlace,
        deathDate: currentPerson.deathDate,
        deathYear,
        deathPlace: currentPerson.deathPlace,
        deathReason: currentPerson.deathReason,
        burialDate: currentPerson.burialDate,
        burialPlace: currentPerson.burialPlace,
        occupation: currentPerson.occupation,
        residencePlace: currentPerson.residencePlace,
        notes: currentPerson.notes,
        childrenIds: currentPerson.childrenIds || [],
        spouseIds: currentPerson.spouseIds || [],
        isLiving: !deathYear && !currentPerson.deathDate && (birthYear ? Number(birthYear) > (new Date().getFullYear() - 100) : false),
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
        marriagePlace: currentFamily.marriagePlace,
        ...currentFamily
      } as Family;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) continue;

    const parts = line.split(' ');
    const level = parseInt(parts[0], 10);
    if (isNaN(level)) continue;

    const tagOrId = parts[1];
    const value = parts.slice(2).join(' ').trim();

    if (level === 0) {
      saveCurrentEntity();

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
      lastMainTag = '';
      lastSubTag = '';
      continue;
    }

    if (currentType === 'INDI') {
      if (level === 1) {
        lastMainTag = tagOrId;
        lastSubTag = '';

        if (tagOrId === 'NAME') {
          if (value.includes('/')) {
            const nameParts = value.split('/');
            currentPerson.firstName = (nameParts[0] || '').trim();
            currentPerson.lastName = (nameParts[1] || '').trim();
          } else if (value) {
            const words = value.split(' ');
            if (words.length > 1) {
              currentPerson.lastName = words[words.length - 1];
              currentPerson.firstName = words.slice(0, words.length - 1).join(' ');
            } else {
              currentPerson.firstName = value;
            }
          }
        } else if (tagOrId === 'SEX') {
          const valUpper = value.toUpperCase();
          currentPerson.gender = (valUpper === 'F' || valUpper === 'FEMALE') ? 'female' : 'male';
        } else if (tagOrId === 'OCCU') {
          currentPerson.occupation = value;
        } else if (tagOrId === 'RESI') {
          if (value) currentPerson.residencePlace = value;
        } else if (tagOrId === 'NOTE') {
          currentPerson.notes = (currentPerson.notes ? currentPerson.notes + '\n' : '') + value;
          lastSubTag = 'NOTE';
        } else if (tagOrId === '_PATR' || tagOrId === 'PATR' || tagOrId === '_PATRONYMIC') {
          currentPerson.patronymic = value;
        } else if (tagOrId === '_MARNM' || tagOrId === 'MAID' || tagOrId === '_MAID' || tagOrId === '_MAIDEN') {
          currentPerson.maidenName = value.replace(/\//g, '').trim();
        } else if (tagOrId === '_UID' || tagOrId === 'UID' || tagOrId === 'RIN' || tagOrId === 'FSFTID' || tagOrId === '_FSFTID') {
          (currentPerson as any).sourceId = value;
        }
      } else if (level === 2) {
        lastSubTag = tagOrId;

        if (lastMainTag === 'NAME') {
          if (tagOrId === 'GIVN') {
            currentPerson.firstName = value;
          } else if (tagOrId === 'SURN') {
            currentPerson.lastName = value;
          } else if (tagOrId === '_PATR' || tagOrId === 'PATR') {
            currentPerson.patronymic = value;
          } else if (tagOrId === '_MARNM' || tagOrId === '_MAID' || tagOrId === 'MAID') {
            currentPerson.maidenName = value;
          }
        } else if (lastMainTag === 'BIRT') {
          if (tagOrId === 'DATE') {
            currentPerson.birthDate = value;
            const match = value.match(/\b(1\d{3}|20\d{2}|\d{3,4})\b/);
            if (match) currentPerson.birthYear = parseInt(match[1], 10);
          } else if (tagOrId === 'PLAC') {
            currentPerson.birthPlace = value;
          }
        } else if (lastMainTag === 'DEAT') {
          if (tagOrId === 'DATE') {
            currentPerson.deathDate = value;
            const match = value.match(/\b(1\d{3}|20\d{2}|\d{3,4})\b/);
            if (match) currentPerson.deathYear = parseInt(match[1], 10);
          } else if (tagOrId === 'PLAC') {
            currentPerson.deathPlace = value;
          } else if (tagOrId === 'CAUS') {
            currentPerson.deathReason = value;
          }
        } else if (lastMainTag === 'BURI') {
          if (tagOrId === 'DATE') {
            currentPerson.burialDate = value;
          } else if (tagOrId === 'PLAC') {
            currentPerson.burialPlace = value;
          }
        } else if (lastMainTag === 'RESI') {
          if (tagOrId === 'PLAC') {
            currentPerson.residencePlace = value;
          }
        } else if (tagOrId === 'CONT' || tagOrId === 'CONC') {
          if (lastMainTag === 'NOTE' || lastSubTag === 'NOTE') {
            currentPerson.notes = (currentPerson.notes || '') + (tagOrId === 'CONT' ? '\n' : ' ') + value;
          }
        }
      } else if (level === 3 && (tagOrId === 'CONT' || tagOrId === 'CONC')) {
        currentPerson.notes = (currentPerson.notes || '') + (tagOrId === 'CONT' ? '\n' : ' ') + value;
      }
    } else if (currentType === 'FAM') {
      if (level === 1) {
        lastMainTag = tagOrId;
        if (tagOrId === 'HUSB') {
          currentFamily.husbandId = value.replace(/@/g, '');
        } else if (tagOrId === 'WIFE') {
          currentFamily.wifeId = value.replace(/@/g, '');
        } else if (tagOrId === 'CHIL') {
          if (!currentFamily.childrenIds) currentFamily.childrenIds = [];
          currentFamily.childrenIds.push(value.replace(/@/g, ''));
        }
      } else if (level === 2 && lastMainTag === 'MARR') {
        if (tagOrId === 'DATE') {
          currentFamily.marriageDate = value;
        } else if (tagOrId === 'PLAC') {
          currentFamily.marriagePlace = value;
        }
      }
    }
  }

  // Save the final entity
  saveCurrentEntity();

  // Bi-directionally link family relationships (parents, spouses, children)
  Object.values(families).forEach((fam) => {
    const { husbandId, wifeId, childrenIds } = fam;

    // Connect parents to children
    if (childrenIds && childrenIds.length > 0) {
      childrenIds.forEach((childId) => {
        if (persons[childId]) {
          if (husbandId) persons[childId].fatherId = husbandId;
          if (wifeId) persons[childId].motherId = wifeId;
        }
      });
    }

    // Connect spouses to each other and add children to spouse lists
    if (husbandId && persons[husbandId]) {
      if (wifeId) {
        persons[husbandId].spouseIds = Array.from(new Set([...(persons[husbandId].spouseIds || []), wifeId]));
      }
      if (childrenIds && childrenIds.length > 0) {
        persons[husbandId].childrenIds = Array.from(new Set([...(persons[husbandId].childrenIds || []), ...childrenIds]));
      }
    }

    if (wifeId && persons[wifeId]) {
      if (husbandId) {
        persons[wifeId].spouseIds = Array.from(new Set([...(persons[wifeId].spouseIds || []), husbandId]));
      }
      if (childrenIds && childrenIds.length > 0) {
        persons[wifeId].childrenIds = Array.from(new Set([...(persons[wifeId].childrenIds || []), ...childrenIds]));
      }
    }
  });

  // Determine an initial root person ID
  const personList = Object.values(persons);
  let rootPersonId = personList[0]?.id;

  // Prefer a person with both ancestors/children or oldest identified
  const candidatesWithRelations = personList.filter((p) => (p.childrenIds && p.childrenIds.length > 0) || p.fatherId || p.motherId);
  if (candidatesWithRelations.length > 0) {
    rootPersonId = candidatesWithRelations[0].id;
  }

  return {
    persons,
    families,
    sources: {},
    events: {},
    places: {},
    rootPersonId,
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
  Object.values(database.persons || {}).forEach((p) => {
    ged += `0 @${p.id}@ INDI\n`;
    const given = p.firstName || p.name?.given || '';
    const surname = p.lastName || p.name?.surname || '';
    ged += `1 NAME ${given} /${surname}/\n`;
    if (given) ged += `2 GIVN ${given}\n`;
    if (surname) ged += `2 SURN ${surname}\n`;
    if (p.patronymic || p.name?.patronymic) {
      ged += `2 _PATR ${p.patronymic || p.name?.patronymic}\n`;
    }
    if (p.maidenName || p.name?.maidenName) {
      ged += `2 _MARNM ${p.maidenName || p.name?.maidenName}\n`;
    }

    ged += `1 SEX ${p.gender === 'female' || p.gender === 'F' ? 'F' : 'M'}\n`;

    if (p.birthDate || p.birthYear || p.birthPlace) {
      ged += '1 BIRT\n';
      if (p.birthDate || p.birthYear) ged += `2 DATE ${p.birthDate || p.birthYear}\n`;
      if (p.birthPlace) ged += `2 PLAC ${p.birthPlace}\n`;
    }

    if (p.deathDate || p.deathYear || p.deathPlace || p.deathReason) {
      ged += '1 DEAT\n';
      if (p.deathDate || p.deathYear) ged += `2 DATE ${p.deathDate || p.deathYear}\n`;
      if (p.deathPlace) ged += `2 PLAC ${p.deathPlace}\n`;
      if (p.deathReason) ged += `2 CAUS ${p.deathReason}\n`;
    }

    if (p.burialDate || p.burialPlace) {
      ged += '1 BURI\n';
      if (p.burialDate) ged += `2 DATE ${p.burialDate}\n`;
      if (p.burialPlace) ged += `2 PLAC ${p.burialPlace}\n`;
    }

    if (p.occupation) {
      ged += `1 OCCU ${p.occupation}\n`;
    }

    if (p.residencePlace) {
      ged += '1 RESI\n';
      ged += `2 PLAC ${p.residencePlace}\n`;
    }

    if (p.notes) {
      const noteLines = String(p.notes).split('\n');
      ged += `1 NOTE ${noteLines[0] || ''}\n`;
      for (let i = 1; i < noteLines.length; i++) {
        ged += `2 CONT ${noteLines[i]}\n`;
      }
    }
  });

  // Families
  Object.values(database.families || {}).forEach((fam) => {
    ged += `0 @${fam.id}@ FAM\n`;
    if (fam.husbandId) ged += `1 HUSB @${fam.husbandId}@\n`;
    if (fam.wifeId) ged += `1 WIFE @${fam.wifeId}@\n`;
    if (fam.childrenIds && Array.isArray(fam.childrenIds)) {
      fam.childrenIds.forEach((childId) => {
        ged += `1 CHIL @${childId}@\n`;
      });
    }
    if (fam.marriageDate || fam.marriagePlace) {
      ged += '1 MARR\n';
      if (fam.marriageDate) ged += `2 DATE ${fam.marriageDate}\n`;
      if (fam.marriagePlace) ged += `2 PLAC ${fam.marriagePlace}\n`;
    }
  });

  ged += '0 TRLR\n';
  return ged;
}

export function downloadGedcom(database: GenealogyDatabase, filename = 'rodovid_tree.ged'): void {
  const content = exportToGedcom(database);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  if (typeof document !== 'undefined') {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

