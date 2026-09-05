/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Phonetic-Genealogical Duplicate Person Detector
 * Specializing in automated Ukrainian genealogical comparison:
 * - ПІБ (Surname, Given name, Patronymic with historical phonetics)
 * - Birth dates (exact date, revision discrepancies, generation guards)
 * - Parents (Father and Mother identification, cross-patronymic verification, sibling safeguards)
 */

import { Person, DuplicatePair, DuplicatePairCriteria } from '../types';
import {
  normalizeArchaicUkrainian,
  getLevenshteinSimilarity,
  areSurnamesPhoneticallyRelated
} from './ukrainianPhonetics';
import { extractYear } from './treeAudit';

export interface PersonDuplicateMatch {
  person: Person;
  confidence: number;
  confidenceLevel: 'very_high' | 'high' | 'possible';
  reasons: string[];
  breakdown: DuplicatePair['breakdown'];
  criteria?: DuplicatePairCriteria;
}

/**
 * Common Ukrainian historical / ecclesiastical given name variants and canonical roots
 */
const UKRAINIAN_NAME_VARIANTS: Record<string, string[]> = {
  'іван': ['іван', 'ян', 'івась', 'іванко', 'іоанн', 'іоан', 'йоганн', 'іванка'],
  'олександр': ['олександр', 'олекса', 'сашко', 'саня', 'александр', 'алексей'],
  'олексій': ['олексій', 'олекса', 'алексій', 'алексей', 'олесь'],
  'микола': ['микола', 'миколай', 'ніколай', 'миколка', 'кола'],
  'михайло': ['михайло', 'михаїл', 'михал', 'михайлик'],
  'дмитро': ['дмитро', 'димитрій', 'дмитрій', 'митько'],
  'василь': ['василь', 'василій', 'васько', 'василько'],
  'григорій': ['григорій', 'григір', 'гриць', 'грицько', 'григорий'],
  'петро': ['петро', 'петрик', 'петр'],
  'степан': ['степан', 'стефан', 'стець', 'степко'],
  'федір': ['федір', 'феодор', 'теодор', 'федот', 'федя'],
  'семен': ['семен', 'симеон', 'семко', 'сьома'],
  'яків': ['яків', 'іаков', 'якуб', 'яша'],
  'юрій': ['юрій', 'георгій', 'юрко', 'єгор', 'юрчик'],
  'павло': ['павло', 'павлик', 'павел'],
  'роман': ['роман', 'ромко', 'романко'],
  'андрій': ['андрій', 'андрей', 'андрійко'],
  'володимир': ['володимир', 'владимир', 'володя'],
  'тарас': ['тарас', 'тарасик'],
  'ігнат': ['ігнат', 'ігнатій', 'ігнацій'],
  'тимофій': ['тимофій', 'тиміш', 'тимофей'],
  'кирило': ['кирило', 'кирил', 'кирилочко'],
  'данило': ['данило', 'даниїл', 'данил'],
  'костянтин': ['костянтин', 'констянтин', 'кость'],
  'лука': ['лука', 'лукіян', 'лукаш'],
  'максим': ['максим', 'максимко'],
  'матвій': ['матвій', 'матфей', 'матюша'],
  'прокіп': ['прокіп', 'прокопій', 'прокоп'],
  'пилип': ['пилип', 'філіп', 'філіпп'],
  'захар': ['захар', 'захарій', 'захарія'],
  'ілля': ['ілля', 'ілія', 'ілья'],
  'ганна': ['ганна', 'анна', 'ганя', 'галина', 'аня'],
  'марія': ['марія', 'маріка', 'маруся', 'мар\'я', 'марійка'],
  'катерина': ['катерина', 'катря', 'катя', 'катрина'],
  'оксана': ['оксана', 'ксенія', 'аксинья', 'оксанка'],
  'тетяна': ['тетяна', 'татьяна', 'таня', 'тетєна'],
  'олена': ['олена', 'єлена', 'алена', 'ілона', 'оленка'],
  'наталія': ['наталія', 'наталя', 'наталья', 'наталка'],
  'євдокія': ['євдокія', 'явдоха', 'ярина', 'докія', 'євдокія'],
  'пелагея': ['пелагея', 'палажка', 'палагна', 'пелагія'],
  'варвара': ['варвара', 'варка', 'варя'],
  'параскева': ['параскева', 'параска', 'прасковія'],
  'софія': ['софія', 'соня', 'зофія'],
  'христина': ['христина', 'христя', 'кристина'],
  'юстина': ['юстина', 'устина', 'юстинія'],
  'анастасія': ['анастасія', 'настя', 'настася'],
  'меланія': ['меланія', 'маланка', 'меланка'],
  'уляна': ['уляна', 'юліана', 'улянка']
};

