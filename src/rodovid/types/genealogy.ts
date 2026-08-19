/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
  | 'reports';

export type TreeLayoutType = 'ancestors' | 'descendants' | 'hourglass' | 'both';

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
  isLiving?: boolean;
  birthDate?: string;
  birthYear?: number | string;
  birthPlace?: string;
  deathDate?: string;
  deathYear?: number | string;
  deathPlace?: string;
  occupation?: string;
  avatarUrl?: string;
  avatar?: string;
  photoUrl?: string;
  photos?: string[];
  bio?: string;
  notes?: any;
  tags?: string[];
  events?: any[];
  citations?: any[];
  sourceCitations?: string[];
  parentFamilyId?: string;
  spouseFamilyIds?: string[];
  fatherId?: string;
  motherId?: string;
  spouseIds?: string[];
  childrenIds?: string[];
  generation?: number;
  confession?: string;
  estate?: string;
  socialStatus?: string;
  estateOrSocialStatus?: string;
  militaryRank?: string;
  sourceIds?: string[];
  isDeleted?: boolean;
  deletedAt?: string;
  customFields?: CustomFieldItem[] | Record<string, string>;
}

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
  archiveReference?: string;
  archiveFund?: string;
  inventory?: string;
  caseNumber?: string;
  page?: string;
  url?: string;
  notes?: string;
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
  events: Record<string, Event>;
  places?: Record<string, any>;
  notes?: Record<string, any>;
  metadata?: {
    title: string;
    description?: string;
    lastModified?: string;
    author?: string;
  };
  lastModified?: string;
}
