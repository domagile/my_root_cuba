/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ThemePalette =
  | 'classic'
  | 'dark'
  | 'emerald'
  | 'amber'
  | 'sepia'
  | 'slate'
  | 'nordic'
  | 'royal'
  | 'dark-emerald'
  | 'light-parchment';

export type RecordType = 'birth' | 'marriage' | 'death' | 'confession';

export type NavigationTab =
  | 'tree'
  | 'persons'
  | 'research'
  | 'ai-analysis'
  | 'documents'
  | 'requests'
  | 'matrix'
  | 'notes'
  | 'tasks'
  | 'findings'
  | 'hypotheses'
  | 'settings'
  | 'timeline'
  | 'experiment';

export type Gender = 'male' | 'female' | 'other' | 'M' | 'F' | 'U';

export interface PersonName {
  given: string;
  surname: string;
  patronymic?: string;
  maidenName?: string;
  prefix?: string;
  suffix?: string;
}

export interface CustomFieldItem {
  id?: string;
  label?: string;
  key?: string;
  value: string;
}

export type CustomField = CustomFieldItem;

export interface Person {
  id: string;
  name?: PersonName;
  firstName: string;
  lastName: string;
  maidenName?: string;
  patronymic?: string;
  prefix?: string;
  suffix?: string;
  gender: Gender;
  birthDate?: string;
  birthYear?: number | string;
  birthPlace?: string;
  deathDate?: string;
  deathYear?: number | string;
  deathPlace?: string;
  isLiving?: boolean;
  fatherId?: string;
  motherId?: string;
  spouseIds?: string[];
  childrenIds?: string[];
  parentFamilyId?: string;
  spouseFamilyIds?: string[];
  occupation?: string;
  notes?: string;
  bio?: string;
  photos?: string[];
  photoUrl?: string;
  avatar?: string;
  avatarUrl?: string;
  tags?: string[];
  isDeleted?: boolean;
  deletedAt?: string;
  generation?: number;
  confession?: string;
  estate?: string;
  socialStatus?: string;
  estateOrSocialStatus?: string;
  militaryRank?: string;
  sourceIds?: string[];
  sourceCitations?: string[];
  citations?: any[];
  events?: any[];
  customFields?: CustomFieldItem[] | Record<string, string>;
}

export interface MetricIndexedPerson {
  name?: string;
  role?: string;
  personName?: string;
  linkedPersonId?: string;
  age?: string | number;
  residence?: string;
  status?: string;
  details?: string;
}

export interface MetricRecord {
  id: string;
  title: string;
  archive: string;
  fund: string;
  inventory: string;
  caseNumber: string;
  year: number;
  recordType: RecordType;
  village?: string;
  church?: string;
  page?: string;
  itemNumber?: string;
  transcription?: string;
  date?: string;
  notes?: string;
  status?: string;
  createdAt?: string;
  indexedPersons: MetricIndexedPerson[];
  documentScanUrl?: string;
  scannedText?: string;
  linkedPersonId?: string;
  isVerified?: boolean;
  tags?: string[];
}

export interface ImportedMetricRow {
  id: string;
  year: string | number;
  recordType?: string;
  type?: string;
  village?: string;
  churchOrPlace?: string;
  archiveFundCase?: string;
  archiveRef?: string;
  personName: string;
  parentsOrRelatives?: string;
  relatives?: string;
  role?: string;
  notes?: string;
}

export interface GenealogyDocument {
  id: string;
  title?: string;
  researchTitle?: string;
  researchId?: string;
  type?: 'metric' | 'revision' | 'confession' | 'certificate' | 'photo' | 'passport' | 'military' | 'other' | string;
  archive?: string;
  archiveRef?: string;
  subdivision?: string;
  fund?: string;
  inventory?: string;
  caseNumber?: string;
  page?: string;
  year?: number | string;
  yearFrom?: number | string;
  yearTo?: number | string;
  settlement?: string;
  documentLink?: string;
  driveUrl?: string;
  pageCount?: number | string;
  lastViewedPage?: number | string;
  date?: string;
  location?: string;
  transcription?: string;
  summary?: string;
  fileUrl?: string;
  fileData?: string;
  fileName?: string;
  linkedPersonIds?: string[];
  tags?: string[];
  createdAt?: string;
  uploadDate?: string;
  status?: string;
  notes?: string;
  customFields?: CustomFieldItem[];
  scans?: any[];
}

export interface ArchiveRequest {
  id: string;
  title?: string;
  archiveName?: string;
  requestSubject?: string;
  targetPersonOrFamily?: string;
  sentDate?: string;
  dateSent?: string;
  status?: 'draft' | 'sent' | 'in_progress' | 'received' | 'rejected' | 'processing' | string;
  responseSummary?: string;
  incomingDocNumber?: string;
  cost?: number;
  notes?: string;
}

export interface YearMatrixEntry {
  id?: string;
  village?: string;
  location?: string;
  year: number;
  docType?: string;
  status?: string;
  researchTitle?: string;
  archiveRef?: string;
  archiveCode?: string;
  hasBirth?: boolean;
  hasMarriage?: boolean;
  hasDeath?: boolean;
  hasConfession?: boolean;
  hasRevision?: boolean;
  notes?: string;
}

export interface GenealogyTask {
  id?: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'done' | 'completed' | string;
  linkedPersonId?: string;
  personName?: string;
  archiveName?: string;
  category?: 'archive' | 'dna' | 'interview' | 'indexing' | 'other';
}

export interface GenealogyFinding {
  id?: string;
  title: string;
  description?: string;
  summary?: string;
  confidence?: 'confirmed' | 'probable' | 'hypothesis' | 'refuted' | string;
  discoveryDate?: string;
  dateFound?: string;
  sourceReference?: string;
  source?: string;
  linkedPersonIds?: string[];
  personIds?: string[];
  relevanceScore?: number | string;
}

export interface GenealogyHypothesis {
  id?: string;
  title: string;
  hypothesis?: string;
  description?: string;
  confidence?: string | number;
  evidenceCount?: number;
  status?: 'active' | 'validated' | 'rejected' | 'testing' | string;
  argumentsFor?: string[];
  argumentsAgainst?: string[];
  verdictDate?: string;
  notes?: string;
}

export interface RangeAnalysis {
  id?: string;
  title?: string;
  researchName?: string;
  startYear?: number;
  endYear?: number;
  yearFrom?: number;
  yearTo?: number;
  village?: string;
  location?: string;
  docType?: string;
  findingsCount?: number;
  coveragePercent?: number;
  notes?: string;
}

export interface GitConfig {
  repoUrl: string;
  branch: string;
  token: string;
  connected: boolean;
  lastSync?: string;
  autoSyncDaily?: boolean;
  autoSyncTime?: string;
}

export interface AccessLockConfig {
  enabled: boolean;
  pinCode: string;
  secretKey?: string;
  secretLinkKey?: string;
  autoLockMinutes?: number;
}

export interface SharedInvite {
  id: string;
  name: string;
  email?: string;
  role: 'viewer' | 'editor' | 'researcher' | string;
  inviteCode: string;
  createdAt: string;
  invitedAt?: string;
  expiresAt?: string;
}

export interface ThemeConfig {
  id: string;
  name: string;
  desc?: string;
  colors?: any;
  appBg: string;
  cardBg: string;
  cardBorder: string;
  cardText: string;
  cardSubtext: string;
  accentBg: string;
  accentText: string;
  sidebarBg: string;
  headerBg: string;
  border: string;
}
