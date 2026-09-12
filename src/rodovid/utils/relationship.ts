/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Person, GenealogyDatabase } from '../types/genealogy';
import { normalizeUkrainianSurnameGender } from '../../utils/ukrainianPhonetics';

export function getFullName(person?: Person | null): string {
  if (!person) return 'Невідома особа';
  const surname = person.name?.surname || person.lastName || '';
  const given = person.name?.given || person.firstName || '';
  const patronymic = person.name?.patronymic || person.patronymic || '';
  const maiden = person.name?.maidenName || person.maidenName || '';
  const parts = [surname, given, patronymic].filter(Boolean);
  const isFemale = person.gender === 'female' || person.gender === 'F';
  if (maiden && isFemale) {
    return `${parts.join(' ')} / ${maiden}`;
  }
  return parts.join(' ') || 'Без імені';
}

export function getPersonBirthYearNum(p?: Person | null): number {
  if (!p) return -999999;
  if (p.birthYear && !isNaN(Number(p.birthYear))) {
    return Number(p.birthYear);
  }
  if (p.birthDate) {
    const m = String(p.birthDate).match(/\b(1\d{3}|20\d{2})\b/);
    if (m) return parseInt(m[1], 10);
  }
  return -999999;
}

export function sortPersonsBySurnameAndBirthDesc(persons: Person[]): Person[] {
  return [...persons].sort((a, b) => {
    const surnameA = (a.name?.surname || a.lastName || a.name?.maidenName || a.maidenName || '').trim();
    const surnameB = (b.name?.surname || b.lastName || b.name?.maidenName || b.maidenName || '').trim();
    const normA = normalizeUkrainianSurnameGender(surnameA) || surnameA;
    const normB = normalizeUkrainianSurnameGender(surnameB) || surnameB;
    const surnameCmp = normA.localeCompare(normB, 'uk', { sensitivity: 'base' });
    if (surnameCmp !== 0) return surnameCmp;

    // Secondary compare on raw surname
    const rawCmp = surnameA.localeCompare(surnameB, 'uk', { sensitivity: 'base' });
    if (rawCmp !== 0) return rawCmp;

    // By birth year descending (youngest / most recently born on top)
    const yearA = getPersonBirthYearNum(a);
    const yearB = getPersonBirthYearNum(b);
    if (yearA !== yearB) return yearB - yearA;

    // By given name
    const givenA = (a.name?.given || a.firstName || '').trim();
    const givenB = (b.name?.given || b.firstName || '').trim();
    return givenA.localeCompare(givenB, 'uk', { sensitivity: 'base' });
  });
}

export function getPersonFatherId(person: Person, database: GenealogyDatabase): string | undefined {
  if (person.fatherId) return person.fatherId;
  if (person.parentFamilyId && database.families[person.parentFamilyId]) {
    return database.families[person.parentFamilyId].husbandId;
  }
  return undefined;
}

export function getPersonMotherId(person: Person, database: GenealogyDatabase): string | undefined {
  if (person.motherId) return person.motherId;
  if (person.parentFamilyId && database.families[person.parentFamilyId]) {
    return database.families[person.parentFamilyId].wifeId;
  }
  return undefined;
}

export interface KinshipPathStep {
  personId: string;
  relationFromPrevious?: string;
  direction?: 'start' | 'up' | 'down' | 'spouse' | 'sibling';
  generationOffset?: number;
  isCommonAncestor?: boolean;
}

export interface KinshipCalculationResult {
  relationship: string;
  relationshipName: string;
  degree: number;
  degreeOfConsanguinity: number;
  coefficient: number;
  description: string;
  personA: Person | null;
  personB: Person | null;
  commonAncestors: Person[];
  path: KinshipPathStep[];
  lineageType?: 'direct_ancestor' | 'direct_descendant' | 'sibling' | 'collateral' | 'spouse' | 'in_law' | 'distant';
  generationalDistance?: number;
}

