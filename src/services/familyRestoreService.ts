import type { Family, FamilyChild } from '../types';

export const FAMILY_RESTORE_STORAGE_KEY = 'genealogy_deleted_family_links_v1';
export interface FamilyRestoreLink {
  familyId: string;
  husband?: boolean;
  wife?: boolean;
  child?: FamilyChild;
  childOrder?: string[];
  childIdsOrder?: string[];
}
export type FamilyRestoreHistory = Record<string, FamilyRestoreLink[]>;
export interface RestorePersonsResult { restoredCount: number; skippedFamilyLinks: number; }

/** Save only the removed memberships; unrelated family fields are never rolled back. */
export function removeFamilyMemberships(families: Record<string, Family>, ids: ReadonlySet<string>) {
  const next = { ...families };
  const history: FamilyRestoreHistory = Object.fromEntries([...ids].map(id => [id, []]));
  const changedIds: string[] = [];
  for (const [familyId, family] of Object.entries(families)) {
    const members = new Set([family.husbandId, family.wifeId, ...(family.children || []).map(child => child.personId), ...(family.childrenIds || [])]);
    let changed = false;
    for (const id of members) {
      if (!id || !ids.has(id)) continue;
      const child = family.children?.find(item => item.personId === id);
      history[id].push({ familyId, husband: family.husbandId === id, wife: family.wifeId === id,
        ...(child ? { child: { ...child }, childOrder: family.children.map(item => item.personId) } : {}),
        ...(family.childrenIds?.includes(id) ? { childIdsOrder: [...family.childrenIds] } : {}) });
      changed = true;
    }
    if (!changed) continue;
    next[familyId] = { ...family,
      husbandId: family.husbandId && ids.has(family.husbandId) ? undefined : family.husbandId,
      wifeId: family.wifeId && ids.has(family.wifeId) ? undefined : family.wifeId,
      children: (family.children || []).filter(child => !ids.has(child.personId)),
      ...(family.childrenIds ? { childrenIds: family.childrenIds.filter(id => !ids.has(id)) } : {}) };
    changedIds.push(familyId);
  }
  return { families: changedIds.length ? next : families, history, changedIds };
}

function insertMembership<T>(current: T[], item: T, getId: (value: T) => string, order: string[]): T[] {
  const id = getId(item);
  if (current.some(value => getId(value) === id)) return current;
  const originalIndex = order.indexOf(id);
  const after = new Set(order.slice(originalIndex + 1));
  const beforeNext = current.findIndex(value => after.has(getId(value)));
  if (beforeNext >= 0) return [...current.slice(0, beforeNext), item, ...current.slice(beforeNext)];
  return [...current, item];
}

/** Restore memberships into existing families, preserving newer edits and occupied parent slots. */
export function restoreFamilyMemberships(
  families: Record<string, Family>, history: FamilyRestoreHistory, ids: readonly string[]
) {
  const next = { ...families };
  const remaining = { ...history };
  const changedIds = new Set<string>();
  let skippedFamilyLinks = 0;
  for (const id of new Set(ids)) {
    const unresolved: FamilyRestoreLink[] = [];
    for (const link of history[id] || []) {
      const family = next[link.familyId];
      if (!family) { unresolved.push(link); skippedFamilyLinks++; continue; }
      let updated = family;
      let conflict = false;
      for (const [enabled, field] of [[link.husband, 'husbandId'], [link.wife, 'wifeId']] as const) {
        if (!enabled) continue;
        if (family[field] && family[field] !== id) { conflict = true; continue; }
        if (updated[field] !== id) updated = { ...updated, [field]: id };
      }
      if (link.child) {
        const children = insertMembership(updated.children || [], link.child, child => child.personId, link.childOrder || [id]);
        if (children !== updated.children) updated = { ...updated, children };
      }
      if (link.childIdsOrder) {
        const childrenIds = insertMembership(updated.childrenIds || [], id, value => value, link.childIdsOrder);
        if (childrenIds !== updated.childrenIds) updated = { ...updated, childrenIds };
      }
      if (updated !== family) { next[link.familyId] = updated; changedIds.add(link.familyId); }
      if (conflict) { unresolved.push(link); skippedFamilyLinks++; }
    }
    if (unresolved.length) remaining[id] = unresolved;
    else delete remaining[id];
  }
  return { families: changedIds.size ? next : families, remaining, changedIds: [...changedIds], skippedFamilyLinks };
}
