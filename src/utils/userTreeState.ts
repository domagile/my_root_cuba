/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Person, AuthUser, WhitelistEntry } from '../types';
import { isUserWhitelisted } from '../rodovid/utils/privacy';
import { findRootPersonId } from '../rodovid/utils/relationship';

export interface UserTreeState {
  selectedPersonId: string;
  pan?: { x: number; y: number };
  scale?: number;
  generations?: number;
  showSiblings?: boolean;
  orientation?: 'vertical' | 'horizontal';
  enableBloodlineHover?: boolean;
  isCompact?: boolean;
  updatedAt: string;
}

const AUTH_STORAGE_KEY = 'genealogy_auth_security_v1';
const USER_STATE_PREFIX = 'rodovid_user_tree_state_';

/**
 * Returns saved tree state for a given user email.
 */
export function getSavedUserTreeState(email?: string | null): UserTreeState | null {
  if (!email) return null;
  try {
    const clean = email.trim().toLowerCase();
    const raw = localStorage.getItem(`${USER_STATE_PREFIX}${clean}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserTreeState;
    // Filter out uncentered fallback/stale coordinates
    if (parsed.pan && ((parsed.pan.x === 80 && parsed.pan.y === 80) || (parsed.pan.x === 0 && parsed.pan.y === 0))) {
      delete parsed.pan;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Saves or updates tree state for an authorized user.
 */
export function saveUserTreeState(email: string, partial: Partial<UserTreeState>): void {
  if (!email) return;
  try {
    const clean = email.trim().toLowerCase();
    const existing = getSavedUserTreeState(clean) || {
      selectedPersonId: '',
      updatedAt: new Date().toISOString()
    };
    // Never persist dummy uncentered pan (80, 80) or (0, 0)
    const sanitizedPartial = { ...partial };
    if (sanitizedPartial.pan && ((sanitizedPartial.pan.x === 80 && sanitizedPartial.pan.y === 80) || (sanitizedPartial.pan.x === 0 && sanitizedPartial.pan.y === 0))) {
      delete sanitizedPartial.pan;
    }
    const next: UserTreeState = {
      ...existing,
      ...sanitizedPartial,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(`${USER_STATE_PREFIX}${clean}`, JSON.stringify(next));
  } catch {}
}

/**
 * Clears saved tree state for a user.
 */
export function clearUserTreeState(email: string): void {
  if (!email) return;
  try {
    const clean = email.trim().toLowerCase();
    localStorage.removeItem(`${USER_STATE_PREFIX}${clean}`);
  } catch {}
}

/**
 * Resolves the initial person ID to focus on when opening the tree:
 * - If user is an authorized user and has a previously saved state, restores that person.
 * - Otherwise (by default for visitors / guests / first-time opens), focuses on the root person.
 */
export function resolveInitialPersonId(
  persons: Person[],
  currentUser?: AuthUser | null,
  whitelist?: WhitelistEntry[]
): string {
  const rootId = findRootPersonId(persons);

  // If currentUser or whitelist wasn't passed, attempt to read from localStorage
  let user = currentUser;
  let wl = whitelist;
  if (!user && typeof window !== 'undefined') {
    try {
      const savedUser = localStorage.getItem(`${AUTH_STORAGE_KEY}_currentUser`);
      if (savedUser) user = JSON.parse(savedUser);
    } catch {}
  }
  if (!wl && typeof window !== 'undefined') {
    try {
      const savedWl = localStorage.getItem(`${AUTH_STORAGE_KEY}_whitelist`);
      if (savedWl) wl = JSON.parse(savedWl);
    } catch {}
  }

  const isAuth = isUserWhitelisted(user || null, wl || []);
  if (isAuth && user?.email) {
    const savedState = getSavedUserTreeState(user.email);
    if (savedState?.selectedPersonId && persons.some((p) => p.id === savedState.selectedPersonId)) {
      return savedState.selectedPersonId;
    }
  }

  return rootId;
}
