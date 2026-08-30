/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Smart Person Merge Engine
 */

import { Person, Family, MergeFieldSelection, Source, LifeEvent } from '../types';

export interface MergeResult {
  updatedPersons: Person[];
  updatedFamilies: Record<string, Family>;
  masterPerson: Person;
  deletedPersonId: string;
  summary: {
    transferredChildrenCount: number;
    transferredSpousesCount: number;
    transferredSourcesCount: number;
    transferredEventsCount: number;
  };
}

export function executeSmartPersonMerge(
  personA: Person,
  personB: Person,
  selection: MergeFieldSelection,
  allPersons: Person[],
  allFamilies: Record<string, Family> = {},
  masterTarget: 'A' | 'B' = 'A'
): MergeResult {
  const master = masterTarget === 'A' ? personA : personB;
  const duplicate = masterTarget === 'A' ? personB : personA;

  const masterId = master.id;
  const duplicateId = duplicate.id;

  // 1. Resolve String / Scalar Fields based on user selection
  const resolveField = (
    fieldKey: keyof MergeFieldSelection,
    valA: any,
    valB: any,
    customVal?: string
  ): any => {
    const choice = selection[fieldKey];
    if (choice === 'custom' && customVal !== undefined) return customVal;
    if (choice === 'B') return valB || valA || undefined;
    return valA || valB || undefined;
  };

  const customVals = selection.customValues || {};

  const given = resolveField('given', personA.name?.given || personA.firstName, personB.name?.given || personB.firstName, customVals.given);
  const surname = resolveField('surname', personA.name?.surname || personA.lastName, personB.name?.surname || personB.lastName, customVals.surname);
  const patronymic = resolveField('patronymic', personA.name?.patronymic || personA.patronymic, personB.name?.patronymic || personB.patronymic, customVals.patronymic);
  const maidenName = resolveField('maidenName', personA.name?.maidenName || personA.maidenName, personB.name?.maidenName || personB.maidenName, customVals.maidenName);
  const gender = selection.gender === 'B' ? personB.gender : personA.gender;
  const birthDate = resolveField('birthDate', personA.birthDate || personA.birthYear, personB.birthDate || personB.birthYear, customVals.birthDate);
  const birthPlace = resolveField('birthPlace', personA.birthPlace, personB.birthPlace, customVals.birthPlace);
  const deathDate = resolveField('deathDate', personA.deathDate || personA.deathYear, personB.deathDate || personB.deathYear, customVals.deathDate);
  const deathPlace = resolveField('deathPlace', personA.deathPlace, personB.deathPlace, customVals.deathPlace);
  const isLiving = selection.isLiving === 'B' ? personB.isLiving : personA.isLiving;
  const occupation = resolveField('occupation', personA.occupation, personB.occupation, customVals.occupation);
  const estate = resolveField('estateOrSocialStatus', personA.estateOrSocialStatus || personA.estate, personB.estateOrSocialStatus || personB.estate, customVals.estateOrSocialStatus);
  const militaryRank = resolveField('militaryRank', personA.militaryRank, personB.militaryRank, customVals.militaryRank);
  const confession = resolveField('confession', personA.confession, personB.confession, customVals.confession);

  const avatar = selection.avatar === 'B'
    ? (personB.avatarUrl || personB.avatar || personB.photoUrl)
    : selection.avatar === 'none'
    ? undefined
    : (personA.avatarUrl || personA.avatar || personA.photoUrl || personB.avatarUrl || personB.avatar);

  // 2. Combine Notes
  let mergedNotes = personA.notes || '';
  if (selection.combineNotes && personB.notes && personB.notes !== personA.notes) {
    mergedNotes = mergedNotes ? `${mergedNotes}\n\n[Злиття з ${personB.id}]:\n${personB.notes}` : personB.notes;
  }

  // 3. Combine Bio
  let mergedBio = personA.bio || '';
  if (selection.combineBio && personB.bio && personB.bio !== personA.bio) {
    mergedBio = mergedBio ? `${mergedBio}\n\n${personB.bio}` : personB.bio;
  }

  // 4. Combine Sources & Citations
  const sourceIdsSet = new Set<string>([...(personA.sourceIds || []), ...(personB.sourceIds || [])]);
  const citationsMap = new Map<string, any>();
  [...(personA.citations || []), ...(personB.citations || [])].forEach((c, idx) => {
    const key = c.sourceId || c.citation || `cit_${idx}`;
    if (!citationsMap.has(key)) citationsMap.set(key, c);
  });
  const mergedCitations = Array.from(citationsMap.values());
  const mergedSourceIds = Array.from(sourceIdsSet);

  // 5. Combine Events
  const eventsMap = new Map<string, any>();
  [...(personA.events || []), ...(personB.events || [])].forEach((ev, idx) => {
    const key = `${ev.type || 'event'}_${ev.date || ev.year || idx}`;
    if (!eventsMap.has(key)) eventsMap.set(key, ev);
  });
  const mergedEvents = Array.from(eventsMap.values());

  // 6. Combine Family Relations (spouses & children)
  const spousesSet = new Set<string>();
  [...(personA.spouseIds || []), ...(personB.spouseIds || [])].forEach(sId => {
    if (sId && sId !== masterId && sId !== duplicateId) {
      spousesSet.add(sId);
    }
  });

  const childrenSet = new Set<string>();
  [...(personA.childrenIds || []), ...(personB.childrenIds || [])].forEach(cId => {
    if (cId && cId !== masterId && cId !== duplicateId) {
      childrenSet.add(cId);
    }
  });

  // Parents resolution: if master is missing father/mother, inherit from duplicate
  let fatherId = master.fatherId || (duplicate.fatherId !== masterId ? duplicate.fatherId : undefined);
  let motherId = master.motherId || (duplicate.motherId !== masterId ? duplicate.motherId : undefined);

  // Avoid circular parent
  if (fatherId === masterId || fatherId === duplicateId) fatherId = undefined;
  if (motherId === masterId || motherId === duplicateId) motherId = undefined;

  // Assemble the new master Person
  const mergedMasterPerson: Person = {
    ...master,
    id: masterId,
    name: {
      given: given || '',
      surname: surname || '',
      patronymic: patronymic || undefined,
      maidenName: maidenName || undefined,
      prefix: master.name?.prefix || duplicate.name?.prefix
    },
    firstName: given,
    lastName: surname,
    patronymic,
    maidenName,
    gender,
    birthDate,
    birthPlace,
    deathDate,
    deathPlace,
    isLiving,
    occupation,
    estateOrSocialStatus: estate,
    socialStatus: estate,
    estate,
    militaryRank,
    confession,
    avatar,
    avatarUrl: avatar,
    photoUrl: avatar,
    notes: mergedNotes || undefined,
    bio: mergedBio || undefined,
    fatherId,
    motherId,
    spouseIds: Array.from(spousesSet),
    childrenIds: Array.from(childrenSet),
    sourceIds: mergedSourceIds,
    citations: mergedCitations,
    events: mergedEvents
  };

  // 7. Rewrite all references in the rest of the persons array
  const updatedPersons: Person[] = [];
  let transferredChildren = 0;
  let transferredSpouses = 0;

  for (const p of allPersons) {
    if (p.id === duplicateId) {
      // Remove duplicate person from array
      continue;
    }

    if (p.id === masterId) {
      updatedPersons.push(mergedMasterPerson);
      continue;
    }

    let modified = false;
    let newFatherId = p.fatherId;
    let newMotherId = p.motherId;
    let newSpouseIds = p.spouseIds ? [...p.spouseIds] : undefined;
    let newChildrenIds = p.childrenIds ? [...p.childrenIds] : undefined;

    // Rewrite father
    if (newFatherId === duplicateId) {
      newFatherId = masterId;
      modified = true;
      transferredChildren++;
    }

    // Rewrite mother
    if (newMotherId === duplicateId) {
      newMotherId = masterId;
      modified = true;
      transferredChildren++;
    }

    // Rewrite spouses
    if (newSpouseIds && newSpouseIds.includes(duplicateId)) {
      newSpouseIds = newSpouseIds.map(id => (id === duplicateId ? masterId : id));
      // Remove self or duplicates
      newSpouseIds = Array.from(new Set(newSpouseIds)).filter(id => id !== p.id);
      modified = true;
      transferredSpouses++;
    }

    // Rewrite children
    if (newChildrenIds && newChildrenIds.includes(duplicateId)) {
      newChildrenIds = newChildrenIds.map(id => (id === duplicateId ? masterId : id));
      newChildrenIds = Array.from(new Set(newChildrenIds)).filter(id => id !== p.id);
      modified = true;
    }

    if (modified) {
      updatedPersons.push({
        ...p,
        fatherId: newFatherId,
        motherId: newMotherId,
        spouseIds: newSpouseIds,
        childrenIds: newChildrenIds
      });
    } else {
      updatedPersons.push(p);
    }
  }

  // 8. Rewrite all references in the families dictionary
  const updatedFamilies: Record<string, Family> = {};
  Object.entries(allFamilies).forEach(([famId, fam]) => {
    let husbandId = fam.husbandId === duplicateId ? masterId : fam.husbandId;
    let wifeId = fam.wifeId === duplicateId ? masterId : fam.wifeId;

    const children = (fam.children || []).map(child => {
      if (child.personId === duplicateId) {
        return { ...child, personId: masterId };
      }
      return child;
    });

    const childrenIds = (fam.childrenIds || []).map(cId => (cId === duplicateId ? masterId : cId));

    updatedFamilies[famId] = {
      ...fam,
      husbandId,
      wifeId,
      children,
      childrenIds: Array.from(new Set(childrenIds))
    };
  });

  return {
    updatedPersons,
    updatedFamilies,
    masterPerson: mergedMasterPerson,
    deletedPersonId: duplicateId,
    summary: {
      transferredChildrenCount: transferredChildren,
      transferredSpousesCount: transferredSpouses,
      transferredSourcesCount: mergedSourceIds.length,
      transferredEventsCount: mergedEvents.length
    }
  };
}
