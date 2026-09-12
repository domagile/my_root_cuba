/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GenealogyDatabase, Person, Family } from '../types/genealogy';
import { isPersonMale, isPersonFemale } from './genderUtils';
import { normalizeUkrainianSurnameGender, normalizeUkrainianPlace, areSurnamesEquivalent, formatClanName } from '../../utils/ukrainianPhonetics';
import { getLineageColorMap, getPersonClanColor, getPersonRodName } from './treeLayout';

export function extractYear(val?: number | string): number | null {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') {
    return val > 1000 && val < 2100 ? val : null;
  }
  const str = String(val).trim();
  const match = str.match(/\b(1[5-9]\d\d|20\d\d)\b/);
  if (match) {
    const y = parseInt(match[1], 10);
    return isNaN(y) ? null : y;
  }
  return null;
}

export function extractMonth(dateStr?: string): number | null {
  if (!dateStr) return null;
  const s = String(dateStr).toLowerCase();

  // Ukrainian month names
  if (s.includes('січ') || s.includes('jan')) return 1;
  if (s.includes('лют') || s.includes('feb')) return 2;
  if (s.includes('бер') || s.includes('mar')) return 3;
  if (s.includes('кві') || s.includes('apr')) return 4;
  if (s.includes('тра') || s.includes('may') || s.includes('май')) return 5;
  if (s.includes('чер') || s.includes('jun')) return 6;
  if (s.includes('лип') || s.includes('jul')) return 7;
  if (s.includes('сер') || s.includes('aug')) return 8;
  if (s.includes('вер') || s.includes('sep')) return 9;
  if (s.includes('жов') || s.includes('oct')) return 10;
  if (s.includes('лис') || s.includes('nov')) return 11;
  if (s.includes('гру') || s.includes('dec')) return 12;

  // Pattern YYYY-MM-DD or DD.MM.YYYY
  const isoMatch = s.match(/^\d{4}[-/.](0[1-9]|1[0-2])[-/.]/);
  if (isoMatch) return parseInt(isoMatch[1], 10);

  const dotMatch = s.match(/[-/.](0[1-9]|1[0-2])[-/.]\d{4}/);
  if (dotMatch) return parseInt(dotMatch[1], 10);

  return null;
}

export function getPersonName(p?: Person | null): string {
  if (!p) return 'Невідома особа';
  const first = p.firstName || p.name?.given || '';
  const last = p.lastName || p.name?.surname || '';
  const patronymic = p.patronymic || p.name?.patronymic || '';
  const fullName = [first, patronymic, last].filter(Boolean).join(' ');
  return fullName || 'Безіменний родич';
}

export interface ClanStatItem {
  id: string;
  name: string;
  color: string;
  count: number;
  persons: Person[];
}

export interface ComprehensiveGenealogyStats {
  // Overview
  totalPersons: number;
  males: number;
  females: number;
  unknownGender: number;
  livingCount: number;
  deceasedCount: number;
  totalFamilies: number;
  averageLifespan: number;
  profilesWithPhotos: number;
  profilesWithDates: number;
  profilesWithPlaces: number;
  clans: ClanStatItem[];
  topSurnames: [string, number][];

  // Relationships
  generations: { gen: number; count: number }[];
  maxGenerationsCount: number;
  researchStatusStats: { status: string; label: string; count: number; color: string }[];

  // Places
  topPlaces: [string, number][];
  topBirthPlaces: [string, number][];
  topDeathPlaces: [string, number][];
  localRootedCount: number;
  migratedCount: number;

  // Age / Lifespan
  averageLifespanOverall: number;
  averageLifespanMales: number;
  averageLifespanFemales: number;
  longestLived: { person: Person; age: number; birthYear: number; deathYear: number }[];
  lifespanByCentury: { century: string; avgAge: number; count: number }[];
  ageDistribution: { label: string; count: number; pct: number }[];
  oldestLiving: { person: Person; age: number; birthYear: number }[];

  // Births
  birthsByCentury: { century: string; count: number }[];
  birthsByDecade: { decade: string; count: number }[];
  birthsByMonth: { month: number; name: string; count: number }[];
  earliestBorn: { person: Person; year: number } | null;
  latestBorn: { person: Person; year: number } | null;

