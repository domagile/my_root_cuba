/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Global Tree Search Engine with multi-field search and fuzzy matching:
 * - Names: Given, Surname, Patronymic, Maiden name, Name variants, Nicknames
 * - Event Places: Birth, Death, Marriage, Residence, Historical places, Event places
 * - Notes & Details: Notes, Bio, Occupations, Social status, Cause of death, Custom fields
 * - Fuzzy Matching: Levenshtein distance typo tolerance, Ukrainian phonetics/archaic Cyrillic,
 *   keyboard layout fix, and transliteration mapping.
 */

import { Person, PersonLifeEventItem, HistoricalPlaceItem } from '../types';
import { 
  normalizeArchaicUkrainian, 
  calculateLevenshteinDistance, 
  getLevenshteinSimilarity,
  extractUkrainianSurnameRoot
} from './ukrainianPhonetics';

export type SearchCategory = 'all' | 'name' | 'place' | 'note';

export interface SearchMatchDetail {
  category: 'name' | 'place' | 'note';
  field: string;              // e.g. "Прізвище", "Місце народження", "Замітки", "Подія: Хрещення"
  matchedText: string;        // Text where match occurred
  highlightSnippet?: string;  // Context snippet with surrounding words
  isFuzzy: boolean;           // Whether match was fuzzy
  fuzzyType?: 'exact' | 'prefix' | 'substring' | 'stem' | 'typo' | 'phonetic' | 'keyboard';
  score: number;              // 0 - 100
}

export interface GlobalSearchResult {
  person: Person;
  score: number;
  bestMatch: SearchMatchDetail;
  allMatches: SearchMatchDetail[];
  isFuzzy: boolean;
  matchedCategories: {
    name: boolean;
    place: boolean;
    note: boolean;
  };
}

/**
 * Maps English QWERTY keyboard characters to Ukrainian Cyrillic
 * for users who accidentally type with the wrong keyboard layout.
 */
const EN_TO_UA_KEYBOARD: Record<string, string> = {
  'q': 'й', 'w': 'ц', 'e': 'у', 'r': 'к', 't': 'е', 'y': 'н', 'u': 'г', 'i': 'ш', 'o': 'щ', 'p': 'з',
  '[': 'х', ']': 'ї', 'a': 'ф', 's': 'і', 'd': 'в', 'f': 'а', 'g': 'п', 'h': 'р', 'j': 'о', 'k': 'л',
  'l': 'д', ';': 'ж', '\'': 'є', 'z': 'я', 'x': 'ч', 'c': 'с', 'v': 'м', 'b': 'и', 'n': 'т', 'm': 'ь',
  ',': 'б', '.': 'ю', '`': '\'', '~': '₴',
  'Q': 'Й', 'W': 'Ц', 'E': 'У', 'R': 'К', 'T': 'Е', 'Y': 'Н', 'U': 'Г', 'I': 'Ш', 'O': 'Щ', 'P': 'З',
  '{': 'Х', '}': 'Ї', 'A': 'Ф', 'S': 'І', 'D': 'В', 'F': 'А', 'G': 'П', 'H': 'Р', 'J': 'О', 'K': 'Л',
  'L': 'Д', ':': 'Ж', '"': 'Є', 'Z': 'Я', 'X': 'Ч', 'C': 'С', 'V': 'М', 'B': 'И', 'N': 'Т', 'M': 'Ь',
  '<': 'Б', '>': 'Ю'
};

/**
 * Common Ukrainian Latin-to-Cyrillic transliteration mapping
 */
function transliterateLatinToCyrillic(str: string): string {
  let s = str.toLowerCase();
  s = s.replace(/shch/g, 'щ')
       .replace(/ch/g, 'ч')
       .replace(/sh/g, 'ш')
       .replace(/zh/g, 'ж')
       .replace(/kh/g, 'х')
       .replace(/ts/g, 'ц')
       .replace(/yu/g, 'ю')
       .replace(/ya/g, 'я')
       .replace(/ye/g, 'є')
       .replace(/yi/g, 'ї');

  const singleMap: Record<string, string> = {
    'a': 'а', 'b': 'б', 'v': 'в', 'g': 'г', 'd': 'д', 'e': 'е', 'z': 'з',
    'y': 'и', 'i': 'і', 'j': 'й', 'k': 'к', 'l': 'л', 'm': 'м', 'n': 'н',
    'o': 'о', 'p': 'п', 'r': 'р', 's': 'с', 't': 'т', 'u': 'у', 'f': 'ф'
  };

  return s.split('').map(char => singleMap[char] || char).join('');
}

