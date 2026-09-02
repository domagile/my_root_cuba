/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SheetDataset {
  sheetName: string;
  rowCount: number;
  headers: string[];
  rows: Record<string, any>[];
  detectedType: 'birth' | 'marriage' | 'death' | 'revision' | 'confession' | 'general';
  yearEstimate?: number | string;
  placeEstimate?: string;
}

export interface ExtractedPersonMeta {
  fullName: string;
  firstName: string;
  lastName: string;
  patronymic?: string;
  maidenName?: string;
  gender: 'male' | 'female';
  age?: number;
  birthYear?: number;
  socialStatus?: string;
  residence?: string;
  matchedTreePersonId?: string;
  matchedTreePersonName?: string;
  matchScore?: number;
  matchReason?: string;
}

export interface ExtractedGodparent {
  id: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  patronymic?: string;
  role: 'godfather' | 'godmother' | 'witness' | 'sponsor' | 'other';
  socialStatus?: string;
  residence?: string;
  notes?: string;
  matchedTreePersonId?: string;
  matchedTreePersonName?: string;
  matchScore?: number;
  matchReason?: string;
  kinshipHypothesis?: string; // e.g., "Ймовірно рідний брат матері новонародженого"
}

export interface ExtractedMetricRecord {
  id: string;
  sourceSheet: string;
  rowIndex: number;
  year?: number | string;
  dateExact?: string;
  recordType: 'birth' | 'marriage' | 'death' | 'revision' | 'confession' | 'general';
  place?: string;
  churchOrParish?: string;
  archiveFund?: string;
  
  // Primary person (e.g. newborn, groom/bride, deceased, household head)
  primaryPerson: ExtractedPersonMeta;
  
  // Family members mentioned in the same record
  father?: ExtractedPersonMeta;
  mother?: ExtractedPersonMeta;
  spouse?: ExtractedPersonMeta;
  
  // Godparents / Witnesses / Sponsors
  godparents: ExtractedGodparent[];
  
  // Household members (for revisions / confessions)
  householdMembers: Array<{
    fullName: string;
    relationType: string; // 'son' | 'daughter' | 'wife' | 'brother' | 'daughter-in-law' | etc.
    age?: number;
    birthYear?: number;
    matchedTreePersonId?: string;
  }>;

  notes?: string;
  rawText: string;
  relevanceToTargetSurnames: boolean;
  matchingSurnames: string[];
}

export interface CandidateTreeNode {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  patronymic?: string;
  maidenName?: string;
  gender: 'male' | 'female';
  estimatedBirthYear?: number | string;
  deathYear?: number | string;
  place?: string;
  socialStatus?: string;
  roleInSource: string; // e.g. "Новонароджений 1894 р.", "Хрещений батько", "Батько у сповіді"
  generationLevel: number; // 0 is anchor/middle, negative = ancestors, positive = descendants
  
  // Relational IDs inside candidate tree
  fatherCandidateId?: string;
  motherCandidateId?: string;
  spouseCandidateIds: string[];
  childrenCandidateIds: string[];
  
  // Godparent links
  godparentCandidateIds: string[]; // Who baptized this person
  godchildrenCandidateIds: string[]; // Whom this person baptized
  godparentDetails?: Array<{
    name: string;
    role: string;
    year?: string | number;
    sheet: string;
    matchedTreeId?: string;
  }>;

  // Citations from sheets
  citations: Array<{
    sheet: string;
    year?: string | number;
    recordType: string;
    excerpt: string;
  }>;

  // Comparison with existing Main Tree
  alreadyInMainTree: boolean;
  matchedMainPersonId?: string;
  matchedMainPersonName?: string;
  confidenceScore: number;
  matchReasons: string[];
  
  // Merging state
  isConfirmedForImport: boolean;
  isMergedToTree: boolean;
}

export interface CandidateDraftTree {
  id: string;
  title: string;
  createdAt: string;
  targetSurnames: string[];
  sourceSheets: string[];
  nodes: CandidateTreeNode[];
  stats: {
    totalRecordsAnalyzed: number;
    sheetsCount: number;
    totalCandidates: number;
    godparentsFound: number;
    matchesInMainTree: number;
    newPersonsReadyToMerge: number;
  };
}
