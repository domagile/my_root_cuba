export type NyshporkaTab = 
  | 'dashboard'
  | 'viewer'
  | 'catalog'
  | 'gazetteer'
  | 'library'
  | 'reading'
  | 'search'
  | 'profile';

export type HtrEngineVoice = 'pysar' | 'diak' | 'skryba' | 'diff';

export interface ImageFilters {
  brightness: number; // 50 to 200 (default 100)
  contrast: number;   // 50 to 200 (default 100)
  invert: boolean;
  grayscale: boolean;
  rotation: number;   // 0, 90, 180, 270
}

export interface DecodedFrame {
  id: string;
  imageUrl: string;
  pysarText: string;
  diakText: string;
  skrybaText?: string;
  size: [number, number];
  boxes: [number, number, number, number][];
  polys?: number[][][];
}

export interface ArchivalCase {
  id: string;
  shifra: string;
  archive: string;
  fond: string;
  opis: string;
  sprava: string;
  title: string;
  years: string;
  sheets: number;
  status: 'decoded' | 'in_progress' | 'queued';
  frames: DecodedFrame[];
  sourceUrl?: string;
}

export interface ArchiveRepository {
  id: string;
  label: string;
  name: string;
  country: 'UA' | 'PL' | 'MD';
  city?: string;
  sites?: Record<string, { url: string; source_id?: string }>;
  codes?: Record<string, string>;
  aliases?: string[];
}

export interface ResearchProfile {
  primarySurname: string;
  historicalVariants: string[];
  polishVariants: string[];
  confusers: string[];
  villages: string[];
  districts: string[];
}