/**
 * Converts text typed on English layout to Ukrainian Cyrillic
 */
export function convertKeyboardLayout(input: string): string {
  let result = '';
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    result += EN_TO_UA_KEYBOARD[char] || char;
  }
  return result;
}

/**
 * Normalizes query string and produces possible alternative variations
 * (e.g. keyboard layout conversion, transliteration, archaic Cyrillic).
 */
export function prepareQueryVariations(rawQuery: string): string[] {
  const trimmed = rawQuery.trim();
  if (!trimmed) return [];

  const variations = new Set<string>();

  const standard = normalizeArchaicUkrainian(trimmed);
  if (standard) variations.add(standard);

  // Check if keyboard layout might be English
  const layoutConverted = convertKeyboardLayout(trimmed);
  const layoutNorm = normalizeArchaicUkrainian(layoutConverted);
  if (layoutNorm && layoutNorm !== standard) {
    variations.add(layoutNorm);
  }

  // Check Latin transliteration if contains ASCII letters
  if (/[a-zA-Z]/.test(trimmed)) {
    const translit = transliterateLatinToCyrillic(trimmed);
    const translitNorm = normalizeArchaicUkrainian(translit);
    if (translitNorm && translitNorm !== standard) {
      variations.add(translitNorm);
    }
  }

  return Array.from(variations);
}

/**
 * Extract a snippet of text surrounding the matched term
 */
export function extractHighlightSnippet(fullText: string, queryToken: string, maxLength: number = 90): string {
  if (!fullText) return '';
  const lowerText = fullText.toLowerCase();
  const lowerToken = queryToken.toLowerCase();
  const idx = lowerText.indexOf(lowerToken);

  if (idx === -1) {
    // If not direct substring, return beginning
    return fullText.length > maxLength ? fullText.substring(0, maxLength).trim() + '...' : fullText;
  }

  const start = Math.max(0, idx - 25);
  const end = Math.min(fullText.length, idx + queryToken.length + 45);

  let snippet = fullText.substring(start, end).replace(/[\r\n\t]+/g, ' ').trim();
  if (start > 0) snippet = '...' + snippet;
  if (end < fullText.length) snippet = snippet + '...';

  return snippet;
}

/**
 * Evaluates fuzzy match between a target string and query tokens.
 * Returns score (0-100), fuzzy flag, fuzzy type.
 */
