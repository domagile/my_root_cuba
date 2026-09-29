import { GenealogyDatabase, Person, Family } from '../types/genealogy';
import { areGivenNamesEquivalent, arePatronymicsEquivalent } from '../../utils/duplicateDetector';
import { areSurnamesBilingualEquivalent, arePlacesEquivalent } from '../../utils/ukrainianPhonetics';

export interface MatchedPersonRecord {
  existingPerson: Person;
  incomingPerson: Person;
  matchReason: string;
  enrichedFields: string[];
}

export type ConflictFieldKey =
  | 'firstName'
  | 'lastName'
  | 'patronymic'
  | 'maidenName'
  | 'gender'
  | 'birthDate'
  | 'birthYear'
  | 'birthPlace'
  | 'deathDate'
  | 'deathYear'
  | 'deathPlace'
  | 'deathReason'
  | 'burialDate'
  | 'burialPlace'
  | 'occupation'
  | 'residencePlace'
  | 'notes'
  | 'father'
  | 'mother';

export interface FieldConflict {
  fieldKey: ConflictFieldKey;
  label: string;
  existingValue: string;
  incomingValue: string;
  category: 'names' | 'birth' | 'death' | 'details' | 'notes' | 'parents';
}

export interface PersonConflictRecord {
  personId: string; // existing person ID
  personName: string;
  incomingId: string;
  conflicts: FieldConflict[];
}

export type ConflictResolutionChoice = 'keep_existing' | 'take_incoming' | 'combine';

/**
 * personId -> { [fieldKey]: 'keep_existing' | 'take_incoming' | 'combine' }
 */
export type ConflictResolutions = Record<string, Record<string, ConflictResolutionChoice>>;

export interface MergeAnalysis {
  matchedPersons: MatchedPersonRecord[];
  newPersons: Person[];
  conflicts: PersonConflictRecord[];
  totalConflictsCount: number;
  totalIncoming: number;
  totalExisting: number;
  idMapping: Record<string, string>; // incomingId -> targetId (existing or new)
}

export interface ResolvedFieldConflictItem {
  fieldKey: ConflictFieldKey;
  label: string;
  existingValue: string;
  incomingValue: string;
  chosenResolution: ConflictResolutionChoice;
  finalValue: string;
}

export interface ResolvedPersonConflictRecord {
  personId: string; // existing person ID
  personName: string;
  incomingId?: string;
  birthYear?: number | string;
  conflicts: ResolvedFieldConflictItem[];
}

export interface ImportHistorySession {
  id: string;
  timestamp: string; // ISO string
  fileName?: string;
  importType: 'merge' | 'replace';
  totalIncomingCount: number;
  matchedCount: number; // Кількість злитих записів
  newPersonsCount: number; // Кількість доданих осіб
  conflictsResolvedCount: number;
  familiesMergedCount?: number;
  familiesAddedCount?: number;
  resolvedPersonsWithConflicts: ResolvedPersonConflictRecord[]; // Список осіб, що вимагали ручного вирішення конфліктів
}

export interface MergeResult {
  database: GenealogyDatabase;
  matchedCount: number;
  newPersonsCount: number;
  conflictsResolvedCount: number;
  familiesMergedCount: number;
  familiesAddedCount: number;
  resolvedPersonsWithConflicts: ResolvedPersonConflictRecord[];
}

/**
 * Normalizes text for genealogical comparison:
 * Strips whitespace, lowercases, standardizes Ukrainian apostrophes and symbols
 */
