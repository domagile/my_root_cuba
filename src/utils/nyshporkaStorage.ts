import { ResearchProfile, ArchivalCase, ImageFilters, HtrEngineVoice } from '../components/nyshporka/types';

export const DEFAULT_RESEARCH_PROFILE: ResearchProfile = {
  primarySurname: 'Долищинський',
  historicalVariants: ['Долищинскій', 'Долищинъ', 'Долыщинскій', 'Долищінскій', 'Долищиньский'],
  polishVariants: ['Dolyszczyński', 'Doliszczyński', 'Doliszyński', 'Doliszczenski'],
  confusers: ['Делищинський', 'Долизинський', 'Доливинський', 'Далищинський'],
  villages: ['с. Липовеньке', 'м-ко Голованівськ', 'с. Межирічка', 'с. Троянка'],
  districts: ['Балтський повіт', 'Кам’янецький повіт', 'Уманський повіт']
};

const PROFILE_KEY = 'nyshporka_research_profile';
const CASES_KEY = 'nyshporka_archival_cases';
const SETTINGS_KEY = 'nyshporka_viewer_settings';

export function getStoredResearchProfile(): ResearchProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return DEFAULT_RESEARCH_PROFILE;
    const parsed = JSON.parse(raw);
    return {
      primarySurname: parsed.primarySurname || DEFAULT_RESEARCH_PROFILE.primarySurname,
      historicalVariants: Array.isArray(parsed.historicalVariants) ? parsed.historicalVariants : DEFAULT_RESEARCH_PROFILE.historicalVariants,
      polishVariants: Array.isArray(parsed.polishVariants) ? parsed.polishVariants : DEFAULT_RESEARCH_PROFILE.polishVariants,
      confusers: Array.isArray(parsed.confusers) ? parsed.confusers : DEFAULT_RESEARCH_PROFILE.confusers,
      villages: Array.isArray(parsed.villages) ? parsed.villages : DEFAULT_RESEARCH_PROFILE.villages,
      districts: Array.isArray(parsed.districts) ? parsed.districts : DEFAULT_RESEARCH_PROFILE.districts
    };
  } catch {
    return DEFAULT_RESEARCH_PROFILE;
  }
}

export function saveStoredResearchProfile(profile: ResearchProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    window.dispatchEvent(new CustomEvent('nyshporka_profile_updated', { detail: profile }));
  } catch (err) {
    console.warn('Failed to save nyshporka research profile', err);
  }
}

export interface ViewerSettings {
  voice: HtrEngineVoice;
  showBoxes: boolean;
  filters: ImageFilters;
}

export const DEFAULT_VIEWER_SETTINGS: ViewerSettings = {
  voice: 'pysar',
  showBoxes: true,
  filters: {
    brightness: 100,
    contrast: 100,
    invert: false,
    grayscale: false,
    rotation: 0
  }
};

export function getStoredViewerSettings(): ViewerSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_VIEWER_SETTINGS;
    return { ...DEFAULT_VIEWER_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_VIEWER_SETTINGS;
  }
}

export function saveStoredViewerSettings(settings: ViewerSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Failed to save viewer settings', err);
  }
}