export function matchTokenFuzzy(
  target: string,
  queryVariations: string[]
): {
  isMatch: boolean;
  score: number;
  isFuzzy: boolean;
  fuzzyType?: 'exact' | 'prefix' | 'substring' | 'stem' | 'typo' | 'phonetic' | 'keyboard';
  matchedQueryVar?: string;
} {
  if (!target) return { isMatch: false, score: 0, isFuzzy: false };

  const normTarget = normalizeArchaicUkrainian(target);
  if (!normTarget) return { isMatch: false, score: 0, isFuzzy: false };

  let bestResult = {
    isMatch: false,
    score: 0,
    isFuzzy: false,
    fuzzyType: undefined as any,
    matchedQueryVar: undefined as string | undefined
  };

  const targetWords = normTarget.split(/[\s,.\-–—()]+/g).filter(w => w.length > 0);

  for (let qIdx = 0; qIdx < queryVariations.length; qIdx++) {
    const query = queryVariations[qIdx];
    const isKeyboardOrTranslit = qIdx > 0;
    const queryTokens = query.split(/[\s,.\-–—()]+/g).filter(w => w.length > 0);
    if (queryTokens.length === 0) continue;

    // 1. Direct whole-string match
    if (normTarget === query) {
      const score = isKeyboardOrTranslit ? 90 : 100;
      return {
        isMatch: true,
        score,
        isFuzzy: isKeyboardOrTranslit,
        fuzzyType: isKeyboardOrTranslit ? 'keyboard' : 'exact',
        matchedQueryVar: query
      };
    }

    // 2. Starts with whole query
    if (normTarget.startsWith(query)) {
      const score = isKeyboardOrTranslit ? 85 : 92;
      return {
        isMatch: true,
        score,
        isFuzzy: isKeyboardOrTranslit,
        fuzzyType: isKeyboardOrTranslit ? 'keyboard' : 'prefix',
        matchedQueryVar: query
      };
    }

    // 3. Substring of whole text
    if (normTarget.includes(query)) {
      const score = isKeyboardOrTranslit ? 75 : 82;
      if (score > bestResult.score) {
        bestResult = {
          isMatch: true,
          score,
          isFuzzy: isKeyboardOrTranslit,
          fuzzyType: isKeyboardOrTranslit ? 'keyboard' : 'substring',
          matchedQueryVar: query
        };
      }
    }

    // 4. Token-by-token comparison
    let allTokensMatched = true;
    let tokensScoreSum = 0;
    let anyFuzzy = isKeyboardOrTranslit;
    let currentFuzzyType: any = isKeyboardOrTranslit ? 'keyboard' : 'substring';

    for (const qToken of queryTokens) {
      let tokenMatched = false;
      let tokenBestScore = 0;
      let tokenFuzzy = false;
      let tokenFuzzyType: any = undefined;

      for (const tWord of targetWords) {
        // Direct word equality
        if (tWord === qToken) {
          tokenMatched = true;
          tokenBestScore = Math.max(tokenBestScore, 95);
          break;
        }

        // Word starts with query token (e.g. "Шевчен" in "Шевченко")
        if (tWord.startsWith(qToken)) {
          tokenMatched = true;
          tokenBestScore = Math.max(tokenBestScore, 85);
          tokenFuzzyType = 'prefix';
          break;
        }

        // Query token starts with word (e.g. Ukrainian declension "Шевченка" in "Шевченко")
        if (qToken.startsWith(tWord) && tWord.length >= 3) {
          tokenMatched = true;
          tokenBestScore = Math.max(tokenBestScore, 80);
          tokenFuzzy = true;
          tokenFuzzyType = 'stem';
          break;
        }

        // Word contains token
        if (tWord.includes(qToken)) {
          tokenMatched = true;
          tokenBestScore = Math.max(tokenBestScore, 75);
          tokenFuzzyType = 'substring';
          break;
        }

        // Suffix/Stem match for Ukrainian names
        if (qToken.length >= 4 && tWord.length >= 4) {
          const stemQ = qToken.slice(0, Math.min(qToken.length - 1, 5));
          const stemT = tWord.slice(0, Math.min(tWord.length - 1, 5));
          if (stemQ === stemT) {
            tokenMatched = true;
            tokenBestScore = Math.max(tokenBestScore, 70);
            tokenFuzzy = true;
            tokenFuzzyType = 'stem';
            break;
          }
        }

        // Phonetic surname root check
        if (qToken.length >= 4 && tWord.length >= 4) {
          const rootQ = extractUkrainianSurnameRoot(qToken);
          const rootT = extractUkrainianSurnameRoot(tWord);
          if (rootQ === rootT && rootQ.length >= 3) {
            tokenMatched = true;
            tokenBestScore = Math.max(tokenBestScore, 68);
            tokenFuzzy = true;
            tokenFuzzyType = 'phonetic';
            break;
          }
        }

        // Levenshtein Typo Tolerance
        if (qToken.length >= 3) {
          const dist = calculateLevenshteinDistance(qToken, tWord);
          const maxAllowedDist = qToken.length <= 4 ? 1 : 2;

          if (dist <= maxAllowedDist) {
            const sim = getLevenshteinSimilarity(qToken, tWord);
            const typoScore = Math.round(sim * 65);
            if (typoScore > tokenBestScore) {
              tokenMatched = true;
              tokenBestScore = typoScore;
              tokenFuzzy = true;
              tokenFuzzyType = 'typo';
            }
          }
        }
      }

      if (!tokenMatched) {
        allTokensMatched = false;
        break;
      }

      tokensScoreSum += tokenBestScore;
      if (tokenFuzzy) {
        anyFuzzy = true;
        if (!currentFuzzyType || currentFuzzyType === 'substring') {
          currentFuzzyType = tokenFuzzyType;
        }
      }
    }

    if (allTokensMatched && queryTokens.length > 0) {
      const avgScore = Math.round(tokensScoreSum / queryTokens.length);
      if (avgScore > bestResult.score) {
        bestResult = {
          isMatch: true,
          score: avgScore,
          isFuzzy: anyFuzzy,
          fuzzyType: currentFuzzyType || (isKeyboardOrTranslit ? 'keyboard' : 'exact'),
          matchedQueryVar: query
        };
      }
    }
  }

  return bestResult;
}

