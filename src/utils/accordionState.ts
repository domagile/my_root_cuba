/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ModalSection =
  | 'basic'
  | 'names'
  | 'parents'
  | 'dates-places'
  | 'bio-notes'
  | 'events'
  | 'photos'
  | 'custom-fields';

export type ModalAccordionState = Record<ModalSection, boolean>;

export const DEFAULT_MODAL_ACCORDION_SECTIONS: ModalAccordionState = {
  'basic': false,
  'names': false,
  'parents': false,
  'dates-places': false,
  'bio-notes': false,
  'events': false,
  'photos': false,
  'custom-fields': false,
};

export const MODAL_SECTION_KEYS: ModalSection[] = [
  'basic',
  'names',
  'parents',
  'dates-places',
  'bio-notes',
  'events',
  'photos',
  'custom-fields'
];

const GLOBAL_ACCORDION_KEY = 'rodovid_modal_accordion_sections_v2';
const GLOBAL_ACTIVE_SECTION_KEY = 'rodovid_modal_active_section_v2';
const PER_PERSON_KEY_PREFIX = 'rodovid_person_accordion_v2_';

/**
 * Sanitizes any raw object to ensure all 8 modal sections exist with boolean values.
 */
export function sanitizeAccordionState(raw: unknown): ModalAccordionState {
  const result: ModalAccordionState = { ...DEFAULT_MODAL_ACCORDION_SECTIONS };
  if (!raw || typeof raw !== 'object') return result;

  const rec = raw as Record<string, unknown>;
  for (const key of MODAL_SECTION_KEYS) {
    if (typeof rec[key] === 'boolean') {
      result[key] = rec[key] as boolean;
    }
  }
  return result;
}

/**
 * Retrieves the saved accordion state.
 * By default, all accordions are collapsed.
 * If personId is provided, checks if the user customized the sections for that person.
 */
export function getSavedAccordionSections(personId?: string | null): ModalAccordionState {
  if (typeof window === 'undefined') return { ...DEFAULT_MODAL_ACCORDION_SECTIONS };
  try {
    // 1. If personId is provided, check per-person memory
    if (personId) {
      const perPerson = localStorage.getItem(`${PER_PERSON_KEY_PREFIX}${personId}`);
      if (perPerson) {
        const parsed = JSON.parse(perPerson);
        return sanitizeAccordionState(parsed);
      }
    }
  } catch {}

  return { ...DEFAULT_MODAL_ACCORDION_SECTIONS };
}

/**
 * Retrieves the saved active section.
 */
export function getSavedActiveSection(): ModalSection {
  if (typeof window === 'undefined') return 'basic';
  try {
    const saved = localStorage.getItem(GLOBAL_ACTIVE_SECTION_KEY);
    if (saved && (MODAL_SECTION_KEYS as string[]).includes(saved)) {
      return saved as ModalSection;
    }
  } catch {}
  return 'basic';
}

/**
 * Persists the accordion state to localStorage both globally and per-person (if provided).
 */
export function saveAccordionSections(
  state: ModalAccordionState,
  personId?: string | null,
  activeSection?: ModalSection
): void {
  if (typeof window === 'undefined') return;
  try {
    const sanitized = sanitizeAccordionState(state);
    const serialized = JSON.stringify(sanitized);

    localStorage.setItem(GLOBAL_ACCORDION_KEY, serialized);

    if (personId) {
      localStorage.setItem(`${PER_PERSON_KEY_PREFIX}${personId}`, serialized);
    }

    if (activeSection && (MODAL_SECTION_KEYS as string[]).includes(activeSection)) {
      localStorage.setItem(GLOBAL_ACTIVE_SECTION_KEY, activeSection);
    }
  } catch {}
}