export function normalizeNameForComparison(name: string | undefined | null): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[`'’ʼ]/g, "'")
    .replace(/[«»""()]/g, '')
    .trim();
}

/**
 * Extracts a 4-digit integer year from a date string or number
 */
export function extractYear(value: string | number | undefined | null): number | null {
  if (!value) return null;
  if (typeof value === 'number') {
    return value >= 1000 && value <= 2100 ? value : null;
  }
  const match = String(value).match(/\b(1\d{3}|20\d{2})\b/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Compares two years with optional tolerance
 */
function yearsMatch(y1: number | null, y2: number | null, tolerance = 1): boolean {
  if (!y1 || !y2) return false;
  return Math.abs(y1 - y2) <= tolerance;
}

/**
 * Checks if incoming person matches an existing person based on:
 * 1. Full name (First, Last, Patronymic / Maiden name)
 * 2. Birth year (exact or ±1-2 years)
 * 3. Death year (exact or ±1 year)
 * 4. Or exact three-part name when year is unavailable
 */
export function findBestPersonMatch(
  incoming: Person,
  existingList: Person[]
): { person: Person; matchReason: string } | null {
  const incGiven = normalizeNameForComparison(incoming.firstName || incoming.name?.given);
  const incSurname = normalizeNameForComparison(incoming.lastName || incoming.name?.surname);
  const incPatronymic = normalizeNameForComparison(incoming.patronymic || incoming.name?.patronymic);
  const incMaiden = normalizeNameForComparison(incoming.maidenName || incoming.name?.maidenName);

  if (!incGiven || incGiven === 'невідомо' || incGiven === 'unknown') {
    return null;
  }

  const incBirthYear = extractYear(incoming.birthYear || incoming.birthDate);
  const incDeathYear = extractYear(incoming.deathYear || incoming.deathDate);

  for (const existing of existingList) {
    const extGiven = normalizeNameForComparison(existing.firstName || existing.name?.given);
    const extSurname = normalizeNameForComparison(existing.lastName || existing.name?.surname);
    const extPatronymic = normalizeNameForComparison(existing.patronymic || existing.name?.patronymic);
    const extMaiden = normalizeNameForComparison(existing.maidenName || existing.name?.maidenName);

    // 1. Check given name match (strict or phonetic/variant equivalence)
    const givenEquiv = areGivenNamesEquivalent(incGiven, extGiven);
    const givenMatches = incGiven === extGiven || givenEquiv.isMatch;
    if (!givenMatches) continue;

    // 2. Check surname or maiden name match (cross-checking maiden with married surnames across languages)
    const surnameMatches =
      areSurnamesBilingualEquivalent(incSurname, extSurname) ||
      areSurnamesBilingualEquivalent(incMaiden, extMaiden) ||
      areSurnamesBilingualEquivalent(incSurname, extMaiden) ||
      areSurnamesBilingualEquivalent(incMaiden, extSurname);

    if (!surnameMatches && (incSurname || extSurname)) {
      continue;
    }

    const extBirthYear = extractYear(existing.birthYear || existing.birthDate);
    const extDeathYear = extractYear(existing.deathYear || existing.deathDate);
    const isPatrMatch = incPatronymic && extPatronymic && arePatronymicsEquivalent(incPatronymic, extPatronymic);

    // Check shared relatives (children or spouses)
    const incChildren = incoming.childrenIds || [];
    const extChildren = existing.childrenIds || [];
    const hasSharedChild = incChildren.some(cId => extChildren.includes(cId));

    const incSpouses = incoming.spouseIds || [];
    const extSpouses = existing.spouseIds || [];
    const hasSharedSpouse = incSpouses.some(sId => extSpouses.includes(sId));

    if (hasSharedChild) {
      return {
        person: existing,
        matchReason: `Спільні діти та збіг ПІБ (укр/рос): ${incoming.lastName || ''} ${incoming.firstName || ''}`
      };
    }

    if (hasSharedSpouse) {
      return {
        person: existing,
        matchReason: `Спільне подружжя та збіг ПІБ (укр/рос): ${incoming.lastName || ''} ${incoming.firstName || ''}`
      };
    }

    // Both have identical married surname AND identical maiden name
    if (
      incMaiden && extMaiden && areSurnamesBilingualEquivalent(incMaiden, extMaiden) &&
      incSurname && extSurname && areSurnamesBilingualEquivalent(incSurname, extSurname)
    ) {
      return {
        person: existing,
        matchReason: `Повний збіг імені, шлюбного та дівочого прізвища (${incoming.lastName} [${incoming.maidenName}] ${incoming.firstName})`
      };
    }

    // Check Birth Year
    if (incBirthYear && extBirthYear) {
      if (yearsMatch(incBirthYear, extBirthYear, 1)) {
        const reason = isPatrMatch
          ? `ПІБ (з урахуванням укр/рос написання) та рік народження (${incBirthYear}) збігаються`
          : `Ім'я, прізвище (укр/рос) та рік народження (${incBirthYear}) збігаються`;
        return { person: existing, matchReason: reason };
      }
      if (yearsMatch(incBirthYear, extBirthYear, 2) && isPatrMatch) {
        return {
          person: existing,
          matchReason: `ПІБ (укр/рос) та приблизний рік народження (${incBirthYear} ≈ ${extBirthYear})`
        };
      }
    }

    // Check Death Year if birth years are missing
    if (!incBirthYear && !extBirthYear && incDeathYear && extDeathYear) {
      if (yearsMatch(incDeathYear, extDeathYear, 1)) {
        return {
          person: existing,
          matchReason: `Ім'я, прізвище (укр/рос) та рік смерті (${incDeathYear}) збігаються`
        };
      }
    }

    // Check exact three-part Ukrainian/Russian name (Прізвище + Ім'я + По батькові)
    if (isPatrMatch && surnameMatches) {
      // If one has birth year and other does not, or neither does
      if (!incBirthYear || !extBirthYear) {
        return {
          person: existing,
          matchReason: `Повний збіг ПІБ (укр/рос): ${incoming.lastName || ''} ${incoming.firstName || ''} ${incoming.patronymic || ''}`
        };
      }
    }

    // If one has birth year and the other does not, but given & surname match, and no conflicting death dates
    if ((!incBirthYear || !extBirthYear) && surnameMatches && givenMatches && (incSurname || incMaiden)) {
      if (!incDeathYear || !extDeathYear || yearsMatch(incDeathYear, extDeathYear, 1)) {
        return {
          person: existing,
          matchReason: `Збіг імені та прізвища (${incoming.lastName || ''} ${incoming.firstName || ''})`
        };
      }
    }
  }

  return null;
}

/**
 * Analyzes fields that can be enriched/merged into an existing person
 */
