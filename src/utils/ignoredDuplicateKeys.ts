export const IGNORED_DUPLICATE_PAIRS_KEY = 'rodovid_ignored_duplicate_pairs';
export interface IgnoredDuplicateChange { key: string; ignored: boolean; token: string; }
export type IgnoredDuplicateChanges = Record<string, IgnoredDuplicateChange>;
export interface IgnoredDuplicateSnapshot { keys: string[]; revision: number; }

export function getDuplicatePairKey(idA: string, idB: string): string {
  return [idA.trim(), idB.trim()].sort().join('___');
}
export function duplicatePairAliases(idA: string, idB: string): string[] {
  const a = idA.trim(), b = idB.trim(), key = getDuplicatePairKey(a, b);
  return [...new Set([key, `dup_${key}`, `${a}___${b}`, `${b}___${a}`, `dup_${a}___${b}`, `dup_${b}___${a}`,
    `dup_${a}_${b}`, `dup_${b}_${a}`, `${a}:::${b}`, `${b}:::${a}`])];
}
export function normalizeIgnoredDuplicateKeys(keys: readonly string[]): Set<string> {
  const result = new Set<string>();
  for (const raw of keys) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const key = raw.trim(); result.add(key);
    if (key.includes('___')) {
      const parts = key.replace(/^dup_/, '').split('___');
      if (parts.length === 2 && parts[0] && parts[1]) {
        result.add(getDuplicatePairKey(parts[0], parts[1]));
        result.add(`dup_${parts[0]}___${parts[1]}`); result.add(`dup_${parts[1]}___${parts[0]}`);
      }
    } else if (key.includes(':::')) {
      const parts = key.split(':::');
      if (parts.length === 2 && parts[0] && parts[1]) result.add(getDuplicatePairKey(parts[0], parts[1]));
    }
  }
  return result;
}
export function applyIgnoredDuplicateChanges(keys: readonly string[], changes: readonly IgnoredDuplicateChange[]): string[] {
  const result = new Set(keys);
  for (const change of changes) {
    if (change.ignored) result.add(change.key); else result.delete(change.key);
  }
  return [...result];
}
export function isIgnoredDuplicateSnapshot(value: unknown): value is IgnoredDuplicateSnapshot {
  const snapshot = value as IgnoredDuplicateSnapshot | null;
  return !!snapshot && Array.isArray(snapshot.keys) && snapshot.keys.every(key => typeof key === 'string')
    && Number.isSafeInteger(snapshot.revision) && snapshot.revision >= 0;
}
