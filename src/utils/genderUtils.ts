/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Person, Gender, GenealogyDatabase, Family } from '../types';

/**
 * Normalizes any gender representation ('male', 'female', 'M', 'F', 'm', 'f', etc.)
 */
export function normalizeGender(gender?: string | null): 'male' | 'female' | 'other' | undefined {
  if (!gender) return undefined;
  const g = String(gender).trim().toLowerCase();
  if (['m', 'male', 'man', 'чол', 'чоловік', 'чоловіча', 'муж', 'мужской', '1'].includes(g)) {
    return 'male';
  }
  if (['f', 'female', 'woman', 'жін', 'жінка', 'жіноча', 'жен', 'женский', '2'].includes(g)) {
    return 'female';
  }
  if (['u', 'other', 'unknown', 'невідомо', 'інша'].includes(g)) {
    return 'other';
  }
  return undefined;
}

// Known male given names (Ukrainian, Slavic, Christian)
const KNOWN_MALE_NAMES = new Set([
  'іван', 'иван', 'петро', 'петр', 'василь', 'василий', 'михайло', 'михаил', 'микола', 'николай',
  'степан', 'олексій', 'алексей', 'андрій', 'андрей', 'володимир', 'владимир', 'сергій', 'сергей',
  'олександр', 'александр', 'дмитро', 'дмитрий', 'тарас', 'богдан', 'федір', 'федор', 'вадим',
  'яків', 'яков', 'павло', 'павел', 'семен', 'семён', 'григорій', 'григорий', 'максим', 'денис',
  'артем', 'артём', 'євген', 'евгений', 'віктор', 'виктор', 'юрій', 'юрий', 'анатолій', 'анатолий',
  'ігор', 'игорь', 'роман', 'олег', 'ярослав', 'костянтин', 'константин', 'віталій', 'виталий',
  'микита', 'никита', 'ілля', 'илья', 'лука', 'кузьма', 'хома', 'сава', 'савва', 'фока',
  'георгій', 'георгий', 'геннадій', 'геннадий', 'тимофій', 'тимофей', 'захар', 'назар', 'остап',
  'матвій', 'матвей', 'данило', 'данил', 'даниил', 'лев', 'леонід', 'леонид', 'валерій', 'валерий',
  'влад', 'владислав', 'святослав', 'ростислав', 'любомир', 'всеволод', 'тимур', 'гліб', 'глеб',
  'борис', 'антон', 'артур', 'руслан', 'станіслав', 'станислав', 'пилип', 'филипп', 'трохим', 'трофим',
  'карпо', 'панас', 'опанас', 'афанасий', 'абрам', 'авраам', 'кирило', 'кирилл', 'євдоким', 'евдоким',
  'прокіп', 'прокопий', 'прокофий', 'лазар', 'лукіян', 'лукиян', 'лукьян', 'киндрат', 'кондрат',
  'демид', 'сидір', 'сидор', 'єрофій', 'ерофей', 'юхим', 'ефим', 'йосип', 'осип', 'иосиф',
  'іпатій', 'іпат', 'ігнат', 'игнат', 'терентій', 'терентий', 'гаврило', 'гавриил', 'марко', 'марк',
  'арсен', 'арсеній', 'арсений', 'корній', 'корней', 'гордій', 'гордей', 'дем\'ян', 'демьян', 'улас',
  'влас', 'климентій', 'клим', 'модест', 'лаврентій', 'лаврентий', 'тихон', 'логвин', 'фрол',
  'микифор', 'никифор', 'євтихій', 'евтихий', 'євгеній', 'ян', 'юзеф', 'казимир', 'стась', 'влодек',
  'матфей', 'савелій', 'савелий', 'єлисей', 'елисей', 'гордей', 'прохор', 'фома', 'артемій', 'артемий'
]);

