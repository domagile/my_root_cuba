import { doc, runTransaction, type Firestore } from 'firebase/firestore';
import { applyMergedPersonChanges, validMergedPersonSnapshot, type MergedPersonSnapshot } from '../utils/mergedPersonState';

export async function writeMergedPersonChanges(db: Firestore, projectId: string, changes: Record<string, string | null>): Promise<MergedPersonSnapshot> {
  const ref = doc(db, 'projects', projectId, 'systemSettings', 'mergedPersons');
  return runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref), data = snapshot.exists() ? snapshot.data() : {};
    const current = { mapping: data.mapping ?? {}, revision: data.revision ?? 0 };
    if (!validMergedPersonSnapshot(current) || current.revision >= Number.MAX_SAFE_INTEGER) throw new Error('Invalid merged person settings');
    const result = { mapping: applyMergedPersonChanges(current.mapping, changes), revision: current.revision + 1 };
    // Replace the mapping field inside the transaction: merge:true would retain
    // omitted nested keys, resurrecting an undone merge on the next download.
    transaction.set(ref, { ...data, ...result, updatedAt: new Date().toISOString() }); return result;
  });
}
