/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Specialized Ukrainian genealogical phonetics, Levenshtein distance,
 * and historical Slavic surname root matching algorithm.
 */

/**
 * Normalize Ukrainian surnames across genders into a canonical form
 * (e.g. Пірковський / Пірковська -> Пірковський, Шевченко -> Шевченко, Ковальський/Ковальська -> Ковальський, Іванов/Іванова -> Іванов, Болотний/Болотна -> Болотний)
 */
export function normalizeUkrainianSurnameGender(surname: string): string {
  if (!surname) return '';
  const trimmed = surname.trim();
  if (!trimmed) return '';

  const lower = trimmed.toLowerCase();

  // 1. Adjectival endings -ська / -цька / -зька -> -ський / -цький / -зький
  if (lower.endsWith('ська') && lower.length > 4) {
    const base = trimmed.slice(0, -4);
    return `${base}ський`;
  }
  if (lower.endsWith('цька') && lower.length > 4) {
    const base = trimmed.slice(0, -4);
    return `${base}цький`;
  }
  if (lower.endsWith('зька') && lower.length > 4) {
    const base = trimmed.slice(0, -4);
    return `${base}зький`;
  }

  // 1b. Plural rod endings -ські / -цькі / -зькі, -ських / -цьких / -зьких
  if ((lower.endsWith('ських') || lower.endsWith('цьких') || lower.endsWith('зьких')) && lower.length > 5) {
    const base = trimmed.slice(0, -5);
    const suffix = lower.endsWith('ських') ? 'ський' : lower.endsWith('цьких') ? 'цький' : 'зький';
    return `${base}${suffix}`;
  }
  if ((lower.endsWith('ські') || lower.endsWith('цькі') || lower.endsWith('зькі')) && lower.length > 4) {
    const base = trimmed.slice(0, -4);
    const suffix = lower.endsWith('ські') ? 'ський' : lower.endsWith('цькі') ? 'цький' : 'зький';
    return `${base}${suffix}`;
  }

  // 1c. Metric book / imperial forms without soft sign or archaic:
  // -скій / -цкій / -зкій, -ская / -цкая / -зкая, -ский / -цкий / -зкий
  if (lower.endsWith('ская') && lower.length > 4) {
    return `${trimmed.slice(0, -4)}ський`;
  }
  if (lower.endsWith('цкая') && lower.length > 4) {
    return `${trimmed.slice(0, -4)}цький`;
  }
  if (lower.endsWith('зкая') && lower.length > 4) {
    return `${trimmed.slice(0, -4)}зький`;
  }
  if (lower.endsWith('скій') && lower.length > 4) {
    return `${trimmed.slice(0, -4)}ський`;
  }
  if (lower.endsWith('цкій') && lower.length > 4) {
    return `${trimmed.slice(0, -4)}цький`;
  }
  if (lower.endsWith('зкій') && lower.length > 4) {
    return `${trimmed.slice(0, -4)}зький`;
  }
  if (lower.endsWith('ский') && lower.length > 4) {
    return `${trimmed.slice(0, -4)}ський`;
  }
  if (lower.endsWith('цкий') && lower.length > 4) {
    return `${trimmed.slice(0, -4)}цький`;
  }
  if (lower.endsWith('зкий') && lower.length > 4) {
    return `${trimmed.slice(0, -4)}зький`;
  }

  // 1d. Russian / metric masculine adjectival -ый -> -ий
  if (lower.endsWith('ый') && lower.length > 3) {
    const base = trimmed.slice(0, -2);
    return `${base}ий`;
  }

  // 1e. Other adjectival feminine endings -ая / -яя -> -ий / -ій
  if (lower.endsWith('ая') && lower.length > 3) {
    const base = trimmed.slice(0, -2);
    return `${base}ий`;
  }
  if (lower.endsWith('яя') && lower.length > 3) {
    const base = trimmed.slice(0, -2);
    return `${base}ій`;
  }

  // 1f. General Ukrainian feminine adjectival surnames ending in -а / -я:
  // -на (Болотна -> Болотний, Зелена -> Зелений, Чорна -> Чорний, Красна -> Красний, Піддубна -> Піддубний, Зарічна -> Зарічний)
  // -ла (Біла -> Білий, Тепла -> Теплий, Кругла -> Круглий, Світла -> Світлий)
  // -та (Багата -> Багатий, Свята -> Святий, Товста -> Товстий, Проста -> Простий)
  // -да (Руда -> Рудий, Молода -> Молодий)
  // -га (Довга -> Довгий)
  // -ка (Велика -> Великий)
  // -ха (Глуха -> Глухий, Суха -> Сухий)
  // -ра (Сіра -> Сірий, Стара -> Старий, Добра -> Добрий, Мудра -> Мудрий, Щира -> Щирий, Гостра -> Гострий, Хвора -> Хворий)
  // -ва (Польова -> Польовий, Лісова -> Лісовий, Чергова -> Черговий)
  // -ба (Ряба -> Рябий, Люба -> Любий)
  // Soft: -ня / -ля / -ря (Синя -> Синій, Верхня -> Верхній, Нижня -> Нижній)
  const adjectivalRegex = /([бвгґджзклмнпрстфхцчшщ])([ая])$/i;
  const adjMatch = lower.match(adjectivalRegex);
  if (adjMatch && lower.length > 3) {
    // Exclude patronymic endings like -ова / -єва / -іна / -ина which are handled in step 2
    if (!lower.endsWith('ова') && !lower.endsWith('єва') && !lower.endsWith('ева') && !lower.endsWith('іна') && !lower.endsWith('ина')) {
      const consonant = adjMatch[1];
      const ending = adjMatch[2];
      const base = trimmed.slice(0, -1);
      if (ending === 'я') {
        return `${base}ій`;
      } else {
        return `${base}ий`;
      }
    }
  }

  // 2. Patronymic / possessive endings -ова/-єва/-ева/-іна/-ина -> -ов/-єв/-ев/-ін/-ин
  if (lower.endsWith('ова') && lower.length > 3) {
    return trimmed.slice(0, -1);
  }
  if (lower.endsWith('єва') && lower.length > 3) {
    return trimmed.slice(0, -1);
  }
  if (lower.endsWith('ева') && lower.length > 3) {
    return trimmed.slice(0, -1);
  }
  if (lower.endsWith('іна') && lower.length > 3) {
    return trimmed.slice(0, -1);
  }
  if (lower.endsWith('ина') && lower.length > 3) {
    return trimmed.slice(0, -1);
  }

  // 3. -ишина / -ішина / -иха -> -ишин / -ішин / -их
  if ((lower.endsWith('ишина') || lower.endsWith('ішина') || lower.endsWith('иха')) && lower.length > 4) {
    if (lower.endsWith('ишина')) return `${trimmed.slice(0, -5)}ишин`;
    if (lower.endsWith('ішина')) return `${trimmed.slice(0, -5)}ішин`;
    if (lower.endsWith('иха')) return `${trimmed.slice(0, -3)}их`;
  }

  // 4. Return properly trimmed capitalized base form
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Format a canonical surname into an elegant rod / clan title
 * (e.g. "Пірковський" -> "Рід Пірковських", "Шевченко" -> "Рід Шевченків", "Іванов" -> "Рід Іванових")
 */
export function formatClanName(surname: string): string {
  if (!surname) return 'Рід';
  const clean = normalizeUkrainianSurnameGender(surname);
  if (!clean || clean === 'Рід') return 'Рід';

  const lower = clean.toLowerCase();

  // If already prefixed with "Рід"
  if (clean.startsWith('Рід ') || clean.startsWith('рід ')) {
    return clean;
  }

  // -ський / -цький / -зький -> -ських / -цьких / -зьких
  if (lower.endsWith('ський') && lower.length > 5) {
    return `Рід ${clean.slice(0, -5)}ських`;
  }
  if (lower.endsWith('цький') && lower.length > 5) {
    return `Рід ${clean.slice(0, -5)}цьких`;
  }
  if (lower.endsWith('зький') && lower.length > 5) {
    return `Рід ${clean.slice(0, -5)}зьких`;
  }
  if (lower.endsWith('ий') && lower.length > 3) {
    return `Рід ${clean.slice(0, -2)}их`;
  }
  if (lower.endsWith('ій') && lower.length > 3) {
    return `Рід ${clean.slice(0, -2)}іх`;
  }

  // -енко -> -енків
  if (lower.endsWith('енко') && lower.length > 4) {
    return `Рід ${clean.slice(0, -1)}ків`;
  }

  // -ов / -єв / -ев -> -ових / -євих / -евих
  if ((lower.endsWith('ов') || lower.endsWith('єв') || lower.endsWith('ев')) && lower.length > 3) {
    return `Рід ${clean}их`;
  }

  // -ін / -ин -> -іних / -иних
  if ((lower.endsWith('ін') || lower.endsWith('ин')) && lower.length > 3) {
    return `Рід ${clean}их`;
  }

  // -ук / -юк -> -уків / -юків
  if ((lower.endsWith('ук') || lower.endsWith('юк')) && lower.length > 3) {
    return `Рід ${clean}ів`;
  }

  // Default: Рід + canonical surname
  return `Рід ${clean}`;
}

/**
 * Check if two surnames are gender-equivalent or identical family roots
 */
export function areSurnamesEquivalent(surnameA: string, surnameB: string): boolean {
  if (!surnameA || !surnameB) return false;
  const cleanA = surnameA.replace(/^(?:Рід|рід|Сім'я|сім'я)\s+/i, '').trim();
  const cleanB = surnameB.replace(/^(?:Рід|рід|Сім'я|сім'я)\s+/i, '').trim();
  if (!cleanA || !cleanB) return false;
  if (cleanA.toLowerCase() === cleanB.toLowerCase()) return true;

  const normA = normalizeUkrainianSurnameGender(cleanA);
  const normB = normalizeUkrainianSurnameGender(cleanB);
  if (normA && normB && normA.toLowerCase() === normB.toLowerCase()) return true;

  // Check archaic Cyrillic normalization
  const archA = normalizeArchaicUkrainian(normA || cleanA).toLowerCase();
  const archB = normalizeArchaicUkrainian(normB || cleanB).toLowerCase();
  if (archA && archB && archA === archB) return true;

  // Check phonetic metric book equivalence: interchange 'и' and 'і' (e.g. Пирковський / Пірковський)
  const phonA = archA.replace(/и/g, 'і').replace(/е/g, 'є').replace(/ё/g, 'е').replace(/[ъь]$/, '');
  const phonB = archB.replace(/и/g, 'і').replace(/е/g, 'є').replace(/ё/g, 'е').replace(/[ъь]$/, '');
  if (phonA && phonB && phonA === phonB) return true;

  // Also check surname root stems
  const rootA = extractUkrainianSurnameRoot(cleanA);
  const rootB = extractUkrainianSurnameRoot(cleanB);
  if (rootA && rootB && rootA.length >= 4 && rootA === rootB) return true;

  return false;
}

/**
 * Normalizes Ukrainian settlement/location names by stripping administrative prefixes,
 * prepositions, parish/district tails, and grammatical locative declensions
 * (e.g. "м.Бердянськ", "у с. Чернечий Яр", "Чернечому Яру", "с. Базилівка (Полтавська губ.)", "смт. Опішня" -> clean standard name)
 */
export function normalizeUkrainianPlace(place: string): string {
  if (!place) return '';
  let p = place.trim();
  if (!p) return '';

  // 1. Remove quotes, surrounding punctuation, and noise
  p = p.replace(/^["'«»„“\s]+|["'«»„“\s]+$/g, '');

  // 2. Strip parish, district or county details in parentheses e.g. "Базилівка (Полтавський повіт)"
  p = p.replace(/\s*\([^)]*\)/g, '').trim();

  // 3. Strip trailing county / gubernia parts after comma if multiple parts e.g. "с. Базилівка, Диканський р-н"
  if (p.includes(',')) {
    const parts = p.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) {
      p = parts[0];
    }
  }

  // 4. Strip prepositions and administrative prefixes (case-insensitive, greedy)
  // "у селі", "в селі", "у с.", "в с.", "у місті", "в місті", "с.", "село", "селище", "смт", "м.", "хутір", etc.
  p = p.replace(/^(?:у\s+|в\s+|при\s+|біля\s+|коло\s+)/i, '');
  p = p.replace(/^(?:м\.|м\s+|місто\s+|місті\s+|гор\.\s*|г\.\s*|город\s+)/i, '');
  p = p.replace(/^(?:с\.|с\s+|село\s+|селі\s+|селище\s+|селищі\s+|пос\.\s*|поселок\s+|посьолок\s+)/i, '');
  p = p.replace(/^(?:смт\.|смт\s+|с\.м\.т\.\s*)/i, '');
  p = p.replace(/^(?:х\.|х\s+|хутір\s+|хуторі\s+|хутор\s+|хуторе\s+)/i, '');
  p = p.replace(/^(?:дер\.\s*|деревня\s+|деревне\s+|д\.\s*)/i, '');
  p = p.replace(/^(?:ст\.|ст\s+|станиця\s+|станиці\s+|станція\s+|станції\s+)/i, '');
  p = p.replace(/^(?:урочище\s+|ур\.\s*)/i, '');

  // Strip again in case of doubled prefix e.g. "м. с." or leftover punctuation
  p = p.replace(/^[.,\-–—\s]+/, '').replace(/[.,\-–—\s]+$/, '').trim();

  if (!p) return place.trim();

  // 5. Restore Ukrainian locative/dative inflections to nominative:
  // e.g. "Чернечому Яру" -> "Чернечий Яр"
  // e.g. "Базилівці" -> "Базилівка"
  // e.g. "Опішні" -> "Опішня"
  // e.g. "Бердянську" -> "Бердянськ"
  // e.g. "Полтаві" -> "Полтава"
  // e.g. "Києві" -> "Київ"
  // e.g. "Харкові" -> "Харків"
  const lower = p.toLowerCase();

  if (lower === 'чернечому яру' || lower === 'чернечим яром') {
    p = 'Чернечий Яр';
  } else if (lower === 'бердянську' || lower === 'бердянск') {
    p = 'Бердянськ';
  } else if (lower === 'мариуполь' || lower === 'маріуполі') {
    p = 'Маріуполь';
  } else if (lower === 'полтаві') {
    p = 'Полтава';
  } else if (lower === 'києві') {
    p = 'Київ';
  } else if (lower === 'харкові') {
    p = 'Харків';
  } else if (lower.endsWith('івці') && lower.length > 5) {
    // Базилівці -> Базилівка, Яремівці -> Яремівка
    p = `${p.slice(0, -4)}івка`;
  } else if (lower.endsWith('шні') && lower.length > 4) {
    // Опішні -> Опішня
    p = `${p.slice(0, -3)}шня`;
  }

  // Capitalize first character
  return p.charAt(0).toUpperCase() + p.slice(1);
}

/**
 * Check if two location/settlement names refer to the exact same place
 * (e.g. "с. Базилівка" and "Базилівка", "у с. Чернечий Яр" and "Чернечому Яру", "Бердянск" and "м. Бердянськ")
 */
export function arePlacesEquivalent(placeA: string, placeB: string): boolean {
  if (!placeA || !placeB) return false;
  const a = placeA.trim();
  const b = placeB.trim();
  if (!a || !b) return false;

  const normA = normalizeUkrainianPlace(a).toLowerCase();
  const normB = normalizeUkrainianPlace(b).toLowerCase();
  if (normA === normB) return true;

  const archA = normalizeArchaicUkrainian(normA);
  const archB = normalizeArchaicUkrainian(normB);
  if (archA === archB) return true;

  // Check substring containment if long enough (e.g. "Чернечий Яр" in "Чернечий Яр Полтавського повіту")
  if (archA.length >= 4 && archB.length >= 4) {
    if (archA.includes(archB) || archB.includes(archA)) return true;
    const sim = getLevenshteinSimilarity(archA, archB);
    if (sim >= 0.82) return true;
  }

  return false;
}

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

  // 1b. Canonical gender equivalence (e.g. Пірковський / Пірковська, Ковальський / Ковальська, Іванов / Іванова)
  if (areSurnamesEquivalent(surnameA, surnameB)) {
    return {
      isMatch: true,
      score: 98,
      reason: `Єдине родове прізвище (чоловіча/жіноча форма): «${surnameA}» та «${surnameB}»`
    };
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