/**
 * Check if two Ukrainian given names are equivalent variants
 */
export function areGivenNamesEquivalent(nameA: string, nameB: string): { isMatch: boolean; similarity: number } {
  const a = normalizeArchaicUkrainian(nameA.trim().toLowerCase());
  const b = normalizeArchaicUkrainian(nameB.trim().toLowerCase());
  if (!a || !b) return { isMatch: false, similarity: 0 };
  if (a === b) return { isMatch: true, similarity: 1.0 };

  // Check dictionary
  for (const list of Object.values(UKRAINIAN_NAME_VARIANTS)) {
    const hasA = list.some(v => a === v || a.startsWith(v) || v.startsWith(a));
    const hasB = list.some(v => b === v || b.startsWith(v) || v.startsWith(b));
    if (hasA && hasB) {
      return { isMatch: true, similarity: 0.95 };
    }
  }

  const lev = getLevenshteinSimilarity(a, b);
  return { isMatch: lev >= 0.75, similarity: lev };
}

/**
 * Extract root given name from patronymic (e.g. "Іванович" -> "іван", "Василівна" -> "василь")
 */
export function extractFatherGivenNameFromPatronymic(patronymic: string): string | null {
  if (!patronymic) return null;
  const p = normalizeArchaicUkrainian(patronymic.trim().toLowerCase());

  // Masculine suffixes
  const mascSuffixes = [
    'ович', 'евич', 'йович', 'овичу', 'евичу',
    'ич', 'іч', 'ичу', 'ічу'
  ];
  for (const suf of mascSuffixes) {
    if (p.endsWith(suf) && p.length > suf.length + 2) {
      return p.slice(0, -suf.length);
    }
  }

  // Feminine suffixes
  const femSuffixes = [
    'івна', 'ївна', 'овна', 'евна', 'ична', 'ічна'
  ];
  for (const suf of femSuffixes) {
    if (p.endsWith(suf) && p.length > suf.length + 2) {
      return p.slice(0, -suf.length);
    }
  }

  return null;
}

/**
 * Format a person's display name
 */
export function formatPersonFullName(p?: Person | null): string {
  if (!p) return '';
  const surname = p.name?.surname || p.lastName || '';
  const given = p.name?.given || p.firstName || '';
  const patron = p.name?.patronymic || p.patronymic || '';
  return [surname, given, patron].filter(Boolean).join(' ') || `[Особа ${p.id}]`;
}

/**
 * Compares two persons across the three core genealogical pillars:
 * 1) ПІБ (Прізвище, Ім'я, По батькові)
 * 2) Дата народження
 * 3) Батьки (Батько і Мати)
 * Plus auxiliary data: places, death dates, spouses, children.
 */
