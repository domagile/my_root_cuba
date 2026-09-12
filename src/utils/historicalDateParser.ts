/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type DateModifier = 'EXACT' | 'ABT' | 'BEF' | 'AFT' | 'BET' | 'EST';

export interface HistoricalDateParseResult {
  raw: string;
  normalizedText: string;
  year?: number;
  month?: number;
  day?: number;
  modifier: DateModifier;
  modifierLabel?: string;
  isApproximate: boolean;
  calendarStyle?: 'julian' | 'gregorian' | 'unknown';
  convertedDate?: {
    targetStyle: 'julian' | 'gregorian';
    formattedText: string;
    day: number;
    month: number;
    year: number;
    offsetDays: number;
  };
}

const UKR_MONTH_NAMES = [
  'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'
];

const UKR_MONTH_MAP: Record<string, number> = {
  'січ': 1, 'січня': 1, 'січень': 1, 'янв': 1, 'января': 1,
  'лют': 2, 'лютого': 2, 'лютий': 2, 'фев': 2, 'февраля': 2,
  'бер': 3, 'березня': 3, 'березень': 3, 'мар': 3, 'марта': 3,
  'квіт': 4, 'квітня': 4, 'квітень': 4, 'апр': 4, 'апреля': 4,
  'трав': 5, 'травня': 5, 'травень': 5, 'май': 5, 'мая': 5,
  'черв': 6, 'червня': 6, 'червень': 6, 'июн': 6, 'июня': 6,
  'лип': 7, 'липня': 7, 'липень': 7, 'июл': 7, 'июля': 7,
  'серп': 8, 'серпня': 8, 'серпень': 8, 'авг': 8, 'августа': 8,
  'вер': 9, 'вересня': 9, 'вересень': 9, 'сен': 9, 'сентября': 9,
  'жовт': 10, 'жовтня': 10, 'жовтень': 10, 'окт': 10, 'октября': 10,
  'лист': 11, 'листопада': 11, 'листопад': 11, 'ноя': 11, 'ноября': 11,
  'груд': 12, 'грудня': 12, 'грудень': 12, 'дек': 12, 'декабря': 12,
};

/**
 * Calculates calendar offset between Julian and Gregorian calendar for a given year.
 * 1582–1700: +10 days
 * 1700–1800: +11 days
 * 1800–1900: +12 days
 * 1900–2100: +13 days
 */
export function getJulianToGregorianOffsetDays(year: number): number {
  if (year < 1700) return 10;
  if (year < 1800) return 11;
  if (year < 1900) return 12;
  return 13;
}

/**
 * Parses Ukrainian historical & genealogical date strings.
 * Handles:
 * - "близько 1845", "бл. 1850 р.", "ок. 1870" -> ABT
 * - "до 1914", "перед 1890", "раніше 1888" -> BEF
 * - "після 1861", "по 1917" -> AFT
 * - "між 1830 та 1835", "від 1840 до 1845" -> BET
 * - "12 жовтня 1888 за ст.ст.", "12.10.1888 ст.ст."
 * - "15.04.1892", "1892-04-15", "1880"
 */
