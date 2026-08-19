import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  limit,
  startAfter,
  orderBy,
  writeBatch,
  DocumentSnapshot,
  QueryDocumentSnapshot,
  Firestore
} from 'firebase/firestore';

export const DEFAULT_PROJECT_ID = 'defaultProject';

let cachedDb: Firestore | null = null;

export function getDbInstance(): Firestore | null {
  if (cachedDb) return cachedDb;
  try {
    const config: any = {};
    if (!config || !config.apiKey) return null;
    const app = !getApps().length ? initializeApp(config) : getApp();
    if (config.firestoreDatabaseId) {
      try {
        cachedDb = getFirestore(app, config.firestoreDatabaseId);
      } catch {
        cachedDb = getFirestore(app);
      }
    } else {
      cachedDb = getFirestore(app);
    }
  } catch (e) {
    console.warn('Firebase initialization warning:', e);
  }
  return cachedDb;
}

export { cachedDb as db };

// Error handling helper conforming to Firestore guidelines
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  };
  console.warn('Firestore Error Notice: ', JSON.stringify(errInfo));
  return errInfo;
}

// Subcollection path helpers
export const getProjectPath = (projectId: string = DEFAULT_PROJECT_ID) => `projects/${projectId}`;
export const getSubcollectionPath = (subcollection: string, projectId: string = DEFAULT_PROJECT_ID) => 
  `projects/${projectId}/${subcollection}`;

/**
 * Save single entity to its respective subcollection document
 * Path: projects/{projectId}/{subcollection}/{itemId}
 */
export async function saveEntityDoc(
  subcollection: string,
  itemId: string,
  data: any,
  projectId: string = DEFAULT_PROJECT_ID
): Promise<boolean> {
  try {
    const db = getDbInstance();
    if (!db) return false;
    const cleanData = JSON.parse(JSON.stringify(data));
    cleanData.updatedAt = cleanData.updatedAt || new Date().toISOString();
    const docRef = doc(db, 'projects', projectId, subcollection, itemId);
    await setDoc(docRef, cleanData, { merge: true });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `projects/${projectId}/${subcollection}/${itemId}`);
    return false;
  }
}

/**
 * Delete single entity from its subcollection
 */
export async function deleteEntityDoc(
  subcollection: string,
  itemId: string,
  projectId: string = DEFAULT_PROJECT_ID
): Promise<boolean> {
  try {
    const db = getDbInstance();
    if (!db) return false;
    const docRef = doc(db, 'projects', projectId, subcollection, itemId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `projects/${projectId}/${subcollection}/${itemId}`);
    return false;
  }
}

/**
 * Specific typed helpers for single entity persistence
 */
export const savePersonDoc = (person: any, projectId?: string) =>
  saveEntityDoc('persons', person.id, person, projectId);

export const deletePersonDoc = (personId: string, projectId?: string) =>
  deleteEntityDoc('persons', personId, projectId);

export const saveMetricRecordDoc = (record: any, projectId?: string) =>
  saveEntityDoc('metricRecords', record.id, record, projectId);

export const deleteMetricRecordDoc = (recordId: string, projectId?: string) =>
  deleteEntityDoc('metricRecords', recordId, projectId);

export const saveDocumentDoc = (document: any, projectId?: string) =>
  saveEntityDoc('documents', document.id, document, projectId);

export const deleteDocumentDoc = (docId: string, projectId?: string) =>
  deleteEntityDoc('documents', docId, projectId);

export const saveHypothesisDoc = (hypothesis: any, projectId?: string) =>
  saveEntityDoc('hypotheses', hypothesis.id, hypothesis, projectId);

export const deleteHypothesisDoc = (hypothesisId: string, projectId?: string) =>
  deleteEntityDoc('hypotheses', hypothesisId, projectId);

/**
 * Batch write items into a subcollection in chunks of 450 items
 * (Firestore limits batch writes to max 500 ops per batch)
 */
export async function batchSaveEntities(
  subcollection: string,
  items: any[],
  projectId: string = DEFAULT_PROJECT_ID
): Promise<boolean> {
  try {
    const db = getDbInstance();
    if (!db || !items || items.length === 0) return false;

    const CHUNK_SIZE = 450;
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      chunk.forEach((item) => {
        if (item && item.id) {
          const docRef = doc(db, 'projects', projectId, subcollection, String(item.id));
          const cleanItem = JSON.parse(JSON.stringify(item));
          cleanItem.updatedAt = cleanItem.updatedAt || new Date().toISOString();
          batch.set(docRef, cleanItem, { merge: true });
        }
      });

      await batch.commit();
    }
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `projects/${projectId}/${subcollection}`);
    return false;
  }
}

/**
 * Paginated Firestore Fetcher with limit() and startAfter()
 * Prevents memory exhaustion and enables progressive UI loading.
 */
export interface PaginatedResult<T> {
  items: T[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
  totalFetched: number;
}

export async function fetchSubcollectionPaginated<T = any>(
  subcollection: string,
  pageSize: number = 50,
  lastDocSnapshot: QueryDocumentSnapshot | null = null,
  projectId: string = DEFAULT_PROJECT_ID
): Promise<PaginatedResult<T>> {
  const result: PaginatedResult<T> = {
    items: [],
    lastDoc: null,
    hasMore: false,
    totalFetched: 0
  };

  try {
    const db = getDbInstance();
    if (!db) return result;

    const colRef = collection(db, 'projects', projectId, subcollection);
    let q = query(colRef, limit(pageSize));

    if (lastDocSnapshot) {
      q = query(colRef, startAfter(lastDocSnapshot), limit(pageSize));
    }

    const querySnapshot = await getDocs(q);
    const docs = querySnapshot.docs;

    result.items = docs.map((d) => ({ ...d.data(), id: d.id } as T));
    result.lastDoc = docs.length > 0 ? docs[docs.length - 1] : null;
    result.hasMore = docs.length === pageSize;
    result.totalFetched = docs.length;

    return result;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `projects/${projectId}/${subcollection}`);
    return result;
  }
}