export function comparePersonPair(
  pA: Person,
  pB: Person,
  allPersonsMap?: Map<string, Person> | Record<string, Person>
): {
  confidence: number;
  confidenceLevel: 'very_high' | 'high' | 'possible';
  reasons: string[];
  breakdown: DuplicatePair['breakdown'];
  criteria: DuplicatePairCriteria;
} | null {
  // Guard against comparing identical ID
  if (pA.id === pB.id) return null;

  // 1. Hard Incompatibility Check: Gender (if both known)
  const isFemaleA = pA.gender === 'female' || pA.gender === 'F';
  const isMaleA = pA.gender === 'male' || pA.gender === 'M';
  const isFemaleB = pB.gender === 'female' || pB.gender === 'F';
  const isMaleB = pB.gender === 'male' || pB.gender === 'M';

  if ((isFemaleA && isMaleB) || (isMaleA && isFemaleB)) {
    return null; // Different known genders cannot be duplicates
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
    return null;
  }

  // Resolve Map for looking up parents
  const personsMap: Map<string, Person> | null = allPersonsMap instanceof Map
    ? allPersonsMap
    : allPersonsMap && typeof allPersonsMap === 'object'
    ? new Map(Object.entries(allPersonsMap))
    : null;

  const reasons: string[] = [];

  // ==========================================
  // PILLAR 1: ПІБ (Прізвище, Ім'я, По батькові)
  // ==========================================
  const surA = (pA.name?.surname || pA.lastName || '').trim();
  const surB = (pB.name?.surname || pB.lastName || '').trim();
  const maidenA = (pA.name?.maidenName || pA.maidenName || '').trim();
  const maidenB = (pB.name?.maidenName || pB.maidenName || '').trim();

  let surnameScore = 0;
  let surnameReason = '';
  if (surA && surB) {
    const surAnalysis = areSurnamesPhoneticallyRelated(surA, surB);
    if (surAnalysis.isMatch) {
      surnameScore = Math.round((surAnalysis.score / 100) * 35);
      surnameReason = surAnalysis.reason;
      reasons.push(surAnalysis.reason);
    } else if (maidenA && maidenB) {
      const maidenAnalysis = areSurnamesPhoneticallyRelated(maidenA, maidenB);
      if (maidenAnalysis.isMatch) {
        surnameScore = Math.round((maidenAnalysis.score / 100) * 30);
        surnameReason = `Збіг дівочого прізвища: «${maidenA}» ~ «${maidenB}»`;
        reasons.push(surnameReason);
      }
    }
  } else if (!surA && !surB) {
    surnameScore = 12;
    surnameReason = 'Обидва записи без зазначеного прізвища';
    reasons.push(surnameReason);
  }

  // Surnames completely incompatible
  if (surA && surB && surnameScore === 0) {
    return null;
  }

  const givenA = (pA.name?.given || pA.firstName || '').trim();
  const givenB = (pB.name?.given || pB.firstName || '').trim();
  const patronA = (pA.name?.patronymic || pA.patronymic || '').trim();
  const patronB = (pB.name?.patronymic || pB.patronymic || '').trim();

  let givenNameScore = 0;
  let givenMatchLevel: 'exact' | 'variant' | 'none' = 'none';

  if (givenA && givenB) {
    const nameEquiv = areGivenNamesEquivalent(givenA, givenB);
    if (nameEquiv.similarity === 1.0) {
      givenNameScore += 18;
      givenMatchLevel = 'exact';
      reasons.push(`Повний збіг імені «${givenA}»`);
    } else if (nameEquiv.isMatch) {
      givenNameScore += Math.round(nameEquiv.similarity * 16);
      givenMatchLevel = 'variant';
      reasons.push(`Збіг імені з урахуванням варіантів: «${givenA}» ~ «${givenB}»`);
    } else {
      // Distinctly different given names (e.g. "Микола" vs "Петро")
      return null;
    }
  } else if (!givenA && !givenB) {
    givenNameScore += 5;
  }

  let patronScore = 0;
  let patronMatch = false;
  if (patronA && patronB) {
    const pSim = getLevenshteinSimilarity(
      normalizeArchaicUkrainian(patronymicNormalize(patronA)),
      normalizeArchaicUkrainian(patronymicNormalize(patronB))
    );
    if (pSim >= 0.8) {
      patronScore = Math.round(pSim * 12);
      patronMatch = true;
      reasons.push(`Збіг по батькові: «${patronA}» ~ «${patronB}»`);
    }
  }

  const pibTotalScore = surnameScore + givenNameScore + patronScore;
  const pibScore = Math.min(100, Math.round((pibTotalScore / 55) * 100));

  let pibMatch: 'exact' | 'partial' | 'mismatch' = 'partial';
  if (surA && surB && givenA && givenB && givenMatchLevel === 'exact' && (!patronA || !patronB || patronMatch)) {
    pibMatch = 'exact';
  } else if (pibScore < 45) {
    pibMatch = 'mismatch';
  }

  const pibDetails = [
    surA && surB ? `${surA}${surA !== surB ? ` / ${surB}` : ''}` : (surA || surB || 'Прізвище не вказано'),
    givenA && givenB ? `${givenA}${givenA !== givenB ? ` / ${givenB}` : ''}` : (givenA || givenB || 'Імʼя не вказано'),
    patronA && patronB ? `${patronA}${patronA !== patronB ? ` / ${patronB}` : ''}` : (patronA || patronB || '')
  ].filter(Boolean).join(' ');

  // ==========================================
  // PILLAR 2: ДАТА НАРОДЖЕННЯ ТА СМЕРТІ
  // ==========================================
  const birthYearA = extractYear(pA.birthDate) || extractYear(pA.birthYear);
  const birthYearB = extractYear(pB.birthDate) || extractYear(pB.birthYear);
  const deathYearA = extractYear(pA.deathDate) || extractYear(pA.deathYear);
  const deathYearB = extractYear(pB.deathDate) || extractYear(pB.deathYear);

  let datesScore = 0;
  let birthScore = 30; // default unknown
  let birthMatch: 'exact' | 'close' | 'unknown' | 'mismatch' = 'unknown';
  let birthDetails = 'Дата не зазначена';

  if (pA.birthDate && pB.birthDate && pA.birthDate.trim() === pB.birthDate.trim()) {
    datesScore += 16;
    birthScore = 100;
    birthMatch = 'exact';
    birthDetails = `Точний збіг повної дати: ${pA.birthDate}`;
    reasons.push(birthDetails);
  } else if (birthYearA && birthYearB) {
    const bDiff = Math.abs(birthYearA - birthYearB);
    if (bDiff === 0) {
      datesScore += 14;
      birthScore = 95;
      birthMatch = 'exact';
      birthDetails = `Збіг року народження: ${birthYearA} р.`;
      reasons.push(birthDetails);
    } else if (bDiff === 1) {
      datesScore += 11;
      birthScore = 80;
      birthMatch = 'close';
      birthDetails = `Різниця в 1 рік (${birthYearA} / ${birthYearB} р. — типова для метрик)`;
      reasons.push(birthDetails);
    } else if (bDiff <= 3) {
      datesScore += 8;
      birthScore = 65;
      birthMatch = 'close';
      birthDetails = `Близький рік народження (похибка ${bDiff} р.: ${birthYearA} / ${birthYearB})`;
      reasons.push(birthDetails);
    } else if (bDiff <= 5) {
      datesScore += 4;
      birthScore = 45;
      birthMatch = 'close';
      birthDetails = `Різниця року народження ${bDiff} р. (${birthYearA} / ${birthYearB})`;
      reasons.push(birthDetails);
    } else if (bDiff > 12) {
      // Widely different generations cannot be duplicates
      return null;
    } else {
      birthMatch = 'mismatch';
      birthScore = 20;
      birthDetails = `Різниця ${bDiff} р.`;
    }
  } else if (birthYearA || birthYearB) {
    birthDetails = `Вказано лише в одному записі: ${birthYearA || birthYearB} р.`;
  }

  if (deathYearA && deathYearB) {
    const dDiff = Math.abs(deathYearA - deathYearB);
    if (dDiff === 0) {
      datesScore += 8;
      reasons.push(`Точний збіг року смерті (${deathYearA} р.)`);
    } else if (dDiff <= 2) {
      datesScore += 6;
      reasons.push(`Близький рік смерті (${deathYearA} / ${deathYearB} р.)`);
    } else if (dDiff > 15) {
      return null;
    }
  }

  // ==========================================
  // PILLAR 3: БАТЬКИ (Батько і Мати)
  // ==========================================
  let parentsScore = 0;
  let relationsScore = 0;
  let parentsMatch: 'both' | 'father' | 'mother' | 'patronymic' | 'none' | 'conflict' = 'none';
  let parentsDetails = 'Батьки не зазначені або не звʼязані';

  let fatherA: Person | null = null;
  let fatherB: Person | null = null;
  let motherA: Person | null = null;
  let motherB: Person | null = null;

  if (personsMap) {
    if (pA.fatherId) fatherA = personsMap.get(pA.fatherId) || null;
    if (pB.fatherId) fatherB = personsMap.get(pB.fatherId) || null;
    if (pA.motherId) motherA = personsMap.get(pA.motherId) || null;
    if (pB.motherId) motherB = personsMap.get(pB.motherId) || null;
  }

  const fatherNameA = formatPersonFullName(fatherA);
  const fatherNameB = formatPersonFullName(fatherB);
  const motherNameA = formatPersonFullName(motherA);
  const motherNameB = formatPersonFullName(motherB);

  const directFatherIdMatch = !!(pA.fatherId && pB.fatherId && pA.fatherId === pB.fatherId);
  const directMotherIdMatch = !!(pA.motherId && pB.motherId && pA.motherId === pB.motherId);

  // Check name-based match for fathers
  let fatherNameMatched = false;
  if (fatherA && fatherB) {
    const fSurA = (fatherA.name?.surname || fatherA.lastName || '').trim();
    const fSurB = (fatherB.name?.surname || fatherB.lastName || '').trim();
    const fGivenA = (fatherA.name?.given || fatherA.firstName || '').trim();
    const fGivenB = (fatherB.name?.given || fatherB.firstName || '').trim();

    if (fGivenA && fGivenB) {
      const gMatch = areGivenNamesEquivalent(fGivenA, fGivenB);
      if (gMatch.isMatch) {
        if (!fSurA || !fSurB || areSurnamesPhoneticallyRelated(fSurA, fSurB).isMatch) {
          fatherNameMatched = true;
        }
      }
    }
  }

  // Check name-based match for mothers
  let motherNameMatched = false;
  if (motherA && motherB) {
    const mGivenA = (motherA.name?.given || motherA.firstName || '').trim();
    const mGivenB = (motherB.name?.given || motherB.firstName || '').trim();
    const mMaidenA = (motherA.name?.maidenName || motherA.maidenName || motherA.name?.surname || '').trim();
    const mMaidenB = (motherB.name?.maidenName || motherB.maidenName || motherB.name?.surname || '').trim();

    if (mGivenA && mGivenB) {
      const gMatch = areGivenNamesEquivalent(mGivenA, mGivenB);
      if (gMatch.isMatch) {
        if (!mMaidenA || !mMaidenB || areSurnamesPhoneticallyRelated(mMaidenA, mMaidenB).isMatch) {
          motherNameMatched = true;
        }
      }
    }
  }

  // Cross-check patronymic with father's name
  let patronymicFatherMatch = false;
  let patronymicMatchedName = '';

  const fGivenFromPatronA = extractFatherGivenNameFromPatronymic(patronA);
  const fGivenFromPatronB = extractFatherGivenNameFromPatronymic(patronB);

  if (fatherB && fGivenFromPatronA) {
    const fGivenB = (fatherB.name?.given || fatherB.firstName || '').trim();
    if (fGivenB && areGivenNamesEquivalent(fGivenFromPatronA, fGivenB).isMatch) {
      patronymicFatherMatch = true;
      patronymicMatchedName = fGivenB;
    }
  }
  if (!patronymicFatherMatch && fatherA && fGivenFromPatronB) {
    const fGivenA = (fatherA.name?.given || fatherA.firstName || '').trim();
    if (fGivenA && areGivenNamesEquivalent(fGivenFromPatronB, fGivenA).isMatch) {
      patronymicFatherMatch = true;
      patronymicMatchedName = fGivenA;
    }
  }

  const isFatherMatched = directFatherIdMatch || fatherNameMatched;
  const isMotherMatched = directMotherIdMatch || motherNameMatched;

  // SIBLING CONFLICT GUARD:
  // If father AND mother match, same surname, BUT given names are distinctly different
  // (e.g. givenMatchLevel === 'none' or different birth years >= 2), they are BROTHERS/SISTERS!
  if (isFatherMatched && isMotherMatched && givenA && givenB && givenMatchLevel === 'none') {
    return null; // Sibling, not duplicate!
  }

  if (isFatherMatched && isMotherMatched) {
    parentsMatch = 'both';
    parentsScore = 100;
    relationsScore += 24;
    parentsDetails = `Спільні батько (${fatherNameA || fatherNameB}) та мати (${motherNameA || motherNameB})`;
    reasons.push(parentsDetails);
  } else if (isFatherMatched) {
    parentsMatch = 'father';
    parentsScore = 75;
    relationsScore += 14;
    parentsDetails = `Спільний батько: ${fatherNameA || fatherNameB}`;
    reasons.push(parentsDetails);
  } else if (isMotherMatched) {
    parentsMatch = 'mother';
    parentsScore = 65;
    relationsScore += 12;
    parentsDetails = `Спільна мати: ${motherNameA || motherNameB}`;
    reasons.push(parentsDetails);
  } else if (patronymicFatherMatch) {
    parentsMatch = 'patronymic';
    parentsScore = 55;
    relationsScore += 10;
    parentsDetails = `По батькові узгоджується з імʼям батька («${patronymicMatchedName}»)`;
    reasons.push(parentsDetails);
  } else if (fatherA && fatherB && motherA && motherB && !isFatherMatched && !isMotherMatched) {
    // Both parents exist on both sides and they are completely different!
    parentsMatch = 'conflict';
    parentsScore = 0;
    relationsScore -= 15;
    parentsDetails = `Конфлікт: різні батьки (${fatherNameA} / ${fatherNameB})`;
    reasons.push(parentsDetails);
  }

  // ==========================================
  // PILLAR 4: AUXILIARY (Places, Spouses, Children)
  // ==========================================
  const placeA = normalizeArchaicUkrainian(pA.birthPlace || pA.deathPlace || '');
  const placeB = normalizeArchaicUkrainian(pB.birthPlace || pB.deathPlace || '');
  let locationScore = 0;

  if (placeA && placeB) {
    if (placeA === placeB) {
      locationScore = 10;
      reasons.push(`Спільне місце: «${pA.birthPlace || pA.deathPlace}»`);
    } else {
      const locSim = getLevenshteinSimilarity(placeA, placeB);
      if (locSim >= 0.7) {
        locationScore = Math.round(locSim * 8);
        reasons.push(`Схожа локація: «${pA.birthPlace}» ~ «${pB.birthPlace}»`);
      }
    }
  }

  // Shared spouse
  const spousesA = pA.spouseIds || [];
  const spousesB = pB.spouseIds || [];
  const sharedSpouses = spousesA.filter(sId => spousesB.includes(sId));
  if (sharedSpouses.length > 0) {
    relationsScore += 10;
    reasons.push('Спільне подружжя в родинному дереві');
  }

  // Shared children
  const childrenA = pA.childrenIds || [];
  const childrenB = pB.childrenIds || [];
  const sharedChildren = childrenA.filter(cId => childrenB.includes(cId));
  if (sharedChildren.length > 0) {
    relationsScore += 10;
    reasons.push(`Спільні діти (${sharedChildren.length})`);
  }

  // Final confidence synthesis
  // Normal baseline max: ~90 pts
  const totalScore = surnameScore + givenNameScore + patronScore + datesScore + locationScore + relationsScore;
  const confidence = Math.min(99, Math.max(0, Math.round((totalScore / 88) * 100)));

  if (confidence < 45) {
    return null;
  }

  let confidenceLevel: 'very_high' | 'high' | 'possible' = 'possible';
  if (confidence >= 85) confidenceLevel = 'very_high';
  else if (confidence >= 68) confidenceLevel = 'high';

  return {
    confidence,
    confidenceLevel,
    reasons,
    breakdown: {
      surnameScore,
      givenNameScore,
      datesScore,
      locationScore,
      relationsScore,
      pibScore,
      birthScore,
      parentsScore
    },
    criteria: {
      pibMatch,
      pibDetails,
      pibScore,
      birthMatch,
      birthDetails,
      birthScore,
      parentsMatch,
      parentsDetails,
      parentsScore,
      fatherNameA: fatherNameA || undefined,
      fatherNameB: fatherNameB || undefined,
      motherNameA: motherNameA || undefined,
      motherNameB: motherNameB || undefined
    }
  };
}

