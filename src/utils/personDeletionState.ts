import { idbGet, persistLocalData, readLocalDataSync } from './indexedDbStorage';

export const TOMBSTONE_STORAGE_KEY = 'genealogy_deleted_tombstone_ids_v1';
export const TRASH_STORAGE_KEY = 'genealogy_workstation_data_v4_familio_trashPersons';
export const DELETION_CHANGES_KEY = 'genealogy_person_deletion_changes_v1';
export interface DeletionChange { deleted: boolean; token: string; }
export type DeletionChanges = Record<string, DeletionChange>;
let revision = 0;

function validIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && id.length > 0) : [];
}
export function getPendingDeletionChanges(): DeletionChanges {
  const raw = readLocalDataSync<DeletionChanges>(DELETION_CHANGES_KEY);
  return Object.fromEntries(Object.entries(raw || {}).filter(([, change]) =>
    change && typeof change.deleted === 'boolean' && typeof change.token === 'string'));
}
export function getTombstoneIds(): Set<string> {
  const ids = new Set(validIds(readLocalDataSync(TOMBSTONE_STORAGE_KEY)));
  const trash = readLocalDataSync<{ id: string }[]>(TRASH_STORAGE_KEY);
  if (Array.isArray(trash)) for (const person of trash) if (person?.id) ids.add(person.id);
  for (const [id, change] of Object.entries(getPendingDeletionChanges())) {
    if (change.deleted) ids.add(id); else ids.delete(id);
  }
  return ids;
}
export function recordPersonDeletionChanges(ids: string[], deleted: boolean): void {
  const unique = [...new Set(validIds(ids))];
  if (!unique.length) return;
  const changes: DeletionChanges = Object.assign(Object.create(null), getPendingDeletionChanges());
  const tombstones = getTombstoneIds();
  for (const id of unique) {
    changes[id] = { deleted, token: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${revision}-${Math.random()}` };
    if (deleted) tombstones.add(id); else tombstones.delete(id);
  }
  revision++;
  persistLocalData(DELETION_CHANGES_KEY, changes);
  persistLocalData(TOMBSTONE_STORAGE_KEY, [...tombstones]);
}
export const getDeletionStateRevision = () => revision;

/** The cloud list is authoritative, with newer unconfirmed local intentions layered over it. */
export function acceptCloudTombstones(ids: string[], expectedRevision?: number): boolean {
  if (expectedRevision !== undefined && expectedRevision !== revision) return false;
  revision++;
  persistLocalData(TOMBSTONE_STORAGE_KEY, validIds(ids));
  return true;
}

/** Acknowledge only the exact per-person intentions included in a successful transaction. */
export function acknowledgeDeletionChanges(snapshot: DeletionChanges, cloudIds: string[], expectedRevision?: number): void {
  const pending: DeletionChanges = Object.assign(Object.create(null), getPendingDeletionChanges());
  for (const [id, change] of Object.entries(snapshot)) {
    if (pending[id]?.token === change.token) delete pending[id];
  }
  // A subscription may have arrived while the transaction was running. Keep its
  // unrelated IDs, and apply only the intentions confirmed by this transaction.
  const confirmedIds = expectedRevision === undefined || expectedRevision === revision
    ? validIds(cloudIds)
    : applyDeletionChangesToIds(readLocalDataSync(TOMBSTONE_STORAGE_KEY),
      Object.fromEntries(Object.entries(snapshot).map(([id, change]) => [id, change.deleted])));
  persistLocalData(TOMBSTONE_STORAGE_KEY, confirmedIds);
  revision++;
  persistLocalData(DELETION_CHANGES_KEY, pending);
}
export async function hydratePersonDeletionState(): Promise<void> {
  // Register before asynchronous reads, so empty/large committed values override old mirrors.
  for (const key of [TOMBSTONE_STORAGE_KEY, TRASH_STORAGE_KEY, DELETION_CHANGES_KEY]) readLocalDataSync(key);
  await Promise.all([idbGet(TOMBSTONE_STORAGE_KEY), idbGet(TRASH_STORAGE_KEY), idbGet(DELETION_CHANGES_KEY)]);
}

/** Apply per-ID intentions, preserving unrelated changes from other clients. */
export function applyDeletionChangesToIds(ids: unknown, changes: Record<string, boolean>): string[] {
  const result = new Set(validIds(ids));
  for (const [id, deleted] of Object.entries(changes)) {
    if (!id || typeof deleted !== 'boolean') throw new Error('Invalid person deletion change');
    if (deleted) result.add(id); else result.delete(id);
  }
  return [...result];
}
