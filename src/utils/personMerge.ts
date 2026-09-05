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

  // Combine Godparents & Godchildren
  const godparentsMap = new Map<string, any>();
  [...(personA.godparents || []), ...(personB.godparents || [])].forEach((gp, idx) => {
    const key = gp.personId ? `pid_${gp.personId}` : `${gp.name}_${gp.role || 'gp'}_${idx}`;
    if (!godparentsMap.has(key)) {
      godparentsMap.set(key, gp);
    }
  });
  const mergedGodparents = Array.from(godparentsMap.values()).filter(gp => gp.personId !== masterId && gp.personId !== duplicateId);
  const mergedGodparentIds = Array.from(new Set([...(personA.godparentIds || []), ...(personB.godparentIds || [])]))
    .filter(id => id !== masterId && id !== duplicateId);
  const mergedGodchildrenIds = Array.from(new Set([...(personA.godchildrenIds || []), ...(personB.godchildrenIds || [])]))
    .filter(id => id !== masterId && id !== duplicateId);

  // Parents resolution: if selection provided, use it; otherwise inherit from duplicate
  let fatherId: string | undefined;
  if (selection.father === 'B') {
    fatherId = personB.fatherId || personA.fatherId;
  } else if (selection.father === 'A') {
    fatherId = personA.fatherId || personB.fatherId;
  } else if (selection.father === 'none') {
    fatherId = undefined;
  } else {
    fatherId = master.fatherId || (duplicate.fatherId !== masterId ? duplicate.fatherId : undefined);
  }

  let motherId: string | undefined;
  if (selection.mother === 'B') {
    motherId = personB.motherId || personA.motherId;
  } else if (selection.mother === 'A') {
    motherId = personA.motherId || personB.motherId;
  } else if (selection.mother === 'none') {
    motherId = undefined;
  } else {
    motherId = master.motherId || (duplicate.motherId !== masterId ? duplicate.motherId : undefined);
  }

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
    godparents: mergedGodparents.length > 0 ? mergedGodparents : undefined,
    godparentIds: mergedGodparentIds.length > 0 ? mergedGodparentIds : undefined,
    godchildrenIds: mergedGodchildrenIds.length > 0 ? mergedGodchildrenIds : undefined,
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
    let newGodparents = p.godparents ? [...p.godparents] : undefined;
    let newGodparentIds = p.godparentIds ? [...p.godparentIds] : undefined;
    let newGodchildrenIds = p.godchildrenIds ? [...p.godchildrenIds] : undefined;

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

    // Rewrite godparents
    if (newGodparents && newGodparents.some(gp => gp.personId === duplicateId)) {
      newGodparents = newGodparents.map(gp => gp.personId === duplicateId ? { ...gp, personId: masterId } : gp);
      modified = true;
    }

    // Rewrite godparentIds
    if (newGodparentIds && newGodparentIds.includes(duplicateId)) {
      newGodparentIds = Array.from(new Set(newGodparentIds.map(id => id === duplicateId ? masterId : id))).filter(id => id !== p.id);
      modified = true;
    }

    // Rewrite godchildrenIds
    if (newGodchildrenIds && newGodchildrenIds.includes(duplicateId)) {
      newGodchildrenIds = Array.from(new Set(newGodchildrenIds.map(id => id === duplicateId ? masterId : id))).filter(id => id !== p.id);
      modified = true;
    }

    if (modified) {
      updatedPersons.push({
        ...p,
        fatherId: newFatherId,
        motherId: newMotherId,
        spouseIds: newSpouseIds,
        childrenIds: newChildrenIds,
        godparents: newGodparents,
        godparentIds: newGodparentIds,
        godchildrenIds: newGodchildrenIds
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

/**
 * Automatically merges two persons into one with automated field selection.
 * Chooses the richer record as master, populates missing fields, and merges all relationships.
 */
export function quickMergePersons(
  personA: Person,
  personB: Person,
  allPersons: Person[],
  allFamilies: Record<string, Family> = {}
): MergeResult {
  // Score completeness of personA vs personB
  const scorePerson = (p: Person): number => {
    let score = 0;
    if (p.name?.surname || p.lastName) score += 2;
    if (p.name?.given || p.firstName) score += 2;
    if (p.name?.patronymic || p.patronymic) score += 2;
    if (p.birthDate || p.birthYear) score += 4;
    if (p.birthPlace) score += 3;
    if (p.deathDate || p.deathYear) score += 3;
    if (p.deathPlace) score += 2;
    if (p.fatherId) score += 5;
    if (p.motherId) score += 5;
    if (p.bio && p.bio.length > 10) score += 4;
    if (p.notes && p.notes.length > 5) score += 3;
    if (p.citations && p.citations.length > 0) score += 4;
    if (p.events && p.events.length > 0) score += 3;
    if (p.avatar || p.photoUrl || p.avatarUrl) score += 5;
    return score;
  };

  const scoreA = scorePerson(personA);
  const scoreB = scorePerson(personB);
  const masterTarget: 'A' | 'B' = scoreA >= scoreB ? 'A' : 'B';

  const getChoice = (valA: any, valB: any): 'A' | 'B' => {
    if (valA && !valB) return 'A';
    if (!valA && valB) return 'B';
    return scoreA >= scoreB ? 'A' : 'B';
  };

  const selection: MergeFieldSelection = {
    given: getChoice(personA.name?.given || personA.firstName, personB.name?.given || personB.firstName),
    surname: getChoice(personA.name?.surname || personA.lastName, personB.name?.surname || personB.lastName),
    patronymic: getChoice(personA.name?.patronymic || personA.patronymic, personB.name?.patronymic || personB.patronymic),
    maidenName: getChoice(personA.name?.maidenName || personA.maidenName, personB.name?.maidenName || personB.maidenName),
    gender: personA.gender ? 'A' : 'B',
    birthDate: getChoice(personA.birthDate || personA.birthYear, personB.birthDate || personB.birthYear),
    birthPlace: getChoice(personA.birthPlace, personB.birthPlace),
    deathDate: getChoice(personA.deathDate || personA.deathYear, personB.deathDate || personB.deathYear),
    deathPlace: getChoice(personA.deathPlace, personB.deathPlace),
    isLiving: personA.isLiving !== undefined ? 'A' : 'B',
    occupation: getChoice(personA.occupation, personB.occupation),
    estateOrSocialStatus: getChoice(personA.estateOrSocialStatus || personA.estate, personB.estateOrSocialStatus || personB.estate),
    militaryRank: getChoice(personA.militaryRank, personB.militaryRank),
    confession: getChoice(personA.confession, personB.confession),
    avatar: personA.avatar || personA.photoUrl ? 'A' : personB.avatar || personB.photoUrl ? 'B' : 'none',
    father: getChoice(personA.fatherId, personB.fatherId),
    mother: getChoice(personA.motherId, personB.motherId),
    combineBio: true,
    combineNotes: true,
    combineSources: true,
    combineEvents: true,
    combineRelations: true,
  };

  return executeSmartPersonMerge(personA, personB, selection, allPersons, allFamilies, masterTarget);
}

/**
 * Batch merges safe, high-confidence duplicate pairs
 */
export function batchMergeSafeDuplicates(
  pairs: Array<{ personA: Person; personB: Person; confidence: number }>,
  allPersons: Person[],
  allFamilies: Record<string, Family> = {},
  minConfidence = 85
): {
  mergedCount: number;
  updatedPersons: Person[];
  updatedFamilies: Record<string, Family>;
  mergedNames: string[];
} {
  let currentPersons = [...allPersons];
  let currentFamilies = { ...allFamilies };
  let mergedCount = 0;
  const mergedNames: string[] = [];
  const processedPersonIds = new Set<string>();

  for (const pair of pairs) {
    if (pair.confidence < minConfidence) continue;

    // Check if either person was already merged in this batch
    if (processedPersonIds.has(pair.personA.id) || processedPersonIds.has(pair.personB.id)) {
      continue;
    }

    // Lookup freshest state of persons from currentPersons
    const freshA = currentPersons.find(p => p.id === pair.personA.id);
    const freshB = currentPersons.find(p => p.id === pair.personB.id);
    if (!freshA || !freshB) continue;

    const res = quickMergePersons(freshA, freshB, currentPersons, currentFamilies);
    currentPersons = res.updatedPersons;
    currentFamilies = res.updatedFamilies;
    processedPersonIds.add(pair.personA.id);
    processedPersonIds.add(pair.personB.id);
    mergedCount++;
    const nameStr = res.masterPerson.name?.given
      ? `${res.masterPerson.name.surname || ''} ${res.masterPerson.name.given}`
      : res.masterPerson.id;
    mergedNames.push(nameStr.trim());
  }

  return {
    mergedCount,
    updatedPersons: currentPersons,
    updatedFamilies: currentFamilies,
    mergedNames
  };
}

