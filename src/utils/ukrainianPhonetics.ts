/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Specialized Ukrainian genealogical phonetics, Levenshtein distance,
 * and historical Slavic surname root matching algorithm.
 */

// Normalize archaic Cyrillic characters from imperial metric books & parish registers
export function normalizeArchaicUkrainian(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/ѣ/g, 'і') // Ять -> і/е
    .replace(/ѳ/g, 'ф') // Фіта -> ф
    .replace(/ѵ/g, 'і') // Іжиця -> і
    .replace(/ъ/g, '')  // Єр -> прибираємо
    .replace(/і/g, 'і')
    .replace(/i/g, 'і') // латинське i
    .replace(/ы/g, 'и') // російське ы -> укр и
    .replace(/э/g, 'е')
    .replace(/ё/g, 'е')
    .replace(/[\u0300-\u036f]/g, '') // видалення наголосів
    .trim();
}

/**
 * Standard Levenshtein Distance implementation
 */
export function calculateLevenshteinDistance(a: string, b: string): number {
  const s1 = normalizeArchaicUkrainian(a);
  const s2 = normalizeArchaicUkrainian(b);
  
  const matrix: number[][] = [];

  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[s2.length][s1.length];
}

/**
 * Returns Levenshtein similarity between 0 (completely different) and 1 (identical)
 */
