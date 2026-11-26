import { persistLocalData, readLocalDataSync, idbGet } from './indexedDbStorage';
import { applyIgnoredDuplicateChanges, duplicatePairAliases, normalizeIgnoredDuplicateKeys,
  isIgnoredDuplicateSnapshot, IGNORED_DUPLICATE_PAIRS_KEY,
  type IgnoredDuplicateChanges, type IgnoredDuplicateSnapshot } from './ignoredDuplicateKeys';

export const IGNORED_DUPLICATE_STATE_KEY = 'genealogy_ignored_duplicate_state_v1';
interface State { version: 1; base: IgnoredDuplicateSnapshot; pending: IgnoredDuplicateChanges; localRevision?: number; }
function token(): string { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`; }
function broadcast(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('rodovid_ignored_duplicates_changed'));
}
function effective(state: State): string[] { return applyIgnoredDuplicateChanges(state.base.keys, Object.values(state.pending)); }
function validState(saved: State | null): saved is State {
  return saved?.version === 1 && isIgnoredDuplicateSnapshot(saved.base) && !!saved.pending && !Array.isArray(saved.pending)
    && typeof saved.pending === 'object' && Object.entries(saved.pending).every(([key, value]) => value?.key === key
      && typeof value.ignored === 'boolean' && typeof value.token === 'string')
    && (saved.localRevision === undefined || Number.isSafeInteger(saved.localRevision) && saved.localRevision >= 0);
}
function persist(state: State): void {
  // The journal is authoritative; the legacy key remains a compatibility mirror.
  const previous = readLocalDataSync<State>(IGNORED_DUPLICATE_STATE_KEY);
  state = { ...state, localRevision: Math.max(state.localRevision ?? 0, validState(previous) ? previous.localRevision ?? 0 : 0) + 1 };
  persistLocalData(IGNORED_DUPLICATE_STATE_KEY, state, true);
  persistLocalData(IGNORED_DUPLICATE_PAIRS_KEY, effective(state), true);
}
function state(): State {
  const saved = readLocalDataSync<State>(IGNORED_DUPLICATE_STATE_KEY);
  if (validState(saved)) return saved;
  const legacy = readLocalDataSync<unknown>(IGNORED_DUPLICATE_PAIRS_KEY);
  const keys = Array.isArray(legacy) ? [...new Set(legacy.filter((key): key is string => typeof key === 'string' && !!key.trim()).map(key => key.trim()))] : [];
  // Preserve pre-upgrade choices, including opaque historical aliases we cannot split safely.
  const pending = Object.fromEntries(keys.map(key => [key, { key, ignored: true, token: `legacy:${key}` }]));
  const initial: State = { version: 1, base: { keys: [], revision: 0 }, pending };
  return initial;
}
export async function hydrateIgnoredDuplicateState(): Promise<void> {
  const mirror = readLocalDataSync<State>(IGNORED_DUPLICATE_STATE_KEY);
  for (const key of [IGNORED_DUPLICATE_STATE_KEY, IGNORED_DUPLICATE_PAIRS_KEY]) readLocalDataSync(key);
  await Promise.all([idbGet(IGNORED_DUPLICATE_STATE_KEY), idbGet(IGNORED_DUPLICATE_PAIRS_KEY)]);
  const committed = readLocalDataSync<State>(IGNORED_DUPLICATE_STATE_KEY);
  // An emergency page-close mirror can be newer than the last completed IDB transaction.
  if (validState(mirror) && (!validState(committed) || (mirror.localRevision ?? 0) > (committed.localRevision ?? 0)
    || mirror.base.revision > committed.base.revision)) {
    const preferred = !validState(committed) || (mirror.localRevision ?? 0) > (committed.localRevision ?? 0) ? mirror : committed;
    const base = !validState(committed) || mirror.base.revision > committed.base.revision ? mirror.base : committed.base;
    persist({ ...preferred, base });
  }
  broadcast();
}
export function getEffectiveIgnoredDuplicateKeys(): Set<string> { return normalizeIgnoredDuplicateKeys(effective(state())); }
export function getPendingIgnoredDuplicateChanges(): IgnoredDuplicateChanges { return { ...state().pending }; }

export function setIgnoredDuplicateDecision(idA: string, idB: string, ignored: boolean): boolean {
  if (!idA?.trim() || !idB?.trim() || idA.trim() === idB.trim()) return false;
  const current = state(), aliases = duplicatePairAliases(idA, idB);
  const keys = normalizeIgnoredDuplicateKeys(effective(current));
  if (aliases.some(key => keys.has(key)) === ignored) return false;
  const pending = { ...current.pending }, nonce = token();
  for (const key of aliases) pending[key] = { key, ignored, token: nonce };
  persist({ ...current, pending }); broadcast(); return true;
}

/** Pending local decisions always overlay downloads/subscriptions, even an empty list. */
export function applyCloudIgnoredDuplicateSnapshot(snapshot: IgnoredDuplicateSnapshot): boolean {
  if (!isIgnoredDuplicateSnapshot(snapshot)) return false;
  const current = state();
  if (snapshot.revision < current.base.revision) return false;
  const base = { keys: [...new Set(snapshot.keys)], revision: snapshot.revision };
  if (base.revision === current.base.revision && JSON.stringify(base.keys) === JSON.stringify(current.base.keys)) return true;
  persist({ ...current, base }); broadcast(); return true;
}

export function acknowledgeIgnoredDuplicateChanges(changes: IgnoredDuplicateChanges, snapshot: unknown): boolean {
  if (!isIgnoredDuplicateSnapshot(snapshot)) return false;
  const keys = new Set(snapshot.keys);
  if (Object.values(changes).some(change => keys.has(change.key) !== change.ignored)) return false;
  const current = state(), pending = { ...current.pending };
  for (const [key, change] of Object.entries(changes)) if (pending[key]?.token === change.token) delete pending[key];
  const base = snapshot.revision >= current.base.revision ? { keys: [...snapshot.keys], revision: snapshot.revision } : current.base;
  persist({ ...current, base, pending }); broadcast(); return true;
}
