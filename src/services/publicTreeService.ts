import { collection, doc, getDoc, getDocs, query, setDoc, where, writeBatch } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { GenealogyDatabase } from '../types';
import { createPublicTree, restorePublicTree } from '../utils/publicTree';
import type { PublicPerson, PublicFamily } from '../utils/publicTree';

export async function publishPublicTree(
  db: Firestore, shareId: string,
  database: Pick<GenealogyDatabase, 'persons' | 'families'>, rootPersonId: string
): Promise<void> {
  const version = crypto.randomUUID();
  const data = createPublicTree(database);
  const metaRef = doc(db, 'publicTrees', shareId);
  const metadata = {
    id: shareId, schemaVersion: 1, version, enabled: false,
    rootPersonId: data.persons[rootPersonId] ? rootPersonId : Object.keys(data.persons)[0] || '',
    updatedAt: new Date().toISOString()
  };
  // Revoke the old version first. Failed/interrupted publication stays closed.
  await setDoc(metaRef, metadata);
  for (const [name, records] of Object.entries(data)) {
    const rows = Object.values(records);
    // Family validation checks two referenced persons. Keep the entire batch
    // below Firestore's 20 security-rule document-access limit (16 + shared ACL).
    const batchSize = name === 'families' ? 8 : 400;
    for (let offset = 0; offset < rows.length; offset += batchSize) {
      const batch = writeBatch(db);
      for (const row of rows.slice(offset, offset + batchSize)) {
        batch.set(doc(db, 'publicTrees', shareId, 'versions', version, name, row.id), row);
      }
      await batch.commit();
    }
  }
  await setDoc(metaRef, { ...metadata, enabled: true });
}

export async function getPublicTree(db: Firestore, shareId: string) {
  const meta = await getDoc(doc(db, 'publicTrees', shareId));
  if (!meta.exists() || !meta.data().enabled) return null;
  const data = meta.data();
  const [persons, families] = await Promise.all([
    getDocs(query(collection(db, 'publicTrees', shareId, 'versions', data.version, 'persons'), where('isLiving', '==', false))),
    getDocs(collection(db, 'publicTrees', shareId, 'versions', data.version, 'families'))
  ]);
  return {
    updatedAt: data.updatedAt as string,
    database: restorePublicTree(
      persons.docs.map(row => row.data() as PublicPerson),
      families.docs.map(row => row.data() as PublicFamily), data.rootPersonId
    )
  };
}
