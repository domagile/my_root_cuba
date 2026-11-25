import type { Person } from '../types';
import type { DeletionChanges } from '../utils/personDeletionState';
import { normalizePerson } from '../utils/personNormalization';
import { isDemoPerson } from '../utils/demoPurge';

interface PersonState { persons: Person[]; trashPersons: Person[]; }

/** Reconcile confirmed remote evidence locally. Missing records are never proof of deletion. */
export function reconcileCloudTrash(
  state: PersonState, confirmedDeletedIds: readonly string[], confirmedPersons: readonly Person[] = [],
  pending: DeletionChanges = {}, mergedIds: ReadonlySet<string> = new Set(), now = new Date().toISOString()
): PersonState {
  const deleted = new Set(confirmedDeletedIds);
  const active = new Map(state.persons.map(person => [person.id, person]));
  const trash = new Map(state.trashPersons.map(person => [person.id, person]));
  let changed = false;
  for (const person of state.persons) {
    if (!deleted.has(person.id) || pending[person.id]?.deleted === false) continue;
    active.delete(person.id);
    if (!trash.has(person.id)) trash.set(person.id, { ...person, isDeleted: true, deletedAt: now });
    changed = true;
  }
  for (const person of confirmedPersons) {
    if (!person?.id || person.isDeleted || isDemoPerson(person) || !trash.has(person.id) ||
        deleted.has(person.id) || pending[person.id]?.deleted === true || mergedIds.has(person.id)) continue;
    trash.delete(person.id);
    if (!active.has(person.id)) active.set(person.id, normalizePerson({ ...person, isDeleted: false, deletedAt: undefined }));
    changed = true;
  }
  return changed ? { persons: [...active.values()], trashPersons: [...trash.values()] } : state;
}