export function detectEnrichedFields(existing: Person, incoming: Person): string[] {
  const fields: string[] = [];

  const extBirthDate = existing.birthDate || (existing.birthYear ? String(existing.birthYear) : '');
  const incBirthDate = incoming.birthDate || (incoming.birthYear ? String(incoming.birthYear) : '');
  if (!extBirthDate && incBirthDate) fields.push('Дата/рік народження');
  if (!existing.birthPlace && incoming.birthPlace) fields.push('Місце народження');

  const extDeathDate = existing.deathDate || (existing.deathYear ? String(existing.deathYear) : '');
  const incDeathDate = incoming.deathDate || (incoming.deathYear ? String(incoming.deathYear) : '');
  if (!extDeathDate && incDeathDate) fields.push('Дата/рік смерті');
  if (!existing.deathPlace && incoming.deathPlace) fields.push('Місце смерті');
  if (!existing.deathReason && incoming.deathReason) fields.push('Причина смерті');

  if (!existing.burialDate && incoming.burialDate) fields.push('Дата поховання');
  if (!existing.burialPlace && incoming.burialPlace) fields.push('Місце поховання');

  if (!existing.patronymic && incoming.patronymic) fields.push('По батькові');
  if (!existing.maidenName && incoming.maidenName) fields.push('Дівоче прізвище');
  if (!existing.occupation && incoming.occupation) fields.push('Рід занять / професія');
  if (!existing.residencePlace && incoming.residencePlace) fields.push('Місце проживання');

  if (incoming.notes && (!existing.notes || !existing.notes.includes(incoming.notes.trim().slice(0, 30)))) {
    fields.push('Біографічні нотатки');
  }

  if (!existing.fatherId && incoming.fatherId) fields.push("Зв'язок з батьком");
  if (!existing.motherId && incoming.motherId) fields.push("Зв'язок з матір'ю");

  const extChildren = existing.childrenIds || [];
  const incChildren = incoming.childrenIds || [];
  if (incChildren.some((c) => !extChildren.includes(c))) {
    fields.push('Діти');
  }

  const extSpouses = existing.spouseIds || [];
  const incSpouses = incoming.spouseIds || [];
  if (incSpouses.some((s) => !extSpouses.includes(s))) {
    fields.push('Подружжя');
  }

  return fields;
}

/**
 * Detects conflicts where both existing and incoming have non-empty but different values
 */