interface AdjacencyEdge {
  to: string;
  dir: 'up' | 'down' | 'spouse' | 'sibling';
  label: string;
}

/**
 * Builds bidirectional adjacency graph across all persons in GenealogyDatabase
 */
function buildKinshipGraph(db: GenealogyDatabase): Map<string, AdjacencyEdge[]> {
  const adj = new Map<string, AdjacencyEdge[]>();
  const persons = db.persons || {};
  const families = db.families || {};

  for (const pId of Object.keys(persons)) {
    adj.set(pId, []);
  }

  for (const [pId, p] of Object.entries(persons)) {
    const list = adj.get(pId)!;
    const isMale = p.gender === 'male' || p.gender === 'M';

    // 1. Parents
    const fId = p.fatherId || (p.parentFamilyId && families[p.parentFamilyId]?.husbandId);
    const mId = p.motherId || (p.parentFamilyId && families[p.parentFamilyId]?.wifeId);

    if (fId && persons[fId] && !list.some((e) => e.to === fId)) {
      list.push({ to: fId, dir: 'up', label: 'Батько' });
      const parentList = adj.get(fId);
      if (parentList && !parentList.some((e) => e.to === pId)) {
        parentList.push({ to: pId, dir: 'down', label: isMale ? 'Син' : 'Донька' });
      }
    }

    if (mId && persons[mId] && !list.some((e) => e.to === mId)) {
      list.push({ to: mId, dir: 'up', label: 'Мати' });
      const parentList = adj.get(mId);
      if (parentList && !parentList.some((e) => e.to === pId)) {
        parentList.push({ to: pId, dir: 'down', label: isMale ? 'Син' : 'Донька' });
      }
    }

    // Additional check in family children
    for (const fam of Object.values(families)) {
      if (fam.childrenIds && fam.childrenIds.includes(pId)) {
        if (fam.husbandId && persons[fam.husbandId] && !list.some((e) => e.to === fam.husbandId)) {
          list.push({ to: fam.husbandId, dir: 'up', label: 'Батько' });
          const pl = adj.get(fam.husbandId);
          if (pl && !pl.some((e) => e.to === pId)) {
            pl.push({ to: pId, dir: 'down', label: isMale ? 'Син' : 'Донька' });
          }
        }
        if (fam.wifeId && persons[fam.wifeId] && !list.some((e) => e.to === fam.wifeId)) {
          list.push({ to: fam.wifeId, dir: 'up', label: 'Мати' });
          const pl = adj.get(fam.wifeId);
          if (pl && !pl.some((e) => e.to === pId)) {
            pl.push({ to: pId, dir: 'down', label: isMale ? 'Син' : 'Донька' });
          }
        }
      }
    }

    // 2. Children directly listed on person
    if (p.childrenIds) {
      for (const cId of p.childrenIds) {
        if (persons[cId] && !list.some((e) => e.to === cId)) {
          const cPerson = persons[cId];
          const cIsMale = cPerson.gender === 'male' || cPerson.gender === 'M';
          list.push({ to: cId, dir: 'down', label: cIsMale ? 'Син' : 'Донька' });
          const cl = adj.get(cId);
          if (cl && !cl.some((e) => e.to === pId)) {
            cl.push({ to: pId, dir: 'up', label: isMale ? 'Батько' : 'Мати' });
          }
        }
      }
    }

    // 3. Spouses
    const spouses = new Set<string>(p.spouseIds || []);
    if (p.spouseFamilyIds) {
      for (const fId of p.spouseFamilyIds) {
        const fam = families[fId];
        if (fam) {
          if (fam.husbandId && fam.husbandId !== pId) spouses.add(fam.husbandId);
          if (fam.wifeId && fam.wifeId !== pId) spouses.add(fam.wifeId);
        }
      }
    }
    for (const fam of Object.values(families)) {
      if (fam.husbandId === pId && fam.wifeId && fam.wifeId !== pId) spouses.add(fam.wifeId);
      if (fam.wifeId === pId && fam.husbandId && fam.husbandId !== pId) spouses.add(fam.husbandId);
    }
    for (const sId of spouses) {
      if (persons[sId] && !list.some((e) => e.to === sId)) {
        const sPerson = persons[sId];
        const sIsMale = sPerson.gender === 'male' || sPerson.gender === 'M';
        list.push({ to: sId, dir: 'spouse', label: sIsMale ? 'Чоловік' : 'Дружина' });
        const sl = adj.get(sId);
        if (sl && !sl.some((e) => e.to === pId)) {
          sl.push({ to: pId, dir: 'spouse', label: isMale ? 'Чоловік' : 'Дружина' });
        }
      }
    }
  }

  return adj;
}