  // Marriages
  totalMarriagesWithDates: number;
  avgMarriageAgeMen: number | null;
  avgMarriageAgeWomen: number | null;
  youngestGroom: { person: Person; age: number; spouseName: string; year: number } | null;
  youngestBride: { person: Person; age: number; spouseName: string; year: number } | null;
  oldestGroom: { person: Person; age: number; spouseName: string; year: number } | null;
  oldestBride: { person: Person; age: number; spouseName: string; year: number } | null;
  avgAgeGapBetweenSpouses: number | null;
  biggestAgeGaps: { familyId: string; husband?: Person; wife?: Person; gap: number; older: 'husband' | 'wife' }[];
  longestMarriages: { familyId: string; husband?: Person; wife?: Person; duration: number }[];
  marriagesByMonth: { month: number; name: string; count: number }[];

  // Children
  averageChildrenPerFamily: number;
  largestFamilies: { familyId: string; husband?: Person; wife?: Person; count: number; children: Person[] }[];
  avgMotherAgeAtFirstChild: number | null;
  avgFatherAgeAtFirstChild: number | null;
  youngestMother: { person: Person; age: number; childName: string } | null;
  youngestFather: { person: Person; age: number; childName: string } | null;
  oldestMother: { person: Person; age: number; childName: string } | null;
  oldestFather: { person: Person; age: number; childName: string } | null;
  childrenGenderRatio: { boys: number; girls: number };
  avgChildIntervalYears: number | null;
}

