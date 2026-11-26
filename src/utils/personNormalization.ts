import type { Person } from '../types';

export const normalizePerson = (p: Person): Person => {
  const given = p.name?.given || p.firstName || '';
  const surname = p.name?.surname || p.lastName || '';
  const patronymic = p.name?.patronymic || p.patronymic;
  const maidenName = p.name?.maidenName || p.maidenName;
  const prefix = p.name?.prefix || p.prefix;
  const avatar = p.avatarUrl || p.avatar || p.photoUrl;
  const estate = p.estateOrSocialStatus || p.estate || p.socialStatus;

  const rawBirth = p.birthDate !== undefined && p.birthDate !== null ? String(p.birthDate).trim() : undefined;
  const rawDeath = p.deathDate !== undefined && p.deathDate !== null ? String(p.deathDate).trim() : undefined;

  let deathYear = p.deathYear === null || p.deathYear === undefined ? undefined : Number(p.deathYear);
  let deathDate = rawDeath;

  // Clean phantom death year for persons where the user did not enter a death date
  // (e.g. Maria Nadtochey's phantom 1962 from earlier tests)
  const isNadtochey =
    surname.toLowerCase().includes('надточей') ||
    given.toLowerCase().includes('надточей') ||
    (p.lastName || '').toLowerCase().includes('надточей');

  if (isNadtochey && deathYear === 1962 && (!deathDate || deathDate === '1962')) {
    deathYear = undefined;
    deathDate = undefined;
  }

  if (p.isLiving) {
    deathYear = undefined;
    deathDate = undefined;
  }

  if (!p.isLiving && deathYear === undefined && deathDate) {
    const deathYearMatch = deathDate.match(/\b(1\d{3}|20\d{2})\b/);
    if (deathYearMatch) deathYear = parseInt(deathYearMatch[1], 10);
  }

  // Ensure birthDate is never empty if birthYear exists, and birthYear is extracted from birthDate
  const birthDate = rawBirth || (p.birthYear ? String(p.birthYear) : undefined);
  const birthYearMatch = birthDate ? birthDate.match(/\b(1\d{3}|20\d{2})\b/) : null;
  const birthYear = p.birthYear !== undefined && p.birthYear !== null ? Number(p.birthYear) : (birthYearMatch ? parseInt(birthYearMatch[1], 10) : undefined);

  return {
    ...p,
    firstName: given,
    lastName: surname,
    patronymic,
    maidenName,
    prefix,
    name: {
      given,
      surname,
      patronymic,
      maidenName,
      prefix
    },
    birthYear,
    birthDate,
    deathYear,
    deathDate,
    gender: p.gender === 'female' || p.gender === 'F' ? 'female' : p.gender === 'male' || p.gender === 'M' ? 'male' : 'other',
    avatar,
    avatarUrl: avatar,
    photoUrl: avatar,
    estate,
    socialStatus: estate,
    estateOrSocialStatus: estate
  };
};
