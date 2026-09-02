import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
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
  Firestore,
  getDocFromServer
} from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  Auth
} from 'firebase/auth';
import firebaseConfigRaw from '../../firebase-applet-config.json';

export const DEFAULT_PROJECT_ID = 'defaultProject';

let cachedApp: FirebaseApp | null = null;
let cachedDb: Firestore | null = null;
let cachedAuth: Auth | null = null;

export interface FirebaseAppConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  firestoreDatabaseId?: string;
  [key: string]: any;
}

export function getFirebaseConfig(): FirebaseAppConfig {
  return (firebaseConfigRaw as FirebaseAppConfig) || {};
}

export function isFirebaseConfigured(): boolean {
  const cfg = getFirebaseConfig();
  return Boolean(cfg && cfg.apiKey && cfg.projectId);
}

export function getFirebaseApp(): FirebaseApp | null {
  if (cachedApp) return cachedApp;
  try {
    const config = getFirebaseConfig();
    if (!config || !config.apiKey) return null;
    cachedApp = !getApps().length ? initializeApp(config) : getApp();
    return cachedApp;
  } catch (e) {
    console.warn('Firebase app init warning:', e);
    return null;
  }
}

export function getDbInstance(): Firestore | null {
  if (cachedDb) return cachedDb;
  try {
    const app = getFirebaseApp();
    if (!app) return null;
    const config = getFirebaseConfig();
    const dbId = config.firestoreDatabaseId;

    try {
      if (dbId) {
        cachedDb = initializeFirestore(
          app,
          {
            experimentalAutoDetectLongPolling: true
          },
          dbId
        );
      } else {
        cachedDb = initializeFirestore(app, {
          experimentalAutoDetectLongPolling: true
        });
      }
    } catch {
      try {
        cachedDb = dbId ? getFirestore(app, dbId) : getFirestore(app);
      } catch {
        cachedDb = getFirestore(app);
      }
    }
  } catch (e) {
    console.warn('Firebase Firestore initialization warning:', e);
  }
  return cachedDb;
}

export function getFirebaseAuth(): Auth | null {
  if (cachedAuth) return cachedAuth;
  try {
    const app = getFirebaseApp();
    if (!app) return null;
    cachedAuth = getAuth(app);
    return cachedAuth;
  } catch (e) {
    console.warn('Firebase Auth initialization warning:', e);
    return null;
  }
}

// Lazy/safe export for db instance
export const db = getDbInstance();

// Test connection on boot according to skill guidelines
if (typeof window !== 'undefined') {
  setTimeout(() => {
    const firestore = getDbInstance();
    if (firestore) {
      getDocFromServer(doc(firestore, 'projects', 'healthCheck'))
        .catch(() => {
          // Silent offline / cache resilience
        });
    }
  }, 1000);
}

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

// Authentication Helpers
export async function signInWithGoogle(): Promise<{ user: FirebaseUser | null; error: string | null }> {
  try {
    const auth = getFirebaseAuth();
    if (!auth) {
      return { user: null, error: 'Firebase Auth не налаштовано' };
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const res = await signInWithPopup(auth, provider);
    return { user: res.user, error: null };
  } catch (err: any) {
    console.warn('Google sign-in error:', err);
    return { user: null, error: err?.message || 'Помилка авторизації через Google' };
  }
}

export async function signOutFirebase(): Promise<boolean> {
  try {
    const auth = getFirebaseAuth();
    if (auth) {
      await signOut(auth);
    }
    return true;
  } catch {
    return false;
  }
}

export function subscribeToFirebaseAuth(callback: (user: FirebaseUser | null) => void): () => void {
  try {
    const auth = getFirebaseAuth();
    if (!auth) {
      callback(null);
      return () => {};
    }
    return onAuthStateChanged(auth, (user) => {
      callback(user);
    });
  } catch {
    callback(null);
    return () => {};
  }
}

import { trackAtomicSync, useCloudSyncStore } from '../stores/useCloudSyncStore';

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
  return trackAtomicSync(async () => {
    try {
      const db = getDbInstance();
      if (!db || !itemId) return false;
      const cleanData = JSON.parse(JSON.stringify(data));
      cleanData.updatedAt = cleanData.updatedAt || new Date().toISOString();
      const docRef = doc(db, 'projects', projectId, subcollection, String(itemId));
      await setDoc(docRef, cleanData, { merge: true });
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `projects/${projectId}/${subcollection}/${itemId}`);
      throw err;
    }
  }).catch(() => false);
}

