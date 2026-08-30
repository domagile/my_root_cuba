/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Comprehensive Tree Data Health & Conflict Audit Engine
 */

import { Person, Family, TreeConflict } from '../types';

export interface TreeHealthReport {
  conflicts: TreeConflict[];
  stats: {
    total: number;
    critical: number;
    warning: number;
    gap: number;
    healthScore: number;
  };
  byCategory: {
    chronology: number;
    biology: number;
    cycles: number;
    relations: number;
    data_gaps: number;
  };
}

/**
 * Extracts a 4-digit year from arbitrary date strings or numbers
 */
export function extractYear(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }
  const str = String(value).trim();
  if (!str) return null;
  
  const match = str.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Parses a date string into timestamp if possible (YYYY-MM-DD, DD.MM.YYYY, etc.)
 */
export function parseDateToTime(value: string | undefined | null): number | null {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;

  // Try standard ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const t = Date.parse(str);
    if (!isNaN(t)) return t;
  }

  // Try DD.MM.YYYY
  const dmy = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10) - 1;
    const year = parseInt(dmy[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d.getTime();
  }

  const y = extractYear(str);
  if (y) {
    return new Date(y, 0, 1).getTime();
  }

  return null;
}

/**
 * Detects circular loops in ancestry using Depth First Search
 */
function detectAncestryCycles(personsMap: Map<string, Person>): TreeConflict[] {
  const conflicts: TreeConflict[] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const reportedCycles = new Set<string>();

  function dfs(personId: string, path: string[]) {
    visited.add(personId);
    recursionStack.add(personId);
    path.push(personId);

    const person = personsMap.get(personId);
    if (person) {
      const parentIds = [person.fatherId, person.motherId].filter(Boolean) as string[];

      for (const parentId of parentIds) {
        if (!personsMap.has(parentId)) continue;

        if (parentId === personId) {
          const conflictKey = `self_loop_${personId}`;
          if (!reportedCycles.has(conflictKey)) {
            reportedCycles.add(conflictKey);
            const pName = `${person.name?.surname || person.lastName || ''} ${person.name?.given || person.firstName || ''}`.trim() || person.id;
            conflicts.push({
              id: conflictKey,
              type: 'cycles',
              severity: 'critical',
              title: 'Кільцевий цикл (Особа є власним батьком)',
              description: `Особа «${pName}» (ID: ${personId}) вказана як власний батько/мати.`,
              recommendation: 'Відкрийте картку особи та видаліть посилання на самого себе в полі батьків.',
              personId,
              personName: pName,
              canAutoFix: true,
              autoFixType: 'remove_self_loop'
            });
          }
          continue;
        }

        if (recursionStack.has(parentId)) {
          // Cycle detected!
          const cyclePath = [...path, parentId];
          const cycleKey = [...cyclePath].sort().join('-');
          if (!reportedCycles.has(cycleKey)) {
            reportedCycles.add(cycleKey);
            const pName = `${person.name?.surname || person.lastName || ''} ${person.name?.given || person.firstName || ''}`.trim() || person.id;
            const parent = personsMap.get(parentId);
            const parentName = parent ? `${parent.name?.surname || parent.lastName || ''} ${parent.name?.given || parent.firstName || ''}`.trim() : parentId;

            const pathNames = cyclePath.map(id => {
              const p = personsMap.get(id);
              return p ? `${p.name?.surname || p.lastName || ''} ${p.name?.given || p.firstName || ''}`.trim() || id : id;
            }).join(' ➔ ');

            conflicts.push({
              id: `cycle_${personId}_${parentId}`,
              type: 'cycles',
              severity: 'critical',
              title: 'Зациклення родоводу (Graph Loop)',
              description: `Виявлено замкнене коло предків: ${pathNames}`,
              recommendation: `Особа «${pName}» є водночас і предком, і нащадком для «${parentName}». Необхідно розірвати некоректний зв'язок батьківства.`,
              personId,
              personName: pName,
              relatedPersonId: parentId,
              relatedPersonName: parentName,
              canAutoFix: true,
              autoFixType: 'remove_self_loop'
            });
          }
        } else if (!visited.has(parentId)) {
          dfs(parentId, [...path]);
        }
      }
    }

    recursionStack.delete(personId);
  }

  for (const personId of personsMap.keys()) {
    if (!visited.has(personId)) {
      dfs(personId, []);
    }
  }

  return conflicts;
}