export function detectConflicts(
  existing: Person,
  incoming: Person,
  idMapping: Record<string, string>,
  existingPersonsMap: Record<string, Person>,
  incomingPersonsMap: Record<string, Person>
): FieldConflict[] {
  const conflicts: FieldConflict[] = [];

  // 1. Birth Place
  const extBirthPlace = String(existing.birthPlace || '').trim();
  const incBirthPlace = String(incoming.birthPlace || '').trim();
  if (
    extBirthPlace &&
    incBirthPlace &&
    normalizeNameForComparison(extBirthPlace) !== normalizeNameForComparison(incBirthPlace)
  ) {
    if (!arePlacesEquivalent(extBirthPlace, incBirthPlace)) {
      conflicts.push({
        fieldKey: 'birthPlace',
        label: 'Місце народження',
        existingValue: extBirthPlace,
        incomingValue: incBirthPlace,
        category: 'birth'
      });
    }
  }

  // 2. Birth Date / Year
  const extBirthDate = String(existing.birthDate || '').trim();
  const incBirthDate = String(incoming.birthDate || '').trim();
  const extBirthYear = extractYear(existing.birthYear || existing.birthDate);
  const incBirthYear = extractYear(incoming.birthYear || incoming.birthDate);

  if (extBirthDate && incBirthDate && extBirthDate !== incBirthDate) {
    if (extBirthYear && incBirthYear && extBirthYear !== incBirthYear) {
      conflicts.push({
        fieldKey: 'birthDate',
        label: 'Дата/рік народження',
        existingValue: extBirthDate || String(extBirthYear),
        incomingValue: incBirthDate || String(incBirthYear),
        category: 'birth'
      });
    } else if (
      normalizeNameForComparison(extBirthDate) !== normalizeNameForComparison(incBirthDate) &&
      !extBirthDate.includes(incBirthDate) &&
      !incBirthDate.includes(extBirthDate)
    ) {
      conflicts.push({
        fieldKey: 'birthDate',
        label: 'Дата народження',
        existingValue: extBirthDate,
        incomingValue: incBirthDate,
        category: 'birth'
      });
    }
  } else if (!extBirthDate && !incBirthDate && extBirthYear && incBirthYear && extBirthYear !== incBirthYear) {
    conflicts.push({
      fieldKey: 'birthYear',
      label: 'Рік народження',
      existingValue: String(extBirthYear),
      incomingValue: String(incBirthYear),
      category: 'birth'
    });
  }

  // 3. Death Place
  const extDeathPlace = String(existing.deathPlace || '').trim();
  const incDeathPlace = String(incoming.deathPlace || '').trim();
  if (
    extDeathPlace &&
    incDeathPlace &&
    normalizeNameForComparison(extDeathPlace) !== normalizeNameForComparison(incDeathPlace)
  ) {
    if (!arePlacesEquivalent(extDeathPlace, incDeathPlace)) {
      conflicts.push({
        fieldKey: 'deathPlace',
        label: 'Місце смерті',
        existingValue: extDeathPlace,
        incomingValue: incDeathPlace,
        category: 'death'
      });
    }
  }

  // 4. Death Date / Year
  const extDeathDate = String(existing.deathDate || '').trim();
  const incDeathDate = String(incoming.deathDate || '').trim();
  const extDeathYear = extractYear(existing.deathYear || existing.deathDate);
  const incDeathYear = extractYear(incoming.deathYear || incoming.deathDate);

  if (extDeathDate && incDeathDate && extDeathDate !== incDeathDate) {
    if (extDeathYear && incDeathYear && extDeathYear !== incDeathYear) {
      conflicts.push({
        fieldKey: 'deathDate',
        label: 'Дата/рік смерті',
        existingValue: extDeathDate || String(extDeathYear),
        incomingValue: incDeathDate || String(incDeathYear),
        category: 'death'
      });
    } else if (
      normalizeNameForComparison(extDeathDate) !== normalizeNameForComparison(incDeathDate) &&
      !extDeathDate.includes(incDeathDate) &&
      !incDeathDate.includes(extDeathDate)
    ) {
      conflicts.push({
        fieldKey: 'deathDate',
        label: 'Дата смерті',
        existingValue: extDeathDate,
        incomingValue: incDeathDate,
        category: 'death'
      });
    }
  } else if (!extDeathDate && !incDeathDate && extDeathYear && incDeathYear && extDeathYear !== incDeathYear) {
    conflicts.push({
      fieldKey: 'deathYear',
      label: 'Рік смерті',
      existingValue: String(extDeathYear),
      incomingValue: String(incDeathYear),
      category: 'death'
    });
  }

  // 5. Death Reason
  const extDeathReason = String(existing.deathReason || '').trim();
  const incDeathReason = String(incoming.deathReason || '').trim();
  if (
    extDeathReason &&
    incDeathReason &&
    normalizeNameForComparison(extDeathReason) !== normalizeNameForComparison(incDeathReason)
  ) {
    conflicts.push({
      fieldKey: 'deathReason',
      label: 'Причина смерті',
      existingValue: extDeathReason,
      incomingValue: incDeathReason,
      category: 'death'
    });
  }

  // 6. Burial Place
  const extBurialPlace = String(existing.burialPlace || '').trim();
  const incBurialPlace = String(incoming.burialPlace || '').trim();
  if (
    extBurialPlace &&
    incBurialPlace &&
    normalizeNameForComparison(extBurialPlace) !== normalizeNameForComparison(incBurialPlace)
  ) {
    conflicts.push({
      fieldKey: 'burialPlace',
      label: 'Місце поховання',
      existingValue: extBurialPlace,
      incomingValue: incBurialPlace,
      category: 'death'
    });
  }

  // 7. Burial Date
  const extBurialDate = String(existing.burialDate || '').trim();
  const incBurialDate = String(incoming.burialDate || '').trim();
  if (
    extBurialDate &&
    incBurialDate &&
    normalizeNameForComparison(extBurialDate) !== normalizeNameForComparison(incBurialDate)
  ) {
    conflicts.push({
      fieldKey: 'burialDate',
      label: 'Дата поховання',
      existingValue: extBurialDate,
      incomingValue: incBurialDate,
      category: 'death'
    });
  }

  // 8. Occupation
  const extOccupation = String(existing.occupation || '').trim();
  const incOccupation = String(incoming.occupation || '').trim();
  if (
    extOccupation &&
    incOccupation &&
    normalizeNameForComparison(extOccupation) !== normalizeNameForComparison(incOccupation)
  ) {
    conflicts.push({
      fieldKey: 'occupation',
      label: 'Рід занять / професія',
      existingValue: extOccupation,
      incomingValue: incOccupation,
      category: 'details'
    });
  }

  // 9. Residence Place
  const extResidence = String(existing.residencePlace || '').trim();
  const incResidence = String(incoming.residencePlace || '').trim();
  if (
    extResidence &&
    incResidence &&
    normalizeNameForComparison(extResidence) !== normalizeNameForComparison(incResidence)
  ) {
    conflicts.push({
      fieldKey: 'residencePlace',
      label: 'Місце проживання',
      existingValue: extResidence,
      incomingValue: incResidence,
      category: 'details'
    });
  }

  // 10. First Name
  const extFirst = String(existing.firstName || existing.name?.given || '').trim();
  const incFirst = String(incoming.firstName || incoming.name?.given || '').trim();
  if (
    extFirst &&
    incFirst &&
    extFirst !== 'Невідомо' &&
    incFirst !== 'Невідомо' &&
    normalizeNameForComparison(extFirst) !== normalizeNameForComparison(incFirst)
  ) {
    if (!areGivenNamesEquivalent(extFirst, incFirst).isMatch) {
      conflicts.push({
        fieldKey: 'firstName',
        label: "Ім'я",
        existingValue: extFirst,
        incomingValue: incFirst,
        category: 'names'
      });
    }
  }

  // 11. Last Name
  const extLast = String(existing.lastName || existing.name?.surname || '').trim();
  const incLast = String(incoming.lastName || incoming.name?.surname || '').trim();
  if (
    extLast &&
    incLast &&
    normalizeNameForComparison(extLast) !== normalizeNameForComparison(incLast)
  ) {
    if (!areSurnamesBilingualEquivalent(extLast, incLast)) {
      conflicts.push({
        fieldKey: 'lastName',
        label: 'Прізвище',
        existingValue: extLast,
        incomingValue: incLast,
        category: 'names'
      });
    }
  }

  // 12. Patronymic
  const extPatr = String(existing.patronymic || existing.name?.patronymic || '').trim();
  const incPatr = String(incoming.patronymic || incoming.name?.patronymic || '').trim();
  if (
    extPatr &&
    incPatr &&
    normalizeNameForComparison(extPatr) !== normalizeNameForComparison(incPatr)
  ) {
    if (!arePatronymicsEquivalent(extPatr, incPatr)) {
      conflicts.push({
        fieldKey: 'patronymic',
        label: 'По батькові',
        existingValue: extPatr,
        incomingValue: incPatr,
        category: 'names'
      });
    }
  }

  // 13. Maiden Name
  const extMaiden = String(existing.maidenName || existing.name?.maidenName || '').trim();
  const incMaiden = String(incoming.maidenName || incoming.name?.maidenName || '').trim();
  if (
    extMaiden &&
    incMaiden &&
    normalizeNameForComparison(extMaiden) !== normalizeNameForComparison(incMaiden)
  ) {
    if (!areSurnamesBilingualEquivalent(extMaiden, incMaiden)) {
      conflicts.push({
        fieldKey: 'maidenName',
        label: 'Дівоче прізвище',
        existingValue: extMaiden,
        incomingValue: incMaiden,
        category: 'names'
      });
    }
  }

  // 14. Gender
  if (existing.gender && incoming.gender && existing.gender !== incoming.gender) {
    const genderLabels: Record<string, string> = { male: 'Чоловіча', female: 'Жіноча', other: 'Інша' };
    conflicts.push({
      fieldKey: 'gender',
      label: 'Стать',
      existingValue: genderLabels[existing.gender] || existing.gender,
      incomingValue: genderLabels[incoming.gender] || incoming.gender,
      category: 'names'
    });
  }

  // 15. Notes
  const extNotes = String(existing.notes || '').trim();
  const incNotes = String(incoming.notes || '').trim();
  if (
    extNotes &&
    incNotes &&
    extNotes !== incNotes &&
    !extNotes.includes(incNotes.slice(0, 40)) &&
    !incNotes.includes(extNotes.slice(0, 40))
  ) {
    conflicts.push({
      fieldKey: 'notes',
      label: 'Біографічні нотатки',
      existingValue: extNotes.length > 90 ? extNotes.slice(0, 90) + '…' : extNotes,
      incomingValue: incNotes.length > 90 ? incNotes.slice(0, 90) + '…' : incNotes,
      category: 'notes'
    });
  }

  // 16. Father
  if (existing.fatherId && incoming.fatherId) {
    const remappedFather = idMapping[incoming.fatherId] || incoming.fatherId;
    if (existing.fatherId !== remappedFather) {
      const extFather = existingPersonsMap[existing.fatherId];
      const incFather = incomingPersonsMap[incoming.fatherId];
      if (extFather && incFather) {
        const extFatherName = `${extFather.lastName || ''} ${extFather.firstName || ''}`.trim() || existing.fatherId;
        const incFatherName = `${incFather.lastName || ''} ${incFather.firstName || ''}`.trim() || incoming.fatherId;
        if (normalizeNameForComparison(extFatherName) !== normalizeNameForComparison(incFatherName)) {
          conflicts.push({
            fieldKey: 'father',
            label: 'Батько',
            existingValue: extFatherName,
            incomingValue: incFatherName,
            category: 'parents'
          });
        }
      }
    }
  }

  // 17. Mother
  if (existing.motherId && incoming.motherId) {
    const remappedMother = idMapping[incoming.motherId] || incoming.motherId;
    if (existing.motherId !== remappedMother) {
      const extMother = existingPersonsMap[existing.motherId];
      const incMother = incomingPersonsMap[incoming.motherId];
      if (extMother && incMother) {
        const extMotherName = `${extMother.lastName || ''} ${extMother.firstName || ''}`.trim() || existing.motherId;
        const incMotherName = `${incMother.lastName || ''} ${incMother.firstName || ''}`.trim() || incoming.motherId;
        if (normalizeNameForComparison(extMotherName) !== normalizeNameForComparison(incMotherName)) {
          conflicts.push({
            fieldKey: 'mother',
            label: "Матір",
            existingValue: extMotherName,
            incomingValue: incMotherName,
            category: 'parents'
          });
        }
      }
    }
  }

  return conflicts;
}