/**
 * Searches a single person against query variations across:
 * 1. Names
 * 2. Event Places
 * 3. Notes & Details
 */
export function searchPerson(person: Person, queryVariations: string[]): GlobalSearchResult | null {
  if (person.isDeleted) return null;

  const matches: SearchMatchDetail[] = [];

  // ==========================================
  // 1. NAMES SEARCH
  // ==========================================
  const given = person.name?.given || person.firstName || '';
  const surname = person.name?.surname || person.lastName || '';
  const patronymic = person.name?.patronymic || person.patronymic || '';
  const maiden = person.name?.maidenName || person.maidenName || '';
  const nick = (person.name as any)?.nick || (person as any)?.nickname || '';
  const fullName1 = [surname, given, patronymic].filter(Boolean).join(' ');
  const fullName2 = [given, patronymic, surname].filter(Boolean).join(' ');

  const nameFields: Array<{ label: string; text: string; baseScoreBonus: number }> = [
    { label: 'Повне ім\'я', text: fullName1, baseScoreBonus: 10 },
    { label: 'Повне ім\'я (пряме)', text: fullName2, baseScoreBonus: 10 },
    { label: 'Прізвище', text: surname, baseScoreBonus: 12 },
    { label: 'Ім\'я', text: given, baseScoreBonus: 8 },
    { label: 'По батькові', text: patronymic, baseScoreBonus: 5 },
    { label: 'Дівоче прізвище', text: maiden, baseScoreBonus: 12 },
    { label: 'Прізвисько / Псевдонім', text: nick, baseScoreBonus: 5 }
  ];

  if (Array.isArray(person.nameVariants)) {
    person.nameVariants.forEach((v, idx) => {
      nameFields.push({ label: `Варіант імені #${idx + 1}`, text: v, baseScoreBonus: 6 });
    });
  }
  if (Array.isArray(person.surnameVariants)) {
    person.surnameVariants.forEach((v, idx) => {
      nameFields.push({ label: `Варіант прізвища #${idx + 1}`, text: v, baseScoreBonus: 8 });
    });
  }

  for (const nf of nameFields) {
    if (!nf.text) continue;
    const match = matchTokenFuzzy(nf.text, queryVariations);
    if (match.isMatch) {
      matches.push({
        category: 'name',
        field: nf.label,
        matchedText: nf.text,
        isFuzzy: match.isFuzzy,
        fuzzyType: match.fuzzyType,
        score: Math.min(100, match.score + nf.baseScoreBonus)
      });
    }
  }

  // ==========================================
  // 2. EVENT PLACES SEARCH
  // ==========================================
  const placeFields: Array<{ label: string; text: string }> = [
    { label: 'Місце народження', text: person.birthPlace || '' },
    { label: 'Місце смерті', text: person.deathPlace || '' },
    { label: 'Місце шлюбу', text: person.marriagePlace || '' },
    { label: 'Місце проживання', text: person.residencePlace || '' }
  ];

  // Historical places
  if (Array.isArray(person.historicalPlaces)) {
    person.historicalPlaces.forEach((hp: HistoricalPlaceItem, idx) => {
      if (hp.modernPlace) {
        placeFields.push({ label: `Історичне місце (${hp.type || 'подія'})`, text: hp.modernPlace });
      }
      if (hp.historicalText) {
        placeFields.push({ label: `Історична назва місця`, text: hp.historicalText });
      }
    });
  }

  // Events life cycle places
  if (Array.isArray(person.events)) {
    person.events.forEach((ev: PersonLifeEventItem) => {
      if (ev.place) {
        const evTitle = ev.title || (ev.type === 'birth' ? 'Народження' : ev.type === 'death' ? 'Смерть' : ev.type === 'marriage' ? 'Шлюб' : 'Подія');
        placeFields.push({ label: `Місце події (${evTitle})`, text: ev.place });
      }
      if (ev.historicalPlace) {
        placeFields.push({ label: `Історичне місце події`, text: ev.historicalPlace });
      }
    });
  }

  for (const pf of placeFields) {
    if (!pf.text) continue;
    const match = matchTokenFuzzy(pf.text, queryVariations);
    if (match.isMatch) {
      matches.push({
        category: 'place',
        field: pf.label,
        matchedText: pf.text,
        isFuzzy: match.isFuzzy,
        fuzzyType: match.fuzzyType,
        score: match.score
      });
    }
  }

  // ==========================================
  // 3. NOTES & DETAILS SEARCH
  // ==========================================
  const noteFields: Array<{ label: string; text: string }> = [
    { label: 'Замітки', text: person.notes || '' },
    { label: 'Біографія', text: person.bio || '' },
    { label: 'Фах / Професія', text: person.occupation || '' },
    { label: 'Причина смерті', text: person.deathReason || '' },
    { label: 'Стан / Верства', text: person.estate || person.socialStatus || person.estateOrSocialStatus || '' },
    { label: 'Віросповідання', text: person.confession || '' },
    { label: 'Військове звання', text: person.militaryRank || '' }
  ];

  // Custom fields
  if (Array.isArray(person.customFields)) {
    person.customFields.forEach((cf: any) => {
      const label = cf.label || cf.key || 'Додаткове поле';
      if (cf.value) {
        noteFields.push({ label: `Поле: ${label}`, text: String(cf.value) });
      }
    });
  } else if (person.customFields && typeof person.customFields === 'object') {
    Object.entries(person.customFields).forEach(([k, v]) => {
      if (v) noteFields.push({ label: `Поле: ${k}`, text: String(v) });
    });
  }

  // Life event descriptions and notes
  if (Array.isArray(person.events)) {
    person.events.forEach((ev: PersonLifeEventItem) => {
      if (ev.description) {
        const evTitle = ev.title || 'Подія';
        noteFields.push({ label: `Опис події (${evTitle})`, text: ev.description });
      }
    });
  }

  // Source citations
  if (Array.isArray(person.sourceCitations)) {
    person.sourceCitations.forEach((cit, idx) => {
      if (cit) noteFields.push({ label: `Джерело #${idx + 1}`, text: cit });
    });
  }

  for (const nf of noteFields) {
    if (!nf.text) continue;
    const match = matchTokenFuzzy(nf.text, queryVariations);
    if (match.isMatch) {
      const snippet = extractHighlightSnippet(nf.text, match.matchedQueryVar || queryVariations[0]);
      matches.push({
        category: 'note',
        field: nf.label,
        matchedText: nf.text,
        highlightSnippet: snippet,
        isFuzzy: match.isFuzzy,
        fuzzyType: match.fuzzyType,
        score: match.score
      });
    }
  }

  if (matches.length === 0) return null;

  // Sort matches by score descending
  matches.sort((a, b) => b.score - a.score);
  const bestMatch = matches[0];

  const matchedCategories = {
    name: matches.some(m => m.category === 'name'),
    place: matches.some(m => m.category === 'place'),
    note: matches.some(m => m.category === 'note')
  };

  return {
    person,
    score: bestMatch.score,
    bestMatch,
    allMatches: matches,
    isFuzzy: bestMatch.isFuzzy,
    matchedCategories
  };
}

