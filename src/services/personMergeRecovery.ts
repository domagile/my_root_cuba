import type { Person, Family } from '../types';
import { normalizePerson } from '../utils/personNormalization';

export interface MergePayload {
  updatedPersons: Person[]; updatedFamilies: Record<string, Family>; masterPerson?: Person;
  deletedPersonIds: string[]; mergedInto?: Record<string, string>;
  sourcePersons: Person[]; sourceFamilies: Record<string, Family>;
}
export interface MergeRecords { persons: Person[]; families: Record<string, Family>; trashPersons: Person[]; }
export interface PersonMergeRecovery {
  version: 1; afterFingerprint: string; deletedPersonIds: string[]; mergedInto: Record<string, string>;
  previousSelectedId: string | null; afterSelectedId: string | null; previousSnapshotId: string | null;
}
export function sameMergeValue(a: unknown, b: unknown): boolean { return stable(a) === stable(b); }
function stable(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
}
const indexed = (persons: Person[]) => Object.fromEntries(persons.map(person => [person.id, person]));
export function mergeRecordsFingerprint(records: MergeRecords): string {
  const withoutSyncMetadata = (rows: Record<string, any>) => Object.fromEntries(Object.entries(rows).map(([id, row]) => {
    const { updatedAt: _updatedAt, ...data } = row; return [id, data];
  }));
  // Firestore adds updatedAt and represents cleared optional fields as null.
  // These transport changes must not disable undo; substantive edits still do.
  return JSON.stringify({ persons: withoutSyncMetadata(indexed(records.persons)), families: withoutSyncMetadata(records.families),
    trashPersons: withoutSyncMetadata(indexed(records.trashPersons)) }, (_key, item) => item === null ? undefined
      : item && typeof item === 'object' && !Array.isArray(item)
        ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
}
export function assertFreshMergePair(a: Person, b: Person, persons: Person[]): void {
  if (!a?.id || !b?.id || a.id === b.id) throw new Error('Потрібні дві різні особи для злиття.');
  for (const person of [a, b]) {
    const current = persons.find(item => item.id === person.id);
    if (!current || current.isDeleted || !sameMergeValue(current, person)) throw new Error('Дані осіб змінилися. Оновіть порівняння перед злиттям.');
  }
}
export function preparePersonMerge(current: MergeRecords & { selectedPersonId: string | null }, payload: MergePayload) {
  if (!sameMergeValue(indexed(current.persons), indexed(payload.sourcePersons)) || !sameMergeValue(current.families, payload.sourceFamilies)) {
    throw new Error('База змінилася після відкриття порівняння. Повторіть перевірку.');
  }
  const deletedIds = [...new Set(payload.deletedPersonIds)], deleted = new Set(deletedIds);
  if (!deletedIds.length || deletedIds.some(id => !current.persons.some(person => person.id === id))) throw new Error('Немає актуальних осіб для злиття.');
  const mapping = payload.mergedInto ?? Object.fromEntries(deletedIds.map(id => [id, payload.masterPerson?.id]));
  const expected = new Set(current.persons.filter(person => !deleted.has(person.id)).map(person => person.id));
  const persons = payload.updatedPersons.map(normalizePerson);
  if (persons.length !== expected.size || new Set(persons.map(person => person.id)).size !== persons.length
    || persons.some(person => !expected.has(person.id) || person.isDeleted)) throw new Error('Результат злиття втрачає або дублює інші записи.');
  if (deletedIds.some(id => !mapping[id] || !expected.has(mapping[id]))) throw new Error('Не визначено основну особу для кожного дубліката.');
  if (!sameMergeValue(Object.keys(current.families).sort(), Object.keys(payload.updatedFamilies).sort())) throw new Error('Результат злиття змінює набір родин.');
  const now = new Date().toISOString();
  const trashPersons = [...current.trashPersons.filter(person => !deleted.has(person.id)),
    ...current.persons.filter(person => deleted.has(person.id)).map(person => ({ ...person, isDeleted: true, deletedAt: now,
      notes: `${person.notes ? person.notes + ' • ' : ''}Об’єднано з ${mapping[person.id]}` }))];
  const selectedPersonId = payload.masterPerson?.id || (current.selectedPersonId && deleted.has(current.selectedPersonId)
    ? mapping[current.selectedPersonId] : current.selectedPersonId);
  return { persons, families: payload.updatedFamilies, trashPersons, selectedPersonId, deletedIds,
    mapping: Object.fromEntries(deletedIds.map(id => [id, mapping[id]])) as Record<string, string> };
}