/**
 * Normalizes patronymic endings for comparison
 */
function patronymicNormalize(p: string): string {
  const s = p.trim().toLowerCase();
  if (s.endsWith('ович') || s.endsWith('евич') || s.endsWith('йович')) return s.slice(0, -4);
  if (s.endsWith('івна') || s.endsWith('ївна') || s.endsWith('овна')) return s.slice(0, -4);
  return s;
}

/**
 * Finds all potential duplicate pairs in the tree using multi-dimensional phonetic,
 * chronological, and genealogical similarity evaluation.
 */
export function detectDuplicatePersons(persons: Person[]): DuplicatePair[] {
  const duplicatePairs: DuplicatePair[] = [];
  const n = persons.length;

  const personsMap = new Map<string, Person>();
  for (const p of persons) {
    personsMap.set(p.id, p);
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const pA = persons[i];
      const pB = persons[j];

      const comp = comparePersonPair(pA, pB, personsMap);
      if (comp && comp.confidence >= 48) {
        duplicatePairs.push({
          id: `dup_${pA.id}_${pB.id}`,
          personA: pA,
          personB: pB,
          confidence: comp.confidence,
          confidenceLevel: comp.confidenceLevel,
          reasons: comp.reasons,
          breakdown: comp.breakdown,
          criteria: comp.criteria
        });
      }
    }
  }

  // Sort descending by confidence
  return duplicatePairs.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Searches for potential duplicates of a single person (e.g. during person creation)
 * against all existing persons in the tree.
 */
export function findDuplicatesForPerson(
  target: Person,
  existingPersons: Person[],
  excludeId?: string,
  minConfidence = 45
): PersonDuplicateMatch[] {
  const targetSur = (target.name?.surname || target.lastName || '').trim();
  const targetGiven = (target.name?.given || target.firstName || '').trim();

  // If user hasn't entered at least a given name or surname with length >= 2, skip check
  if (targetSur.length < 2 && targetGiven.length < 2) {
    return [];
  }

  const personsMap = new Map<string, Person>();
  for (const p of existingPersons) {
    personsMap.set(p.id, p);
  }
  personsMap.set(target.id, target);

  const matches: PersonDuplicateMatch[] = [];

  for (const existing of existingPersons) {
    if (existing.id === target.id || (excludeId && existing.id === excludeId)) {
      continue;
    }

    const comp = comparePersonPair(target, existing, personsMap);
    if (comp && comp.confidence >= minConfidence) {
      matches.push({
        person: existing,
        confidence: comp.confidence,
        confidenceLevel: comp.confidenceLevel,
        reasons: comp.reasons,
        breakdown: comp.breakdown,
        criteria: comp.criteria
      });
    }
  }

  return matches.sort((a, b) => b.confidence - a.confidence);
}