/**
 * Pre-analyzes the merge between current database and incoming database
 */
export function analyzeMerge(
  currentDb: GenealogyDatabase,
  incomingDb: GenealogyDatabase
): MergeAnalysis {
  const existingPersons = Object.values(currentDb.persons || {});
  const incomingPersons = Object.values(incomingDb.persons || {});

  const idMapping: Record<string, string> = {};
  const matchedPersons: MatchedPersonRecord[] = [];
  const newPersons: Person[] = [];

  const usedTargetIds = new Set(existingPersons.map((p) => p.id));

  // Step 1: Match incoming persons with existing persons
  for (const inc of incomingPersons) {
    const match = findBestPersonMatch(inc, existingPersons);

    if (match) {
      idMapping[inc.id] = match.person.id;
      const enrichedFields = detectEnrichedFields(match.person, inc);
      matchedPersons.push({
        existingPerson: match.person,
        incomingPerson: inc,
        matchReason: match.matchReason,
        enrichedFields
      });
    } else {
      // Determine unique ID for the new person
      let targetId = inc.id;
      if (!targetId || usedTargetIds.has(targetId) || /^p([1-9]|1[0-5])$/.test(targetId)) {
        targetId = `p_imp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      }
      usedTargetIds.add(targetId);
      idMapping[inc.id] = targetId;
      newPersons.push({
        ...inc,
        id: targetId
      });
    }
  }

  // Step 2: Detect field conflicts across all matched persons
  const conflicts: PersonConflictRecord[] = [];
  let totalConflictsCount = 0;

  for (const match of matchedPersons) {
    const personConflicts = detectConflicts(
      match.existingPerson,
      match.incomingPerson,
      idMapping,
      currentDb.persons || {},
      incomingDb.persons || {}
    );

    if (personConflicts.length > 0) {
      totalConflictsCount += personConflicts.length;
      const p = match.existingPerson;
      conflicts.push({
        personId: p.id,
        personName: `${p.lastName || ''} ${p.firstName || ''} ${p.patronymic || ''}`.trim() || p.id,
        incomingId: match.incomingPerson.id,
        conflicts: personConflicts
      });
    }
  }

  return {
    matchedPersons,
    newPersons,
    conflicts,
    totalConflictsCount,
    totalIncoming: incomingPersons.length,
    totalExisting: existingPersons.length,
    idMapping
  };
}

/**
 * Executes a full smart merge of incoming database into current database
 * incorporating explicit user conflict resolutions
 */
export function executeMerge(
  currentDb: GenealogyDatabase,
  incomingDb: GenealogyDatabase,
  preAnalysis?: MergeAnalysis,
  conflictResolutions?: ConflictResolutions
): MergeResult {
  const analysis = preAnalysis || analyzeMerge(currentDb, incomingDb);
  const { idMapping, matchedPersons, newPersons } = analysis;

  const mergedPersons: Record<string, Person> = { ...(currentDb.persons || {}) };
  let conflictsResolvedCount = 0;

  // 1. Enrich existing matched persons with conflict choices applied
  for (const match of matchedPersons) {
    const ext = mergedPersons[match.existingPerson.id];
    const inc = match.incomingPerson;
    if (!ext) continue;

    const resolutions = conflictResolutions?.[ext.id] || {};

    const resolveField = (
      fieldKey: ConflictFieldKey,
      extVal: string | undefined | null,
      incVal: string | undefined | null
    ): string | undefined => {
      if (!extVal && incVal) return incVal;
      if (extVal && !incVal) return extVal;
      if (!extVal && !incVal) return undefined;

      const choice = resolutions[fieldKey] || 'keep_existing';
      if (choice === 'take_incoming') {
        conflictsResolvedCount++;
        return incVal!;
      }
      return extVal!;
    };

    const resolveYear = (
      fieldKey: ConflictFieldKey,
      extYear: number | string | undefined | null,
      incYear: number | string | undefined | null
    ): number | string | undefined => {
      if (!extYear && incYear) return incYear;
      if (extYear && !incYear) return extYear;
      if (!extYear && !incYear) return undefined;

      const choice = resolutions[fieldKey] || 'keep_existing';
      if (choice === 'take_incoming') {
        conflictsResolvedCount++;
        return incYear!;
      }
      return extYear!;
    };

    // First Name
    const firstName = resolveField(
      'firstName',
      ext.firstName && ext.firstName !== 'Невідомо' ? ext.firstName : '',
      inc.firstName && inc.firstName !== 'Невідомо' ? inc.firstName : ''
    ) || ext.firstName || inc.firstName || '';

    // Last Name
    const lastName = resolveField('lastName', ext.lastName, inc.lastName) || '';

    // Patronymic
    const patronymic = resolveField('patronymic', ext.patronymic, inc.patronymic);

    // Maiden Name
    const maidenName = resolveField('maidenName', ext.maidenName, inc.maidenName);

    // Gender
    let gender = ext.gender;
    if (ext.gender && inc.gender && ext.gender !== inc.gender) {
      if (resolutions.gender === 'take_incoming') {
        gender = inc.gender;
        conflictsResolvedCount++;
      }
    } else {
      gender = ext.gender || inc.gender;
    }

    // Birth fields
    const birthDate = resolveField('birthDate', ext.birthDate, inc.birthDate);
    const birthYear = resolveYear('birthYear', ext.birthYear, inc.birthYear) || (birthDate ? extractYear(birthDate) || undefined : undefined);
    const birthPlace = resolveField('birthPlace', ext.birthPlace, inc.birthPlace);

    // Death fields
    const deathDate = resolveField('deathDate', ext.deathDate, inc.deathDate);
    const deathYear = resolveYear('deathYear', ext.deathYear, inc.deathYear) || (deathDate ? extractYear(deathDate) || undefined : undefined);
    const deathPlace = resolveField('deathPlace', ext.deathPlace, inc.deathPlace);
    const deathReason = resolveField('deathReason', ext.deathReason, inc.deathReason);

    // Burial fields
    const burialDate = resolveField('burialDate', ext.burialDate, inc.burialDate);
    const burialPlace = resolveField('burialPlace', ext.burialPlace, inc.burialPlace);

    // Occupation & Residence
    const occupation = resolveField('occupation', ext.occupation, inc.occupation);
    const residencePlace = resolveField('residencePlace', ext.residencePlace, inc.residencePlace);

    // Notes
    let notes = ext.notes;
    if (!ext.notes && inc.notes) {
      notes = inc.notes;
    } else if (ext.notes && inc.notes) {
      const choice = resolutions.notes || 'keep_existing';
      if (choice === 'take_incoming') {
        notes = inc.notes;
        conflictsResolvedCount++;
      } else if (choice === 'combine') {
        notes = ext.notes.includes(inc.notes.trim().slice(0, 30))
          ? ext.notes
          : `${ext.notes}\n\n[Злиття з GEDCOM]:\n${inc.notes}`;
        conflictsResolvedCount++;
      } else {
        notes = ext.notes;
      }
    }

    // Parents
    let fatherId = ext.fatherId || (inc.fatherId ? idMapping[inc.fatherId] : undefined);
    if (ext.fatherId && inc.fatherId) {
      const remapped = idMapping[inc.fatherId] || inc.fatherId;
      if (ext.fatherId !== remapped && resolutions.father === 'take_incoming') {
        fatherId = remapped;
        conflictsResolvedCount++;
      }
    }

    let motherId = ext.motherId || (inc.motherId ? idMapping[inc.motherId] : undefined);
    if (ext.motherId && inc.motherId) {
      const remapped = idMapping[inc.motherId] || inc.motherId;
      if (ext.motherId !== remapped && resolutions.mother === 'take_incoming') {
        motherId = remapped;
        conflictsResolvedCount++;
      }
    }

    const updated: Person = {
      ...ext,
      firstName,
      lastName,
      patronymic,
      maidenName,
      gender,
      name: {
        ...ext.name,
        given: firstName || ext.name?.given || '',
        surname: lastName || ext.name?.surname || '',
        patronymic: patronymic || ext.name?.patronymic,
        maidenName: maidenName || ext.name?.maidenName
      },

      birthDate,
      birthYear,
      birthPlace,
      deathDate,
      deathYear,
      deathPlace,
      deathReason,
      burialDate,
      burialPlace,

      occupation,
      residencePlace,
      notes,

      photoUrl: ext.photoUrl || inc.photoUrl,
      avatarUrl: ext.avatarUrl || inc.avatarUrl || ext.photoUrl || inc.photoUrl,

      fatherId,
      motherId,

      spouseIds: Array.from(
        new Set([
          ...(ext.spouseIds || []),
          ...(inc.spouseIds || []).map((sid) => idMapping[sid] || sid)
        ])
      ),

      childrenIds: Array.from(
        new Set([
          ...(ext.childrenIds || []),
          ...(inc.childrenIds || []).map((cid) => idMapping[cid] || cid)
        ])
      )
    };

    mergedPersons[ext.id] = updated;
  }

  // 2. Add brand-new persons with remapped relation IDs
  for (const inc of newPersons) {
    const targetId = idMapping[inc.id] || inc.id;

    const remappedChildren = (inc.childrenIds || []).map((cid) => idMapping[cid] || cid);
    const remappedSpouses = (inc.spouseIds || []).map((sid) => idMapping[sid] || sid);
    const remappedFather = inc.fatherId ? (idMapping[inc.fatherId] || inc.fatherId) : undefined;
    const remappedMother = inc.motherId ? (idMapping[inc.motherId] || inc.motherId) : undefined;

    mergedPersons[targetId] = {
      ...inc,
      id: targetId,
      fatherId: remappedFather,
      motherId: remappedMother,
      spouseIds: remappedSpouses,
      childrenIds: remappedChildren
    };
  }

  // 3. Merge Families
  const mergedFamilies: Record<string, Family> = { ...(currentDb.families || {}) };
  let familiesMergedCount = 0;
  let familiesAddedCount = 0;

  const incomingFamilies = Object.values(incomingDb.families || {});

  for (const incFam of incomingFamilies) {
    const remappedHusband = incFam.husbandId ? idMapping[incFam.husbandId] : undefined;
    const remappedWife = incFam.wifeId ? idMapping[incFam.wifeId] : undefined;
    const remappedChildren = (incFam.childrenIds || []).map((cid) => idMapping[cid] || cid);

    // Look for existing family with same husband & wife
    const existingFamilyEntry = Object.entries(mergedFamilies).find(([, f]) => {
      if (remappedHusband && remappedWife) {
        return f.husbandId === remappedHusband && f.wifeId === remappedWife;
      }
      if (remappedHusband && !remappedWife) {
        return f.husbandId === remappedHusband && !f.wifeId;
      }
      if (!remappedHusband && remappedWife) {
        return !f.husbandId && f.wifeId === remappedWife;
      }
      return false;
    });

    if (existingFamilyEntry) {
      // Merge children into existing family
      const [existingFamId, existingFam] = existingFamilyEntry;
      const combinedChildren = Array.from(
        new Set([...(existingFam.childrenIds || []), ...remappedChildren])
      );

      mergedFamilies[existingFamId] = {
        ...existingFam,
        childrenIds: combinedChildren,
        children: combinedChildren.map((cId) => ({ personId: cId, relationType: 'Biological' })),
        marriageDate: existingFam.marriageDate || incFam.marriageDate,
        marriagePlace: existingFam.marriagePlace || incFam.marriagePlace
      };
      familiesMergedCount++;
    } else {
      // Add new family with a safe unique ID
      let targetFamId = incFam.id;
      if (!targetFamId || mergedFamilies[targetFamId] || /^f([1-9]|10)$/.test(targetFamId)) {
        targetFamId = `fam_imp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      }

      mergedFamilies[targetFamId] = {
        ...incFam,
        id: targetFamId,
        husbandId: remappedHusband,
        wifeId: remappedWife,
        childrenIds: remappedChildren,
        children: remappedChildren.map((cId) => ({ personId: cId, relationType: 'Biological' }))
      };
      familiesAddedCount++;
    }
  }

  // 4. Merge sources, events, places
  const mergedSources = { ...(currentDb.sources || {}), ...(incomingDb.sources || {}) };
  const mergedEvents = { ...(currentDb.events || {}), ...(incomingDb.events || {}) };
  const mergedPlaces = { ...(currentDb.places || {}), ...(incomingDb.places || {}) };

  // 5. Build structured list of persons that required conflict resolution
  const resolvedPersonsWithConflicts: ResolvedPersonConflictRecord[] = [];
  for (const personConf of analysis.conflicts) {
    const ext = mergedPersons[personConf.personId];
    const resolutions = conflictResolutions?.[personConf.personId] || {};

    const resolvedFields: ResolvedFieldConflictItem[] = personConf.conflicts.map((c) => {
      const choice: ConflictResolutionChoice = resolutions[c.fieldKey] || 'keep_existing';
      let finalValue = c.existingValue;
      if (c.fieldKey === 'notes' && choice === 'combine') {
        finalValue = c.existingValue.includes(c.incomingValue.trim().slice(0, 30))
          ? c.existingValue
          : `${c.existingValue}\n\n[Злиття з GEDCOM]:\n${c.incomingValue}`;
      } else if (choice === 'take_incoming') {
        finalValue = c.incomingValue;
      }

      return {
        fieldKey: c.fieldKey,
        label: c.label,
        existingValue: c.existingValue,
        incomingValue: c.incomingValue,
        chosenResolution: choice,
        finalValue
      };
    });

    resolvedPersonsWithConflicts.push({
      personId: personConf.personId,
      personName: personConf.personName,
      incomingId: personConf.incomingId,
      birthYear: ext?.birthYear || (ext?.birthDate ? extractYear(ext.birthDate) || undefined : undefined),
      conflicts: resolvedFields
    });
  }

  const finalDb: GenealogyDatabase = {
    metadata: {
      title: currentDb.metadata?.title || 'Генеалогічна база роду',
      description: currentDb.metadata?.description || 'Об\'єднана родовідна база',
      lastModified: new Date().toISOString(),
      author: currentDb.metadata?.author || 'Дослідник'
    },
    rootPersonId: currentDb.rootPersonId || Object.keys(mergedPersons)[0],
    persons: mergedPersons,
    families: mergedFamilies,
    sources: mergedSources,
    events: mergedEvents,
    places: mergedPlaces,
    lastModified: new Date().toISOString()
  };

  return {
    database: finalDb,
    matchedCount: matchedPersons.length,
    newPersonsCount: newPersons.length,
    conflictsResolvedCount,
    familiesMergedCount,
    familiesAddedCount,
    resolvedPersonsWithConflicts
  };
}