// Known female given names (Ukrainian, Slavic, Christian)
const KNOWN_FEMALE_NAMES = new Set([
  'євдокія', 'евдокия', 'ольга', 'меланія', 'мелания', 'ніна', 'нина', 'татьяна', 'тетяна', 'тетєна',
  'анна', 'ганна', 'марія', 'мария', 'олена', 'елена', 'катерина', 'екатерина', 'наталія', 'наталия',
  'наталья', 'софія', 'софия', 'дар\'я', 'дарья', 'дарина', 'варвара', 'параска', 'парасковія',
  'параскева', 'пелагія', 'пелагея', 'юлія', 'юлия', 'олександра', 'александра', 'євгенія', 'евгения',
  'анастасія', 'анастасия', 'вікторія', 'виктория', 'світлана', 'светлана', 'ірина', 'ирина',
  'людмила', 'надія', 'надежда', 'віра', 'вера', 'любов', 'любовь', 'галина', 'поліна', 'полина',
  'валентина', 'ярослава', 'владислава', 'мирослава', 'богдана', 'валерія', 'валерия', 'крістіна',
  'кристина', 'христина', 'діана', 'диана', 'аліна', 'алина', 'аліса', 'алиса', 'марина', 'інна',
  'инна', 'алла', 'жанна', 'тамара', 'раїса', 'раиса', 'лариса', 'зоя', 'оксана', 'ксенія', 'ксения',
  'василина', 'василиса', 'палажка', 'мотря', 'секлита', 'ярина', 'лукерія', 'лукерья', 'ликера',
  'степанида', 'стефанія', 'стефания', 'харитина', 'ялина', 'уляна', 'ульяна', 'ядвига', 'єлизавета',
  'елизавета', 'агафія', 'агафья', 'аглая', 'клавдія', 'клавдия', 'кіра', 'кира', 'маргарита',
  'лілія', 'лилия', 'елеонора', 'майя', 'сніжана', 'снежана', 'юліана', 'юлиана', 'мавра', 'єфросинія',
  'ефросинья', 'домнікія', 'домна', 'акулина', 'акилина', 'килина', 'горпина', 'грипина', 'хведора',
  'федора', 'матрена', 'матрьона', 'васса', 'гликерія', 'гликерия', 'лукія', 'лукия', 'соломія',
  'соломия', 'пріська', 'проня', 'улита', 'улита', 'нестина', 'нестия', 'фросина', 'харитя'
]);

// Exceptional male names ending in -a / -я / -о
const MALE_EXCEPTIONS = new Set([
  'микола', 'ілля', 'илья', 'лука', 'кузьма', 'хома', 'сава', 'савва', 'фока', 'микита', 'никита',
  'данко', 'лесь', 'ярема', 'кузьма', 'сашко', 'івась', 'гриць', 'дмитро', 'петро', 'павло', 'юрко'
]);

/**
 * Automatically infers gender from name components (given, patronymic, surname, maiden name)
 */
export function inferGenderFromName(
  givenName?: string | null,
  patronymic?: string | null,
  surname?: string | null,
  maidenName?: string | null
): 'male' | 'female' | undefined {
  // 1. Patronymic has absolute grammatical determinism
  if (patronymic && patronymic.trim()) {
    const pat = patronymic.trim().toLowerCase();
    // Male patronymics
    if (
      pat.endsWith('ович') ||
      pat.endsWith('евич') ||
      pat.endsWith('євич') ||
      pat.endsWith('ич') ||
      pat.endsWith('ыч') ||
      pat.endsWith('овичем') ||
      pat.endsWith('евичем')
    ) {
      return 'male';
    }
    // Female patronymics
    if (
      pat.endsWith('овна') ||
      pat.endsWith('евна') ||
      pat.endsWith('євна') ||
      pat.endsWith('івна') ||
      pat.endsWith('ївна') ||
      pat.endsWith('ична') ||
      pat.endsWith('ічна') ||
      pat.endsWith('ычна') ||
      pat.endsWith('овною') ||
      pat.endsWith('івною')
    ) {
      return 'female';
    }
  }

  // 2. Presence of maiden name indicates female
  if (maidenName && maidenName.trim()) {
    return 'female';
  }

  // 3. First / Given Name matching
  if (givenName && givenName.trim()) {
    // Extract first token if multiple words/initials
    const firstWord = givenName.trim().toLowerCase().split(/[\s,/-]+/)[0]?.replace(/[.]/g, '');
    if (firstWord) {
      if (KNOWN_FEMALE_NAMES.has(firstWord)) {
        return 'female';
      }
      if (KNOWN_MALE_NAMES.has(firstWord) || MALE_EXCEPTIONS.has(firstWord)) {
        return 'male';
      }

      // Ending heuristics for given name
      if (
        (firstWord.endsWith('ія') ||
          firstWord.endsWith('ия') ||
          firstWord.endsWith('на') ||
          firstWord.endsWith('ра') ||
          firstWord.endsWith('ла') ||
          firstWord.endsWith('та') ||
          firstWord.endsWith('да') ||
          firstWord.endsWith('са') ||
          firstWord.endsWith('ка') ||
          firstWord.endsWith('ва') ||
          firstWord.endsWith('ша') ||
          firstWord.endsWith('ля') ||
          firstWord.endsWith('ня') ||
          firstWord.endsWith('тя') ||
          firstWord.endsWith('а') ||
          firstWord.endsWith('я')) &&
        !MALE_EXCEPTIONS.has(firstWord)
      ) {
        return 'female';
      }

      if (
        firstWord.endsWith('ій') ||
        firstWord.endsWith('ий') ||
        firstWord.endsWith('ей') ||
        firstWord.endsWith('єй') ||
        firstWord.endsWith('о') ||
        firstWord.endsWith('ко') ||
        firstWord.endsWith('ло') ||
        firstWord.endsWith('сь') ||
        firstWord.endsWith('слав') ||
        firstWord.endsWith('мир') ||
        /[бвгґджзйклмнпрстфхцчшщ]$/.test(firstWord)
      ) {
        return 'male';
      }
    }
  }

  // 4. Surname endings
  if (surname && surname.trim()) {
    const s = surname.trim().toLowerCase().split(/[\s,/-]+/)[0];
    if (
      s.endsWith('ова') ||
      s.endsWith('ева') ||
      s.endsWith('єва') ||
      s.endsWith('ина') ||
      s.endsWith('їна') ||
      s.endsWith('ська') ||
      s.endsWith('цька') ||
      s.endsWith('зька') ||
      s.endsWith('ишина') ||
      s.endsWith('ішина')
    ) {
      return 'female';
    }
    if (
      s.endsWith('ов') ||
      s.endsWith('ев') ||
      s.endsWith('єв') ||
      s.endsWith('ин') ||
      s.endsWith('їн') ||
      s.endsWith('ський') ||
      s.endsWith('цький') ||
      s.endsWith('зький') ||
      s.endsWith('ишин') ||
      s.endsWith('ішин')
    ) {
      return 'male';
    }
  }

  return undefined;
}