export function getLevenshteinSimilarity(a: string, b: string): number {
  const s1 = normalizeArchaicUkrainian(a);
  const s2 = normalizeArchaicUkrainian(b);
  if (!s1 && !s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  if (s1 === s2) return 1.0;

  const maxLen = Math.max(s1.length, s2.length);
  const distance = calculateLevenshteinDistance(s1, s2);
  return Math.max(0, (maxLen - distance) / maxLen);
}

/**
 * Strips common historical, patronymic, and rusified suffixes from Ukrainian surnames
 * e.g. "Коваленко" -> "ковал", "Ковальов" -> "ковал", "Мельниченко" -> "мельн", "Шекало" -> "шакал"
 */
export function extractUkrainianSurnameRoot(surname: string): string {
  let norm = normalizeArchaicUkrainian(surname);

  // Common Slavic & Ukrainian patronymic/possessive suffixes
  const suffixes = [
    'енко', 'енка', 'єнко', 'ук', 'юк', 'ович', 'евич', 'євич',
    'ов', 'ев', 'єв', 'ін', 'ин', 'их', 'ський', 'ська', 'цький',
    'цька', 'ів', 'инський', 'енков', 'чука', 'чак', 'ок', 'ець'
  ];

  for (const suf of suffixes) {
    if (norm.endsWith(suf) && norm.length > suf.length + 2) {
      norm = norm.slice(0, -suf.length);
      break;
    }
  }

  // Standardize phonetic consonant clusters & vowel shifts
  norm = norm
    .replace(/[оеиі]/g, '*') // vowel wildcards
    .replace(/[гґх]/g, '1')  // velar fricatives
    .replace(/[сзшж]/g, '2')  // sibilants
    .replace(/[тдцч]/g, '3')  // dentals/affricates
    .replace(/[пбвф]/g, '4')  // labials
    .replace(/[млнр]/g, '5'); // sonorants

  return norm;
}

/**
 * Check if two surnames are phonetically and etymologically related
 */
export function areSurnamesPhoneticallyRelated(surnameA: string, surnameB: string): {
  isMatch: boolean;
  score: number;
  reason: string;
} {
  const normA = normalizeArchaicUkrainian(surnameA);
  const normB = normalizeArchaicUkrainian(surnameB);

  if (!normA || !normB) {
    return { isMatch: false, score: 0, reason: 'Порожнє прізвище' };
  }

  // 1. Direct match
  if (normA === normB) {
    return { isMatch: true, score: 100, reason: `Повний збіг прізвища «${surnameA}»` };
  }

  // 2. Levenshtein string similarity
  const levSim = getLevenshteinSimilarity(normA, normB);
  if (levSim >= 0.8) {
    return { 
      isMatch: true, 
      score: Math.round(levSim * 100), 
      reason: `Висока графічна схожість (${Math.round(levSim * 100)}%): «${surnameA}» та «${surnameB}»` 
    };
  }

  // 3. Phonetic root match (Soundex / Suffix normalization)
  const rootA = extractUkrainianSurnameRoot(normA);
  const rootB = extractUkrainianSurnameRoot(normB);

  if (rootA === rootB && rootA.length >= 2) {
    return {
      isMatch: true,
      score: 88,
      reason: `Фонетичний корінь збігається (патронімічна чи русифікована форма): «${surnameA}» ~ «${surnameB}»`
    };
  }

  const rootSim = getLevenshteinSimilarity(rootA, rootB);
  if (rootSim >= 0.75) {
    return {
      isMatch: true,
      score: Math.round(rootSim * 85),
      reason: `Схожість кореневої основи: «${surnameA}» ~ «${surnameB}»`
    };
  }

  return { isMatch: false, score: Math.round(levSim * 60), reason: 'Прізвища відрізняються' };
}

/**
 * Match a raw person record against existing tree persons
 */
export function findBestPersonMatch(
  extracted: {
    personName: string;
    village?: string;
    year?: string | number;
  },
  existingPersons: any[]
): {
  matchedPerson: any | null;
  confidence: number;
  reason: string;
} {
  if (!existingPersons || existingPersons.length === 0 || !extracted.personName) {
    return { matchedPerson: null, confidence: 0, reason: 'Немає персон для зіставлення' };
  }

  const parts = extracted.personName.trim().split(/\s+/);
  const lastName = parts[0] || '';
  const firstName = parts[1] || '';
  const patronymic = parts[2] || '';

  let bestPerson: any = null;
  let highestScore = 0;
  let bestReason = '';

  const extYear = parseInt(String(extracted.year || '')) || null;
  const extVillageNorm = normalizeArchaicUkrainian(extracted.village || '');

  for (const person of existingPersons) {
    let score = 0;
    const reasons: string[] = [];

    const pLast = person.lastName || person.name?.surname || '';
    const pFirst = person.firstName || person.name?.given || '';
    const pPatron = person.patronymic || person.name?.patronymic || '';
    const pVillage = normalizeArchaicUkrainian(person.birthPlace || person.place || '');
    const pYear = parseInt(person.birthDate ? person.birthDate.slice(0, 4) : person.birthYear) || null;

    // 1. Surname matching
    const surnameAnalysis = areSurnamesPhoneticallyRelated(lastName, pLast);
    if (surnameAnalysis.isMatch) {
      score += surnameAnalysis.score * 0.45;
      reasons.push(surnameAnalysis.reason);
    } else {
      continue; // Different surname root
    }

    // 2. First name matching
    if (firstName && pFirst) {
      const firstSim = getLevenshteinSimilarity(firstName, pFirst);
      if (firstSim >= 0.75) {
        score += firstSim * 25;
        reasons.push(`Збіг імені: «${firstName}» ~ «${pFirst}»`);
      }
    }

    // 3. Patronymic matching
    if (patronymic && pPatron) {
      const patronSim = getLevenshteinSimilarity(patronymic, pPatron);
      if (patronSim >= 0.75) {
        score += patronSim * 15;
        reasons.push(`Збіг по батькові: «${patronymic}» ~ «${pPatron}»`);
      }
    }

    // 4. Geographic parish / village proximity
    if (extVillageNorm && pVillage) {
      if (extVillageNorm.includes(pVillage) || pVillage.includes(extVillageNorm)) {
        score += 15;
        reasons.push(`Географічний збіг парафії (${person.birthPlace || extracted.village})`);
      } else {
        const vSim = getLevenshteinSimilarity(extVillageNorm, pVillage);
        if (vSim > 0.6) {
          score += vSim * 10;
          reasons.push(`Схожість назви поселення`);
        }
      }
    }

    // 5. Year proximity
    if (extYear && pYear) {
      const diff = Math.abs(extYear - pYear);
      if (diff === 0) {
        score += 10;
        reasons.push(`Точний збіг року (${pYear})`);
      } else if (diff <= 5) {
        score += 8;
        reasons.push(`Рік близький (різниця ${diff} р.)`);
      } else if (diff <= 25) {
        score += 4;
        reasons.push(`Суміжне покоління (~${diff} р.)`);
      }
    }

    const finalConfidence = Math.min(99, Math.round(score));
    if (finalConfidence > highestScore) {
      highestScore = finalConfidence;
      bestPerson = person;
      bestReason = reasons.join(' • ');
    }
  }

  if (highestScore >= 50 && bestPerson) {
    return {
      matchedPerson: bestPerson,
      confidence: highestScore,
      reason: bestReason || 'Знайдено ймовірний родинний зв’язок за сукупністю ознак'
    };
  }

  return {
    matchedPerson: null,
    confidence: 35,
    reason: 'Прямого збігу в поточному дереві не знайдено. Рекомендовано додати як нову гілку.'
  };
}