export const fetchPersonsPaginated = (pageSize = 50, lastDoc = null, projectId?: string) =>
  fetchSubcollectionPaginated('persons', pageSize, lastDoc, projectId);

export const fetchMetricRecordsPaginated = (pageSize = 50, lastDoc = null, projectId?: string) =>
  fetchSubcollectionPaginated('metricRecords', pageSize, lastDoc, projectId);

export const fetchDocumentsPaginated = (pageSize = 50, lastDoc = null, projectId?: string) =>
  fetchSubcollectionPaginated('documents', pageSize, lastDoc, projectId);

export const fetchHypothesesPaginated = (pageSize = 50, lastDoc = null, projectId?: string) =>
  fetchSubcollectionPaginated('hypotheses', pageSize, lastDoc, projectId);

/**
 * Real-time Subcollection listener with limit guard
 */
export function subscribeToSubcollection<T = any>(
  subcollection: string,
  onUpdate: (items: T[]) => void,
  limitCount: number = 200,
  projectId: string = DEFAULT_PROJECT_ID
): () => void {
  try {
    const db = getDbInstance();
    if (!db) return () => {};

    const colRef = collection(db, 'projects', projectId, subcollection);
    const q = query(colRef, limit(limitCount));

    return onSnapshot(
      q,
      (snapshot) => {
        try {
          const list = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as T));
          onUpdate(list);
        } catch (e) {
          console.warn(`Error handling snapshot for ${subcollection}:`, e);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `projects/${projectId}/${subcollection}`);
      }
    );
  } catch (err) {
    console.warn(`Failed to subscribe to ${subcollection}:`, err);
    return () => {};
  }
}

/**
 * Unified project data subscriber for all subcollections
 */
export function subscribeToProjectData(
  onDataUpdate: (data: {
    persons?: any[];
    metricRecords?: any[];
    documents?: any[];
    tasks?: any[];
    findings?: any[];
    hypotheses?: any[];
    requests?: any[];
    matrixEntries?: any[];
  }) => void,
  projectId: string = DEFAULT_PROJECT_ID
) {
  const unsubscribers: (() => void)[] = [];

  const subcollections = [
    'persons',
    'metricRecords',
    'documents',
    'tasks',
    'findings',
    'hypotheses',
    'requests',
    'matrixEntries'
  ];

  subcollections.forEach((colName) => {
    const unsub = subscribeToSubcollection(
      colName,
      (items) => {
        if (items && items.length > 0) {
          onDataUpdate({ [colName]: items });
        }
      },
      300,
      projectId
    );
    unsubscribers.push(unsub);
  });

  return () => {
    unsubscribers.forEach((unsub) => {
      try {
        unsub();
      } catch {}
    });
  };
}

/**
 * Saves all project data cleanly into individual subcollection documents
 * bypassing the 1MB monolithic document limit completely.
 */
export async function saveProjectDataToCloud(
  data: {
    persons?: any[];
    metricRecords?: any[];
    documents?: any[];
    tasks?: any[];
    findings?: any[];
    hypotheses?: any[];
    requests?: any[];
    matrixEntries?: any[];
    lastUpdated?: string;
  },
  projectId: string = DEFAULT_PROJECT_ID
): Promise<boolean> {
  try {
    const db = getDbInstance();
    if (!db) return false;

    // Save subcollections individually
    const promises: Promise<boolean>[] = [];

    if (Array.isArray(data.persons) && data.persons.length > 0) {
      promises.push(batchSaveEntities('persons', data.persons, projectId));
    }
    if (Array.isArray(data.metricRecords) && data.metricRecords.length > 0) {
      promises.push(batchSaveEntities('metricRecords', data.metricRecords, projectId));
    }
    if (Array.isArray(data.documents) && data.documents.length > 0) {
      promises.push(batchSaveEntities('documents', data.documents, projectId));
    }
    if (Array.isArray(data.tasks) && data.tasks.length > 0) {
      promises.push(batchSaveEntities('tasks', data.tasks, projectId));
    }
    if (Array.isArray(data.findings) && data.findings.length > 0) {
      promises.push(batchSaveEntities('findings', data.findings, projectId));
    }
    if (Array.isArray(data.hypotheses) && data.hypotheses.length > 0) {
      promises.push(batchSaveEntities('hypotheses', data.hypotheses, projectId));
    }
    if (Array.isArray(data.requests) && data.requests.length > 0) {
      promises.push(batchSaveEntities('requests', data.requests, projectId));
    }
    if (Array.isArray(data.matrixEntries) && data.matrixEntries.length > 0) {
      promises.push(batchSaveEntities('matrixEntries', data.matrixEntries, projectId));
    }

    // Save metadata document
    const metaDocRef = doc(db, 'projects', projectId);
    promises.push(
      setDoc(
        metaDocRef,
        {
          lastUpdated: data.lastUpdated || new Date().toISOString(),
          personsCount: data.persons?.length || 0,
          metricRecordsCount: data.metricRecords?.length || 0,
          documentsCount: data.documents?.length || 0,
          hypothesesCount: data.hypotheses?.length || 0
        },
        { merge: true }
      ).then(() => true).catch(() => false)
    );

    const results = await Promise.all(promises);
    return results.every(Boolean);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `projects/${projectId}`);
    return false;
  }
}
