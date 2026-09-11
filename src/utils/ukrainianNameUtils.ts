/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Specialized Ukrainian genealogical patronymic generator, surname gender inflection,
 * and contextual inheritance for family tree building.
 */

import { Gender, Person } from '../types';
import { normalizeUkrainianSurnameGender } from './ukrainianPhonetics';

// Special irregular Ukrainian male given name bases for patronymics
const IRREGULAR_MALE_PATRONYMICS: Record<
  string,
  { male: string; female: string; altMale?: string; altFemale?: string }
> = {
  // Імена на -а / -я
  'микола': { male: 'Миколайович', female: 'Миколаївна', altMale: 'Миколович', altFemale: 'Миколівна' },
  'николай': { male: 'Николайович', female: 'Николаївна' },
  'ілля': { male: 'Ілліч', female: 'Іллівна', altMale: 'Ілльович' },
  'илья': { male: 'Ильич', female: 'Ильевна', altMale: 'Ілліч' },
  'кузьма': { male: 'Кузьмич', female: 'Кузьмівна', altMale: 'Кузьмович' },
  'лука': { male: 'Лукич', female: 'Луківна', altMale: 'Лукович' },
  'сава': { male: 'Савич', female: 'Савівна', altMale: 'Савович' },
  'савва': { male: 'Саввич', female: 'Саввівна', altMale: 'Саввович' },
  'хома': { male: 'Хомич', female: 'Хомівна', altMale: 'Хомович' },
  'фома': { male: 'Фомич', female: 'Фомівна', altMale: 'Фомович' },
  'ярема': { male: 'Яремович', female: 'Яремівна' },
  'микита': { male: 'Микитович', female: 'Микитівна' },
  'никита': { male: 'Никитович', female: 'Никитівна' },

  // Специфічні чергування
  'яків': { male: 'Якович', female: 'Яківна' },
  'яков': { male: 'Якович', female: 'Яківна' },
  'лев': { male: 'Львович', female: 'Львівна' },
  'григорій': { male: 'Григорович', female: 'Григорівна', altMale: 'Григорійович', altFemale: 'Григоріївна' },
  'григорий': { male: 'Григорович', female: 'Григорівна' },
  'ігор': { male: 'Ігорович', female: 'Ігорівна', altMale: 'Ігоревич' },
  'игорь': { male: 'Игоревич', female: 'Игоревна' },
  'лазар': { male: 'Лазарович', female: 'Лазарівна' },

  // Імена на -ій / -ий / -ей
  'андрій': { male: 'Андрійович', female: 'Андріївна' },
  'андрей': { male: 'Андреевич', female: 'Андреевна', altMale: 'Андрійович', altFemale: 'Андріївна' },
  'сергій': { male: 'Сергійович', female: 'Сергіївна' },
  'сергей': { male: 'Сергеевич', female: 'Сергеевна', altMale: 'Сергійович', altFemale: 'Сергіївна' },
  'олексій': { male: 'Олексійович', female: 'Олексіївна' },
  'алексей': { male: 'Алексеевич', female: 'Алексеевна', altMale: 'Олексійович', altFemale: 'Олексіївна' },
  'юрій': { male: 'Юрійович', female: 'Юріївна' },
  'юрий': { male: 'Юрьевич', female: 'Юрьевна', altMale: 'Юрійович', altFemale: 'Юріївна' },
  'матвій': { male: 'Матвійович', female: 'Матвіївна' },
  'матвей': { male: 'Матвеевич', female: 'Матвеевна' },
  'тимофій': { male: 'Тимофійович', female: 'Тимофіївна' },
  'тимофей': { male: 'Тимофеевич', female: 'Тимофеевна' },
  'анатолій': { male: 'Анатолійович', female: 'Анатоліївна' },
  'анатолий': { male: 'Анатольевич', female: 'Анатольевна' },
  'валерій': { male: 'Валерійович', female: 'Валеріївна' },
  'валерий': { male: 'Валерьевич', female: 'Валерьевна' },
  'віталій': { male: 'Віталійович', female: 'Віталіївна' },
  'виталий': { male: 'Витальевич', female: 'Витальевна' },
  'василь': { male: 'Васильович', female: 'Василівна' },
  'василий': { male: 'Васильевич', female: 'Васильевна' },
  'геннадій': { male: 'Геннадійович', female: 'Геннадіївна' },
  'георгій': { male: 'Георгійович', female: 'Георгіївна' },
  'гордій': { male: 'Гордійович', female: 'Гордіївна' },
  'корній': { male: 'Корнійович', female: 'Корніївна' },
  'арсеній': { male: 'Арсенійович', female: 'Арсеніївна' },
  'євгеній': { male: 'Євгенійович', female: 'Євгеніївна' },
  'евгений': { male: 'Евгеньевич', female: 'Евгеньевна' },
  'євген': { male: 'Євгенович', female: 'Євгенівна' },

  // Традиційні народні / релігійні форми
  'іван': { male: 'Іванович', female: 'Іванівна' },
  'иван': { male: 'Иванович', female: 'Ивановна' },
  'петро': { male: 'Петрович', female: 'Петрівна' },
  'петр': { male: 'Петрович', female: 'Петровна' },
  'михайло': { male: 'Михайлович', female: 'Михайлівна' },
  'михаил': { male: 'Михайлович', female: 'Михайловна' },
  'павло': { male: 'Павлович', female: 'Павлівна' },
  'павел': { male: 'Павлович', female: 'Павловна' },
  'данило': { male: 'Данилович', female: 'Данилівна' },
  'даниил': { male: 'Данилович', female: 'Данилівна' },
  'дмитро': { male: 'Дмитрович', female: 'Дмитрівна' },
  'дмитрий': { male: 'Дмитриевич', female: 'Дмитриевна' },
  'федір': { male: 'Федорович', female: 'Федорівна' },
  'федор': { male: 'Федорович', female: 'Федоровна' },
  'марко': { male: 'Маркович', female: 'Марківна' },
  'карпо': { male: 'Карпович', female: 'Карпівна' },
  'гаврило': { male: 'Гаврилович', female: 'Гаврилівна' },
  'клим': { male: 'Климович', female: 'Климівна' },
  'дем\'ян': { male: 'Дем\'янович', female: 'Дем\'янівна' },
  'лук\'ян': { male: 'Лук\'янович', female: 'Лук\'янівна' }
};