export function calculateKinship(
  arg1: any,
  arg2: any,
  arg3?: any
): KinshipCalculationResult {
  let db: GenealogyDatabase;
  let p1Id: string;
  let p2Id: string;

  if (typeof arg1 === 'object' && arg1.persons) {
    db = arg1;
    p1Id = arg2;
    p2Id = arg3;
  } else if (typeof arg3 === 'object' && arg3.persons) {
    p1Id = arg1;
    p2Id = arg2;
    db = arg3;
  } else {
    db = { persons: {}, families: {}, sources: {}, events: {} };
    p1Id = arg1;
    p2Id = arg2;
  }

  const p1 = db.persons?.[p1Id] || null;
  const p2 = db.persons?.[p2Id] || null;

  if (!p1 || !p2) {
    return {
      relationship: 'Не знайдено',
      relationshipName: 'Не знайдено',
      degree: 0,
      degreeOfConsanguinity: 0,
      coefficient: 0,
      description: 'Одну або обидві особи не знайдено в базі даних.',
      personA: p1,
      personB: p2,
      commonAncestors: [],
      path: []
    };
  }

  if (p1Id === p2Id) {
    return {
      relationship: 'Та сама особа',
      relationshipName: 'Та сама особа',
      degree: 0,
      degreeOfConsanguinity: 0,
      coefficient: 100,
      description: 'Вибрано одну й ту саму особу.',
      personA: p1,
      personB: p2,
      commonAncestors: [p1],
      path: [{ personId: p1Id, relationFromPrevious: 'Сама особа', direction: 'start', generationOffset: 0 }],
      lineageType: 'direct_ancestor',
      generationalDistance: 0
    };
  }

  const p2IsMale = p2.gender === 'male' || p2.gender === 'M';
  const adj = buildKinshipGraph(db);

  // Shortest path via BFS
  interface BFSQueueItem {
    id: string;
    path: KinshipPathStep[];
  }

  const queue: BFSQueueItem[] = [
    {
      id: p1Id,
      path: [{ personId: p1Id, relationFromPrevious: 'Початок', direction: 'start', generationOffset: 0 }]
    }
  ];
  const visited = new Set<string>([p1Id]);
  let foundPath: KinshipPathStep[] | null = null;

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.id === p2Id) {
      foundPath = current.path;
      break;
    }

    const edges = adj.get(current.id) || [];
    for (const edge of edges) {
      if (!visited.has(edge.to)) {
        visited.add(edge.to);
        const prevStep = current.path[current.path.length - 1];
        const prevGen = prevStep.generationOffset || 0;
        let nextGen = prevGen;
        if (edge.dir === 'up') nextGen = prevGen + 1;
        else if (edge.dir === 'down') nextGen = prevGen - 1;

        queue.push({
          id: edge.to,
          path: [
            ...current.path,
            {
              personId: edge.to,
              relationFromPrevious: edge.label,
              direction: edge.dir,
              generationOffset: nextGen
            }
          ]
        });
      }
    }
  }

  if (!foundPath || foundPath.length <= 1) {
    return {
      relationship: 'Немає зв\'язку',
      relationshipName: 'Родинний зв\'язок не знайдено',
      degree: 0,
      degreeOfConsanguinity: 0,
      coefficient: 0,
      description: `Між ${getFullName(p1)} та ${getFullName(p2)} не виявлено спільних ліній у базі.`,
      personA: p1,
      personB: p2,
      commonAncestors: [],
      path: []
    };
  }

  // Analyze found path
  const steps = foundPath.slice(1);
  const stepsUp = steps.filter((s) => s.direction === 'up').length;
  const stepsDown = steps.filter((s) => s.direction === 'down').length;
  const spouseSteps = steps.filter((s) => s.direction === 'spouse').length;
  const totalHops = steps.length;

  let relationshipName = 'Далекий родич';
  let lineageType: 'direct_ancestor' | 'direct_descendant' | 'sibling' | 'collateral' | 'spouse' | 'in_law' | 'distant' = 'distant';
  let coefficient = 0;
  const commonAncestors: Person[] = [];

  // Identify apex / common ancestor if path goes up then down
  let maxGenOffset = -Infinity;
  let apexIndex = -1;
  foundPath.forEach((step, idx) => {
    const gen = step.generationOffset ?? 0;
    if (gen > maxGenOffset) {
      maxGenOffset = gen;
      apexIndex = idx;
    }
  });

  if (stepsUp > 0 && stepsDown > 0 && apexIndex > 0 && apexIndex < foundPath.length - 1) {
    foundPath[apexIndex].isCommonAncestor = true;
    const apexPerson = db.persons[foundPath[apexIndex].personId];
    if (apexPerson) commonAncestors.push(apexPerson);
  }

  // 1. Direct Ascendant (all steps UP)
  if (spouseSteps === 0 && stepsDown === 0 && stepsUp > 0) {
    lineageType = 'direct_ancestor';
    coefficient = Math.max(0.1, Number((Math.pow(0.5, stepsUp) * 100).toFixed(2)));
    if (stepsUp === 1) {
      relationshipName = p2IsMale ? 'Батько' : 'Мати';
    } else if (stepsUp === 2) {
      relationshipName = p2IsMale ? 'Дідусь' : 'Бабуся';
    } else if (stepsUp === 3) {
      relationshipName = p2IsMale ? 'Прадідусь' : 'Прабабуся';
    } else if (stepsUp === 4) {
      relationshipName = p2IsMale ? 'Прапрадідусь' : 'Прапрабабуся';
    } else {
      relationshipName = `Пра(${stepsUp - 2})${p2IsMale ? 'дідусь' : 'бабуся'}`;
    }
  }
  // 2. Direct Descendant (all steps DOWN)
  else if (spouseSteps === 0 && stepsUp === 0 && stepsDown > 0) {
    lineageType = 'direct_descendant';
    coefficient = Math.max(0.1, Number((Math.pow(0.5, stepsDown) * 100).toFixed(2)));
    if (stepsDown === 1) {
      relationshipName = p2IsMale ? 'Син' : 'Донька';
    } else if (stepsDown === 2) {
      relationshipName = p2IsMale ? 'Онук' : 'Онука';
    } else if (stepsDown === 3) {
      relationshipName = p2IsMale ? 'Правнук' : 'Правнучка';
    } else if (stepsDown === 4) {
      relationshipName = p2IsMale ? 'Праправнук' : 'Праправнучка';
    } else {
      relationshipName = `Пра(${stepsDown - 2})${p2IsMale ? 'внук' : 'внучка'}`;
    }
  }
  // 3. Collateral relatives (Up then Down, no spouse)
  else if (spouseSteps === 0 && stepsUp > 0 && stepsDown > 0) {
    lineageType = 'collateral';
    // Consanguinity DNA calculation
    coefficient = Math.max(0.1, Number((2 * Math.pow(0.5, stepsUp + stepsDown) * 100).toFixed(2)));

    // Siblings (1 up, 1 down)
    if (stepsUp === 1 && stepsDown === 1) {
      lineageType = 'sibling';
      relationshipName = p2IsMale ? 'Рідний брат' : 'Рідна сестра';
      coefficient = 50;
    }
    // Uncle / Aunt (2 up, 1 down)
    else if (stepsUp === 2 && stepsDown === 1) {
      relationshipName = p2IsMale ? 'Рідний дядько' : 'Рідна тітка';
      coefficient = 25;
    }
    // Nephew / Niece (1 up, 2 down)
    else if (stepsUp === 1 && stepsDown === 2) {
      relationshipName = p2IsMale ? 'Рідний племінник' : 'Рідна племінниця';
      coefficient = 25;
    }
    // First Cousins (2 up, 2 down)
    else if (stepsUp === 2 && stepsDown === 2) {
      relationshipName = p2IsMale ? 'Двоюрідний брат' : 'Двоюрідна сестра';
      coefficient = 12.5;
    }
    // Great-uncle / Great-aunt (3 up, 1 down)
    else if (stepsUp === 3 && stepsDown === 1) {
      relationshipName = p2IsMale ? 'Двоюрідний дідусь' : 'Двоюрідна бабуся';
      coefficient = 12.5;
    }
    // Grand-nephew / Grand-niece (1 up, 3 down)
    else if (stepsUp === 1 && stepsDown === 3) {
      relationshipName = p2IsMale ? 'Внучатий племінник' : 'Внучата племінниця';
      coefficient = 12.5;
    }
    // Cousin once removed (3 up, 2 down)
    else if (stepsUp === 3 && stepsDown === 2) {
      relationshipName = p2IsMale ? 'Двоюрідний дядько' : 'Двоюрідна тітка';
      coefficient = 6.25;
    }
    // Cousin once removed (2 up, 3 down)
    else if (stepsUp === 2 && stepsDown === 3) {
      relationshipName = p2IsMale ? 'Двоюрідний племінник' : 'Двоюрідна племінниця';
      coefficient = 6.25;
    }
    // Second Cousins (3 up, 3 down)
    else if (stepsUp === 3 && stepsDown === 3) {
      relationshipName = p2IsMale ? 'Троюрідний брат' : 'Троюрідна сестра';
      coefficient = 3.125;
    }
    // Third Cousins (4 up, 4 down)
    else if (stepsUp === 4 && stepsDown === 4) {
      relationshipName = p2IsMale ? 'Чотириюрідний брат' : 'Чотириюрідна сестра';
      coefficient = 0.78;
    }
    // Higher cousin degrees
    else {
      const cousinDeg = Math.min(stepsUp, stepsDown) - 1;
      const degNames = ['двоюрідн', 'троюрідн', 'чотириюрідн', 'п\'ятиюрідн', 'шестиюрідн'];
      const prefix = degNames[cousinDeg - 1] || `${cousinDeg}-юрідн`;
      const genDiff = stepsUp - stepsDown;

      if (genDiff === 0) {
        relationshipName = `${prefix}${p2IsMale ? 'ий брат' : 'а сестра'}`;
      } else if (genDiff > 0) {
        relationshipName = `${prefix}${p2IsMale ? 'ий дядько' : 'а тітка'}`;
      } else {
        relationshipName = `${prefix}${p2IsMale ? 'ий племінник' : 'а племінниця'}`;
      }
    }
  }
  // 4. Spouse & In-Laws (involves marriage step)
  else if (spouseSteps > 0) {
    lineageType = totalHops === 1 ? 'spouse' : 'in_law';
    coefficient = 0;

    if (totalHops === 1) {
      relationshipName = p2IsMale ? 'Чоловік' : 'Дружина';
    } else if (totalHops === 2) {
      const firstHop = steps[0];
      const secondHop = steps[1];
      const p1IsMale = p1.gender === 'male' || p1.gender === 'M';

      if (firstHop.direction === 'spouse' && secondHop.direction === 'up') {
        if (p1IsMale) {
          relationshipName = p2IsMale ? 'Тесть (батько дружини)' : 'Теща (мати дружини)';
        } else {
          relationshipName = p2IsMale ? 'Свекор (батько чоловіка)' : 'Свекруха (мати чоловіка)';
        }
      } else if (firstHop.direction === 'down' && secondHop.direction === 'spouse') {
        relationshipName = p2IsMale ? 'Зять (чоловік доньки)' : 'Невістка (дружина сина)';
      } else if (firstHop.direction === 'up' && secondHop.direction === 'spouse') {
        relationshipName = p2IsMale ? 'Вітчим' : 'Мачуха';
      } else if (firstHop.direction === 'spouse' && secondHop.direction === 'sibling') {
        if (p1IsMale) {
          relationshipName = p2IsMale ? 'Шурин (брат дружини)' : 'Своячка (сестра дружини)';
        } else {
          relationshipName = p2IsMale ? 'Дівер (брат чоловіка)' : 'Зовиця (сестра чоловіка)';
        }
      } else {
        relationshipName = `Свояк / Своячка (${steps.map((s) => s.relationFromPrevious).join(' → ')})`;
      }
    } else {
      relationshipName = `Родич через шлюб (свояцтво)`;
    }
  }

  const generationalDistance = (foundPath[foundPath.length - 1].generationOffset ?? 0) - (foundPath[0].generationOffset ?? 0);
  const genNote =
    generationalDistance === 0
      ? 'одне покоління'
      : generationalDistance > 0
      ? `+${generationalDistance} ${generationalDistance === 1 ? 'покоління' : 'поколінь'} вище`
      : `${generationalDistance} поколінь нижче`;

  const description = `${getFullName(p2)} є ${relationshipName.toLowerCase()} для ${getFullName(p1)}. Ланцюжок складається з ${totalHops} ${totalHops === 1 ? 'кроку' : 'кроків'} (${genNote}).`;

  return {
    relationship: relationshipName,
    relationshipName,
    degree: totalHops,
    degreeOfConsanguinity: totalHops,
    coefficient,
    description,
    personA: p1,
    personB: p2,
    commonAncestors,
    path: foundPath,
    lineageType,
    generationalDistance
  };
}

