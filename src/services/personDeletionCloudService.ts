import { doc, runTransaction, type Firestore } from 'firebase/firestore';
import { applyDeletionChangesToIds } from '../utils/personDeletionState';

/** Merge per-ID intentions in a transaction, never replace another client's whole list. */
export async function writePersonDeletionMarkers(
  db: Firestore, projectId: string, changes: Record<string, boolean>
): Promise<string[]> {
  const ref = doc(db, 'projects', projectId, 'systemSettings', 'deletedTombstones');
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const ids = applyDeletionChangesToIds(snapshot.exists() ? snapshot.data().ids : [], changes);
    transaction.set(ref, { ids, updatedAt: new Date().toISOString() }, { merge: true });
    return ids;
  });
}
