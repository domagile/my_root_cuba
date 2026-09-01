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

export type RecordType = 'birth' | 'marriage' | 'death' | 'confession' | 'revision' | 'other';

export type NavigationTab =
  | 'tree'
  | 'persons'
  | 'conflicts'
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
  firstName?: string;
  lastName?: string;
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
  siblingIds?: string[];
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
  documents?: PersonDocumentItem[];
  media?: PersonDocumentItem[];
}

export interface PersonDocumentItem {
  id: string;
  title: string;
  url: string;
  type?: 'photo' | 'metric' | 'revision' | 'confession' | 'passport' | 'military' | 'certificate' | 'other' | string;
  storageType?: 'github' | 'gdrive' | 'firestore' | 'external';
  githubPath?: string;
  year?: string | number;
  archiveRef?: string;
  page?: string;
  notes?: string;
  createdAt?: string;
  isLivingTarget?: boolean;
}

export interface GitHubStorageConfig {
  owner: string;
  repo: string;
  branch: string;
  token: string;
  baseFolder?: string;
  isConfigured: boolean;
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

export type ViewMode = 
  | 'tree'
  | 'fan'
  | 'persons'
  | 'families'
  | 'timeline'
  | 'map'
  | 'places'
  | 'sources'
  | 'calculator'
  | 'kinship'
  | 'statistics'
  | 'stats'
  | 'reports'
  | 'conflicts'
  | 'audit'
  | 'duplicates';

export interface TreeConflict {
  id: string;
  type: 'chronology' | 'biology' | 'cycles' | 'relations' | 'data_gaps';
  severity: 'critical' | 'warning' | 'gap';
  title: string;
  description: string;
  recommendation: string;
  personId: string;
  personName: string;
  relatedPersonId?: string;
  relatedPersonName?: string;
  familyId?: string;
  canAutoFix?: boolean;
  autoFixType?: 'sync_parent_child' | 'sync_spouses' | 'clean_dangling' | 'remove_self_loop';
  metadata?: Record<string, any>;
}

export interface DuplicatePair {
  id: string;
  personA: Person;
  personB: Person;
  confidence: number; // 0 - 100
  confidenceLevel: 'very_high' | 'high' | 'possible';
  reasons: string[];
  breakdown: {
    surnameScore: number;
    givenNameScore: number;
    datesScore: number;
    locationScore: number;
    relationsScore: number;
  };
}

export interface MergeFieldSelection {
  given: 'A' | 'B' | 'custom';
  surname: 'A' | 'B' | 'custom';
  patronymic: 'A' | 'B' | 'custom';
  maidenName: 'A' | 'B' | 'custom';
  gender: 'A' | 'B';
  birthDate: 'A' | 'B' | 'custom';
  birthPlace: 'A' | 'B' | 'custom';
  deathDate: 'A' | 'B' | 'custom';
  deathPlace: 'A' | 'B' | 'custom';
  isLiving: 'A' | 'B';
  occupation: 'A' | 'B' | 'custom';
  estateOrSocialStatus: 'A' | 'B' | 'custom';
  militaryRank: 'A' | 'B' | 'custom';
  confession: 'A' | 'B' | 'custom';
  avatar: 'A' | 'B' | 'none';
  customValues?: Record<string, string>;
  combineBio: boolean;
  combineNotes: boolean;
  combineSources: boolean;
  combineEvents: boolean;
  combineRelations: boolean;
}

export type TreeLayoutType = 'ancestors' | 'descendants' | 'hourglass' | 'both';

export interface FamilyChild {
  personId: string;
  relationType?: string;
}

export interface Family {
  id: string;
  husbandId?: string;
  wifeId?: string;
  relationshipType?: string;
  children: FamilyChild[];
  childrenIds?: string[];
  marriageDate?: string;
  marriageYear?: number;
  marriagePlace?: string;
  divorceDate?: string;
  divorceYear?: number;
  events?: any[];
  notes?: any;
  citations?: any[];
  sourceIds?: string[];
}

export interface Source {
  id: string;
  title: string;
  author?: string;
  publication?: string;
  repository?: string;
  archive?: string;
  archiveReference?: string;
  archiveFund?: string;
  fund?: string;
  inventory?: string;
  caseNumber?: string;
  page?: string;
  date?: string;
  transcription?: string;
  url?: string;
  notes?: string;
  tags?: string[];
}

export type EventType =
  | 'birth'
  | 'death'
  | 'marriage'
  | 'burial'
  | 'baptism'
  | 'census'
  | 'residence'
  | 'other'
  | 'Birth'
  | 'Baptism'
  | 'Marriage'
  | 'Divorce'
  | 'Death'
  | 'Burial'
  | 'Military'
  | 'Award'
  | 'Education'
  | 'Occupation'
  | 'Census'
  | 'Residence'
  | 'Custom'
  | 'Emigration'
  | 'Immigration';

export interface FanChartSector {
  person: Person | null;
  generation: number;
  startAngle: number;
  endAngle: number;
  innerRadius: number;
  outerRadius: number;
  color?: string;
  isAhnen?: number;
  ahnenNumber?: number;
  ahnentafelNumber?: number;
  side?: 'paternal' | 'maternal' | 'root';
}

export interface LifeEvent {
  id: string;
  type: EventType;
  title?: string;
  date?: string;
  year?: number;
  place?: string;
  placeName?: string;
  description?: string;
  personId?: string;
  familyId?: string;
  sourceId?: string;
  citations?: any[];
  notes?: any;
}

export type Event = LifeEvent;

export interface GenealogyDatabase {
  title?: string;
  description?: string;
  rootPersonId?: string;
  grampsCompatibilityVersion?: string;
  persons: Record<string, Person>;
  families: Record<string, Family>;
  sources: Record<string, Source>;
  events?: Record<string, Event>;
  places?: Record<string, any>;
  notes?: Record<string, any>;
  submitters?: Record<string, any>;
  repositories?: Record<string, any>;
  metadata?: {
    title: string;
    description?: string;
    lastModified?: string;
    author?: string;
  };
  lastModified?: string;
}

export type UserRole = 'admin' | 'editor' | 'researcher' | 'viewer';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  role: UserRole;
  isAuthenticated: boolean;
  isWhitelisted: boolean;
  loginMethod: 'google' | 'email_pin' | 'pin' | 'demo';
  lastActive?: string;
}

export interface WhitelistEntry {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  addedAt: string;
  addedBy?: string;
  status: 'active' | 'suspended';
  notes?: string;
}

export interface AccessRequest {
  id: string;
  email: string;
  name: string;
  note?: string;
  requestedRole: UserRole;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  processedAt?: string;
  processedBy?: string;
}

export interface AccessControlConfig {
  mode: 'whitelist_only' | 'whitelist_and_pin' | 'open_demo';
  pinCode?: string;
  allowPublicRequests: boolean;
  autoApproveViewers?: boolean;
  adminNotificationEmail?: string;
  enableEmailNotifications?: boolean;
  webhookUrl?: string;
}


