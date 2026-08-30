/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Phonetic-Genealogical Duplicate Person Detector
 */

import { Person, DuplicatePair } from '../types';
import {
  normalizeArchaicUkrainian,
  getLevenshteinSimilarity,
  areSurnamesPhoneticallyRelated
} from './ukrainianPhonetics';
import { extractYear } from './treeAudit';

/**
 * Finds all potential duplicate pairs in the tree using multi-dimensional phonetic,
 * chronological, and genealogical similarity evaluation.
 */
export function detectDuplicatePersons(persons: Person[]): DuplicatePair[] {
  const duplicatePairs: DuplicatePair[] = [];
  const n = persons.length;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const pA = persons[i];
      const pB = persons[j];

      // 1. Hard Incompatibility Check: Gender
      const genderA = pA.gender === 'female' || pA.gender === 'F' ? 'female' : 'male';
      const genderB = pB.gender === 'female' || pB.gender === 'F' ? 'female' : 'male';
      if (genderA !== genderB) {
        continue; // Different genders cannot be duplicates
      }

      // 2. Hard Incompatibility Check: Parent-Child relationship
      if (
        pA.fatherId === pB.id ||
        pA.motherId === pB.id ||
        pB.fatherId === pA.id ||
        pB.motherId === pA.id ||
        pA.childrenIds?.includes(pB.id) ||
        pB.childrenIds?.includes(pA.id)
      ) {
        continue;
      }

      const reasons: string[] = [];
      let totalScore = 0;

      // --- DIMENSION 1: SURNAMES (Max 35 pts) ---
      const surA = pA.name?.surname || pA.lastName || '';
      const surB = pB.name?.surname || pB.lastName || '';
      const maidenA = pA.name?.maidenName || pA.maidenName || '';
      const maidenB = pB.name?.maidenName || pB.maidenName || '';

      let surnameScore = 0;
      if (surA && surB) {
        const surAnalysis = areSurnamesPhoneticallyRelated(surA, surB);
        if (surAnalysis.isMatch) {
          surnameScore = Math.round((surAnalysis.score / 100) * 35);
          reasons.push(surAnalysis.reason);
        } else if (maidenA && maidenB) {
          const maidenAnalysis = areSurnamesPhoneticallyRelated(maidenA, maidenB);
          if (maidenAnalysis.isMatch) {
            surnameScore = Math.round((maidenAnalysis.score / 100) * 30);
            reasons.push(`Збіг дівочого прізвища: «${maidenA}» ~ «${maidenB}»`);
          }
        }
      } else if (!surA && !surB) {
        surnameScore = 10;
        reasons.push('Обидва записи без зазначеного прізвища');
      }

      // If surnames are completely different with 0 score and neither has maiden match,
      // skip immediately unless they share exact same parents/birth date.
      if (surA && surB && surnameScore === 0) {
        continue;
      }

      // --- DIMENSION 2: GIVEN NAME & PATRONYMIC (Max 25 pts) ---
      const givenA = pA.name?.given || pA.firstName || '';
      const givenB = pB.name?.given || pB.firstName || '';
      const patronA = pA.name?.patronymic || pA.patronymic || '';
      const patronB = pB.name?.patronymic || pB.patronymic || '';

      let givenNameScore = 0;
      if (givenA && givenB) {
        const givenSim = getLevenshteinSimilarity(givenA, givenB);
        if (givenSim === 1.0) {
          givenNameScore += 15;
          reasons.push(`Повний збіг імені «${givenA}»`);
        } else if (givenSim >= 0.75) {
          givenNameScore += Math.round(givenSim * 15);
          reasons.push(`Фонетична схожість імені: «${givenA}» ~ «${givenB}»`);
        } else {
          // Different first names with very low similarity -> likely siblings or different people
          continue;
        }
      } else if (!givenA && !givenB) {
        givenNameScore += 5;
      }

      if (patronA && patronB) {
        const patronSim = getLevenshteinSimilarity(patronA, patronB);
        if (patronSim === 1.0) {
          givenNameScore += 10;
          reasons.push(`Повний збіг по батькові «${patronA}»`);
        } else if (patronSim >= 0.75) {
          givenNameScore += Math.round(patronSim * 10);
          reasons.push(`Схожість по батькові: «${patronA}» ~ «${patronB}»`);
        }
      }

      // --- DIMENSION 3: DATES & YEARS (Max 20 pts) ---
      const birthYearA = extractYear(pA.birthDate) || extractYear(pA.birthYear);
      const birthYearB = extractYear(pB.birthDate) || extractYear(pB.birthYear);
      const deathYearA = extractYear(pA.deathDate) || extractYear(pA.deathYear);
      const deathYearB = extractYear(pB.deathDate) || extractYear(pB.deathYear);

      let datesScore = 0;
      if (birthYearA && birthYearB) {
        const bDiff = Math.abs(birthYearA - birthYearB);
        if (bDiff === 0) {
          datesScore += 12;
          reasons.push(`Точний збіг року народження (${birthYearA})`);
        } else if (bDiff === 1) {
          datesScore += 10;
          reasons.push(`Рік народження відрізняється на 1 рік (${birthYearA} / ${birthYearB})`);
        } else if (bDiff <= 3) {
          datesScore += 7;
          reasons.push(`Близький рік народження (похибка ${bDiff} р.)`);
        } else if (bDiff <= 5) {
          datesScore += 4;
          reasons.push(`Різниця року народження ${bDiff} р.`);
        } else if (bDiff > 12) {
          // Hard penalty for widely different generations
          continue;
        }
      }

      if (deathYearA && deathYearB) {
        const dDiff = Math.abs(deathYearA - deathYearB);
        if (dDiff === 0) {
          datesScore += 8;
          reasons.push(`Точний збіг року смерті (${deathYearA})`);
        } else if (dDiff <= 2) {
          datesScore += 6;
          reasons.push(`Близький рік смерті (${deathYearA} / ${deathYearB})`);
        } else if (dDiff > 15) {
          continue;
        }
      }

      // --- DIMENSION 4: GEOGRAPHIC LOCATION (Max 10 pts) ---
      const placeA = normalizeArchaicUkrainian(pA.birthPlace || pA.deathPlace || '');
      const placeB = normalizeArchaicUkrainian(pB.birthPlace || pB.deathPlace || '');
      let locationScore = 0;

      if (placeA && placeB) {
        if (placeA === placeB) {
          locationScore = 10;
          reasons.push(`Спільне місце походження: «${pA.birthPlace || pA.deathPlace}»`);
        } else {
          const locSim = getLevenshteinSimilarity(placeA, placeB);
          if (locSim >= 0.7) {
            locationScore = Math.round(locSim * 8);
            reasons.push(`Схожа локація: «${pA.birthPlace}» ~ «${pB.birthPlace}»`);
          }
        }
      }

      // --- DIMENSION 5: FAMILY RELATIONS (Max 20 pts) ---
      let relationsScore = 0;
      if (pA.fatherId && pB.fatherId && pA.fatherId === pB.fatherId) {
        relationsScore += 8;
        reasons.push('Спільний батько в родинному дереві');
      }
      if (pA.motherId && pB.motherId && pA.motherId === pB.motherId) {
        relationsScore += 8;
        reasons.push('Спільна мати в родинному дереві');
      }

      // Shared spouse
      const spousesA = pA.spouseIds || [];
      const spousesB = pB.spouseIds || [];
      const sharedSpouses = spousesA.filter(sId => spousesB.includes(sId));
      if (sharedSpouses.length > 0) {
        relationsScore += 8;
        reasons.push('Спільне подружжя в дереві');
      }

      // Shared children
      const childrenA = pA.childrenIds || [];
      const childrenB = pB.childrenIds || [];
      const sharedChildren = childrenA.filter(cId => childrenB.includes(cId));
      if (sharedChildren.length > 0) {
        relationsScore += 8;
        reasons.push(`Спільні діти (${sharedChildren.length})`);
      }

      totalScore = surnameScore + givenNameScore + datesScore + locationScore + relationsScore;

      // Normalized Confidence (0 - 100)
      const confidence = Math.min(99, Math.max(0, Math.round((totalScore / 90) * 100)));

      if (confidence >= 48) {
        let confidenceLevel: 'very_high' | 'high' | 'possible' = 'possible';
        if (confidence >= 85) confidenceLevel = 'very_high';
        else if (confidence >= 68) confidenceLevel = 'high';

        duplicatePairs.push({
          id: `dup_${pA.id}_${pB.id}`,
          personA: pA,
          personB: pB,
          confidence,
          confidenceLevel,
          reasons,
          breakdown: {
            surnameScore,
            givenNameScore,
            datesScore,
            locationScore,
            relationsScore
          }
        });
      }
    }
  }

  // Sort descending by confidence
  return duplicatePairs.sort((a, b) => b.confidence - a.confidence);
}
