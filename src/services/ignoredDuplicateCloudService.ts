import { doc, runTransaction, type Firestore } from 'firebase/firestore';
import { applyIgnoredDuplicateChanges, type IgnoredDuplicateChange, type IgnoredDuplicateSnapshot } from '../utils/ignoredDuplicateKeys';

/** Only patch requested keys; never replace another client's independent choices. */
export async function writeIgnoredDuplicateChanges(db: Firestore, projectId: string, changes: IgnoredDuplicateChange[]): Promise<IgnoredDuplicateSnapshot> {
  const ref = doc(db, 'projects', projectId, 'systemSettings', 'ignoredDuplicates');
  return runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref), data = snapshot.exists() ? snapshot.data() : { keys: [] };
    if (!Array.isArray(data.keys) || data.keys.some((key: unknown) => typeof key !== 'string')) throw new Error('Invalid ignored duplicate keys');
    const revision = data.revision ?? 0;
    if (!Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER) throw new Error('Invalid ignored duplicate revision');
    if (changes.some(change => typeof change.key !== 'string' || !change.key || typeof change.ignored !== 'boolean')) throw new Error('Invalid ignored duplicate changes');
    const result = { keys: applyIgnoredDuplicateChanges(data.keys, changes), revision: revision + 1 };
    transaction.set(ref, { ...result, updatedAt: new Date().toISOString() }, { merge: true });
    return result;
  });
}
