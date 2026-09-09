/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Robust date parsing and validation utilities for Ukrainian & genealogical date records.
 * Supports:
 * - Simple years: "1850", "2026", "2030"
 * - DD.MM.YYYY: "15.04.1850", "01.01.2028"
 * - YYYY-MM-DD: "1850-04-15", "2029-12-31"
 * - DD/MM/YYYY or DD-MM-YYYY: "15/04/1850", "15-04-1850"
 * - Textual dates: "15 квітня 1850", "квітень 1850"
 * - Approximate dates: "бл. 1850", "до 1900", "після 1920", "близько 1880"
 */

const UKR_MONTHS: Record<string, number> = {
  'січ': 1, 'січня': 1, 'січень': 1,
  'лют': 2, 'лютого': 2, 'лютий': 2,
  'бер': 3, 'березня': 3, 'березень': 3,
  'квіт': 4, 'квітня': 4, 'квітень': 4,
  'трав': 5, 'травня': 5, 'травень': 5,
  'черв': 6, 'червня': 6, 'червень': 6,
  'лип': 7, 'липня': 7, 'липень': 7,
  'серп': 8, 'серпня': 8, 'серпень': 8,
  'вер': 9, 'вересня': 9, 'вересень': 9,
  'жовт': 10, 'жовтня': 10, 'жовтень': 10,
  'лист': 11, 'листопада': 11, 'листопад': 11,
  'груд': 12, 'грудня': 12, 'грудень': 12,
};

export interface ParsedDateInfo {
  raw: string;
  year?: number;
  month?: number; // 1-12
  day?: number;   // 1-31
  timestamp?: number;
  isApproximate?: boolean;
}

/**
 * Extracts year, month, and day from arbitrary genealogical date strings.
 */