/**
 * Capitalizes first letter of string
 */
function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Generates Ukrainian patronymic (по батькові) from father's given name.
 * 
 * @param fatherGivenName Father's first name (e.g. "Іван", "Петро", "Василь", "Сергій")
 * @param childGender 'male' or 'female'
 * @returns Patronymic string (e.g. "Іванович" or "Іванівна")
 */
export function generateUkrainianPatronymic(
  fatherGivenName?: string | null,
  childGender: Gender | string = 'male'
): string {
  if (!fatherGivenName) return '';
  const raw = fatherGivenName.trim();
  if (!raw) return '';

  // Extract first word if compound name (e.g. "Іван Павло" -> "Іван")
  const firstWord = raw.split(/[\s,/-]+/)[0].replace(/[.]/g, '');
  if (!firstWord) return '';

  const lower = firstWord.toLowerCase();
  const isFemale = childGender === 'female' || childGender === 'F';

  // 1. Check irregular dictionary
  if (IRREGULAR_MALE_PATRONYMICS[lower]) {
    const entry = IRREGULAR_MALE_PATRONYMICS[lower];
    return isFemale ? entry.female : entry.male;
  }

  // 2. Regular morphological derivation rules in Ukrainian
  // Names ending in vowel -о (Михайло, Петро, Павло, Данило, Дмитро): stem drops -о
  if (lower.endsWith('о')) {
    const stem = firstWord.slice(0, -1);
    if (isFemale) {
      return `${capitalize(stem)}івна`;
    } else {
      return `${capitalize(stem)}ович`;
    }
  }

  // Names ending in -ій / -ий / -ей / -єй (Сергій, Андрій, Валерій):
  if (lower.endsWith('ій') || lower.endsWith('ий') || lower.endsWith('ей') || lower.endsWith('єй')) {
    const stem = firstWord.slice(0, -1); // drops 'й', keeps 'і'/'е'
    if (isFemale) {
      return `${capitalize(stem)}ївна`;
    } else {
      return `${capitalize(stem)}йович`;
    }
  }

  // Names ending in consonant + 'ь' (Василь, Олесь, Івась):
  if (lower.endsWith('ь')) {
    const stem = firstWord.slice(0, -1);
    if (isFemale) {
      return `${capitalize(stem)}івна`;
    } else {
      return `${capitalize(stem)}ьович`;
    }
  }

  // Names ending in -а / -я after consonant (Микита, Сава, Ярема):
  if (lower.endsWith('а') || lower.endsWith('я')) {
    const stem = firstWord.slice(0, -1);
    if (isFemale) {
      return `${capitalize(stem)}івна`;
    } else {
      return `${capitalize(stem)}ович`;
    }
  }

  // Names ending in hard consonant (Іван, Роман, Степан, Богдан, Тарас, Володимир, Ярослав, Максим):
  if (isFemale) {
    return `${capitalize(firstWord)}івна`;
  } else {
    return `${capitalize(firstWord)}ович`;
  }
}