/**
 * Main Audit Engine
 */
export function runTreeDataHealthAudit(
  persons: Person[],
  families: Record<string, Family> = {}
): TreeHealthReport {
  const conflicts: TreeConflict[] = [];
  const personsMap = new Map<string, Person>();
  const currentYear = new Date().getFullYear();

  persons.forEach((p) => personsMap.set(p.id, p));

  // 1. Detect Graph Loop Cycles
  const cycleConflicts = detectAncestryCycles(personsMap);
  conflicts.push(...cycleConflicts);

  // 2. Iterate through each person for chronological, biological, and reference audits
  for (const person of persons) {
    const pGiven = person.name?.given || person.firstName || '';
    const pSurname = person.name?.surname || person.lastName || '';
    const pName = `${pSurname} ${pGiven}`.trim() || `Особа ${person.id}`;

    const birthYear = extractYear(person.birthDate) || extractYear(person.birthYear);
    const deathYear = extractYear(person.deathDate) || extractYear(person.deathYear);
    const birthTime = parseDateToTime(person.birthDate);
    const deathTime = parseDateToTime(person.deathDate);

    // --- A. DATA GAPS (Прогалини в даних) ---
    if (!pSurname) {
      conflicts.push({
        id: `gap_surname_${person.id}`,
        type: 'data_gaps',
        severity: 'gap',
        title: 'Відсутнє прізвище',
        description: `У персони «${pGiven || person.id}» не вказано родове прізвище.`,
        recommendation: 'Заповніть прізвище або дівоче прізвище з архівних джерел (метричні книги, сповідні розписи).',
        personId: person.id,
        personName: pName
      });
    }

    if (!pGiven) {
      conflicts.push({
        id: `gap_given_${person.id}`,
        type: 'data_gaps',
        severity: 'gap',
        title: 'Відсутнє імʼя',
        description: `У персони «${pSurname || person.id}» не вказано власне імʼя.`,
        recommendation: 'Вкажіть імʼя особи для однозначної ідентифікації в дереві.',
        personId: person.id,
        personName: pName
      });
    }

    if (!birthYear && !deathYear) {
      conflicts.push({
        id: `gap_dates_${person.id}`,
        type: 'data_gaps',
        severity: 'gap',
        title: 'Відсутні хронологічні дати',
        description: `Не вказано ані дати/року народження, ані дати смерті для «${pName}».`,
        recommendation: 'Введіть хоча б приблизний рік народження (наприклад, за віком у ревізькій казці чи метриці).',
        personId: person.id,
        personName: pName
      });
    }

    if (birthYear && !person.birthPlace) {
      conflicts.push({
        id: `gap_birthplace_${person.id}`,
        type: 'data_gaps',
        severity: 'gap',
        title: 'Не вказано місце народження',
        description: `Для «${pName}» (${birthYear} р.н.) не зазначено населений пункт або парафію народження.`,
        recommendation: 'Додайте село/місто або парафіяльну церкву для відображення на історичній карті.',
        personId: person.id,
        personName: pName
      });
    }

    // --- B. CHRONOLOGICAL ANOMALIES ---
    if (birthYear && deathYear) {
      if (deathYear < birthYear) {
        conflicts.push({
          id: `chrono_death_before_birth_${person.id}`,
          type: 'chronology',
          severity: 'critical',
          title: 'Смерть раніше за народження',
          description: `Рік смерті (${deathYear}) передує року народження (${birthYear}) для «${pName}».`,
          recommendation: 'Перевірте записи метричних книг: виправте дату народження або смерті.',
          personId: person.id,
          personName: pName,
          metadata: { birthYear, deathYear }
        });
      } else if (birthTime && deathTime && deathTime < birthTime) {
        conflicts.push({
          id: `chrono_death_date_before_birth_${person.id}`,
          type: 'chronology',
          severity: 'critical',
          title: 'Точна дата смерті раніше дати народження',
          description: `Дата смерті (${person.deathDate}) раніше ніж дата народження (${person.birthDate}) для «${pName}».`,
          recommendation: 'Уточніть календарні дати за актовими записами.',
          personId: person.id,
          personName: pName
        });
      } else if (deathYear - birthYear > 115) {
        conflicts.push({
          id: `chrono_super_longevity_${person.id}`,
          type: 'chronology',
          severity: 'warning',
          title: 'Аномальна тривалість життя (> 115 років)',
          description: `Зазначено тривалість життя ${deathYear - birthYear} років (${birthYear} – ${deathYear}) для «${pName}».`,
          recommendation: 'Ймовірно, відбулося обʼєднання записів повних тезок (діда та онука). Перевірте ревізії.',
          personId: person.id,
          personName: pName
        });
      }
    }

    if (person.isLiving && birthYear && currentYear - birthYear > 115) {
      conflicts.push({
        id: `chrono_living_centenarian_${person.id}`,
        type: 'chronology',
        severity: 'warning',
        title: 'Статус «Живий» для людини віком понад 115 років',
        description: `Особа «${pName}» (${birthYear} р.н., вік ${currentYear - birthYear} р.) позначена як жива без дати смерті.`,
        recommendation: 'Зніміть прапорець «Нині живий» або вкажіть приблизний рік упокоєння.',
        personId: person.id,
        personName: pName
      });
    }

    // --- C. BIOLOGICAL PARENTHOOD CONSTRAINTS ---
    // 1. Father checks
    if (person.fatherId) {
      const father = personsMap.get(person.fatherId);
      if (!father) {
        conflicts.push({
          id: `ref_dangling_father_${person.id}`,
          type: 'relations',
          severity: 'critical',
          title: 'Недійсне посилання на батька',
          description: `Особа «${pName}» посилається на батька з ID «${person.fatherId}», якого не існує в базі.`,
          recommendation: 'Очистіть недійсне посилання або створіть картку батька.',
          personId: person.id,
          personName: pName,
          canAutoFix: true,
          autoFixType: 'clean_dangling'
        });
      } else {
        const fatherGiven = father.name?.given || father.firstName || '';
        const fatherSurname = father.name?.surname || father.lastName || '';
        const fatherName = `${fatherSurname} ${fatherGiven}`.trim() || father.id;

        // Gender of father
        if (father.gender === 'female' || father.gender === 'F') {
          conflicts.push({
            id: `bio_father_female_${person.id}`,
            type: 'biology',
            severity: 'warning',
            title: 'Батько має жіночу стать у базі',
            description: `Батько «${fatherName}» для «${pName}» має позначку статі «Жінка».`,
            recommendation: 'Змініть стать у картці батька на чоловічу або перепризначте як матір.',
            personId: father.id,
            personName: fatherName,
            relatedPersonId: person.id,
            relatedPersonName: pName
          });
        }

        const fatherBirthYear = extractYear(father.birthDate) || extractYear(father.birthYear);
        const fatherDeathYear = extractYear(father.deathDate) || extractYear(father.deathYear);

        if (birthYear && fatherBirthYear) {
          const fatherAgeAtChildBirth = birthYear - fatherBirthYear;

          if (fatherAgeAtChildBirth < 0) {
            conflicts.push({
              id: `bio_father_younger_${person.id}`,
              type: 'biology',
              severity: 'critical',
              title: 'Батько молодший за дитину',
              description: `Батько «${fatherName}» (${fatherBirthYear} р.н.) народився пізніше за дитину «${pName}» (${birthYear} р.н.).`,
              recommendation: 'Виправте роки народження або родинний звʼязок.',
              personId: person.id,
              personName: pName,
              relatedPersonId: father.id,
              relatedPersonName: fatherName
            });
          } else if (fatherAgeAtChildBirth < 14) {
            conflicts.push({
              id: `bio_father_too_young_${person.id}`,
              type: 'biology',
              severity: 'critical',
              title: 'Занадто малий вік батька (< 14 років)',
              description: `Батькові «${fatherName}» було лише ${fatherAgeAtChildBirth} років на момент народження «${pName}» (${fatherBirthYear} ➔ ${birthYear}).`,
              recommendation: 'Перевірте метричні записи або по батькові дитини.',
              personId: person.id,
              personName: pName,
              relatedPersonId: father.id,
              relatedPersonName: fatherName
            });
          } else if (fatherAgeAtChildBirth > 85) {
            conflicts.push({
              id: `bio_father_too_old_${person.id}`,
              type: 'biology',
              severity: 'warning',
              title: 'Аномально похилий вік батька (> 85 років)',
              description: `Батькові «${fatherName}» було ${fatherAgeAtChildBirth} років на момент народження дитини «${pName}» (${fatherBirthYear} ➔ ${birthYear}).`,
              recommendation: 'Перевірте, чи не належить дитина до наступного покоління (онук/правнук).',
              personId: person.id,
              personName: pName,
              relatedPersonId: father.id,
              relatedPersonName: fatherName
            });
          }
        }

        // Child born after father's death (> 1 year)
        if (birthYear && fatherDeathYear && birthYear > fatherDeathYear + 1) {
          conflicts.push({
            id: `bio_child_after_father_death_${person.id}`,
            type: 'biology',
            severity: 'critical',
            title: 'Народження дитини значно пізніше смерті батька',
            description: `Дитина «${pName}» (${birthYear} р.н.) народилася через ${birthYear - fatherDeathYear} р. після смерті батька «${fatherName}» (†${fatherDeathYear}).`,
            recommendation: 'Біологічно неможливо зачати дитину через понад 10 місяців після смерті батька. Перевірте дати.',
            personId: person.id,
            personName: pName,
            relatedPersonId: father.id,
            relatedPersonName: fatherName
          });
        }

        // Check bidirectional child link
        if (father.childrenIds && !father.childrenIds.includes(person.id)) {
          conflicts.push({
            id: `rel_asym_father_child_${person.id}`,
            type: 'relations',
            severity: 'warning',
            title: 'Асиметричний родинний звʼязок (Батько ➔ Дитина)',
            description: `«${pName}» вказує батьком «${fatherName}», але у батька відсутній запис про цю дитину в списку дітей.`,
            recommendation: 'Синхронізуйте список дітей у картці батька.',
            personId: father.id,
            personName: fatherName,
            relatedPersonId: person.id,
            relatedPersonName: pName,
            canAutoFix: true,
            autoFixType: 'sync_parent_child'
          });
        }
      }
    }

    // 2. Mother checks
    if (person.motherId) {
      const mother = personsMap.get(person.motherId);
      if (!mother) {
        conflicts.push({
          id: `ref_dangling_mother_${person.id}`,
          type: 'relations',
          severity: 'critical',
          title: 'Недійсне посилання на матір',
          description: `Особа «${pName}» посилається на матір з ID «${person.motherId}», якої не існує в базі.`,
          recommendation: 'Очистіть недійсне посилання або створіть картку матері.',
          personId: person.id,
          personName: pName,
          canAutoFix: true,
          autoFixType: 'clean_dangling'
        });
      } else {
        const motherGiven = mother.name?.given || mother.firstName || '';
        const motherSurname = mother.name?.surname || mother.lastName || '';
        const motherName = `${motherSurname} ${motherGiven}`.trim() || mother.id;

        // Gender of mother
        if (mother.gender === 'male' || mother.gender === 'M') {
          conflicts.push({
            id: `bio_mother_male_${person.id}`,
            type: 'biology',
            severity: 'warning',
            title: 'Мати має чоловічу стать у базі',
            description: `Мати «${motherName}» для «${pName}» позначена як «Чоловік».`,
            recommendation: 'Змініть стать у картці матері на жіночу або перепризначте як батька.',
            personId: mother.id,
            personName: motherName,
            relatedPersonId: person.id,
            relatedPersonName: pName
          });
        }

        const motherBirthYear = extractYear(mother.birthDate) || extractYear(mother.birthYear);
        const motherDeathYear = extractYear(mother.deathDate) || extractYear(mother.deathYear);

        if (birthYear && motherBirthYear) {
          const motherAgeAtChildBirth = birthYear - motherBirthYear;

          if (motherAgeAtChildBirth < 0) {
            conflicts.push({
              id: `bio_mother_younger_${person.id}`,
              type: 'biology',
              severity: 'critical',
              title: 'Мати народилася пізніше за свою дитину',
              description: `Мати «${motherName}» (${motherBirthYear} р.н.) народилася пізніше за дитину «${pName}» (${birthYear} р.н.).`,
              recommendation: 'Перевірте роки народження матері та дитини.',
              personId: person.id,
              personName: pName,
              relatedPersonId: mother.id,
              relatedPersonName: motherName
            });
          } else if (motherAgeAtChildBirth < 12) {
            conflicts.push({
              id: `bio_mother_too_young_${person.id}`,
              type: 'biology',
              severity: 'critical',
              title: 'Нереалістично юний вік матері (< 12 років)',
              description: `Матері «${motherName}» було ${motherAgeAtChildBirth} років на момент народження дитини «${pName}» (${motherBirthYear} ➔ ${birthYear}).`,
              recommendation: 'Біологічна аномалія. Уточніть ревізії чи шлюбний обшук.',
              personId: person.id,
              personName: pName,
              relatedPersonId: mother.id,
              relatedPersonName: motherName
            });
          } else if (motherAgeAtChildBirth > 55) {
            conflicts.push({
              id: `bio_mother_too_old_${person.id}`,
              type: 'biology',
              severity: 'warning',
              title: 'Аномально високий репродуктивний вік матері (> 55 років)',
              description: `Матері «${motherName}» було ${motherAgeAtChildBirth} років на момент народження дитини «${pName}» (${motherBirthYear} ➔ ${birthYear}).`,
              recommendation: 'У віці понад 55 років народження дітей є малоймовірним. Перевірте, чи не була вона мачухою/прийомною матірʼю.',
              personId: person.id,
              personName: pName,
              relatedPersonId: mother.id,
              relatedPersonName: motherName
            });
          }
        }

        // Child born after mother's death
        if (birthYear && motherDeathYear && birthYear > motherDeathYear) {
          conflicts.push({
            id: `bio_child_after_mother_death_${person.id}`,
            type: 'biology',
            severity: 'critical',
            title: 'Народження дитини після смерті матері',
            description: `Дитина «${pName}» (${birthYear} р.н.) народилася після року смерті матері «${motherName}» (†${motherDeathYear}).`,
            recommendation: 'Мати не могла народити після своєї смерті. Перевірте дату смерті матері або справжню матір дитини.',
            personId: person.id,
            personName: pName,
            relatedPersonId: mother.id,
            relatedPersonName: motherName
          });
        }

        // Check bidirectional child link
        if (mother.childrenIds && !mother.childrenIds.includes(person.id)) {
          conflicts.push({
            id: `rel_asym_mother_child_${person.id}`,
            type: 'relations',
            severity: 'warning',
            title: 'Асиметричний родинний звʼязок (Мати ➔ Дитина)',
            description: `«${pName}» вказує матірʼю «${motherName}», але у матері відсутній запис про цю дитину в списку дітей.`,
            recommendation: 'Синхронізуйте список дітей у картці матері.',
            personId: mother.id,
            personName: motherName,
            relatedPersonId: person.id,
            relatedPersonName: pName,
            canAutoFix: true,
            autoFixType: 'sync_parent_child'
          });
        }
      }
    }

    // --- D. SPOUSE & MARRIAGE CHECKS ---
    const spouses = person.spouseIds || [];
    for (const spouseId of spouses) {
      if (spouseId === person.id) {
        conflicts.push({
          id: `rel_self_spouse_${person.id}`,
          type: 'relations',
          severity: 'critical',
          title: 'Шлюб із самим собою',
          description: `Особа «${pName}» зазначена як власне подружжя.`,
          recommendation: 'Видаліть посилання на власне ID зі списку подружжя.',
          personId: person.id,
          personName: pName,
          canAutoFix: true,
          autoFixType: 'sync_spouses'
        });
        continue;
      }

      const spouse = personsMap.get(spouseId);
      if (!spouse) {
        conflicts.push({
          id: `ref_dangling_spouse_${person.id}_${spouseId}`,
          type: 'relations',
          severity: 'critical',
          title: 'Недійсне посилання на подружжя',
          description: `У «${pName}» є посилання на подружжя (ID: ${spouseId}), якого немає в базі даних.`,
          recommendation: 'Видаліть недійсний ідентифікатор зі списку шлюбів.',
          personId: person.id,
          personName: pName,
          canAutoFix: true,
          autoFixType: 'clean_dangling'
        });
      } else {
        const spouseGiven = spouse.name?.given || spouse.firstName || '';
        const spouseSurname = spouse.name?.surname || spouse.lastName || '';
        const spouseName = `${spouseSurname} ${spouseGiven}`.trim() || spouse.id;

        // Check bidirectional spouse link
        if (!spouse.spouseIds?.includes(person.id)) {
          conflicts.push({
            id: `rel_asym_spouse_${person.id}_${spouseId}`,
            type: 'relations',
            severity: 'warning',
            title: 'Односторонній шлюбний звʼязок',
            description: `«${pName}» вказує подружжям «${spouseName}», але в картці «${spouseName}» цей звʼязок відсутній.`,
            recommendation: 'Синхронізуйте зворотне посилання в картці подружжя.',
            personId: person.id,
            personName: pName,
            relatedPersonId: spouse.id,
            relatedPersonName: spouseName,
            canAutoFix: true,
            autoFixType: 'sync_spouses'
          });
        }
      }
    }

    // --- E. CHILDREN INTEGRITY CHECKS ---
    const childrenIds = person.childrenIds || [];
    for (const childId of childrenIds) {
      const child = personsMap.get(childId);
      if (!child) {
        conflicts.push({
          id: `ref_dangling_child_${person.id}_${childId}`,
          type: 'relations',
          severity: 'critical',
          title: 'Недійсне посилання на дитину',
          description: `У «${pName}» вказана дитина з ID «${childId}», якої немає в базі даних.`,
          recommendation: 'Видаліть відсутній ID дитини або створіть картку.',
          personId: person.id,
          personName: pName,
          canAutoFix: true,
          autoFixType: 'clean_dangling'
        });
      }
    }
  }

  // Deduplicate conflicts by id
  const uniqueConflictsMap = new Map<string, TreeConflict>();
  conflicts.forEach(c => uniqueConflictsMap.set(c.id, c));
  const finalConflicts = Array.from(uniqueConflictsMap.values());

  // Calculate statistics & Health Score
  const critical = finalConflicts.filter(c => c.severity === 'critical').length;
  const warning = finalConflicts.filter(c => c.severity === 'warning').length;
  const gap = finalConflicts.filter(c => c.severity === 'gap').length;

  const penalty = critical * 15 + warning * 4 + gap * 1;
  const healthScore = Math.max(0, Math.min(100, 100 - penalty));

  return {
    conflicts: finalConflicts,
    stats: {
      total: finalConflicts.length,
      critical,
      warning,
      gap,
      healthScore
    },
    byCategory: {
      chronology: finalConflicts.filter(c => c.type === 'chronology').length,
      biology: finalConflicts.filter(c => c.type === 'biology').length,
      cycles: finalConflicts.filter(c => c.type === 'cycles').length,
      relations: finalConflicts.filter(c => c.type === 'relations').length,
      data_gaps: finalConflicts.filter(c => c.type === 'data_gaps').length
    }
  };
}