/**
 * Master function to resolve the gender of a person object
 */
export function inferPersonGender(
  person?: Partial<Person> | null,
  allPersonsOrDatabase?: Record<string, Person> | Person[] | GenealogyDatabase | null
): 'male' | 'female' {
  if (!person) return 'male';

  // 1. Explicit normalized gender
  const explicit = normalizeGender(person.gender);
  if (explicit === 'male' || explicit === 'female') {
    return explicit;
  }

  // 2. Name-based inference
  const given = person.name?.given || person.firstName || '';
  const patronymic = person.name?.patronymic || person.patronymic || '';
  const surname = person.name?.surname || person.lastName || '';
  const maidenName = person.name?.maidenName || person.maidenName || '';

  const fromName = inferGenderFromName(given, patronymic, surname, maidenName);
  if (fromName) {
    return fromName;
  }

  // 3. Database / Family relations inference
  if (allPersonsOrDatabase && person.id) {
    const pId = person.id;

    // Check if database object with families
    if ((allPersonsOrDatabase as GenealogyDatabase).families) {
      const fams = (allPersonsOrDatabase as GenealogyDatabase).families;
      for (const fam of Object.values(fams)) {
        if (fam.husbandId === pId) return 'male';
        if (fam.wifeId === pId) return 'female';
      }
    }

    // Check if parent of someone
    const personsList = Array.isArray(allPersonsOrDatabase)
      ? allPersonsOrDatabase
      : (allPersonsOrDatabase as GenealogyDatabase).persons
      ? Object.values((allPersonsOrDatabase as GenealogyDatabase).persons)
      : typeof allPersonsOrDatabase === 'object'
      ? (Object.values(allPersonsOrDatabase) as Person[])
      : [];

    for (const other of personsList) {
      if (other.fatherId === pId) return 'male';
      if (other.motherId === pId) return 'female';
    }
  }

  // 4. Notes / Bio keywords
  const notesText = `${person.notes || ''} ${person.bio || ''}`.toLowerCase();
  if (
    notesText.includes('бабуся') ||
    notesText.includes('бабушка') ||
    notesText.includes('мати') ||
    notesText.includes('мать') ||
    notesText.includes('дружина') ||
    notesText.includes('жена') ||
    notesText.includes('дочка') ||
    notesText.includes('донька') ||
    notesText.includes('сестра') ||
    notesText.includes('народилася') ||
    notesText.includes('померла')
  ) {
    return 'female';
  }
  if (
    notesText.includes('дідусь') ||
    notesText.includes('дедушка') ||
    notesText.includes('батько') ||
    notesText.includes('отец') ||
    notesText.includes('чоловік') ||
    notesText.includes('муж') ||
    notesText.includes('син') ||
    notesText.includes('брат') ||
    notesText.includes('народився') ||
    notesText.includes('помер')
  ) {
    return 'male';
  }

  // Default fallback
  return 'male';
}

/**
 * Returns true if person is male (by explicit property or automatic name/relational inference)
 */
export function isPersonMale(
  person?: Partial<Person> | null,
  allPersonsOrDatabase?: Record<string, Person> | Person[] | GenealogyDatabase | null
): boolean {
  if (!person) return false;
  const norm = normalizeGender(person.gender);
  if (norm === 'male') return true;
  if (norm === 'female') return false;
  return inferPersonGender(person, allPersonsOrDatabase) === 'male';
}

