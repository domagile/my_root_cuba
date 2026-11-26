import { idbGet, persistLocalData, readLocalDataSync } from './indexedDbStorage';

export const MERGED_PERSON_MAP_KEY = 'genealogy_merged_person_ids';
export const MERGED_PERSON_STATE_KEY = 'genealogy_merged_person_state_v1';
export interface MergedPersonSnapshot { mapping: Record<string, string>; revision: number; }
export interface MergedPersonChange { target: string | null; token: string; }
export type MergedPersonChanges = Record<string, MergedPersonChange>;
interface State { version: 1; base: MergedPersonSnapshot; pending: MergedPersonChanges; localRevision: number; }
const mappingIsValid = (value: unknown): value is Record<string, string> => !!value && typeof value === 'object'
  && !Array.isArray(value) && Object.values(value).every(target => typeof target === 'string' && !!target);
export function validMergedPersonSnapshot(value: unknown): value is MergedPersonSnapshot {
  const data = value as MergedPersonSnapshot | null;
  return !!data && mappingIsValid(data.mapping) && Number.isSafeInteger(data.revision) && data.revision >= 0;
}
function validState(value: State | null): value is State {
  return value?.version === 1 && validMergedPersonSnapshot(value.base) && !!value.pending && typeof value.pending === 'object' && !Array.isArray(value.pending)
    && Object.values(value.pending).every(change => change && (change.target === null || typeof change.target === 'string') && typeof change.token === 'string')
    && Number.isSafeInteger(value.localRevision) && value.localRevision >= 0;
}
export function applyMergedPersonChanges(mapping: Record<string, string>, changes: Record<string, string | null>): Record<string, string> {
  const result = new Map(Object.entries(mapping));
  for (const [id, target] of Object.entries(changes)) {
    if (!id || target !== null && (!target || typeof target !== 'string' || target === id)) throw new Error('Некоректний зв’язок злиття.');
    if (target === null) result.delete(id); else result.set(id, target);
  }
  return Object.fromEntries(result);
}
function state(): State {
  const saved = readLocalDataSync<State>(MERGED_PERSON_STATE_KEY);
  if (validState(saved)) return saved;
  const legacy = readLocalDataSync<unknown>(MERGED_PERSON_MAP_KEY);
  const mapping = mappingIsValid(legacy) ? legacy : {};
  return { version: 1, base: { mapping: {}, revision: 0 }, localRevision: 0,
    pending: Object.fromEntries(Object.entries(mapping).map(([id, target]) => [id, { target, token: `legacy:${id}:${target}` }])) };
}
function effective(current: State): Record<string, string> {
  return applyMergedPersonChanges(current.base.mapping, Object.fromEntries(Object.entries(current.pending).map(([id, change]) => [id, change.target])));
}
function persist(next: State): void {
  const previous = readLocalDataSync<State>(MERGED_PERSON_STATE_KEY);
  next = { ...next, localRevision: Math.max(next.localRevision, validState(previous) ? previous.localRevision : 0) + 1 };
  persistLocalData(MERGED_PERSON_STATE_KEY, next, true);
  persistLocalData(MERGED_PERSON_MAP_KEY, effective(next), true);
}
export function getMergedPersonMap(): Record<string, string> { return effective(state()); }
export function getPendingMergedPersonChanges(): MergedPersonChanges { return { ...state().pending }; }
export function recordMergedPersonChanges(changes: Record<string, string | null>): void {
  const current = state(); applyMergedPersonChanges(effective(current), changes);
  const updates = Object.entries(changes).map(([id, target]) => [id, { target,
    token: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}` }] as const);
  persist({ ...current, pending: Object.fromEntries([...Object.entries(current.pending), ...updates]) });
}
export function acceptMergedPersonSnapshot(snapshot: MergedPersonSnapshot): boolean {
  if (!validMergedPersonSnapshot(snapshot)) return false;
  const current = state(); if (snapshot.revision < current.base.revision) return false;
  persist({ ...current, base: { mapping: { ...snapshot.mapping }, revision: snapshot.revision } }); return true;
}
export function acknowledgeMergedPersonChanges(changes: MergedPersonChanges, snapshot: unknown): boolean {
  if (!validMergedPersonSnapshot(snapshot) || Object.entries(changes).some(([id, change]) =>
    change.target === null ? Object.hasOwn(snapshot.mapping, id) : snapshot.mapping[id] !== change.target)) return false;
  const current = state();
  const pending = Object.fromEntries(Object.entries(current.pending).filter(([id, change]) => changes[id]?.token !== change.token));
  persist({ ...current, base: snapshot.revision >= current.base.revision ? snapshot : current.base, pending }); return true;
}
export async function hydrateMergedPersonState(): Promise<void> {
  const mirror = readLocalDataSync<State>(MERGED_PERSON_STATE_KEY);
  for (const key of [MERGED_PERSON_MAP_KEY, MERGED_PERSON_STATE_KEY]) readLocalDataSync(key);
  await Promise.all([idbGet(MERGED_PERSON_MAP_KEY), idbGet(MERGED_PERSON_STATE_KEY)]);
  const committed = readLocalDataSync<State>(MERGED_PERSON_STATE_KEY);
  if (validState(mirror) && (!validState(committed) || mirror.localRevision > committed.localRevision || mirror.base.revision > committed.base.revision)) {
    const preferred = !validState(committed) || mirror.localRevision > committed.localRevision ? mirror : committed;
    persist({ ...preferred, base: !validState(committed) || mirror.base.revision > committed.base.revision ? mirror.base : committed.base });
  }
}