/**
 * Auto-fix engine to repair bidirectional links, self-loops, and dangling references
 */
export function autoFixTreeConflict(
  conflict: TreeConflict,
  persons: Person[]
): { updatedPersons: Person[]; message: string } {
  const personsMap = new Map<string, Person>();
  persons.forEach(p => personsMap.set(p.id, { ...p }));

  if (conflict.autoFixType === 'sync_parent_child') {
    const parent = personsMap.get(conflict.personId);
    const childId = conflict.relatedPersonId;
    if (parent && childId) {
      const childrenSet = new Set(parent.childrenIds || []);
      childrenSet.add(childId);
      parent.childrenIds = Array.from(childrenSet);
      personsMap.set(parent.id, parent);
      return {
        updatedPersons: Array.from(personsMap.values()),
        message: `Успішно додано дитину до списку дітей батька/матері «${conflict.personName}».`
      };
    }
  }

  if (conflict.autoFixType === 'sync_spouses') {
    const person = personsMap.get(conflict.personId);
    const relatedId = conflict.relatedPersonId;
    if (person && relatedId) {
      const spouse = personsMap.get(relatedId);
      if (spouse) {
        const sSpouses = new Set(spouse.spouseIds || []);
        sSpouses.add(person.id);
        spouse.spouseIds = Array.from(sSpouses);
        personsMap.set(spouse.id, spouse);
      }
      return {
        updatedPersons: Array.from(personsMap.values()),
        message: `Синхронізовано взаємний звʼязок подружжя між «${conflict.personName}» та «${conflict.relatedPersonName || relatedId}».`
      };
    }
  }

  if (conflict.autoFixType === 'remove_self_loop') {
    const person = personsMap.get(conflict.personId);
    if (person) {
      if (person.fatherId === person.id) person.fatherId = undefined;
      if (person.motherId === person.id) person.motherId = undefined;
      if (person.spouseIds) {
        person.spouseIds = person.spouseIds.filter(id => id !== person.id);
      }
      if (person.childrenIds) {
        person.childrenIds = person.childrenIds.filter(id => id !== person.id);
      }
      personsMap.set(person.id, person);
      return {
        updatedPersons: Array.from(personsMap.values()),
        message: `Усунуто циклічне самопосилання в картці «${conflict.personName}».`
      };
    }
  }

  if (conflict.autoFixType === 'clean_dangling') {
    const person = personsMap.get(conflict.personId);
    if (person) {
      if (person.fatherId && !personsMap.has(person.fatherId)) person.fatherId = undefined;
      if (person.motherId && !personsMap.has(person.motherId)) person.motherId = undefined;
      if (person.spouseIds) {
        person.spouseIds = person.spouseIds.filter(id => personsMap.has(id));
      }
      if (person.childrenIds) {
        person.childrenIds = person.childrenIds.filter(id => personsMap.has(id));
      }
      personsMap.set(person.id, person);
      return {
        updatedPersons: Array.from(personsMap.values()),
        message: `Очищено недійсні зовнішні посилання в картці «${conflict.personName}».`
      };
    }
  }

  return {
    updatedPersons: persons,
    message: 'Автоматичне виправлення не підтримується для цього типу конфлікту.'
  };
}