/**
 * Delete single entity from its subcollection
 */
export async function deleteEntityDoc(
  subcollection: string,
  itemId: string,
  projectId: string = DEFAULT_PROJECT_ID
): Promise<boolean> {
  return trackAtomicSync(async () => {
    try {
      const db = getDbInstance();
      if (!db || !itemId) return false;
      const docRef = doc(db, 'projects', projectId, subcollection, String(itemId));
      await deleteDoc(docRef);
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `projects/${projectId}/${subcollection}/${itemId}`);
      throw err;
    }
  }).catch(() => false);
}

/**
 * Specific typed helpers for single entity persistence
 */
export const savePersonDoc = (person: any, projectId?: string) =>
  saveEntityDoc('persons', person.id, person, projectId);

export const deletePersonDoc = (personId: string, projectId?: string) =>
  deleteEntityDoc('persons', personId, projectId);

export const saveFamilyDoc = (family: any, projectId?: string) =>
  saveEntityDoc('families', family.id, family, projectId);

export const deleteFamilyDoc = (familyId: string, projectId?: string) =>
  deleteEntityDoc('families', familyId, projectId);

export const saveEventDoc = (event: any, projectId?: string) =>
  saveEntityDoc('events', event.id, event, projectId);

export const deleteEventDoc = (eventId: string, projectId?: string) =>
  deleteEntityDoc('events', eventId, projectId);

export const saveSourceDoc = (source: any, projectId?: string) =>
  saveEntityDoc('sources', source.id, source, projectId);

export const deleteSourceDoc = (sourceId: string, projectId?: string) =>
  deleteEntityDoc('sources', sourceId, projectId);

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

export const saveTaskDoc = (task: any, projectId?: string) =>
  saveEntityDoc('tasks', task.id, task, projectId);

export const deleteTaskDoc = (taskId: string, projectId?: string) =>
  deleteEntityDoc('tasks', taskId, projectId);

export const saveFindingDoc = (finding: any, projectId?: string) =>
  saveEntityDoc('findings', finding.id, finding, projectId);

export const deleteFindingDoc = (findingId: string, projectId?: string) =>
  deleteEntityDoc('findings', findingId, projectId);

export const saveRequestDoc = (request: any, projectId?: string) =>
  saveEntityDoc('requests', request.id, request, projectId);

export const deleteRequestDoc = (requestId: string, projectId?: string) =>
  deleteEntityDoc('requests', requestId, projectId);

export const saveMatrixEntryDoc = (entry: any, projectId?: string) =>
  saveEntityDoc('matrixEntries', entry.id || `${entry.village}_${entry.year}`, entry, projectId);

export const deleteMatrixEntryDoc = (entryId: string, projectId?: string) =>
  deleteEntityDoc('matrixEntries', entryId, projectId);

export const saveNoteDoc = (note: any, projectId?: string) =>
  saveEntityDoc('researchNotes', note.id, note, projectId);

export const deleteNoteDoc = (noteId: string, projectId?: string) =>
  deleteEntityDoc('researchNotes', noteId, projectId);

// Access Requests Helpers (both in project and top-level)
export async function saveAccessRequestToCloud(req: any, projectId: string = DEFAULT_PROJECT_ID): Promise<boolean> {
  try {
    const db = getDbInstance();
    if (!db || !req?.id) return false;
    const cleanData = JSON.parse(JSON.stringify(req));
    cleanData.updatedAt = new Date().toISOString();
    
    // Save in project accessRequests subcollection
    const docRef = doc(db, 'projects', projectId, 'accessRequests', String(req.id));
    await setDoc(docRef, cleanData, { merge: true });
    
    // Also save in top-level for easy global admin lookup
    try {
      const topRef = doc(db, 'accessRequests', String(req.id));
      await setDoc(topRef, cleanData, { merge: true });
    } catch {}
    
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `projects/${projectId}/accessRequests/${req.id}`);
    return false;
  }
}

