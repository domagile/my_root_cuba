/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ExtractedMetricRecord, CandidateTreeNode, CandidateDraftTree } from '../types/sheetsAnalysis';
import { Person } from '../types';

/**
 * Normalizes string for fuzzy comparison
 */
function normalizeStr(s?: string): string {
  if (!s) return '';
  return s.toLowerCase().replace(/[\s\-_,.;:()'"«»]/g, '').trim();
}

/**
 * Calculates similarity score (0-100) between two names
 */
export function calculatePersonMatchScore(
  candidate: { lastName?: string; firstName?: string; patronymic?: string; fullName?: string; birthYear?: number | string; place?: string },
  treePerson: Person
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  const treeLastName = treePerson.lastName || treePerson.name?.surname || '';
  const treeFirstName = treePerson.firstName || treePerson.name?.given || '';
  const treePatronymic = treePerson.patronymic || treePerson.name?.patronymic || '';
  const treeBirthYear = treePerson.birthYear ? Number(treePerson.birthYear) : (treePerson.birthDate ? parseInt(treePerson.birthDate.slice(0, 4)) : undefined);
  const treePlace = treePerson.birthPlace || treePerson.residencePlace || '';

  const candLastName = candidate.lastName || '';
  const candFirstName = candidate.firstName || '';
  const candPatronymic = candidate.patronymic || '';
  const candFullName = candidate.fullName || `${candLastName} ${candFirstName} ${candPatronymic}`.trim();

  // 1. Surname check (up to 40 pts)
  if (candLastName && treeLastName) {
    if (normalizeStr(candLastName) === normalizeStr(treeLastName)) {
      score += 40;
      reasons.push(`Ідентичне прізвище «${treeLastName}»`);
    } else if (normalizeStr(candLastName).includes(normalizeStr(treeLastName)) || normalizeStr(treeLastName).includes(normalizeStr(candLastName))) {
      score += 30;
      reasons.push(`Споріднене прізвище «${candLastName}» ~ «${treeLastName}»`);
    }
  }

  // 2. First name check (up to 30 pts)
  if (candFirstName && treeFirstName) {
    if (normalizeStr(candFirstName) === normalizeStr(treeFirstName)) {
      score += 30;
      reasons.push(`Ідентичне ім'я «${treeFirstName}»`);
    } else if (normalizeStr(candFirstName).slice(0, 3) === normalizeStr(treeFirstName).slice(0, 3)) {
      score += 20;
      reasons.push(`Схоже ім'я «${candFirstName}» ~ «${treeFirstName}»`);
    }
  }

  // 3. Patronymic check (up to 20 pts)
  if (candPatronymic && treePatronymic) {
    if (normalizeStr(candPatronymic) === normalizeStr(treePatronymic)) {
      score += 20;
      reasons.push(`Ідентичне по батькові «${treePatronymic}»`);
    }
  }

  // 4. Year check (up to 15 pts)
  if (candidate.birthYear && treeBirthYear) {
    const diff = Math.abs(Number(candidate.birthYear) - treeBirthYear);
    if (diff === 0) {
      score += 15;
      reasons.push(`Точний збіг року (${treeBirthYear} р.)`);
    } else if (diff <= 2) {
      score += 10;
      reasons.push(`Різниця року лише ${diff} р. (${candidate.birthYear} ~ ${treeBirthYear})`);
    } else if (diff <= 5) {
      score += 5;
      reasons.push(`Близький часовий діапазон ±${diff} р.`);
    }
  }

  // 5. Place check (up to 10 pts)
  if (candidate.place && treePlace) {
    if (normalizeStr(candidate.place).includes(normalizeStr(treePlace)) || normalizeStr(treePlace).includes(normalizeStr(candidate.place))) {
      score += 10;
      reasons.push(`Збіг населеного пункту/парафії «${candidate.place}»`);
    }
  }

  // Fallback full name fuzzy
  if (score < 40 && candFullName && (treeLastName || treeFirstName)) {
    const treeFull = `${treeLastName} ${treeFirstName} ${treePatronymic}`.trim();
    if (normalizeStr(candFullName).includes(normalizeStr(treeLastName)) && normalizeStr(candFullName).includes(normalizeStr(treeFirstName))) {
      score = 75;
      reasons.push(`Повний збіг у рядку імені («${candFullName}»)`);
    }
  }

  return { score: Math.min(100, score), reasons };
}

/**
 * Finds best match in existing tree
 */
export function findBestTreeMatch(
  candidate: { lastName?: string; firstName?: string; patronymic?: string; fullName?: string; birthYear?: number | string; place?: string },
  treePersons: Person[]
): { matchedPerson?: Person; score: number; reasons: string[] } {
  let bestScore = 0;
  let bestPerson: Person | undefined = undefined;
  let bestReasons: string[] = [];

  for (const person of treePersons) {
    const { score, reasons } = calculatePersonMatchScore(candidate, person);
    if (score > bestScore && score >= 50) {
      bestScore = score;
      bestPerson = person;
      bestReasons = reasons;
    }
  }

  return { matchedPerson: bestPerson, score: bestScore, reasons: bestReasons };
}

/**
 * Builds a structured Candidate Draft Tree from multi-sheet extracted records
 */
export function buildCandidateDraftTree(
  records: ExtractedMetricRecord[],
  treePersons: Person[],
  targetSurnames: string[]
): CandidateDraftTree {
  const nodeMap = new Map<string, CandidateTreeNode>();

  // Helper to generate unified entity key (unifying the same person across sheets)
  const getEntityKey = (lastName: string, firstName: string, patronymic?: string, approxYear?: number) => {
    const cleanLast = normalizeStr(lastName);
    const cleanFirst = normalizeStr(firstName);
    const cleanPat = normalizeStr(patronymic);
    const yearBucket = approxYear ? Math.round(approxYear / 5) * 5 : 0;
    return `${cleanLast}_${cleanFirst}_${cleanPat}_${yearBucket}`;
  };

  // Helper to get or create a candidate node
  const getOrCreateNode = (
    meta: {
      fullName: string;
      firstName: string;
      lastName: string;
      patronymic?: string;
      gender: 'male' | 'female';
      birthYear?: number;
      place?: string;
      socialStatus?: string;
      roleInSource: string;
    },
    sheetName: string,
    recType: string,
    rawText: string,
    year?: number | string
  ): CandidateTreeNode => {
    const key = getEntityKey(meta.lastName, meta.firstName, meta.patronymic, meta.birthYear);
    
    let node = nodeMap.get(key);
    if (!node) {
      // Cross check against tree
      const matchRes = findBestTreeMatch(
        {
          lastName: meta.lastName,
          firstName: meta.firstName,
          patronymic: meta.patronymic,
          fullName: meta.fullName,
          birthYear: meta.birthYear,
          place: meta.place
        },
        treePersons
      );

      const alreadyInMainTree = matchRes.score >= 80;

      node = {
        id: `cand_${Math.random().toString(36).substring(2, 9)}`,
        fullName: meta.fullName,
        firstName: meta.firstName || meta.fullName.split(' ')[1] || '',
        lastName: meta.lastName || meta.fullName.split(' ')[0] || '',
        patronymic: meta.patronymic,
        gender: meta.gender,
        estimatedBirthYear: meta.birthYear,
        place: meta.place,
        socialStatus: meta.socialStatus,
        roleInSource: meta.roleInSource,
        generationLevel: 0,
        spouseCandidateIds: [],
        childrenCandidateIds: [],
        godparentCandidateIds: [],
        godchildrenCandidateIds: [],
        godparentDetails: [],
        citations: [],
        alreadyInMainTree,
        matchedMainPersonId: matchRes.matchedPerson?.id,
        matchedMainPersonName: matchRes.matchedPerson ? `${matchRes.matchedPerson.lastName} ${matchRes.matchedPerson.firstName} ${matchRes.matchedPerson.patronymic || ''}`.trim() : undefined,
        confidenceScore: matchRes.score,
        matchReasons: matchRes.reasons,
        isConfirmedForImport: false,
        isMergedToTree: alreadyInMainTree
      };

      nodeMap.set(key, node);
    }

    // Add citation
    node.citations.push({
      sheet: sheetName,
      year,
      recordType: recType,
      excerpt: rawText.length > 120 ? rawText.slice(0, 120) + '...' : rawText
    });

    return node;
  };

  // Process all records
  records.forEach(rec => {
    if (!rec.relevanceToTargetSurnames) return;

    // 1. Primary person
    const primaryNode = getOrCreateNode(
      {
        fullName: rec.primaryPerson.fullName,
        firstName: rec.primaryPerson.firstName,
        lastName: rec.primaryPerson.lastName,
        patronymic: rec.primaryPerson.patronymic,
        gender: rec.primaryPerson.gender,
        birthYear: typeof rec.year === 'number' ? rec.year : undefined,
        place: rec.place,
        roleInSource: `Головний фігурант (${rec.recordType} ${rec.year ? rec.year + ' р.' : ''})`
      },
      rec.sourceSheet,
      rec.recordType,
      rec.rawText,
      rec.year
    );

    // 2. Father
    let fatherNode: CandidateTreeNode | undefined = undefined;
    if (rec.father && rec.father.fullName) {
      fatherNode = getOrCreateNode(
        {
          fullName: rec.father.fullName,
          firstName: rec.father.firstName,
          lastName: rec.father.lastName,
          patronymic: rec.father.patronymic,
          gender: 'male',
          birthYear: typeof rec.year === 'number' ? rec.year - 28 : undefined,
          place: rec.place,
          roleInSource: `Батько у записі ${rec.year || ''} р.`
        },
        rec.sourceSheet,
        rec.recordType,
        rec.rawText,
        rec.year
      );

      primaryNode.fatherCandidateId = fatherNode.id;
      if (!fatherNode.childrenCandidateIds.includes(primaryNode.id)) {
        fatherNode.childrenCandidateIds.push(primaryNode.id);
      }
    }

    // 3. Mother
    let motherNode: CandidateTreeNode | undefined = undefined;
    if (rec.mother && rec.mother.fullName) {
      motherNode = getOrCreateNode(
        {
          fullName: rec.mother.fullName,
          firstName: rec.mother.firstName,
          lastName: rec.mother.lastName,
          patronymic: rec.mother.patronymic,
          gender: 'female',
          birthYear: typeof rec.year === 'number' ? rec.year - 24 : undefined,
          place: rec.place,
          roleInSource: `Мати у записі ${rec.year || ''} р.`
        },
        rec.sourceSheet,
        rec.recordType,
        rec.rawText,
        rec.year
      );

      primaryNode.motherCandidateId = motherNode.id;
      if (!motherNode.childrenCandidateIds.includes(primaryNode.id)) {
        motherNode.childrenCandidateIds.push(primaryNode.id);
      }

      // Link parents as spouses
      if (fatherNode) {
        if (!fatherNode.spouseCandidateIds.includes(motherNode.id)) {
          fatherNode.spouseCandidateIds.push(motherNode.id);
        }
        if (!motherNode.spouseCandidateIds.includes(fatherNode.id)) {
          motherNode.spouseCandidateIds.push(fatherNode.id);
        }
      }
    }

    // 4. Godparents (Восприємники) - Crucial Linkage!
    rec.godparents.forEach(gp => {
      if (!gp.fullName) return;

      const parsedGp = {
        firstName: gp.firstName || '',
        lastName: gp.lastName || '',
        patronymic: gp.patronymic,
        gender: (gp.role === 'godmother' ? 'female' : 'male') as 'male' | 'female'
      };

      const gpNode = getOrCreateNode(
        {
          fullName: gp.fullName,
          firstName: parsedGp.firstName,
          lastName: parsedGp.lastName,
          patronymic: parsedGp.patronymic,
          gender: parsedGp.gender,
          birthYear: typeof rec.year === 'number' ? rec.year - 20 : undefined,
          place: gp.residence || rec.place,
          roleInSource: `${gp.role === 'godmother' ? 'Хрещена мати (кума)' : gp.role === 'godfather' ? 'Хрещений батько (кум)' : 'Поручитель / Свідок'} у ${rec.year || ''} р.`
        },
        rec.sourceSheet,
        rec.recordType,
        rec.rawText,
        rec.year
      );

      // Link godparent relationship
      if (!primaryNode.godparentCandidateIds.includes(gpNode.id)) {
        primaryNode.godparentCandidateIds.push(gpNode.id);
      }
      if (!gpNode.godchildrenCandidateIds.includes(primaryNode.id)) {
        gpNode.godchildrenCandidateIds.push(primaryNode.id);
      }

      // Record godparent details
      if (!primaryNode.godparentDetails) primaryNode.godparentDetails = [];
      primaryNode.godparentDetails.push({
        name: gp.fullName,
        role: gp.role,
        year: rec.year,
        sheet: rec.sourceSheet,
        matchedTreeId: gpNode.matchedMainPersonId
      });
    });
  });

  const nodes = Array.from(nodeMap.values());

  // Assign generation levels based on parent-child topology
  const assignGenerations = () => {
    // Find roots (nodes without parents)
    const roots = nodes.filter(n => !n.fatherCandidateId && !n.motherCandidateId);
    
    const visited = new Set<string>();
    const queue: { node: CandidateTreeNode; level: number }[] = roots.map(r => ({ node: r, level: 0 }));

    while (queue.length > 0) {
      const { node, level } = queue.shift()!;
      if (visited.has(node.id)) continue;
      visited.add(node.id);
      node.generationLevel = level;

      node.childrenCandidateIds.forEach(childId => {
        const child = nodes.find(n => n.id === childId);
        if (child) {
          queue.push({ node: child, level: level + 1 });
        }
      });
    }
  };

  assignGenerations();

  // Compute statistics
  const totalCandidates = nodes.length;
  const godparentsFound = nodes.filter(n => n.godchildrenCandidateIds.length > 0).length;
  const matchesInMainTree = nodes.filter(n => n.alreadyInMainTree).length;
  const newPersonsReadyToMerge = nodes.filter(n => !n.alreadyInMainTree).length;
  const uniqueSheets = Array.from(new Set(records.map(r => r.sourceSheet)));

  return {
    id: `tree_${Date.now()}`,
    title: `AI Чернеткове дерево: ${targetSurnames.join(', ') || 'Усі родини'}`,
    createdAt: new Date().toLocaleDateString('uk-UA'),
    targetSurnames,
    sourceSheets: uniqueSheets,
    nodes,
    stats: {
      totalRecordsAnalyzed: records.length,
      sheetsCount: uniqueSheets.length,
      totalCandidates,
      godparentsFound,
      matchesInMainTree,
      newPersonsReadyToMerge
    }
  };
}
