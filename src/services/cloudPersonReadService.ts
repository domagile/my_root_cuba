import type { Person } from '../types';
import { isDemoPerson } from '../utils/demoPurge';
import { normalizePerson } from '../utils/personNormalization';

interface ReadOptions {
  excludedIds: ReadonlySet<string>;
  localPersons?: Person[];
  pendingIds?: ReadonlySet<string>;
}

/** Select a local view without deleting, uploading, or creating deletion intentions. */
export function selectCloudPersons(remote: Person[], options: ReadOptions): Person[] {
  const result = new Map<string, Person>();
  const visible = (person: Person) => person && typeof person.id === 'string' && person.id.length > 0 &&
    !person.isDeleted && !isDemoPerson(person) && !options.excludedIds.has(person.id);
  for (const person of remote) if (visible(person)) result.set(person.id, normalizePerson(person));
  for (const person of options.localPersons || []) {
    if (visible(person) && (!result.has(person.id) || options.pendingIds?.has(person.id))) result.set(person.id, person);
  }
  return [...result.values()];
}
