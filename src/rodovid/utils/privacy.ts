/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Person, AuthUser, WhitelistEntry } from '../../types';
import { GenealogyDatabase } from '../types/genealogy';
import { getFullName } from './relationship';

/**
 * Checks if the current user has active whitelisted access.
 */
export const isUserWhitelisted = (
  user: AuthUser | null,
  whitelist: WhitelistEntry[] = []
): boolean => {
  if (!user) return false;
  if (user.role === 'admin' || user.isWhitelisted) return true;
  if (!user.email) return false;
  return whitelist.some(
    (w) => w.email.toLowerCase() === user.email.toLowerCase() && w.status === 'active'
  );
};

/**
 * Determines whether a person is considered living.
 * Prioritizes explicit `isLiving` flag, or falls back to absence of death info.
 */
export const isPersonLiving = (person?: Person | null): boolean => {
  if (!person) return false;
  
  if (typeof person.isLiving === 'boolean') {
    return person.isLiving;
  }

  // If death date or death year exists, person is deceased
  if (person.deathDate || person.deathYear || person.deathPlace) {
    return false;
  }

  // If birth year is known and recent (< 105 years ago), or no birth/death info, treat as living if created recently
  if (person.birthYear) {
    const currentYear = new Date().getFullYear();
    const age = currentYear - Number(person.birthYear);
    return age < 105;
  }

  return false;
};

/**
 * Returns a privacy-safe masked version of the person for non-whitelisted public visitors.
 * If user is in whitelist, returns original person object untouched.
 */
export const getPrivacySafePerson = (person: Person, isWhitelisted: boolean): Person => {
  if (isWhitelisted) {
    return person;
  }

  if (!isPersonLiving(person)) {
    return person;
  }

  // Living person viewed by non-whitelisted guest: mask private data
  return {
    ...person,
    name: {
      given: 'Скрито',
      surname: 'Скрито',
      patronymic: undefined,
      maidenName: undefined,
      prefix: undefined
    },
    firstName: 'Скрито',
    lastName: 'Скрито',
    patronymic: undefined,
    maidenName: undefined,
    prefix: undefined,
    birthDate: 'Конфіденційно',
    birthYear: undefined,
    birthPlace: undefined,
    deathDate: undefined,
    deathYear: undefined,
    deathPlace: undefined,
    avatar: undefined,
    avatarUrl: undefined,
    photoUrl: undefined,
    photos: [],
    bio: '🔒 Інформація про живу особу прихована з міркувань конфіденційності. Повні дані доступні авторизованим родичам з Білого списку (Whitelist).',
    notes: undefined,
    occupation: undefined,
    estate: undefined,
    estateOrSocialStatus: undefined,
    socialStatus: undefined,
    militaryRank: undefined,
    confession: undefined,
    events: [],
    citations: [],
    sourceCitations: [],
    sourceIds: [],
    isLiving: true
  };
};

/**
 * Returns a privacy-safe label for <select> options or dropdown lists.
 */
export const getPrivacyPersonOptionLabel = (person: Person, isWhitelisted: boolean): string => {
  if (!isWhitelisted && isPersonLiving(person)) {
    return '🔒 Скрито (Жива особа)';
  }
  const fullName = getFullName(person);
  const bYear = person.birthYear || (person.birthDate ? person.birthDate.match(/\b(1\d{3}|20\d{2})\b/)?.[1] : '');
  return bYear ? `${fullName} (${bYear})` : fullName;
};

/**
 * Returns a privacy-safe database where all living persons have been sanitized for public viewers.
 */
export const getPrivacySafeDatabase = (
  database: GenealogyDatabase,
  isWhitelisted: boolean
): GenealogyDatabase => {
  if (isWhitelisted) {
    return database;
  }

  const safePersons: Record<string, Person> = {};
  Object.entries(database.persons || {}).forEach(([id, p]) => {
    safePersons[id] = getPrivacySafePerson(p, false);
  });

  return {
    ...database,
    persons: safePersons
  };
};

/**
 * Returns a display string for lifespan taking privacy into account.
 */
export const getPrivacyLifespan = (person: Person, isWhitelisted: boolean): string => {
  const isLiving = isPersonLiving(person);
  
  if (!isWhitelisted && isLiving) {
    return '🔒 Скрито (Жива особа)';
  }

  if (isLiving) {
    const bYear = person.birthYear || (person.birthDate ? person.birthDate.match(/\b(1\d{3}|20\d{2})\b/)?.[1] : '');
    return bYear ? `нар. ${bYear} (живий/а)` : 'Нині живий(а)';
  }

  const bYear = person.birthYear || (person.birthDate ? person.birthDate.match(/\b(1\d{3}|20\d{2})\b/)?.[1] : '');
  const dYear = person.deathYear || (person.deathDate ? person.deathDate.match(/\b(1\d{3}|20\d{2})\b/)?.[1] : '');

  if (bYear && dYear) return `${bYear} – ${dYear}`;
  if (bYear) return `нар. ${bYear}`;
  if (dYear) return `пом. ${dYear}`;
  return '—';
};
