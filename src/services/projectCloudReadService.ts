import { collection, doc, getDocFromServer, getDocsFromServer, type Firestore } from 'firebase/firestore';

export const projectCollections = ['persons', 'families', 'events', 'sources', 'places', 'metricRecords',
  'documents', 'tasks', 'findings', 'hypotheses', 'requests', 'matrixEntries'] as const;
type CollectionName = typeof projectCollections[number];
export interface CloudProjectSettings {
  deletedTombstones?: string[];
  ignoredDuplicatePairs?: string[];
  ignoredDuplicateRevision?: number;
  mergedPersons?: Record<string, string>;
  mergedPersonsRevision?: number;
}
export interface CloudProjectSnapshot {
  data: Partial<Record<CollectionName, any[]>>;
  settings: CloudProjectSettings;
}
export interface ProjectReader {
  readCollection: (name: CollectionName) => Promise<any[]>;
  readSetting: (name: string) => Promise<Record<string, any> | undefined>;
  readLegacy: () => Promise<Record<string, any> | undefined>;
}

/** All required reads must succeed. Never disguise an unavailable collection as empty. */
export async function readProjectSnapshot(reader: ProjectReader): Promise<CloudProjectSnapshot> {
  const [entries, tombstones, ignored, merged] = await Promise.all([
    Promise.all(projectCollections.map(async name => {
      const rows = await reader.readCollection(name);
      if (!Array.isArray(rows)) throw new Error(`Invalid cloud collection: ${name}`);
      return [name, rows] as const;
    })),
    reader.readSetting('deletedTombstones'), reader.readSetting('ignoredDuplicates'), reader.readSetting('mergedPersons')
  ]);
  const data = Object.fromEntries(entries) as CloudProjectSnapshot['data'];
  const settings: CloudProjectSettings = {};
  if (tombstones !== undefined) {
    if (!Array.isArray(tombstones.ids) || tombstones.ids.some((id: unknown) => typeof id !== 'string')) throw new Error('Invalid cloud deletion markers');
    settings.deletedTombstones = tombstones.ids;
  }
  if (ignored !== undefined) {
    if (!Array.isArray(ignored.keys) || ignored.keys.some((id: unknown) => typeof id !== 'string')) throw new Error('Invalid cloud duplicate settings');
    settings.ignoredDuplicatePairs = ignored.keys;
    if (ignored.revision !== undefined && (!Number.isSafeInteger(ignored.revision) || ignored.revision < 0)) throw new Error('Invalid cloud duplicate revision');
    settings.ignoredDuplicateRevision = ignored.revision ?? 0;
  }
  if (merged !== undefined) {
    if (!merged.mapping || typeof merged.mapping !== 'object' || Array.isArray(merged.mapping) ||
        Object.values(merged.mapping).some(id => typeof id !== 'string')) throw new Error('Invalid cloud merge settings');
    settings.mergedPersons = merged.mapping;
    if (merged.revision !== undefined && (!Number.isSafeInteger(merged.revision) || merged.revision < 0)) throw new Error('Invalid cloud merge revision');
    settings.mergedPersonsRevision = merged.revision ?? 0;
  }
  // Legacy data may be read locally. Migration requires an explicit later upload.
  if (entries.every(([, rows]) => rows.length === 0) && tombstones === undefined) {
    let legacy: Record<string, any> | undefined;
    try { legacy = await reader.readLegacy(); }
    catch (error: any) { if (error?.code !== 'permission-denied') throw error; }
    if (legacy) for (const name of projectCollections) {
      if (legacy[name] === undefined) continue;
      if (!Array.isArray(legacy[name])) throw new Error(`Invalid legacy collection: ${name}`);
      data[name] = legacy[name];
    }
  }
  return { data, settings };
}

/** SDK adapter deliberately has read capabilities only; it never initializes a production app. */
export async function readProjectFromFirestore(db: Firestore, projectId: string): Promise<CloudProjectSnapshot> {
  return readProjectSnapshot({
    readCollection: async name => (await getDocsFromServer(collection(db, 'projects', projectId, name)))
      .docs.map(snapshot => ({ ...snapshot.data(), id: snapshot.id })),
    readSetting: async name => (await getDocFromServer(doc(db, 'projects', projectId, 'systemSettings', name))).data(),
    readLegacy: async () => (await getDocFromServer(doc(db, 'genealogyProjects', projectId))).data()
  });
}