export function parseGenealogyDate(value: string | undefined | null): ParsedDateInfo | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const isApproximate = /\b(бл|близько|після|до|прибл|ок|ок\.|ca|circa)\b/i.test(raw);

  // 1. Try ISO: YYYY-MM-DD
  const isoMatch = raw.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    const d = new Date(Date.UTC(year, month - 1, day));
    return { raw, year, month, day, timestamp: d.getTime(), isApproximate };
  }

  // 2. Try DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = raw.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(Date.UTC(year, month - 1, day));
    return { raw, year, month, day, timestamp: d.getTime(), isApproximate };
  }

  // 3. Try Ukrainian textual month (e.g. "15 квітня 1850" or "квітень 1850")
  const words = raw.toLowerCase().split(/\s+/);
  let foundMonth: number | undefined;
  for (const w of words) {
    const cleanWord = w.replace(/[^а-яіїєґ]/gi, '');
    for (const [mPrefix, mNum] of Object.entries(UKR_MONTHS)) {
      if (cleanWord.startsWith(mPrefix)) {
        foundMonth = mNum;
        break;
      }
    }
    if (foundMonth) break;
  }

  // Extract 4-digit year
  const yearMatch = raw.match(/\b(1\d{3}|20\d{2}|21\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;

  // Extract day if present with textual month
  let foundDay: number | undefined;
  if (foundMonth && year) {
    const dayMatch = raw.match(/\b([1-9]|[12]\d|3[01])\s+[а-яіїєґ]+/i);
    if (dayMatch) {
      foundDay = parseInt(dayMatch[1], 10);
    }
  }

  if (year !== undefined) {
    const m = foundMonth !== undefined ? foundMonth - 1 : 0;
    const d = foundDay !== undefined ? foundDay : 1;
    const timestamp = new Date(Date.UTC(year, m, d)).getTime();
    return {
      raw,
      year,
      month: foundMonth,
      day: foundDay,
      timestamp,
      isApproximate,
    };
  }

  return null;
}

export interface DateValidationResult {
  isValid: boolean;
  isFuture: boolean;
  message?: string;
}

/**
 * Checks whether a given date string is in the future.
 */
export function validateFutureDate(
  value: string | undefined | null,
  now: Date = new Date()
): DateValidationResult {
  if (!value || !value.trim()) {
    return { isValid: true, isFuture: false };
  }

  const parsed = parseGenealogyDate(value);
  if (!parsed || parsed.year === undefined) {
    return { isValid: true, isFuture: false };
  }

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  // If year is greater than current year
  if (parsed.year > currentYear) {
    return {
      isValid: false,
      isFuture: true,
      message: `Дата не може бути в майбутньому (${parsed.year} р. > ${currentYear} р.)`
    };
  }

  // If same year, check month and day if available
  if (parsed.year === currentYear) {
    if (parsed.month !== undefined) {
      if (parsed.month > currentMonth) {
        return {
          isValid: false,
          isFuture: true,
          message: `Дата не може бути в майбутньому (місяць ${parsed.month}.${parsed.year} ще не настав)`
        };
      }
      if (parsed.month === currentMonth && parsed.day !== undefined && parsed.day > currentDay) {
        return {
          isValid: false,
          isFuture: true,
          message: `Дата не може бути в майбутньому (${parsed.day}.${parsed.month}.${parsed.year} ще не настав)`
        };
      }
    }
  }

  return { isValid: true, isFuture: false };
}

export interface DeathBirthComparisonResult {
  isDeathBeforeBirth: boolean;
  message?: string;
  diffYears?: number;
}

/**
 * Validates that deathDate is NOT earlier than birthDate.
 */
export function compareBirthAndDeathDates(
  birthDateStr: string | undefined | null,
  deathDateStr: string | undefined | null
): DeathBirthComparisonResult {
  if (!birthDateStr || !deathDateStr) {
    return { isDeathBeforeBirth: false };
  }

  const bParsed = parseGenealogyDate(birthDateStr);
  const dParsed = parseGenealogyDate(deathDateStr);

  if (!bParsed || !dParsed || bParsed.year === undefined || dParsed.year === undefined) {
    return { isDeathBeforeBirth: false };
  }

  // 1. Year comparison
  if (dParsed.year < bParsed.year) {
    const diff = bParsed.year - dParsed.year;
    return {
      isDeathBeforeBirth: true,
      diffYears: diff,
      message: `Дата смерті (${dParsed.year} р.) на ${diff} ${diff === 1 ? 'рік' : diff < 5 ? 'роки' : 'років'} раніше за дату народження (${bParsed.year} р.)`
    };
  }

  // 2. Same year, compare precise timestamps if months or days are present
  if (dParsed.year === bParsed.year) {
    // If both have month
    if (dParsed.month !== undefined && bParsed.month !== undefined) {
      if (dParsed.month < bParsed.month) {
        return {
          isDeathBeforeBirth: true,
          message: `Дата смерті (місяць ${dParsed.month}) раніше за дату народження (місяць ${bParsed.month}) у тому ж ${bParsed.year} році`
        };
      }
      // Same month, compare days
      if (dParsed.month === bParsed.month && dParsed.day !== undefined && bParsed.day !== undefined) {
        if (dParsed.day < bParsed.day) {
          return {
            isDeathBeforeBirth: true,
            message: `Дата смерті (${dParsed.day}.${dParsed.month}.${dParsed.year}) раніше за дату народження (${bParsed.day}.${bParsed.month}.${bParsed.year})`
          };
        }
      }
    }
  }

  return { isDeathBeforeBirth: false };
}

export interface PersonDateAuditSummary {
  birthDateError?: string;
  deathDateError?: string;
  marriageDateError?: string;
  hasErrors: boolean;
  errorsList: string[];
}

/**
 * Validates birth, death and marriage dates for a person form.
 */
export function validatePersonFormDates(
  birthDate: string,
  deathDate: string,
  marriageDate: string,
  isLiving: boolean,
  now: Date = new Date()
): PersonDateAuditSummary {
  const errorsList: string[] = [];
  let birthDateError: string | undefined;
  let deathDateError: string | undefined;
  let marriageDateError: string | undefined;

  // 1. Check if birth date is in future
  const birthFutureCheck = validateFutureDate(birthDate, now);
  if (birthFutureCheck.isFuture) {
    birthDateError = birthFutureCheck.message || 'Дата народження вказує на майбутній час';
    errorsList.push(birthDateError);
  }

  // 2. If not living, validate death date
  if (!isLiving && deathDate && deathDate.trim()) {
    const deathFutureCheck = validateFutureDate(deathDate, now);
    if (deathFutureCheck.isFuture) {
      deathDateError = deathFutureCheck.message || 'Дата смерті не може бути в майбутньому';
      errorsList.push(deathDateError);
    }

    // Compare death vs birth
    if (birthDate && birthDate.trim()) {
      const cmp = compareBirthAndDeathDates(birthDate, deathDate);
      if (cmp.isDeathBeforeBirth) {
        deathDateError = cmp.message || 'Дата смерті не може бути раніше за дату народження';
        errorsList.push(deathDateError);
      }
    }
  }

  // 3. Marriage date check
  if (marriageDate && marriageDate.trim()) {
    const marriageFutureCheck = validateFutureDate(marriageDate, now);
    if (marriageFutureCheck.isFuture) {
      marriageDateError = marriageFutureCheck.message || 'Дата шлюбу не може бути в майбутньому';
      errorsList.push(marriageDateError);
    } else if (birthDate && birthDate.trim()) {
      const bParsed = parseGenealogyDate(birthDate);
      const mParsed = parseGenealogyDate(marriageDate);
      if (bParsed?.year !== undefined && mParsed?.year !== undefined) {
        if (mParsed.year < bParsed.year) {
          marriageDateError = `Дата шлюбу (${mParsed.year} р.) не може бути раніше за дату народження (${bParsed.year} р.)`;
          errorsList.push(marriageDateError);
        }
      }
    }
  }

  return {
    birthDateError,
    deathDateError,
    marriageDateError,
    hasErrors: errorsList.length > 0,
    errorsList,
  };
}

/**
 * Validates a life event date:
 * - Checks if event date is in the future
 * - Optional check if event date is before birth date
 */
export function validateLifeEventDate(
  eventDate: string | undefined | null,
  birthDate?: string | null,
  deathDate?: string | null,
  isLiving?: boolean,
  now: Date = new Date()
): { isFuture: boolean; message?: string; isBeforeBirth?: boolean; isAfterDeath?: boolean } {
  if (!eventDate || !eventDate.trim()) {
    return { isFuture: false };
  }

  const futureCheck = validateFutureDate(eventDate, now);
  if (futureCheck.isFuture) {
    return {
      isFuture: true,
      message: futureCheck.message || 'Дата події не може бути в майбутньому'
    };
  }

  const eParsed = parseGenealogyDate(eventDate);
  if (eParsed?.year !== undefined) {
    if (birthDate) {
      const bParsed = parseGenealogyDate(birthDate);
      if (bParsed?.year !== undefined && eParsed.year < bParsed.year) {
        return {
          isFuture: false,
          isBeforeBirth: true,
          message: `Дата події (${eParsed.year} р.) раніше за рік народження (${bParsed.year} р.)`
        };
      }
    }

    if (!isLiving && deathDate) {
      const dParsed = parseGenealogyDate(deathDate);
      if (dParsed?.year !== undefined && eParsed.year > dParsed.year + 1) {
        return {
          isFuture: false,
          isAfterDeath: true,
          message: `Дата події (${eParsed.year} р.) пізніше за рік смерті (${dParsed.year} р.)`
        };
      }
    }
  }

  return { isFuture: false };
}