/**
 * Determines the true root person (коренева особа) in the database.
 * Priority:
 * 1. Person with explicit isRoot flag
 * 2. Person with generation === 0 (standard root in Familio / genealogy charts)
 * 3. Person whose notes or bio specify "коренева особа" / "корінь"
 * 4. Known default root in Familio data ('p_bom_olga')
 * 5. fallbackRootId if valid
 * 6. First person in list
 */
export function findRootPerson(
  persons: Person[] | Record<string, Person>,
  fallbackRootId?: string
): Person | undefined {
  const list: Person[] = Array.isArray(persons) ? persons : Object.values(persons || {});
  if (list.length === 0) return undefined;

  // 1. Explicit isRoot flag
  const isRootPerson = list.find((p) => (p as any).isRoot === true);
  if (isRootPerson) return isRootPerson;

  // 2. Generation === 0
  const genZero = list.find((p) => p.generation === 0);
  if (genZero) return genZero;

  // 3. Notes or bio containing 'коренева особа' or 'корінь'
  const rootByNotes = list.find((p) => 
    (p.notes && /корен(ев|н)[а-я\s]*особ/i.test(p.notes)) ||
    (p.bio && /корен(ев|н)[а-я\s]*особ/i.test(p.bio))
  );
  if (rootByNotes) return rootByNotes;

  // 4. Default person ID in familio data
  const defaultBom = list.find((p) => p.id === 'p_bom_olga');
  if (defaultBom) return defaultBom;

  // 5. fallbackRootId if valid
  if (fallbackRootId) {
    const fallback = list.find((p) => p.id === fallbackRootId);
    if (fallback) return fallback;
  }

  // 6. First person
  return list[0];
}

export function findRootPersonId(
  persons: Person[] | Record<string, Person>,
  fallbackRootId?: string
): string {
  const root = findRootPerson(persons, fallbackRootId);
  return root?.id || fallbackRootId || 'p_bom_olga';
}