export function computeComprehensiveStats(database: GenealogyDatabase): ComprehensiveGenealogyStats {
  const persons = Object.values(database.persons || {}) as Person[];
  const families = Object.values(database.families || {}) as Family[];
  const personMap = new Map<string, Person>();
  persons.forEach((p) => personMap.set(p.id, p));

  const totalPersons = persons.length;
  let males = 0;
  let females = 0;
  let unknownGender = 0;
  let livingCount = 0;
  let deceasedCount = 0;
  let profilesWithPhotos = 0;
  let profilesWithDates = 0;
  let profilesWithPlaces = 0;

  const currentYear = new Date().getFullYear();

  // 1. Overview & Person Metrics
  persons.forEach((p) => {
    if (isPersonMale(p, database)) males++;
    else if (isPersonFemale(p, database)) females++;
    else unknownGender++;

    const bYear = extractYear(p.birthYear || p.birthDate);
    const dYear = extractYear(p.deathYear || p.deathDate);

    const isDeceased = p.isLiving === false || dYear !== null || !!p.deathDate || !!p.deathPlace || (bYear !== null && currentYear - bYear > 115);
    if (isDeceased) {
      deceasedCount++;
    } else {
      livingCount++;
    }

    if (p.avatarUrl || p.photoUrl || (p.photos && p.photos.length > 0)) {
      profilesWithPhotos++;
    }
    if (bYear !== null || dYear !== null) {
      profilesWithDates++;
    }
    if (p.birthPlace || p.deathPlace || p.residencePlace) {
      profilesWithPlaces++;
    }
  });

  // 2. Clans & Lineages (existing logic)
  const lineageColorMap = getLineageColorMap(database);
  const clanMap = new Map<string, ClanStatItem>();

  persons.forEach((p) => {
    const rawRod = getPersonRodName(p);
    const rawSurname = (p.name?.surname || p.lastName || p.name?.maidenName || p.maidenName || '').trim();
    if (!rawSurname || rawSurname === 'Рід') return;
    const canonical = normalizeUkrainianSurnameGender(rawSurname) || rawRod;
    const clanId = canonical;
    const clanName = formatClanName(canonical);
    const color = getPersonClanColor(p, lineageColorMap);

    const existing = Array.from(clanMap.values()).find(
      (c) => c.id.toLowerCase() === clanId.toLowerCase() || areSurnamesEquivalent(clanId, c.id)
    );
    if (existing) {
      existing.count += 1;
      existing.persons.push(p);
    } else {
      clanMap.set(clanId, { id: clanId, name: clanName, color, count: 1, persons: [p] });
    }
  });

  const clans = Array.from(clanMap.values()).sort((a, b) => b.count - a.count);

  // 3. Top Surnames (existing logic)
  const surnameMap: Record<string, number> = {};
  persons.forEach((p) => {
    const rawSurname = (p.name?.surname || p.lastName || p.name?.maidenName || p.maidenName || '').trim();
    if (rawSurname) {
      const canonicalSurname = normalizeUkrainianSurnameGender(rawSurname) || rawSurname;
      if (canonicalSurname) {
        const existingKey = Object.keys(surnameMap).find(
          (k) => k.toLowerCase() === canonicalSurname.toLowerCase() || areSurnamesEquivalent(k, canonicalSurname)
        );
        const keyToUse = existingKey || canonicalSurname;
        surnameMap[keyToUse] = (surnameMap[keyToUse] || 0) + 1;
      }
    }
  });

  const topSurnames = Object.entries(surnameMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // 4. Places
  const generalPlaceMap: Record<string, number> = {};
  const birthPlaceMap: Record<string, number> = {};
  const deathPlaceMap: Record<string, number> = {};
  let localRootedCount = 0;
  let migratedCount = 0;

  persons.forEach((p) => {
    const bPlace = normalizeUkrainianPlace(p.birthPlace || '');
    const dPlace = normalizeUkrainianPlace(p.deathPlace || '');
    const rPlace = normalizeUkrainianPlace(p.residencePlace || '');

    if (bPlace && bPlace.length >= 2 && bPlace !== '-' && bPlace !== '?') {
      birthPlaceMap[bPlace] = (birthPlaceMap[bPlace] || 0) + 1;
      generalPlaceMap[bPlace] = (generalPlaceMap[bPlace] || 0) + 1;
    }
    if (dPlace && dPlace.length >= 2 && dPlace !== '-' && dPlace !== '?') {
      deathPlaceMap[dPlace] = (deathPlaceMap[dPlace] || 0) + 1;
      generalPlaceMap[dPlace] = (generalPlaceMap[dPlace] || 0) + 1;
    }
    if (rPlace && rPlace.length >= 2 && rPlace !== '-' && rPlace !== '?') {
      generalPlaceMap[rPlace] = (generalPlaceMap[rPlace] || 0) + 1;
    }

    if (bPlace && dPlace && bPlace.length >= 2 && dPlace.length >= 2) {
      if (bPlace.toLowerCase() === dPlace.toLowerCase()) {
        localRootedCount++;
      } else {
        migratedCount++;
      }
    }
  });

  const topPlaces = Object.entries(generalPlaceMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const topBirthPlaces = Object.entries(birthPlaceMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const topDeathPlaces = Object.entries(deathPlaceMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // 5. Age & Lifespan
  const deceasedWithAge: { person: Person; age: number; birthYear: number; deathYear: number }[] = [];
  let maleAgeSum = 0;
  let maleAgeCount = 0;
  let femaleAgeSum = 0;
  let femaleAgeCount = 0;

  const centuryMap: Record<string, { sum: number; count: number }> = {};
  const ageBuckets = { '<20': 0, '20-39': 0, '40-59': 0, '60-79': 0, '80+': 0 };

  const livingWithAge: { person: Person; age: number; birthYear: number }[] = [];

  persons.forEach((p) => {
    const bYear = extractYear(p.birthYear || p.birthDate);
    const dYear = extractYear(p.deathYear || p.deathDate);

    if (bYear !== null) {
      if (dYear !== null && dYear >= bYear) {
        const age = dYear - bYear;
        deceasedWithAge.push({ person: p, age, birthYear: bYear, deathYear: dYear });

        if (isPersonMale(p, database)) {
          maleAgeSum += age;
          maleAgeCount++;
        } else if (isPersonFemale(p, database)) {
          femaleAgeSum += age;
          femaleAgeCount++;
        }

        // Century
        const centNum = Math.floor(dYear / 100) + 1;
        const centLabel = centNum === 18 ? 'XVIII ст.' : centNum === 19 ? 'XIX ст.' : centNum === 20 ? 'XX ст.' : `${centNum} ст.`;
        if (!centuryMap[centLabel]) centuryMap[centLabel] = { sum: 0, count: 0 };
        centuryMap[centLabel].sum += age;
        centuryMap[centLabel].count += 1;

        // Buckets
        if (age < 20) ageBuckets['<20']++;
        else if (age <= 39) ageBuckets['20-39']++;
        else if (age <= 59) ageBuckets['40-59']++;
        else if (age <= 79) ageBuckets['60-79']++;
        else ageBuckets['80+']++;
      } else if (dYear === null && p.isLiving !== false && currentYear - bYear <= 115) {
        const livingAge = currentYear - bYear;
        livingWithAge.push({ person: p, age: livingAge, birthYear: bYear });
      }
    }
  });

  deceasedWithAge.sort((a, b) => b.age - a.age);
  const longestLived = deceasedWithAge.slice(0, 8);

  livingWithAge.sort((a, b) => b.age - a.age);
  const oldestLiving = livingWithAge.slice(0, 5);

  const totalDeceasedWithAge = deceasedWithAge.length;
  const totalAgeSum = deceasedWithAge.reduce((acc, cur) => acc + cur.age, 0);

  const averageLifespanOverall = totalDeceasedWithAge > 0 ? Math.round(totalAgeSum / totalDeceasedWithAge) : 0;
  const averageLifespanMales = maleAgeCount > 0 ? Math.round(maleAgeSum / maleAgeCount) : 0;
  const averageLifespanFemales = femaleAgeCount > 0 ? Math.round(femaleAgeSum / femaleAgeCount) : 0;

  const lifespanByCentury = Object.entries(centuryMap)
    .map(([century, val]) => ({
      century,
      avgAge: Math.round(val.sum / val.count),
      count: val.count
    }))
    .sort((a, b) => a.century.localeCompare(b.century));

  const ageDistribution = [
    { label: 'до 20 років', count: ageBuckets['<20'], pct: totalDeceasedWithAge ? Math.round((ageBuckets['<20'] / totalDeceasedWithAge) * 100) : 0 },
    { label: '20 — 39 років', count: ageBuckets['20-39'], pct: totalDeceasedWithAge ? Math.round((ageBuckets['20-39'] / totalDeceasedWithAge) * 100) : 0 },
    { label: '40 — 59 років', count: ageBuckets['40-59'], pct: totalDeceasedWithAge ? Math.round((ageBuckets['40-59'] / totalDeceasedWithAge) * 100) : 0 },
    { label: '60 — 79 років', count: ageBuckets['60-79'], pct: totalDeceasedWithAge ? Math.round((ageBuckets['60-79'] / totalDeceasedWithAge) * 100) : 0 },
    { label: '80+ років (довгожителі)', count: ageBuckets['80+'], pct: totalDeceasedWithAge ? Math.round((ageBuckets['80+'] / totalDeceasedWithAge) * 100) : 0 }
  ];

  // 6. Births
  const centuryBirthMap: Record<string, number> = {};
  const decadeBirthMap: Record<string, number> = {};
  const monthBirthCounts: number[] = new Array(13).fill(0);
  let earliestBorn: { person: Person; year: number } | null = null;
  let latestBorn: { person: Person; year: number } | null = null;

  persons.forEach((p) => {
    const bYear = extractYear(p.birthYear || p.birthDate);
    if (bYear !== null) {
      if (!earliestBorn || bYear < earliestBorn.year) {
        earliestBorn = { person: p, year: bYear };
      }
      if (!latestBorn || bYear > latestBorn.year) {
        latestBorn = { person: p, year: bYear };
      }

      const cent = Math.floor(bYear / 100) + 1;
      const centName = cent === 18 ? 'XVIII ст.' : cent === 19 ? 'XIX ст.' : cent === 20 ? 'XX ст.' : cent === 21 ? 'XXI ст.' : `${cent} ст.`;
      centuryBirthMap[centName] = (centuryBirthMap[centName] || 0) + 1;

      const dec = `${Math.floor(bYear / 10) * 10}-ті`;
      decadeBirthMap[dec] = (decadeBirthMap[dec] || 0) + 1;
    }

    const m = extractMonth(p.birthDate);
    if (m && m >= 1 && m <= 12) {
      monthBirthCounts[m]++;
    }
  });

  const birthsByCentury = Object.entries(centuryBirthMap)
    .map(([century, count]) => ({ century, count }))
    .sort((a, b) => a.century.localeCompare(b.century));

  const birthsByDecade = Object.entries(decadeBirthMap)
    .map(([decade, count]) => ({ decade, count }))
    .sort((a, b) => a.decade.localeCompare(b.decade))
    .slice(-12);

  const monthNames = ['', 'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
  const birthsByMonth = monthNames.slice(1).map((name, idx) => ({
    month: idx + 1,
    name,
    count: monthBirthCounts[idx + 1]
  }));

  // 7. Marriages
  let groomAgeSum = 0;
  let groomAgeCount = 0;
  let brideAgeSum = 0;
  let brideAgeCount = 0;
  let totalMarriagesWithDates = 0;

  let youngestGroom: { person: Person; age: number; spouseName: string; year: number } | null = null;
  let youngestBride: { person: Person; age: number; spouseName: string; year: number } | null = null;
  let oldestGroom: { person: Person; age: number; spouseName: string; year: number } | null = null;
  let oldestBride: { person: Person; age: number; spouseName: string; year: number } | null = null;

  let totalAgeGapSum = 0;
  let ageGapCount = 0;
  const biggestAgeGaps: { familyId: string; husband?: Person; wife?: Person; gap: number; older: 'husband' | 'wife' }[] = [];
  const longestMarriages: { familyId: string; husband?: Person; wife?: Person; duration: number }[] = [];
  const marriageMonthCounts: number[] = new Array(13).fill(0);

  families.forEach((fam) => {
    const husband = fam.husbandId ? personMap.get(fam.husbandId) : undefined;
    const wife = fam.wifeId ? personMap.get(fam.wifeId) : undefined;
    const mYear = extractYear(fam.marriageYear || fam.marriageDate);

    const mMonth = extractMonth(fam.marriageDate);
    if (mMonth && mMonth >= 1 && mMonth <= 12) {
      marriageMonthCounts[mMonth]++;
    }

    if (mYear !== null) {
      totalMarriagesWithDates++;

      if (husband) {
        const hBirth = extractYear(husband.birthYear || husband.birthDate);
        if (hBirth !== null && mYear >= hBirth) {
          const age = mYear - hBirth;
          groomAgeSum += age;
          groomAgeCount++;
          if (!youngestGroom || age < youngestGroom.age) {
            youngestGroom = { person: husband, age, spouseName: getPersonName(wife), year: mYear };
          }
          if (!oldestGroom || age > oldestGroom.age) {
            oldestGroom = { person: husband, age, spouseName: getPersonName(wife), year: mYear };
          }
        }
      }

      if (wife) {
        const wBirth = extractYear(wife.birthYear || wife.birthDate);
        if (wBirth !== null && mYear >= wBirth) {
          const age = mYear - wBirth;
          brideAgeSum += age;
          brideAgeCount++;
          if (!youngestBride || age < youngestBride.age) {
            youngestBride = { person: wife, age, spouseName: getPersonName(husband), year: mYear };
          }
          if (!oldestBride || age > oldestBride.age) {
            oldestBride = { person: wife, age, spouseName: getPersonName(husband), year: mYear };
          }
        }
      }

      // Duration of marriage
      if (husband && wife) {
        const hDeath = extractYear(husband.deathYear || husband.deathDate);
        const wDeath = extractYear(wife.deathYear || wife.deathDate);
        const endYear = Math.min(hDeath || 9999, wDeath || 9999);
        if (endYear !== 9999 && endYear >= mYear) {
          const dur = endYear - mYear;
          if (dur > 0 && dur < 90) {
            longestMarriages.push({ familyId: fam.id, husband, wife, duration: dur });
          }
        }
      }
    }

    // Spouse age gap
    if (husband && wife) {
      const hBirth = extractYear(husband.birthYear || husband.birthDate);
      const wBirth = extractYear(wife.birthYear || wife.birthDate);
      if (hBirth !== null && wBirth !== null) {
        const gap = Math.abs(hBirth - wBirth);
        totalAgeGapSum += gap;
        ageGapCount++;
        if (gap >= 5) {
          biggestAgeGaps.push({
            familyId: fam.id,
            husband,
            wife,
            gap,
            older: hBirth < wBirth ? 'husband' : 'wife'
          });
        }
      }
    }
  });

  biggestAgeGaps.sort((a, b) => b.gap - a.gap);
  longestMarriages.sort((a, b) => b.duration - a.duration);

  const avgMarriageAgeMen = groomAgeCount > 0 ? Math.round(groomAgeSum / groomAgeCount) : null;
  const avgMarriageAgeWomen = brideAgeCount > 0 ? Math.round(brideAgeSum / brideAgeCount) : null;
  const avgAgeGapBetweenSpouses = ageGapCount > 0 ? Math.round(totalAgeGapSum / ageGapCount) : null;

  const marriagesByMonth = monthNames.slice(1).map((name, idx) => ({
    month: idx + 1,
    name,
    count: marriageMonthCounts[idx + 1]
  }));

  // 8. Children & Parents
  const largestFamilies: { familyId: string; husband?: Person; wife?: Person; count: number; children: Person[] }[] = [];
  let totalChildrenCount = 0;
  let familiesWithChildrenCount = 0;

  let motherFirstChildAgeSum = 0;
  let motherFirstChildCount = 0;
  let fatherFirstChildAgeSum = 0;
  let fatherFirstChildCount = 0;

  let youngestMother: { person: Person; age: number; childName: string } | null = null;
  let youngestFather: { person: Person; age: number; childName: string } | null = null;
  let oldestMother: { person: Person; age: number; childName: string } | null = null;
  let oldestFather: { person: Person; age: number; childName: string } | null = null;

  let boysCount = 0;
  let girlsCount = 0;

  let totalIntervalSum = 0;
  let totalIntervalCount = 0;

  families.forEach((fam) => {
    const rawChildrenIds = Array.isArray(fam.children)
      ? fam.children.map((c) => (typeof c === 'string' ? c : c.personId))
      : fam.childrenIds || [];

    const kids = rawChildrenIds.map((id) => personMap.get(id)).filter(Boolean) as Person[];
    const count = kids.length;

    if (count > 0) {
      familiesWithChildrenCount++;
      totalChildrenCount += count;
      largestFamilies.push({
        familyId: fam.id,
        husband: fam.husbandId ? personMap.get(fam.husbandId) : undefined,
        wife: fam.wifeId ? personMap.get(fam.wifeId) : undefined,
        count,
        children: kids
      });

      // Sort children by birth year for intervals and first-child age
      const kidsWithYears = kids
        .map((k) => ({ person: k, year: extractYear(k.birthYear || k.birthDate) }))
        .filter((k): k is { person: Person; year: number } => k.year !== null)
        .sort((a, b) => a.year - b.year);

      // Gender count of children
      kids.forEach((k) => {
        if (isPersonMale(k, database)) boysCount++;
        else if (isPersonFemale(k, database)) girlsCount++;
      });

      // Intervals
      for (let i = 1; i < kidsWithYears.length; i++) {
        const diff = kidsWithYears[i].year - kidsWithYears[i - 1].year;
        if (diff >= 0 && diff <= 15) {
          totalIntervalSum += diff;
          totalIntervalCount++;
        }
      }

      // First child & youngest/oldest parent
      const husband = fam.husbandId ? personMap.get(fam.husbandId) : undefined;
      const wife = fam.wifeId ? personMap.get(fam.wifeId) : undefined;
      const hBirth = husband ? extractYear(husband.birthYear || husband.birthDate) : null;
      const wBirth = wife ? extractYear(wife.birthYear || wife.birthDate) : null;

      if (kidsWithYears.length > 0) {
        const firstKid = kidsWithYears[0];
        const lastKid = kidsWithYears[kidsWithYears.length - 1];

        if (husband && hBirth !== null) {
          const ageAtFirst = firstKid.year - hBirth;
          if (ageAtFirst >= 14 && ageAtFirst <= 70) {
            fatherFirstChildAgeSum += ageAtFirst;
            fatherFirstChildCount++;
          }
          kidsWithYears.forEach((k) => {
            const age = k.year - hBirth;
            if (age >= 14 && age <= 80) {
              if (!youngestFather || age < youngestFather.age) {
                youngestFather = { person: husband, age, childName: getPersonName(k.person) };
              }
              if (!oldestFather || age > oldestFather.age) {
                oldestFather = { person: husband, age, childName: getPersonName(k.person) };
              }
            }
          });
        }

        if (wife && wBirth !== null) {
          const ageAtFirst = firstKid.year - wBirth;
          if (ageAtFirst >= 13 && ageAtFirst <= 55) {
            motherFirstChildAgeSum += ageAtFirst;
            motherFirstChildCount++;
          }
          kidsWithYears.forEach((k) => {
            const age = k.year - wBirth;
            if (age >= 13 && age <= 60) {
              if (!youngestMother || age < youngestMother.age) {
                youngestMother = { person: wife, age, childName: getPersonName(k.person) };
              }
              if (!oldestMother || age > oldestMother.age) {
                oldestMother = { person: wife, age, childName: getPersonName(k.person) };
              }
            }
          });
        }
      }
    }
  });

  largestFamilies.sort((a, b) => b.count - a.count);

  const averageChildrenPerFamily = familiesWithChildrenCount > 0 ? +(totalChildrenCount / familiesWithChildrenCount).toFixed(1) : 0;
  const avgMotherAgeAtFirstChild = motherFirstChildCount > 0 ? Math.round(motherFirstChildAgeSum / motherFirstChildCount) : null;
  const avgFatherAgeAtFirstChild = fatherFirstChildCount > 0 ? Math.round(fatherFirstChildAgeSum / fatherFirstChildCount) : null;
  const avgChildIntervalYears = totalIntervalCount > 0 ? +(totalIntervalSum / totalIntervalCount).toFixed(1) : null;

  // 9. Generations Breakdown
  const genMap: Record<number, number> = {};
  persons.forEach((p) => {
    const gen = p.generation !== undefined && p.generation !== null ? p.generation : 1;
    genMap[gen] = (genMap[gen] || 0) + 1;
  });

  const generations = Object.entries(genMap)
    .map(([genStr, count]) => ({ gen: parseInt(genStr, 10), count }))
    .sort((a, b) => a.gen - b.gen);

  const maxGenerationsCount = generations.length > 0 ? Math.max(...generations.map((g) => g.gen)) : 1;

  // 10. Research status stats
  const statusCounts: Record<string, number> = {};
  persons.forEach((p) => {
    const st = p.researchStatus || (p.isHypothesis ? 'hypothesis' : 'confirmed');
    statusCounts[st] = (statusCounts[st] || 0) + 1;
  });

  const researchStatusStats = [
    { status: 'confirmed', label: 'Підтверджено документами', count: statusCounts['confirmed'] || 0, color: '#10b981' },
    { status: 'in_progress', label: 'В процесі пошуку', count: statusCounts['in_progress'] || 0, color: '#38bdf8' },
    { status: 'needs_verification', label: 'Потребує перевірки', count: statusCounts['needs_verification'] || 0, color: '#f59e0b' },
    { status: 'hypothesis', label: 'Гіпотези та версії', count: (statusCounts['hypothesis'] || 0) + (statusCounts['hypothetical'] || 0), color: '#a855f7' }
  ];

  return {
    totalPersons,
    males,
    females,
    unknownGender,
    livingCount,
    deceasedCount,
    totalFamilies: families.length,
    averageLifespan: averageLifespanOverall,
    profilesWithPhotos,
    profilesWithDates,
    profilesWithPlaces,
    clans,
    topSurnames,
    generations,
    maxGenerationsCount,
    researchStatusStats,
    topPlaces,
    topBirthPlaces,
    topDeathPlaces,
    localRootedCount,
    migratedCount,
    averageLifespanOverall,
    averageLifespanMales,
    averageLifespanFemales,
    longestLived,
    lifespanByCentury,
    ageDistribution,
    oldestLiving,
    birthsByCentury,
    birthsByDecade,
    birthsByMonth,
    earliestBorn,
    latestBorn,
    totalMarriagesWithDates,
    avgMarriageAgeMen,
    avgMarriageAgeWomen,
    youngestGroom,
    youngestBride,
    oldestGroom,
    oldestBride,
    avgAgeGapBetweenSpouses,
    biggestAgeGaps: biggestAgeGaps.slice(0, 8),
    longestMarriages: longestMarriages.slice(0, 8),
    marriagesByMonth,
    averageChildrenPerFamily,
    largestFamilies: largestFamilies.slice(0, 8),
    avgMotherAgeAtFirstChild,
    avgFatherAgeAtFirstChild,
    youngestMother,
    youngestFather,
    oldestMother,
    oldestFather,
    childrenGenderRatio: { boys: boysCount, girls: girlsCount },
    avgChildIntervalYears
  };
}
