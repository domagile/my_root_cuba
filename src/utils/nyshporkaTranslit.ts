/**
 * Нишпорка: Історична та архівна нормалізація тексту для пошуку прізвищ у скорописі XVIII–XIX ст.
 * Портовано з nyshporka.utils.translit та nyshporka.matching
 */

// Польські та румунські діакритики -> ASCII наближення
const PL_DIACRITICS: Record<string, string> = {
  ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n',
  ó: 'u', ś: 's', ż: 'z', ź: 'z',
  Ą: 'a', Ć: 'c', Ę: 'e', Ł: 'l', Ń: 'n',
  Ó: 'u', Ś: 's', Ż: 'z', Ź: 'z',
  ș: 's', ş: 's', ț: 't', ţ: 't',
  ă: 'a', â: 'a', î: 'i',
  Ș: 's', Ş: 's', Ț: 't', Ţ: 't',
  Ă: 'a', Â: 'a', Î: 'i'
};

const PL_DIGRAPHS: [string, string][] = [
  ['szcz', 'sc'],
  ['sz', 's'],
  ['cz', 'c'],
  ['rz', 'r'],
  ['schi', 'ski'],
  ['sche', 'ske'],
  ['ghe', 'ge'],
  ['ghi', 'gi'],
  ['ch', 'h']
];

const CYR_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', ґ: 'g', д: 'd',
  е: 'e', є: 'e', ё: 'e', ж: 'z', з: 'z',
  и: 'i', і: 'i', ы: 'i', ї: 'i', й: 'i',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h',
  ц: 'c', ч: 'c', ш: 's', щ: 'sc',
  ъ: '', ь: '', э: 'e', ю: 'u', я: 'a',
  y: 'i', w: 'v'
};

// Історичні літери (ять ѣ, фіта ѳ, іжиця ѵ, дзело ѕ, омега ѡ) та часті плутанини рушія HTR
const ARCHIVAL_FOLD_MAP: Record<string, string> = {
  ...CYR_MAP,
  'ѣ': 'e',
  'ѳ': 'f',
  'ѵ': 'i',
  'ѕ': 'z',
  'ѡ': 'o',
  'q': 'g',
  '9': 'g',
  '0': 'o'
};

export function normalizeForMatching(text: string): string {
  if (!text) return '';
  let s = text.toLowerCase();
  
  // Replace polish diacritics
  s = s.replace(/[ąćęłńóśżźĄĆĘŁŃÓŚŻŹșşțţăâîȘŞȚŢĂÂÎ]/g, (m) => PL_DIACRITICS[m] || m);

  // Apply digraphs if has z or h
  if (s.includes('z') || s.includes('h')) {
    for (const [src, dst] of PL_DIGRAPHS) {
      s = s.replaceAll(src, dst);
    }
  }

  // Replace Cyrillic and historical letters
  let res = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ARCHIVAL_FOLD_MAP[ch] !== undefined) {
      res += ARCHIVAL_FOLD_MAP[ch];
    } else {
      res += ch;
    }
  }

  // Normalize common archival surname endings:
  // e.g. -skago, -skomu, -skim, -ski -> -ski
  let normalized = res.replace(/\s+/g, ' ').trim();
  normalized = normalized.replace(/sk(ii|ogo|ago|omu|im|ij|y|iy|i)\b/g, 'ski');

  return normalized;
}

/**
 * Оцінка схожості двох рядків з урахуванням історичної орфографії (0..1)
 * Підтримує пошук окремих слів або словосполучень усередині цілого рядка рукопису.
 */
export function historicalFuzzyScore(query: string, target: string): number {
  const nQ = normalizeForMatching(query);
  const nT = normalizeForMatching(target);
  
  if (!nQ || !nT) return 0;
  if (nT.includes(nQ)) return 1.0;
  if (nQ.includes(nT)) return 0.95;

  const targetTokens = nT.split(/[^a-z0-9]+/).filter(t => t.length > 1);
  const queryTokens = nQ.split(/[^a-z0-9]+/).filter(t => t.length > 1);

  if (targetTokens.length === 0 || queryTokens.length === 0) {
    const dist = levenshtein(nQ, nT);
    const maxLen = Math.max(nQ.length, nT.length);
    return maxLen === 0 ? 1.0 : Math.max(0, 1.0 - dist / maxLen);
  }

  // Single word search inside multi-word target
  if (queryTokens.length === 1) {
    const qToken = queryTokens[0];
    let bestScore = 0;

    for (const token of targetTokens) {
      if (token === qToken) return 1.0;
      if (token.includes(qToken) || qToken.includes(token)) {
        const minL = Math.min(token.length, qToken.length);
        const maxL = Math.max(token.length, qToken.length);
        if (minL >= 4 && minL / maxL >= 0.7) {
          bestScore = Math.max(bestScore, 0.92);
          continue;
        }
      }
      const dist = levenshtein(qToken, token);
      const maxL = Math.max(qToken.length, token.length);
      const score = 1.0 - dist / maxL;
      if (score > bestScore) bestScore = score;
    }

    return Math.max(0, Math.min(1, bestScore));
  }

  // Multi-word phrase search: sliding window over target tokens
  const windowSize = queryTokens.length;
  let bestPhraseScore = 0;

  for (let i = 0; i <= targetTokens.length - windowSize; i++) {
    const windowSlice = targetTokens.slice(i, i + windowSize).join(' ');
    const dist = levenshtein(nQ, windowSlice);
    const maxL = Math.max(nQ.length, windowSlice.length);
    const score = 1.0 - dist / maxL;
    if (score > bestPhraseScore) bestPhraseScore = score;
    if (bestPhraseScore >= 0.95) break;
  }

  return Math.max(0, Math.min(1, bestPhraseScore));
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}