/**
 * Returns true if person is female (by explicit property or automatic name/relational inference)
 */
export function isPersonFemale(
  person?: Partial<Person> | null,
  allPersonsOrDatabase?: Record<string, Person> | Person[] | GenealogyDatabase | null
): boolean {
  if (!person) return false;
  const norm = normalizeGender(person.gender);
  if (norm === 'female') return true;
  if (norm === 'male') return false;
  return inferPersonGender(person, allPersonsOrDatabase) === 'female';
}

/**
 * Resolves standard 1-character code ('M' | 'F')
 */
export function getPersonGenderCode(
  person?: Partial<Person> | null,
  allPersonsOrDatabase?: Record<string, Person> | Person[] | GenealogyDatabase | null
): 'M' | 'F' {
  return isPersonFemale(person, allPersonsOrDatabase) ? 'F' : 'M';
}

/**
 * Aliases for backwards compatibility & intuitive imports
 */
export const detectGenderFromName = inferGenderFromName;

export function getPersonGenderLabel(
  person?: Partial<Person> | null,
  allPersonsOrDatabase?: Record<string, Person> | Person[] | GenealogyDatabase | null
): { label: string; fullLabel: string; isMale: boolean; isFemale: boolean } {
  const isMale = isPersonMale(person, allPersonsOrDatabase);
  const isFemale = isPersonFemale(person, allPersonsOrDatabase);
  return {
    isMale,
    isFemale,
    label: isMale ? 'Чол' : isFemale ? 'Жін' : '—',
    fullLabel: isMale ? 'Чоловіча' : isFemale ? 'Жіноча' : 'Не вказано'
  };
}

export interface ParsedPersonName {
  given: string;
  surname: string;
  patronymic?: string;
}

/**
 * Parses full name string (e.g. from historical sources, metrics, godparents) into Given, Patronymic, and Surname
 */
export function parseFullNameComponents(rawInput: string): ParsedPersonName {
  const clean = rawInput.trim();
  if (!clean) return { given: '', surname: '' };

  const tokens = clean.split(/\s+/).filter(Boolean);
  if (tokens.length === 1) {
    const isGiven = KNOWN_MALE_NAMES.has(tokens[0].toLowerCase()) || KNOWN_FEMALE_NAMES.has(tokens[0].toLowerCase());
    return isGiven ? { given: tokens[0], surname: '' } : { given: '', surname: tokens[0] };
  }

  let patronymic: string | undefined;
  const remainingTokens: string[] = [];

  for (const token of tokens) {
    const tLower = token.toLowerCase();
    if (
      !patronymic &&
      (tLower.endsWith('ович') ||
        tLower.endsWith('евич') ||
        tLower.endsWith('євич') ||
        tLower.endsWith('ич') ||
        tLower.endsWith('івна') ||
        tLower.endsWith('евна') ||
        tLower.endsWith('ївна') ||
        tLower.endsWith('овна') ||
        tLower.endsWith('ична') ||
        tLower.endsWith('ічна'))
    ) {
      patronymic = token;
    } else {
      remainingTokens.push(token);
    }
  }

  if (remainingTokens.length === 0) {
    return { given: '', surname: '', patronymic };
  }

  if (remainingTokens.length === 1) {
    const isGiven = KNOWN_MALE_NAMES.has(remainingTokens[0].toLowerCase()) || KNOWN_FEMALE_NAMES.has(remainingTokens[0].toLowerCase());
    return isGiven
      ? { given: remainingTokens[0], surname: '', patronymic }
      : { given: '', surname: remainingTokens[0], patronymic };
  }

  // If 2 remaining tokens, check which one is the given name
  const t0Lower = remainingTokens[0].toLowerCase();
  const t1Lower = remainingTokens[1].toLowerCase();

  const is0Given = KNOWN_MALE_NAMES.has(t0Lower) || KNOWN_FEMALE_NAMES.has(t0Lower);
  const is1Given = KNOWN_MALE_NAMES.has(t1Lower) || KNOWN_FEMALE_NAMES.has(t1Lower);

  if (is0Given && !is1Given) {
    // "Іван Шевченко"
    return { given: remainingTokens[0], surname: remainingTokens[1], patronymic };
  }
  if (!is0Given && is1Given) {
    // "Шевченко Іван"
    return { given: remainingTokens[1], surname: remainingTokens[0], patronymic };
  }

  // Default: first token is Surname, second token is Given Name (Ukrainian metric records standard)
  return { surname: remainingTokens[0], given: remainingTokens.slice(1).join(' '), patronymic };
}