/**
 * Execute global search across all persons with category filtering
 */
export function executeGlobalTreeSearch(
  persons: Person[],
  query: string,
  categoryFilter: SearchCategory = 'all',
  options?: {
    maxResults?: number;
  }
): GlobalSearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const queryVariations = prepareQueryVariations(trimmed);
  if (queryVariations.length === 0) return [];

  const results: GlobalSearchResult[] = [];

  for (const person of persons) {
    const res = searchPerson(person, queryVariations);
    if (!res) continue;

    // Apply category filter if not 'all'
    if (categoryFilter !== 'all') {
      const hasCategoryMatch = res.allMatches.some(m => m.category === categoryFilter);
      if (!hasCategoryMatch) continue;

      // Re-evaluate best match for that category
      const catMatches = res.allMatches.filter(m => m.category === categoryFilter);
      catMatches.sort((a, b) => b.score - a.score);
      res.bestMatch = catMatches[0];
      res.score = catMatches[0].score;
    }

    results.push(res);
  }

  // Sort by score descending, then by importance (living/deceased, full name)
  results.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // Secondary sort: matches across multiple categories rank higher
    const aCatCount = (a.matchedCategories.name ? 1 : 0) + (a.matchedCategories.place ? 1 : 0) + (a.matchedCategories.note ? 1 : 0);
    const bCatCount = (b.matchedCategories.name ? 1 : 0) + (b.matchedCategories.place ? 1 : 0) + (b.matchedCategories.note ? 1 : 0);
    return bCatCount - aCatCount;
  });

  const max = options?.maxResults || 50;
  return results.slice(0, max);
}