export function subscribeToAccessRequestsCloud(
  onUpdate: (requests: any[]) => void,
  projectId: string = DEFAULT_PROJECT_ID
): () => void {
  try {
    const db = getDbInstance();
    if (!db) return () => {};
    const colRef = collection(db, 'projects', projectId, 'accessRequests');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
        onUpdate(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `projects/${projectId}/accessRequests`);
      }
    );
  } catch {
    return () => {};
  }
}

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
        if (item && (item.id || item.year)) {
          const id = String(item.id || `${item.village}_${item.year}`);
          const docRef = doc(db, 'projects', projectId, subcollection, id);
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
 * Real-time Subcollection listener with limit guard
 */
export function subscribeToSubcollection<T = any>(
  subcollection: string,
  onUpdate: (items: T[]) => void,
  limitCount: number = 300,
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
    families?: any[];
    events?: any[];
    sources?: any[];
    metricRecords?: any[];
    documents?: any[];
    tasks?: any[];
    findings?: any[];
    hypotheses?: any[];
    requests?: any[];
    matrixEntries?: any[];
    accessRequests?: any[];
  }) => void,
  projectId: string = DEFAULT_PROJECT_ID
) {
  const unsubscribers: (() => void)[] = [];

  const subcollections = [
    'persons',
    'families',
    'events',
    'sources',
    'metricRecords',
    'documents',
    'tasks',
    'findings',
    'hypotheses',
    'requests',
    'matrixEntries',
    'accessRequests'
  ];

  subcollections.forEach((colName) => {
    const unsub = subscribeToSubcollection(
      colName,
      (items) => {
        if (items && items.length > 0) {
          onDataUpdate({ [colName]: items });
        }
      },
      400,
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
 * bypassing monolithic document limit completely.
 */
export async function saveProjectDataToCloud(
  data: {
    persons?: any[];
    families?: any[];
    events?: any[];
    sources?: any[];
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

    const promises: Promise<boolean>[] = [];

    if (Array.isArray(data.persons) && data.persons.length > 0) {
      promises.push(batchSaveEntities('persons', data.persons, projectId));
    }
    if (Array.isArray(data.families) && data.families.length > 0) {
      promises.push(batchSaveEntities('families', data.families, projectId));
    }
    if (Array.isArray(data.events) && data.events.length > 0) {
      promises.push(batchSaveEntities('events', data.events, projectId));
    }
    if (Array.isArray(data.sources) && data.sources.length > 0) {
      promises.push(batchSaveEntities('sources', data.sources, projectId));
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
        sanitizeForFirestore({
          lastUpdated: data.lastUpdated || new Date().toISOString(),
          personsCount: data.persons?.length || 0,
          familiesCount: data.families?.length || 0,
          metricRecordsCount: data.metricRecords?.length || 0,
          documentsCount: data.documents?.length || 0,
          hypothesesCount: data.hypotheses?.length || 0
        }),
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

/**
 * Manually fetches all entities from all Firestore subcollections in one batch
 */
export async function fetchAllProjectDataFromCloud(projectId: string = DEFAULT_PROJECT_ID): Promise<{
  success: boolean;
  data: {
    persons?: any[];
    families?: any[];
    events?: any[];
    sources?: any[];
    metricRecords?: any[];
    documents?: any[];
    tasks?: any[];
    findings?: any[];
    hypotheses?: any[];
    requests?: any[];
    matrixEntries?: any[];
    accessRequests?: any[];
    lastUpdated?: string;
  };
  error?: string;
}> {
  try {
    const db = getDbInstance();
    if (!db) return { success: false, data: {}, error: 'База Firestore не ініціалізована' };

    const subcollections = [
      'persons',
      'families',
      'events',
      'sources',
      'metricRecords',
      'documents',
      'tasks',
      'findings',
      'hypotheses',
      'requests',
      'matrixEntries',
      'accessRequests'
    ];

    const resultData: Record<string, any[]> = {};

    await Promise.all(
      subcollections.map(async (colName) => {
        try {
          const colRef = collection(db, 'projects', projectId, colName);
          const snap = await getDocs(colRef);
          resultData[colName] = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        } catch (e) {
          console.warn(`Failed to fetch subcollection ${colName}:`, e);
          resultData[colName] = [];
        }
      })
    );

    return {
      success: true,
      data: resultData
    };
  } catch (err: any) {
    handleFirestoreError(err, OperationType.LIST, `projects/${projectId}`);
    return {
      success: false,
      data: {},
      error: err?.message || 'Помилка отримання даних з Firestore'
    };
  }
}

/**
 * Shared Family Tree Cloud Data Structure
 */
export interface SharedTreeData {
  id: string;
  title: string;
  authorName: string;
  authorEmail?: string;
  createdAt: string;
  updatedAt: string;
  rootPersonId: string;
  mode: 'readonly' | 'editable';
  isPinProtected: boolean;
  pinHash?: string;
  hideLivingDates?: boolean;
  personsCount: number;
  database: {
    persons: Record<string, any>;
    families: Record<string, any>;
    sources?: Record<string, any>;
    events?: Record<string, any>;
    metricRecords?: any[];
  };
}

/**
 * Universal deep sanitizer for Firestore to remove all `undefined` fields
 * which are strictly forbidden by Firestore SDK.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) return null as unknown as T;
  try {
    return JSON.parse(JSON.stringify(data));
  } catch (e) {
    return data;
  }
}

/**
 * Publishes or updates a shared tree snapshot in Firestore
 */
export async function publishSharedTreeToCloud(treeData: SharedTreeData): Promise<{
  success: boolean;
  shareId: string;
  shareUrl: string;
  error?: string;
}> {
  try {
    const db = getDbInstance();
    if (!db) return { success: false, shareId: treeData.id, shareUrl: '', error: 'База Firestore недоступна' };

    const rawData: Record<string, any> = {
      id: treeData.id,
      title: treeData.title || 'Родинне дерево',
      authorName: treeData.authorName || 'Дослідник родоводу',
      authorEmail: treeData.authorEmail || '',
      createdAt: treeData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rootPersonId: treeData.rootPersonId || '',
      mode: treeData.mode || 'readonly',
      isPinProtected: Boolean(treeData.isPinProtected),
      pinHash: treeData.pinHash || '',
      hideLivingDates: Boolean(treeData.hideLivingDates),
      personsCount: Object.keys(treeData.database?.persons || {}).length,
      database: {
        persons: treeData.database?.persons || {},
        families: treeData.database?.families || {},
        sources: treeData.database?.sources || {},
        events: treeData.database?.events || {},
        metricRecords: treeData.database?.metricRecords || []
      }
    };

    // Deep sanitize to eliminate any nested `undefined` properties
    const cleanData = sanitizeForFirestore(rawData);

    const docRef = doc(db, 'sharedTrees', treeData.id);
    await setDoc(docRef, cleanData, { merge: true });

    // Generate full URL
    let baseUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
    if (baseUrl.includes('ais-dev-')) {
      baseUrl = baseUrl.replace('ais-dev-', 'ais-pre-');
    }
    const shareUrl = `${baseUrl}?share=${treeData.id}`;

    return {
      success: true,
      shareId: treeData.id,
      shareUrl
    };
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, `sharedTrees/${treeData.id}`);
    return {
      success: false,
      shareId: treeData.id,
      shareUrl: '',
      error: err?.message || 'Помилка публікації дерева в хмару'
    };
  }
}

/**
 * Fetches a shared tree from Firestore by its shareId
 */
export async function getSharedTreeFromCloud(shareId: string): Promise<{
  success: boolean;
  data?: SharedTreeData;
  error?: string;
}> {
  try {
    const db = getDbInstance();
    if (!db) return { success: false, error: 'База Firestore недоступна' };

    const docRef = doc(db, 'sharedTrees', shareId);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return { success: false, error: 'Спільне дерево не знайдено за цим посиланням або термін дії вичерпано.' };
    }

    const data = snap.data() as SharedTreeData;
    return {
      success: true,
      data
    };
  } catch (err: any) {
    handleFirestoreError(err, OperationType.GET, `sharedTrees/${shareId}`);
    return {
      success: false,
      error: err?.message || 'Не вдалося завантажити родинне дерево'
    };
  }
}

/**
 * Subscribes to real-time updates for a shared tree
 */
export function subscribeToSharedTreeCloud(
  shareId: string,
  callback: (tree: SharedTreeData | null) => void
): () => void {
  const db = getDbInstance();
  if (!db) {
    callback(null);
    return () => {};
  }

  const docRef = doc(db, 'sharedTrees', shareId);
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        callback(snap.data() as SharedTreeData);
      } else {
        callback(null);
      }
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, `sharedTrees/${shareId}`);
      callback(null);
    }
  );
}