/**
 * Recursively retrieves all direct ancestor IDs (parents, grandparents, great-grandparents...)
 * of a specific person within a database.
 */
export function getPersonAncestorsIds(
  personId: string,
  persons: Record<string, Person>
): Set<string> {
  const ancestorIds = new Set<string>();
  const queue: string[] = [];

  const root = persons[personId];
  if (!root) return ancestorIds;

  if (root.fatherId && persons[root.fatherId]) queue.push(root.fatherId);
  if (root.motherId && persons[root.motherId]) queue.push(root.motherId);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (ancestorIds.has(currentId)) continue;
    ancestorIds.add(currentId);

    const current = persons[currentId];
    if (current) {
      if (current.fatherId && persons[current.fatherId]) queue.push(current.fatherId);
      if (current.motherId && persons[current.motherId]) queue.push(current.motherId);
    }
  }

  return ancestorIds;
}

/**
 * Filters a database by excluding all ancestors of specified person IDs,
 * as well as any individually excluded persons.
 * Safely severs the parent linkages on the boundary persons so they remain in the tree
 * without pointing to phantom/excluded parent records.
 */
export function filterDatabaseExcludingBranches(
  incomingDb: GenealogyDatabase,
  excludeAncestorsOfPersonIds: string[],
  excludeIndividualPersonIds: string[] = []
): {
  filteredDb: GenealogyDatabase;
  excludedPersonIds: string[];
  severedPersonIds: string[];
} {
  const persons = incomingDb.persons || {};
  const allExcluded = new Set<string>(excludeIndividualPersonIds);
  const severedPersonIdsSet = new Set<string>();

  for (const rootId of excludeAncestorsOfPersonIds) {
    if (persons[rootId]) {
      severedPersonIdsSet.add(rootId);
      const ancestors = getPersonAncestorsIds(rootId, persons);
      ancestors.forEach((ancId) => allExcluded.add(ancId));
    }
  }

  // Ensure root persons whose ancestors are excluded are NOT themselves excluded
  // (unless explicitly in excludeIndividualPersonIds)
  excludeAncestorsOfPersonIds.forEach((rootId) => {
    if (!excludeIndividualPersonIds.includes(rootId)) {
      allExcluded.delete(rootId);
    }
  });

  const filteredPersons: Record<string, Person> = {};
  for (const [id, p] of Object.entries(persons)) {
    if (allExcluded.has(id)) continue;

    const isSeveredTarget = severedPersonIdsSet.has(id);
    const fatherExcluded = Boolean(p.fatherId && allExcluded.has(p.fatherId));
    const motherExcluded = Boolean(p.motherId && allExcluded.has(p.motherId));

    const fatherId = isSeveredTarget || fatherExcluded ? undefined : p.fatherId;
    const motherId = isSeveredTarget || motherExcluded ? undefined : p.motherId;

    const childrenIds = (p.childrenIds || []).filter((cid) => !allExcluded.has(cid));
    const spouseIds = (p.spouseIds || []).filter((sid) => !allExcluded.has(sid));

    filteredPersons[id] = {
      ...p,
      fatherId,
      motherId,
      childrenIds,
      spouseIds
    };
  }

  // Filter and repair families
  const filteredFamilies: Record<string, Family> = {};
  for (const [famId, fam] of Object.entries(incomingDb.families || {})) {
    const husbExcluded = Boolean(fam.husbandId && allExcluded.has(fam.husbandId));
    const wifeExcluded = Boolean(fam.wifeId && allExcluded.has(fam.wifeId));
    const remainingChildren = (fam.childrenIds || []).filter((cid) => !allExcluded.has(cid));

    // If both spouses and all children are excluded, drop family entirely
    if (husbExcluded && wifeExcluded && remainingChildren.length === 0) {
      continue;
    }

    filteredFamilies[famId] = {
      ...fam,
      husbandId: husbExcluded ? undefined : fam.husbandId,
      wifeId: wifeExcluded ? undefined : fam.wifeId,
      childrenIds: remainingChildren,
      children: (fam.children || []).filter((c) => !allExcluded.has(c.personId))
    };
  }

  return {
    filteredDb: {
      ...incomingDb,
      persons: filteredPersons,
      families: filteredFamilies
    },
    excludedPersonIds: Array.from(allExcluded),
    severedPersonIds: Array.from(severedPersonIdsSet)
  };
}
