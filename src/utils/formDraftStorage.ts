/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PersonDraftData {
  personId?: string | null;
  savedAt: number;
  firstName: string;
  lastName: string;
  patronymic?: string;
  maidenName?: string;
  gender: string;
  isLiving: boolean;
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  residencePlace?: string;
  fatherId?: string;
  motherId?: string;
  spouseId?: string;
  notes?: string;
  bio?: string;
  formMode?: 'express' | 'full' | 'view';
}

const STORAGE_PREFIX = 'rodovid_person_draft_';

export function getDraftStorageKey(personId?: string | null): string {
  return `${STORAGE_PREFIX}${personId || '__new__'}`;
}

export function savePersonDraft(personId: string | null | undefined, data: Partial<PersonDraftData>): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getDraftStorageKey(personId);
    // Don't save empty drafts
    if (!data.firstName?.trim() && !data.lastName?.trim() && !data.birthDate?.trim()) {
      return;
    }
    const payload: PersonDraftData = {
      personId: personId || null,
      savedAt: Date.now(),
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      patronymic: data.patronymic || '',
      maidenName: data.maidenName || '',
      gender: data.gender || 'male',
      isLiving: data.isLiving ?? true,
      birthDate: data.birthDate || '',
      birthPlace: data.birthPlace || '',
      deathDate: data.deathDate || '',
      deathPlace: data.deathPlace || '',
      residencePlace: data.residencePlace || '',
      fatherId: data.fatherId || '',
      motherId: data.motherId || '',
      spouseId: data.spouseId || '',
      notes: data.notes || '',
      bio: data.bio || '',
      formMode: data.formMode || 'express'
    };
    sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore sessionStorage quota or private mode issues
  }
}

export function loadPersonDraft(personId?: string | null): PersonDraftData | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = getDraftStorageKey(personId);
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersonDraftData;
    // Expire drafts older than 48 hours
    if (Date.now() - parsed.savedAt > 48 * 60 * 60 * 1000) {
      sessionStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPersonDraft(personId?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getDraftStorageKey(personId);
    sessionStorage.removeItem(key);
  } catch {
    // Ignore errors
  }
}