/**
 * Adapts Ukrainian surname for a specific gender (e.g. for a daughter inheriting father's surname).
 * 
 * Rules:
 * - Daughter (female):
 *   -ський -> -ська, -цький -> -цька, -зький -> -зька
 *   -ов -> -ова, -ев/-єв -> -ева/-єва
 *   -ін -> -іна, -ин -> -ина
 *   Adjectival: -ий -> -а (Білий -> Біла, Чорний -> Чорна), -ій -> -я (Синій -> Синя)
 *   Invariable: -енко, -ук, -юк, -ак, -як, -ич, -ець, consonant (Шевченко, Коваль, Кравчук) -> remain unchanged
 * - Son (male):
 *   Normalizes feminine forms back to masculine base (-ська -> -ський, -ова -> -ов, etc.)
 */
export function adaptUkrainianSurnameForGender(
  surname?: string | null,
  targetGender: Gender | string = 'male'
): string {
  if (!surname) return '';
  const trimmed = surname.trim();
  if (!trimmed) return '';

  const isFemale = targetGender === 'female' || targetGender === 'F';
  const lower = trimmed.toLowerCase();

  if (isFemale) {
    // 1. Adjectival -ський / -цький / -зький -> -ська / -цька / -зька
    if (lower.endsWith('ський') && lower.length > 5) {
      return `${trimmed.slice(0, -5)}ська`;
    }
    if (lower.endsWith('цький') && lower.length > 5) {
      return `${trimmed.slice(0, -5)}цька`;
    }
    if (lower.endsWith('зький') && lower.length > 5) {
      return `${trimmed.slice(0, -5)}зька`;
    }

    // Metric / archaic Russian forms: -ский, -цкий, -зкий -> -ська / -цька / -зька
    if (lower.endsWith('ский') && lower.length > 4) {
      return `${trimmed.slice(0, -4)}ська`;
    }
    if (lower.endsWith('цкий') && lower.length > 4) {
      return `${trimmed.slice(0, -4)}цька`;
    }
    if (lower.endsWith('зкий') && lower.length > 4) {
      return `${trimmed.slice(0, -4)}зька`;
    }

    // 2. Patronymic / possessive surnames: -ов -> -ова, -єв -> -єва, -ев -> -ева
    if (lower.endsWith('ов') && lower.length > 2) {
      return `${trimmed}а`;
    }
    if (lower.endsWith('єв') && lower.length > 2) {
      return `${trimmed}а`;
    }
    if (lower.endsWith('ев') && lower.length > 2) {
      return `${trimmed}а`;
    }

    // 3. Surnames in -ін / -ин (e.g. Пушкін -> Пушкіна, Романин -> Романина)
    // Note: ensure we don't accidentally match common invariant roots if they are not patronymic
    if ((lower.endsWith('ін') || lower.endsWith('ин') || lower.endsWith('їн')) && lower.length > 3) {
      // Common exceptions that don't take -а (e.g. Литвин stays Литвин or Литвинка; but in formal records usually Литвин or Литвина)
      return `${trimmed}а`;
    }

    // 4. Adjectival masculine surnames in -ий / -ій
    // Exclude patronymic -ий like in some fixed nouns
    if (lower.endsWith('ий') && lower.length > 3) {
      return `${trimmed.slice(0, -2)}а`;
    }
    if (lower.endsWith('ій') && lower.length > 3) {
      return `${trimmed.slice(0, -2)}я`;
    }
    if (lower.endsWith('ый') && lower.length > 3) {
      return `${trimmed.slice(0, -2)}а`;
    }

    // 5. If already ends with feminine marker, return as-is
    if (
      lower.endsWith('ська') ||
      lower.endsWith('цька') ||
      lower.endsWith('зька') ||
      lower.endsWith('ова') ||
      lower.endsWith('єва') ||
      lower.endsWith('ева') ||
      lower.endsWith('іна') ||
      lower.endsWith('ина')
    ) {
      return trimmed;
    }

    // 6. Invariable in Ukrainian feminine grammar:
    // -енко, -ук, -юк, -як, -ак, -ич, -ець, -ко, or consonant ending (Шевченко, Коваль, Ткачук, Бойко)
    return trimmed;
  } else {
    // Target is male -> normalize feminine endings to canonical masculine form
    return normalizeUkrainianSurnameGender(trimmed);
  }
}