export function parseHistoricalDate(input: string | undefined | null): HistoricalDateParseResult | null {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  let modifier: DateModifier = 'EXACT';
  let modifierLabel: string | undefined;
  let isApproximate = false;
  let calendarStyle: 'julian' | 'gregorian' | 'unknown' = 'unknown';

  // Check calendar annotations
  if (/\b(ст\.?\s*ст\.?|старий стиль|старим стилем|юліанськ)\b/i.test(raw)) {
    calendarStyle = 'julian';
  } else if (/\b(н\.?\s*ст\.?|новий стиль|новим стилем|григоріанськ)\b/i.test(raw)) {
    calendarStyle = 'gregorian';
  }

  // Detect modifiers
  if (/\b(бл\.?|близько|приблизно|прибл\.?|ок\.?|около|ca\.?|circa)\b/i.test(raw)) {
    modifier = 'ABT';
    modifierLabel = 'близько';
    isApproximate = true;
  } else if (/\b(до|раніше|перед|ранее|bef\.?|before)\b/i.test(raw)) {
    modifier = 'BEF';
    modifierLabel = 'до';
    isApproximate = true;
  } else if (/\b(після|пізніше|по|после|aft\.?|after)\b/i.test(raw)) {
    modifier = 'AFT';
    modifierLabel = 'після';
    isApproximate = true;
  } else if (/\b(між|від|от|между|bet\.?|between)\b/i.test(raw) && /\b(та|і|до|и|and)\b/i.test(raw)) {
    modifier = 'BET';
    modifierLabel = 'між';
    isApproximate = true;
  }

  // Clean text from modifiers for numeral extraction
  const clean = raw
    .replace(/\b(ст\.?\s*ст\.?|старий стиль|старим стилем|н\.?\s*ст\.?|новий стиль|новим стилем)\b/gi, '')
    .replace(/\b(бл\.?|близько|приблизно|прибл\.?|ок\.?|около|ca\.?|circa|до|раніше|перед|після|пізніше|по|ранее|после)\b/gi, '')
    .replace(/\b(р\.?|року|роках|г\.?|года|гг\.?)\b/gi, '')
    .trim();

  let year: number | undefined;
  let month: number | undefined;
  let day: number | undefined;

  // 1. Check DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{4})$/);
  if (dmyMatch) {
    day = parseInt(dmyMatch[1], 10);
    month = parseInt(dmyMatch[2], 10);
    year = parseInt(dmyMatch[3], 10);
  }

  // 2. Check ISO: YYYY-MM-DD
  if (!year) {
    const isoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
      year = parseInt(isoMatch[1], 10);
      month = parseInt(isoMatch[2], 10);
      day = parseInt(isoMatch[3], 10);
    }
  }

  // 3. Check textual date: "15 жовтня 1888" or "жовтень 1888"
  if (!year) {
    const textDateMatch = clean.match(/(?:(\d{1,2})\s+)?([а-яіїєьА-ЯІЇЄЬ]+)\s+(\d{4})/i);
    if (textDateMatch) {
      if (textDateMatch[1]) {
        day = parseInt(textDateMatch[1], 10);
      }
      const monthStr = textDateMatch[2].toLowerCase();
      for (const [prefix, mNum] of Object.entries(UKR_MONTH_MAP)) {
        if (monthStr.startsWith(prefix)) {
          month = mNum;
          break;
        }
      }
      year = parseInt(textDateMatch[3], 10);
    }
  }

  // 4. Fallback: single 4-digit year
  if (!year) {
    const yearMatch = clean.match(/\b(1\d{3}|20\d{2})\b/);
    if (yearMatch) {
      year = parseInt(yearMatch[1], 10);
    }
  }

  // Generate normalized representation
  let normalizedText = '';
  if (modifierLabel) {
    normalizedText += `${modifierLabel} `;
  }
  if (day && month && year) {
    const dStr = String(day).padStart(2, '0');
    const mStr = String(month).padStart(2, '0');
    normalizedText += `${dStr}.${mStr}.${year}`;
  } else if (month && year) {
    const mName = UKR_MONTH_NAMES[month - 1] || `${month}`;
    normalizedText += `${mName} ${year}`;
  } else if (year) {
    normalizedText += `${year} р.`;
  } else {
    normalizedText = raw;
  }

  if (calendarStyle === 'julian') {
    normalizedText += ' (ст. ст.)';
  } else if (calendarStyle === 'gregorian') {
    normalizedText += ' (н. ст.)';
  }

  // Calendar conversion helper if precise day, month and year exist
  let convertedDate: HistoricalDateParseResult['convertedDate'];
  if (day && month && year) {
    const offset = getJulianToGregorianOffsetDays(year);
    // If tagged or assumed Julian (typical for pre-1918 Ukraine / Russian Empire)
    const isCurrentlyJulian = calendarStyle === 'julian' || (calendarStyle === 'unknown' && year <= 1918);

    if (isCurrentlyJulian) {
      // Convert Julian -> Gregorian
      const julianEpoch = new Date(Date.UTC(year, month - 1, day));
      julianEpoch.setUTCDate(julianEpoch.getUTCDate() + offset);
      convertedDate = {
        targetStyle: 'gregorian',
        day: julianEpoch.getUTCDate(),
        month: julianEpoch.getUTCMonth() + 1,
        year: julianEpoch.getUTCFullYear(),
        formattedText: `${String(julianEpoch.getUTCDate()).padStart(2, '0')}.${String(julianEpoch.getUTCMonth() + 1).padStart(2, '0')}.${julianEpoch.getUTCFullYear()} (н. ст.)`,
        offsetDays: offset
      };
    } else {
      // Convert Gregorian -> Julian
      const gregEpoch = new Date(Date.UTC(year, month - 1, day));
      gregEpoch.setUTCDate(gregEpoch.getUTCDate() - offset);
      convertedDate = {
        targetStyle: 'julian',
        day: gregEpoch.getUTCDate(),
        month: gregEpoch.getUTCMonth() + 1,
        year: gregEpoch.getUTCFullYear(),
        formattedText: `${String(gregEpoch.getUTCDate()).padStart(2, '0')}.${String(gregEpoch.getUTCMonth() + 1).padStart(2, '0')}.${gregEpoch.getUTCFullYear()} (ст. ст.)`,
        offsetDays: -offset
      };
    }
  }

  return {
    raw,
    normalizedText,
    year,
    month,
    day,
    modifier,
    modifierLabel,
    isApproximate,
    calendarStyle,
    convertedDate
  };
}