/**
 * Result of parent context inheritance
 */
export interface ParentContextInheritance {
  suggestedLastName?: string;
  suggestedPatronymic?: string;
  suggestedBranch?: string;
  suggestedBirthPlace?: string;
  suggestedResidencePlace?: string;
  suggestedEstate?: string;
  suggestedConfession?: string;
  fatherName?: string;
  motherName?: string;
}

/**
 * Computes suggested context (adapted surname, patronymic, branch, location, social status)
 * from father and mother persons for a newly created child.
 */
export function inheritContextFromParents(options: {
  father?: Person | null;
  mother?: Person | null;
  childGender: Gender | string;
}): ParentContextInheritance {
  const { father, mother, childGender } = options;
  const result: ParentContextInheritance = {};

  const fatherFirst = father?.name?.given || father?.firstName || '';
  const fatherLast = father?.name?.surname || father?.lastName || '';
  const motherLast = mother?.name?.surname || mother?.lastName || '';

  if (father) {
    result.fatherName = `${fatherLast} ${fatherFirst}`.trim() || 'Батько';
  }
  if (mother) {
    const motherFirst = mother?.name?.given || mother?.firstName || '';
    result.motherName = `${motherLast} ${motherFirst}`.trim() || 'Мати';
  }

  // 1. Surname inheritance & gender adaptation
  const sourceSurname = fatherLast || motherLast;
  if (sourceSurname) {
    result.suggestedLastName = adaptUkrainianSurnameForGender(sourceSurname, childGender);
  }

  // 2. Patronymic generation from father's given name
  if (fatherFirst) {
    result.suggestedPatronymic = generateUkrainianPatronymic(fatherFirst, childGender);
  }

  // 3. Research Branch inheritance: Father branch has priority, then Mother branch
  const fatherBranch = father?.researchBranch;
  const motherBranch = mother?.researchBranch;
  if (fatherBranch && fatherBranch !== 'Без прив\'язки' && fatherBranch.trim()) {
    result.suggestedBranch = fatherBranch;
  } else if (motherBranch && motherBranch !== 'Без прив\'язки' && motherBranch.trim()) {
    result.suggestedBranch = motherBranch;
  }

  // 4. Places inheritance (birth place or residence place from parents)
  const place =
    father?.residencePlace ||
    father?.birthPlace ||
    mother?.residencePlace ||
    mother?.birthPlace;
  if (place && place.trim()) {
    result.suggestedBirthPlace = place.trim();
    result.suggestedResidencePlace = place.trim();
  }

  // 5. Estate / Social status (стан)
  const estate = father?.estateOrSocialStatus || father?.estate || mother?.estateOrSocialStatus || mother?.estate;
  if (estate && estate.trim()) {
    result.suggestedEstate = estate.trim();
  }

  // 6. Confession (віросповідання)
  const confession = father?.confession || mother?.confession;
  if (confession && confession.trim()) {
    result.suggestedConfession = confession.trim();
  }

  return result;
}
