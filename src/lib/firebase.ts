import { writeMergedPersonChanges } from '../services/mergedPersonCloudService';
import type { MergedPersonSnapshot } from '../utils/mergedPersonState';
import { serializeFamilyForCloud } from '../utils/familyCloudData';
import { writePersonDeletionMarkers } from '../services/personDeletionCloudService';
import { writeIgnoredDuplicateChanges } from '../services/ignoredDuplicateCloudService';
import type { IgnoredDuplicateChange, IgnoredDuplicateSnapshot } from '../utils/ignoredDuplicateKeys';
import { readProjectFromFirestore, type CloudProjectSnapshot } from '../services/projectCloudReadService';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
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
  getDocFromServer,
  disableNetwork,
  enableNetwork,
  setLogLevel
} from 'firebase/firestore';
import { useCloudSyncStore, isQuotaExceededToday, trackAtomicSync, markQuotaExceededToday } from '../stores/useCloudSyncStore';
import {
  getAuth,
  initializeAuth,
  browserLocalPersistence,
  browserSessionPersistence,
  indexedDBLocalPersistence,
  inMemoryPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  Auth
} from 'firebase/auth';
import firebaseConfigRaw from '../../firebase-applet-config.json';
import { getPublicTree, publishPublicTree } from '../services/publicTreeService';

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
      cachedDb = initializeFirestore(
        app,
        {
          experimentalAutoDetectLongPolling: true,
          ignoreUndefinedProperties: true
        },
        dbId || undefined
      );
    } catch {
      cachedDb = dbId ? getFirestore(app, dbId) : getFirestore(app);
    }

    try {
      setLogLevel('silent');
    } catch {}

    // If quota was already marked as exceeded today, disable network immediately
    // so Firestore SDK does not attempt background WebSocket connections that fail with resource-exhausted
    if (cachedDb && typeof window !== 'undefined' && isQuotaExceededToday()) {
      disableNetwork(cachedDb).catch(() => {});
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
    try {
      // In embedded iframe or environments where IndexedDB is closing or restricted,
      // providing browserLocalPersistence first prevents fatal "Database is closing/hidden" crashes
      cachedAuth = initializeAuth(app, {
        persistence: [
          browserLocalPersistence,
          indexedDBLocalPersistence,
          browserSessionPersistence,
          inMemoryPersistence
        ],
        popupRedirectResolver: browserPopupRedirectResolver
      });
    } catch {
      cachedAuth = getAuth(app);
    }
    return cachedAuth;
  } catch (e) {
    console.warn('Firebase Auth initialization warning:', e);
    return null;
  }
}

// Lazy/safe export for db instance
export const db = getDbInstance();

// Robust detection for any Firestore quota metric or resource-exhausted error
export function isFirestoreQuotaError(error: unknown): boolean {
  if (!error) return false;
  const errMsg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  const errCode = String((error as any)?.code || '').toLowerCase();

  return (
    errCode.includes('resource-exhausted') ||
    errCode.includes('resource_exhausted') ||
    errMsg.includes('resource-exhausted') ||
    errMsg.includes('resource_exhausted') ||
    errMsg.includes('quota limit exceeded') ||
    errMsg.includes('quota exceeded') ||
    (errMsg.includes('quota') && (errMsg.includes('exceeded') || errMsg.includes('limit') || errMsg.includes('units per project')))
  );
}

export function isCloudWriteBlocked(allowManualDirectWrite: boolean = false): boolean {
  if (typeof window === 'undefined') return false;
  const store = useCloudSyncStore.getState();
  if (isQuotaExceededToday() || store.isQuotaExceeded) {
    return true;
  }
  // In manual sync mode, NEVER perform individual automatic/background cloud writes!
  // Cloud writes must ONLY happen when the user explicitly triggers a manual sync batch.
  if (!allowManualDirectWrite && !store.isManualPushing && store.syncMode === 'manual') {
    return true;
  }
  return false;
}

export async function testConnection(force: boolean = false): Promise<boolean> {
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }
  // In manual mode, do not perform automatic background server pings unless explicitly requested
  if (!force && useCloudSyncStore.getState().syncMode === 'manual') {
    return false;
  }
  if (!force && isCloudWriteBlocked()) {
    return false;
  }
  try {
    const firestore = getDbInstance();
    if (firestore) {
      if (force) {
        await enableNetwork(firestore).catch(() => {});
      }
      await getDocFromServer(doc(firestore, 'test', 'connection'));
      useCloudSyncStore.getState().setQuotaExceeded(false);
      markQuotaExceededToday(false);
      return true;
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    if (
      errMsg.includes('the client is offline') || 
      (error as any)?.code === 'unavailable' || 
      errMsg.includes('unavailable')
    ) {
      // Gracefully silent: Firestore operates in local/offline cache mode
    } else if (isFirestoreQuotaError(error)) {
      useCloudSyncStore.getState().setQuotaExceeded(true);
      markQuotaExceededToday(true);
      const firestore = getDbInstance();
      if (firestore) {
        disableNetwork(firestore).catch(() => {});
      }
    } else {
      console.warn('Firestore connection check notice:', errMsg);
    }
    return false;
  }
  return false;
}

if (typeof window !== 'undefined') {
  window.addEventListener('rodovid_quota_exceeded_changed', (e: any) => {
    const isExceeded = e?.detail?.isQuotaExceeded;
    const firestore = getDbInstance();
    if (firestore) {
      if (isExceeded) {
        disableNetwork(firestore).catch(() => {});
      } else {
        enableNetwork(firestore).catch(() => {});
      }
    }
  });
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
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const currentAuth = getFirebaseAuth();
  const currentUser = currentAuth?.currentUser;
  const errMsg = error instanceof Error ? error.message : String(error);

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    operationType,
    path,
    authInfo: {
      userId: currentUser?.uid || null,
      email: currentUser?.email || null,
      emailVerified: currentUser?.emailVerified || null,
      isAnonymous: currentUser?.isAnonymous || null,
      tenantId: currentUser?.tenantId || null,
      providerInfo:
        currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email
        })) || []
    }
  };

  const isQuotaExceeded = isFirestoreQuotaError(error);

  if (isQuotaExceeded) {
    useCloudSyncStore.getState().setQuotaExceeded(true);
    markQuotaExceededToday(true);
    const firestore = getDbInstance();
    if (firestore) {
      disableNetwork(firestore).catch(() => {});
    }
    console.warn('Firestore Quota Notice: Daily write quota reached. Switched to offline/local storage mode.');
    return errInfo;
  }

  const isPermissionDenied =
    errMsg.toLowerCase().includes('missing or insufficient permissions') ||
    errMsg.toLowerCase().includes('permission-denied');

  if (isPermissionDenied) {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  } else {
    console.warn('Firestore Notice: ', JSON.stringify(errInfo));
    return errInfo;
  }
}

/**
 * Safe snapshot listener wrapper to:
 * 1. Abort if quota exceeded today or store marked as quota exceeded
 * 2. Immediately unsubscribe on quota / resource-exhausted error
 * 3. Cut off Firebase SDK internal backoff retry loop
 * 4. Put Firestore into offline mode
 */
export function safeSnapshotListener(
  queryOrDocRef: any,
  onNext: (snapshot: any) => void,
  path: string,
  operationType: OperationType = OperationType.LIST,
  includeMetadataChanges: boolean = false
): () => void {
  if (isCloudWriteBlocked()) {
    return () => {};
  }

  let unsub: (() => void) | null = null;
  let isCancelled = false;

  try {
    unsub = onSnapshot(
      queryOrDocRef,
      { includeMetadataChanges },
      (snapshot) => {
        if (!isCancelled) {
          onNext(snapshot);
        }
      },
      (error: any) => {
        if (isFirestoreQuotaError(error)) {
          isCancelled = true;
          try {
            if (unsub) unsub();
          } catch {}
          useCloudSyncStore.getState().setQuotaExceeded(true);
          markQuotaExceededToday(true);
          const firestore = getDbInstance();
          if (firestore) {
            disableNetwork(firestore).catch(() => {});
          }
        }
        handleFirestoreError(error, operationType, path);
      }
    );

    return () => {
      isCancelled = true;
      if (unsub) {
        try {
          unsub();
        } catch {}
      }
    };
  } catch (err) {
    console.warn(`Could not setup snapshot listener for ${path}:`, err);
    return () => {};
  }
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
    const res = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
    return { user: res.user, error: null };
  } catch (err: any) {
    console.warn('Google sign-in error:', err);
    let msg = err?.message || 'Помилка авторизації через Google';
    if (err?.code === 'auth/popup-blocked') {
      msg = 'Спливаюче вікно входу Google було заблоковано браузером. Будь ласка, дозвольте спливаючі вікна для цієї вкладки.';
    } else if (err?.code === 'auth/popup-closed-by-user') {
      msg = 'Вікно авторизації було закрито до завершення входу.';
    } else if (err?.code === 'auth/cancelled-popup-request') {
      msg = 'Попередній запит авторизації скасовано.';
    } else if (err?.code === 'auth/unauthorized-domain') {
      msg = 'Цей домен ще не додано до списку дозволених у Firebase Console (Authentication -> Settings -> Authorized domains).';
    }
    return { user: null, error: msg };
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
    return onAuthStateChanged(
      auth,
      (user) => {
        callback(user);
      },
      (error) => {
        console.warn('Firebase Auth state change error (handled gracefully):', error);
        callback(null);
      }
    );
  } catch (err) {
    console.warn('Firebase Auth subscribe error:', err);
    callback(null);
    return () => {};
  }
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
  if (isCloudWriteBlocked()) {
    return false;
  }
  return trackAtomicSync(async () => {
    try {
      const db = getDbInstance();
      if (!db || !itemId) return false;
      const cleanData = subcollection === 'families' ? serializeFamilyForCloud(data) : JSON.parse(JSON.stringify(data));
      // In Firestore setDoc with { merge: true }, undefined fields are omitted by JSON.stringify.
      // Therefore, if the user explicitly clears deathDate or deathYear (or if they are absent),
      // we must explicitly write null so Firestore overwrites and wipes any old/phantom values:
      if (subcollection === 'persons') {
        if (data.deathYear === undefined || data.deathYear === null) cleanData.deathYear = null;
        if (data.deathDate === undefined || data.deathDate === null) cleanData.deathDate = null;
        if (data.deathPlace === undefined || data.deathPlace === null) cleanData.deathPlace = null;
        if (data.deathReason === undefined || data.deathReason === null) cleanData.deathReason = null;
        if (data.birthYear === undefined || data.birthYear === null) cleanData.birthYear = null;
        if (data.birthDate === undefined || data.birthDate === null) cleanData.birthDate = null;
        if (data.birthPlace === undefined || data.birthPlace === null) cleanData.birthPlace = null;
      }
      cleanData.updatedAt = cleanData.updatedAt || new Date().toISOString();
      const docRef = doc(db, 'projects', projectId, subcollection, String(itemId));
      await setDoc(docRef, cleanData, { merge: true });
      return true;
    } catch (err) {
      if (isFirestoreQuotaError(err)) {
        useCloudSyncStore.getState().setQuotaExceeded(true);
        markQuotaExceededToday(true);
        const firestore = getDbInstance();
        if (firestore) {
          disableNetwork(firestore).catch(() => {});
        }
      }
      handleFirestoreError(err, OperationType.WRITE, `projects/${projectId}/${subcollection}/${itemId}`);
      return false;
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
  if (isCloudWriteBlocked()) {
    return false;
  }
  return trackAtomicSync(async () => {
    try {
      const db = getDbInstance();
      if (!db || !itemId) return false;
      const docRef = doc(db, 'projects', projectId, subcollection, String(itemId));
      await deleteDoc(docRef);
      return true;
    } catch (err) {
      if (isFirestoreQuotaError(err)) {
        useCloudSyncStore.getState().setQuotaExceeded(true);
        markQuotaExceededToday(true);
        const firestore = getDbInstance();
        if (firestore) {
          disableNetwork(firestore).catch(() => {});
        }
      }
      handleFirestoreError(err, OperationType.DELETE, `projects/${projectId}/${subcollection}/${itemId}`);
      return false;
    }
  }).catch(() => false);
}

/**
 * Specific typed helpers for single entity persistence
 */
export const savePersonDoc = (person: any, projectId?: string) =>
  saveEntityDoc('persons', person.id, person, projectId);

/**
 * Fetch a single person document by ID from Firestore on demand
 */
export async function fetchPersonDoc(personId: string, projectId: string = DEFAULT_PROJECT_ID): Promise<any | null> {
  try {
    const db = getDbInstance();
    if (!db || !personId) return null;
    const docRef = doc(db, 'projects', projectId, 'persons', String(personId));
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() };
    }
  } catch (err) {
    console.warn('Error fetching person doc:', err);
  }
  return null;
}


/**
 * Saves ONLY the changed fields (delta) for a single person document using merge: true
 * Path: projects/{projectId}/persons/{personId}
 */
export async function savePersonDeltaDoc(
  personId: string,
  delta: any,
  projectId: string = DEFAULT_PROJECT_ID
): Promise<boolean> {
  if (isCloudWriteBlocked()) {
    return false;
  }
  return trackAtomicSync(async () => {
    try {
      const db = getDbInstance();
      if (!db || !personId || !delta) return false;
      const cleanDelta = JSON.parse(JSON.stringify(delta));
      delete cleanDelta.id;

      if ('deathYear' in delta && (delta.deathYear === undefined || delta.deathYear === null)) cleanDelta.deathYear = null;
      if ('deathDate' in delta && (delta.deathDate === undefined || delta.deathDate === null)) cleanDelta.deathDate = null;
      if ('deathPlace' in delta && (delta.deathPlace === undefined || delta.deathPlace === null)) cleanDelta.deathPlace = null;
      if ('deathReason' in delta && (delta.deathReason === undefined || delta.deathReason === null)) cleanDelta.deathReason = null;
      if ('birthYear' in delta && (delta.birthYear === undefined || delta.birthYear === null)) cleanDelta.birthYear = null;
      if ('birthDate' in delta && (delta.birthDate === undefined || delta.birthDate === null)) cleanDelta.birthDate = null;
      if ('birthPlace' in delta && (delta.birthPlace === undefined || delta.birthPlace === null)) cleanDelta.birthPlace = null;

      cleanDelta.updatedAt = cleanDelta.updatedAt || new Date().toISOString();
      const docRef = doc(db, 'projects', projectId, 'persons', String(personId));
      await setDoc(docRef, cleanDelta, { merge: true });
      return true;
    } catch (err) {
      if (isFirestoreQuotaError(err)) {
        useCloudSyncStore.getState().setQuotaExceeded(true);
        markQuotaExceededToday(true);
        const firestore = getDbInstance();
        if (firestore) {
          disableNetwork(firestore).catch(() => {});
        }
      }
      handleFirestoreError(err, OperationType.WRITE, `projects/${projectId}/persons/${personId}`);
      return false;
    }
  }).catch(() => false);
}

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

export const getPlaceDocId = (placeNameOrId: string) => {
  return String(placeNameOrId).trim().toLowerCase().replace(/[^a-z0-9а-яіїєґ_]/gi, '_');
};

export const savePlaceDoc = (place: any, projectId?: string) =>
  saveEntityDoc('places', place.id || getPlaceDocId(place.placeName), place, projectId);

export const deletePlaceDoc = (placeId: string, projectId?: string) =>
  deleteEntityDoc('places', placeId, projectId);

// Whitelist and Admin Cloud Persistence Helpers
export const getWhitelistDocId = (emailOrId: string) => {
  return String(emailOrId).trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
};

export const saveWhitelistDoc = async (entry: any, projectId: string = DEFAULT_PROJECT_ID): Promise<boolean> => {
  if (useCloudSyncStore.getState().isQuotaExceeded) {
    return false;
  }
  try {
    const db = getDbInstance();
    if (!db || !entry?.email) return false;
    const cleanData = JSON.parse(JSON.stringify(entry));
    cleanData.updatedAt = new Date().toISOString();
    const docId = getWhitelistDocId(entry.email);

    // 1. Save in project subcollection
    const docRef = doc(db, 'projects', projectId, 'whitelist', docId);
    await setDoc(docRef, cleanData, { merge: true });

    // 2. Also save to top-level collection for cross-project admin lookups
    try {
      const topRef = doc(db, 'whitelist', docId);
      await setDoc(topRef, cleanData, { merge: true });
    } catch {}

    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `projects/${projectId}/whitelist/${entry?.email}`);
    return false;
  }
};

export const deleteWhitelistDoc = async (entryIdOrEmail: string, projectId: string = DEFAULT_PROJECT_ID): Promise<boolean> => {
  if (useCloudSyncStore.getState().isQuotaExceeded) {
    return false;
  }
  try {
    const db = getDbInstance();
    if (!db || !entryIdOrEmail) return false;
    const docId = getWhitelistDocId(entryIdOrEmail);

    // Delete from project subcollection
    const docRef = doc(db, 'projects', projectId, 'whitelist', docId);
    await deleteDoc(docRef).catch(() => {});

    // Also delete by original raw id if different
    if (entryIdOrEmail !== docId) {
      const rawRef = doc(db, 'projects', projectId, 'whitelist', String(entryIdOrEmail));
      await deleteDoc(rawRef).catch(() => {});
    }

    // Delete from top-level
    try {
      const topRef = doc(db, 'whitelist', docId);
      await deleteDoc(topRef).catch(() => {});
    } catch {}

    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `projects/${projectId}/whitelist/${entryIdOrEmail}`);
    return false;
  }
};

export async function fetchAllWhitelistFromCloud(projectId: string = DEFAULT_PROJECT_ID): Promise<any[]> {
  try {
    const db = getDbInstance();
    if (!db) return [];
    const map = new Map<string, any>();

    // 1. Fetch from project subcollection
    try {
      const colRef = collection(db, 'projects', projectId, 'whitelist');
      const snap = await getDocs(colRef);
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data?.email) map.set(data.email.toLowerCase(), { ...data, id: d.id });
      });
    } catch {}

    // 2. Fetch from top-level whitelist as backup
    try {
      const topRef = collection(db, 'whitelist');
      const topSnap = await getDocs(topRef);
      topSnap.docs.forEach((d) => {
        const data = d.data();
        if (data?.email && !map.has(data.email.toLowerCase())) {
          map.set(data.email.toLowerCase(), { ...data, id: d.id });
        }
      });
    } catch {}

    return Array.from(map.values());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `projects/${projectId}/whitelist`);
    return [];
  }
}

export function subscribeToWhitelistCloud(
  onUpdate: (entries: any[]) => void,
  projectId: string = DEFAULT_PROJECT_ID
): () => void {
  try {
    const db = getDbInstance();
    if (!db) return () => {};
    const colRef = collection(db, 'projects', projectId, 'whitelist');
    return safeSnapshotListener(
      colRef,
      (snapshot) => {
        const list = snapshot.docs.map((d: any) => ({ ...d.data(), id: d.id }));
        onUpdate(list);
      },
      `projects/${projectId}/whitelist`,
      OperationType.LIST
    );
  } catch {
    return () => {};
  }
}

// Access Requests Helpers (both in project and top-level)
export async function saveAccessRequestToCloud(req: any, projectId: string = DEFAULT_PROJECT_ID): Promise<boolean> {
  if (isCloudWriteBlocked()) {
    return false;
  }
  try {
    const db = getDbInstance();
    if (!db || !req?.id) return false;
    const cleanData = JSON.parse(JSON.stringify(req));
    cleanData.updatedAt = new Date().toISOString();
    const docId = String(req.id);
    
    // Save in project accessRequests subcollection
    const docRef = doc(db, 'projects', projectId, 'accessRequests', docId);
    await setDoc(docRef, cleanData, { merge: true });
    
    // Also save in top-level for easy global admin lookup
    try {
      const topRef = doc(db, 'accessRequests', docId);
      await setDoc(topRef, cleanData, { merge: true });
    } catch {}
    
    return true;
  } catch (err) {
    if (isFirestoreQuotaError(err)) {
      useCloudSyncStore.getState().setQuotaExceeded(true);
      markQuotaExceededToday(true);
      const firestore = getDbInstance();
      if (firestore) {
        disableNetwork(firestore).catch(() => {});
      }
    }
    handleFirestoreError(err, OperationType.WRITE, `projects/${projectId}/accessRequests/${req.id}`);
    return false;
  }
}

export async function fetchAllAccessRequestsFromCloud(projectId: string = DEFAULT_PROJECT_ID): Promise<any[]> {
  try {
    const db = getDbInstance();
    if (!db) return [];
    const map = new Map<string, any>();

    // 1. Project subcollection
    try {
      const colRef = collection(db, 'projects', projectId, 'accessRequests');
      const snap = await getDocs(colRef);
      snap.docs.forEach((d) => {
        map.set(d.id, { ...d.data(), id: d.id });
      });
    } catch {}

    // 2. Top-level collection
    try {
      const topRef = collection(db, 'accessRequests');
      const snap = await getDocs(topRef);
      snap.docs.forEach((d) => {
        if (!map.has(d.id)) {
          map.set(d.id, { ...d.data(), id: d.id });
        }
      });
    } catch {}

    return Array.from(map.values());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `projects/${projectId}/accessRequests`);
    return [];
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
    return safeSnapshotListener(
      colRef,
      (snapshot) => {
        const list = snapshot.docs.map((d: any) => ({ ...d.data(), id: d.id }));
        onUpdate(list);
      },
      `projects/${projectId}/accessRequests`,
      OperationType.LIST
    );
  } catch {
    return () => {};
  }
}

// Whitelist Cloud Persistence Helpers
export async function saveWhitelistEntryToCloud(
  entry: any,
  projectId: string = DEFAULT_PROJECT_ID
): Promise<boolean> {
  // Rules resolve membership by verified email, never by a client-generated ID.
  return saveWhitelistDoc(entry, projectId);
}

export async function deleteWhitelistEntryFromCloud(
  emailOrId: string,
  projectId: string = DEFAULT_PROJECT_ID
): Promise<boolean> {
  return deleteWhitelistDoc(emailOrId, projectId);
}

export async function deleteAccessRequestFromCloud(
  requestId: string,
  projectId: string = DEFAULT_PROJECT_ID
): Promise<boolean> {
  if (isCloudWriteBlocked()) {
    return false;
  }
  try {
    const db = getDbInstance();
    if (!db || !requestId) return false;
    const docRef = doc(db, 'projects', projectId, 'accessRequests', String(requestId));
    await deleteDoc(docRef);
    try {
      const topRef = doc(db, 'accessRequests', String(requestId));
      await deleteDoc(topRef);
    } catch {}
    return true;
  } catch (err) {
    if (isFirestoreQuotaError(err)) {
      useCloudSyncStore.getState().setQuotaExceeded(true);
      markQuotaExceededToday(true);
      const firestore = getDbInstance();
      if (firestore) {
        disableNetwork(firestore).catch(() => {});
      }
    }
    handleFirestoreError(err, OperationType.DELETE, `projects/${projectId}/accessRequests/${requestId}`);
    return false;
  }
}

export async function saveAccessConfigToCloud(
  config: any,
  projectId: string = DEFAULT_PROJECT_ID
): Promise<boolean> {
  if (isCloudWriteBlocked()) {
    return false;
  }
  try {
    const db = getDbInstance();
    if (!db) return false;
    const cleanData = JSON.parse(JSON.stringify(config));
    cleanData.updatedAt = new Date().toISOString();
    const docRef = doc(db, 'projects', projectId, 'accessConfig', 'global');
    await setDoc(docRef, cleanData, { merge: true });
    return true;
  } catch (err) {
    if (isFirestoreQuotaError(err)) {
      useCloudSyncStore.getState().setQuotaExceeded(true);
      markQuotaExceededToday(true);
      const firestore = getDbInstance();
      if (firestore) {
        disableNetwork(firestore).catch(() => {});
      }
    }
    handleFirestoreError(err, OperationType.WRITE, `projects/${projectId}/accessConfig/global`);
    return false;
  }
}

export function subscribeToAccessConfigCloud(
  onUpdate: (config: any) => void,
  projectId: string = DEFAULT_PROJECT_ID
): () => void {
  try {
    const db = getDbInstance();
    if (!db) return () => {};
    const docRef = doc(db, 'projects', projectId, 'accessConfig', 'global');
    return safeSnapshotListener(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          onUpdate(snapshot.data());
        }
      },
      `projects/${projectId}/accessConfig/global`,
      OperationType.GET
    );
  } catch {
    return () => {};
  }
}

// Ignored Duplicate Pairs Cloud Persistence Helpers
export function subscribeToIgnoredDuplicatePairsCloud(
  onUpdate: (keys: string[], revision?: number) => void,
  projectId: string = DEFAULT_PROJECT_ID
): () => void {
  try {
    const db = getDbInstance();
    if (!db) return () => {};
    const docRef = doc(db, 'projects', projectId, 'systemSettings', 'ignoredDuplicates');
    return safeSnapshotListener(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (Array.isArray(data?.keys)) {
            onUpdate(data.keys, data.revision ?? 0);
          }
        }
      },
      `projects/${projectId}/systemSettings/ignoredDuplicates`,
      OperationType.GET
    );
  } catch {
    return () => {};
  }
}

// Deleted Tombstones Cloud Persistence Helpers
export async function updateIgnoredDuplicatePairs(
  changes: IgnoredDuplicateChange[], projectId: string = DEFAULT_PROJECT_ID
): Promise<IgnoredDuplicateSnapshot | null> {
  // Explicit manual uploads set isManualPushing; background calls remain blocked in manual mode.
  if (isCloudWriteBlocked()) return null;
  try {
    const db = getDbInstance();
    if (!db) return null;
    return await writeIgnoredDuplicateChanges(db, projectId, changes);
  } catch (err) {
    if (isFirestoreQuotaError(err)) {
      useCloudSyncStore.getState().setQuotaExceeded(true);
      markQuotaExceededToday(true);
      const db = getDbInstance(); if (db) disableNetwork(db).catch(() => {});
    }
    handleFirestoreError(err, OperationType.WRITE, `projects/${projectId}/systemSettings/ignoredDuplicates`);
    return null;
  }
}

export async function saveDeletedTombstonesToCloud(
  ids: string[],
  projectId: string = DEFAULT_PROJECT_ID
): Promise<boolean> {
  if (isCloudWriteBlocked() || useCloudSyncStore.getState().syncMode === 'manual') return false;
  try {
    const db = getDbInstance();
    if (!db) return false;
    const docRef = doc(db, 'projects', projectId, 'systemSettings', 'deletedTombstones');
    await setDoc(docRef, { ids: Array.from(new Set(ids)), updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch (err) {
    if (isFirestoreQuotaError(err)) {
      useCloudSyncStore.getState().setQuotaExceeded(true);
      markQuotaExceededToday(true);
      const firestore = getDbInstance();
      if (firestore) {
        disableNetwork(firestore).catch(() => {});
      }
    }
    handleFirestoreError(err, OperationType.WRITE, `projects/${projectId}/systemSettings/deletedTombstones`);
    return false;
  }
}

/** Transactional per-person updates avoid overwriting another client's markers. */
export async function updatePersonDeletionMarkers(
  changes: Record<string, boolean>, projectId: string = DEFAULT_PROJECT_ID
): Promise<string[] | null> {
  if (isCloudWriteBlocked(true)) return null;
  const db = getDbInstance();
  if (!db) return null;
  try {
    return await writePersonDeletionMarkers(db, projectId, changes);
  } catch (error) {
    if (isFirestoreQuotaError(error)) {
      useCloudSyncStore.getState().setQuotaExceeded(true);
      markQuotaExceededToday(true);
    }
    handleFirestoreError(error, OperationType.WRITE, `projects/${projectId}/systemSettings/deletedTombstones`);
    return null;
  }
}

export function subscribeToDeletedTombstonesCloud(
  onUpdate: (ids: string[]) => void,
  projectId: string = DEFAULT_PROJECT_ID
): () => void {
  try {
    const db = getDbInstance();
    if (!db) return () => {};
    const docRef = doc(db, 'projects', projectId, 'systemSettings', 'deletedTombstones');
    return safeSnapshotListener(
      docRef,
      (snapshot) => {
        if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (Array.isArray(data?.ids)) {
            onUpdate(data.ids);
          }
        }
      },
      `projects/${projectId}/systemSettings/deletedTombstones`,
      OperationType.GET,
      true
    );
  } catch {
    return () => {};
  }
}

// Merged Persons Mapping Cloud Persistence Helpers
export async function updateMergedPersons(
  changes: Record<string, string | null>, projectId: string = DEFAULT_PROJECT_ID
): Promise<MergedPersonSnapshot | null> {
  if (isCloudWriteBlocked()) return null;
  try {
    const db = getDbInstance();
    if (!db) return null;
    return await writeMergedPersonChanges(db, projectId, changes);
  } catch (err) {
    if (isFirestoreQuotaError(err)) {
      useCloudSyncStore.getState().setQuotaExceeded(true);
      markQuotaExceededToday(true);
      const db = getDbInstance(); if (db) disableNetwork(db).catch(() => {});
    }
    handleFirestoreError(err, OperationType.WRITE, `projects/${projectId}/systemSettings/mergedPersons`);
    return null;
  }
}

export function subscribeToMergedPersonsCloud(
  onUpdate: (mapping: Record<string, string>, revision?: number) => void,
  projectId: string = DEFAULT_PROJECT_ID
): () => void {
  try {
    const db = getDbInstance();
    if (!db) return () => {};
    const docRef = doc(db, 'projects', projectId, 'systemSettings', 'mergedPersons');
    return safeSnapshotListener(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data?.mapping && typeof data.mapping === 'object') {
            onUpdate(data.mapping, data.revision ?? 0);
          }
        }
      },
      `projects/${projectId}/systemSettings/mergedPersons`,
      OperationType.GET
    );
  } catch {
    return () => {};
  }
}

/**
 * Batch write items into a subcollection in chunks of max 400 items
 * (Firestore limits batch writes to max 500 ops per batch; 400 provides a safe buffer).
 */
export async function batchSaveEntities(
  subcollection: string,
  items: any[],
  projectId: string = DEFAULT_PROJECT_ID,
  allowManualDirectWrite: boolean = false,
  onProgress?: (saved: number, total: number) => void
): Promise<boolean> {
  if (isCloudWriteBlocked(allowManualDirectWrite)) {
    return false;
  }
  try {
    const db = getDbInstance();
    if (!db || !items || items.length === 0) return false;

    const CHUNK_SIZE = 400;
    let savedCount = 0;
    const total = items.length;

    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      chunk.forEach((item) => {
        if (item && (item.id || item.year)) {
          const id = String(item.id || `${item.village}_${item.year}`);
          const docRef = doc(db, 'projects', projectId, subcollection, id);
          const cleanItem = subcollection === 'families' ? serializeFamilyForCloud(item) : JSON.parse(JSON.stringify(item));
          if (subcollection === 'persons') {
            if (item.deathYear === undefined || item.deathYear === null) cleanItem.deathYear = null;
            if (item.deathDate === undefined || item.deathDate === null) cleanItem.deathDate = null;
            if (item.deathPlace === undefined || item.deathPlace === null) cleanItem.deathPlace = null;
            if (item.deathReason === undefined || item.deathReason === null) cleanItem.deathReason = null;
            if (item.birthYear === undefined || item.birthYear === null) cleanItem.birthYear = null;
            if (item.birthDate === undefined || item.birthDate === null) cleanItem.birthDate = null;
            if (item.birthPlace === undefined || item.birthPlace === null) cleanItem.birthPlace = null;
          }
          cleanItem.updatedAt = cleanItem.updatedAt || new Date().toISOString();
          batch.set(docRef, cleanItem, { merge: true });
        }
      });

      await batch.commit();
      savedCount += chunk.length;
      if (onProgress) {
        onProgress(Math.min(savedCount, total), total);
      }
    }
    return true;
  } catch (err) {
    if (isFirestoreQuotaError(err)) {
      useCloudSyncStore.getState().setQuotaExceeded(true);
      markQuotaExceededToday(true);
      const firestore = getDbInstance();
      if (firestore) {
        disableNetwork(firestore).catch(() => {});
      }
    }
    handleFirestoreError(err, OperationType.WRITE, `projects/${projectId}/${subcollection}`);
    return false;
  }
}

/**
 * Batch delete items from a subcollection in chunks of max 400 items
 */
export async function batchDeleteEntities(
  subcollection: string,
  ids: string[],
  projectId: string = DEFAULT_PROJECT_ID,
  allowManualDirectWrite: boolean = false,
  onProgress?: (deleted: number, total: number) => void
): Promise<boolean> {
  if (isCloudWriteBlocked(allowManualDirectWrite)) {
    return false;
  }
  try {
    const db = getDbInstance();
    if (!db || !ids || ids.length === 0) return false;

    const CHUNK_SIZE = 400;
    let deletedCount = 0;
    const total = ids.length;

    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      chunk.forEach((id) => {
        if (id && typeof id === 'string') {
          const docRef = doc(db, 'projects', projectId, subcollection, id);
          batch.delete(docRef);
        }
      });

      await batch.commit();
      deletedCount += chunk.length;
      if (onProgress) {
        onProgress(Math.min(deletedCount, total), total);
      }
    }
    return true;
  } catch (err) {
    if (isFirestoreQuotaError(err)) {
      useCloudSyncStore.getState().setQuotaExceeded(true);
      markQuotaExceededToday(true);
      const firestore = getDbInstance();
      if (firestore) {
        disableNetwork(firestore).catch(() => {});
      }
    }
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
  projectId: string = DEFAULT_PROJECT_ID,
  confirmedOnly: boolean = false
): () => void {
  try {
    const db = getDbInstance();
    if (!db) return () => {};

    const colRef = collection(db, 'projects', projectId, subcollection);
    const q = limitCount > 0 ? query(colRef, limit(limitCount)) : colRef;

    return safeSnapshotListener(
      q,
      (snapshot) => {
        if (confirmedOnly && (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites)) return;
        try {
          const list = snapshot.docs.map((d: any) => {
            const row: any = { ...d.data(), id: d.id };
            if (subcollection === 'persons') {
              if (row.deathYear === null) delete row.deathYear;
              if (row.deathDate === null) delete row.deathDate;
              if (row.deathPlace === null) delete row.deathPlace;
              if (row.deathReason === null) delete row.deathReason;
              if (row.birthYear === null) delete row.birthYear;
              if (row.birthDate === null) delete row.birthDate;
              if (row.birthPlace === null) delete row.birthPlace;
            }
            return row as T;
          });
          onUpdate(list);
        } catch (e) {
          console.warn(`Error handling snapshot for ${subcollection}:`, e);
        }
      },
      `projects/${projectId}/${subcollection}`,
      OperationType.LIST,
      confirmedOnly
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
    places?: any[];
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
  // Guard: In manual sync mode or when daily quota is exceeded, do NOT spawn 13 real-time listeners!
  if (
    useCloudSyncStore.getState().syncMode === 'manual' ||
    isQuotaExceededToday() ||
    useCloudSyncStore.getState().isQuotaExceeded
  ) {
    return () => {};
  }
  const unsubscribers: (() => void)[] = [];

  const subcollections = [
    'persons',
    'families',
    'events',
    'sources',
    'places',
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
        if (items && (items.length > 0 || colName === 'persons')) {
          onDataUpdate({ [colName]: items });
        }
      },
      colName === 'persons' ? 0 : 400,
      projectId,
      colName === 'persons'
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
    places?: any[];
    metricRecords?: any[];
    documents?: any[];
    tasks?: any[];
    findings?: any[];
    hypotheses?: any[];
    requests?: any[];
    matrixEntries?: any[];
    lastUpdated?: string;
    counts?: { personsCount: number; familiesCount: number; metricRecordsCount: number;
      documentsCount: number; hypothesesCount: number };
  },
  projectId: string = DEFAULT_PROJECT_ID
): Promise<boolean> {
  if (isCloudWriteBlocked(true)) {
    return false;
  }
  try {
    const db = getDbInstance();
    if (!db) return false;

    const promises: Promise<boolean>[] = [];

    if (Array.isArray(data.persons) && data.persons.length > 0) {
      promises.push(batchSaveEntities('persons', data.persons, projectId, true));
    }
    if (Array.isArray(data.families) && data.families.length > 0) {
      promises.push(batchSaveEntities('families', data.families, projectId, true));
    }
    if (Array.isArray(data.events) && data.events.length > 0) {
      promises.push(batchSaveEntities('events', data.events, projectId, true));
    }
    if (Array.isArray(data.sources) && data.sources.length > 0) {
      promises.push(batchSaveEntities('sources', data.sources, projectId, true));
    }
    if (Array.isArray(data.places) && data.places.length > 0) {
      promises.push(batchSaveEntities('places', data.places, projectId, true));
    }
    if (Array.isArray(data.metricRecords) && data.metricRecords.length > 0) {
      promises.push(batchSaveEntities('metricRecords', data.metricRecords, projectId, true));
    }
    if (Array.isArray(data.documents) && data.documents.length > 0) {
      promises.push(batchSaveEntities('documents', data.documents, projectId, true));
    }
    if (Array.isArray(data.tasks) && data.tasks.length > 0) {
      promises.push(batchSaveEntities('tasks', data.tasks, projectId, true));
    }
    if (Array.isArray(data.findings) && data.findings.length > 0) {
      promises.push(batchSaveEntities('findings', data.findings, projectId, true));
    }
    if (Array.isArray(data.hypotheses) && data.hypotheses.length > 0) {
      promises.push(batchSaveEntities('hypotheses', data.hypotheses, projectId, true));
    }
    if (Array.isArray(data.requests) && data.requests.length > 0) {
      promises.push(batchSaveEntities('requests', data.requests, projectId, true));
    }
    if (Array.isArray(data.matrixEntries) && data.matrixEntries.length > 0) {
      promises.push(batchSaveEntities('matrixEntries', data.matrixEntries, projectId, true));
    }

    // Save metadata document
    const metaDocRef = doc(db, 'projects', projectId);
    promises.push(
      setDoc(
        metaDocRef,
        sanitizeForFirestore({
          lastUpdated: data.lastUpdated || new Date().toISOString(),
          personsCount: data.counts?.personsCount ?? data.persons?.length ?? 0,
          familiesCount: data.counts?.familiesCount ?? data.families?.length ?? 0,
          metricRecordsCount: data.counts?.metricRecordsCount ?? data.metricRecords?.length ?? 0,
          documentsCount: data.counts?.documentsCount ?? data.documents?.length ?? 0,
          hypothesesCount: data.counts?.hypothesesCount ?? data.hypotheses?.length ?? 0
        }),
        { merge: true }
      ).then(() => true).catch((err) => {
        if (isFirestoreQuotaError(err)) {
          useCloudSyncStore.getState().setQuotaExceeded(true);
          markQuotaExceededToday(true);
        }
        return false;
      })
    );

    const results = await Promise.all(promises);
    return results.every(Boolean);
  } catch (err) {
    if (isFirestoreQuotaError(err)) {
      useCloudSyncStore.getState().setQuotaExceeded(true);
      markQuotaExceededToday(true);
      const firestore = getDbInstance();
      if (firestore) {
        disableNetwork(firestore).catch(() => {});
      }
    }
    handleFirestoreError(err, OperationType.WRITE, `projects/${projectId}`);
    return false;
  }
}

/**
 * Manually fetches all entities from all Firestore subcollections in one batch
 */
export async function fetchAllProjectDataFromCloud(projectId: string = DEFAULT_PROJECT_ID): Promise<{
  success: boolean;
  data: CloudProjectSnapshot['data'];
  settings?: CloudProjectSnapshot['settings'];
  error?: string;
}> {
  try {
    const db = getDbInstance();
    if (!db) return { success: false, data: {}, error: 'База Firestore не ініціалізована' };
    return { success: true, ...await readProjectFromFirestore(db, projectId) };
  } catch (err: any) {
    handleFirestoreError(err, OperationType.LIST, `projects/${projectId}`);
    return { success: false, data: {}, error: err?.message || 'Помилка отримання даних з Firestore' };
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
  ownerUid?: string;
  publicOnly?: boolean;
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
  if (isCloudWriteBlocked()) {
    return {
      success: false,
      shareId: treeData.id,
      shareUrl: '',
      error: 'Добову квоту Firestore вичерпано. Публікація буде доступна після відновлення квоти.'
    };
  }
  try {
    const db = getDbInstance();
    if (!db) return { success: false, shareId: treeData.id, shareUrl: '', error: 'База Firestore недоступна' };
    const auth = getFirebaseAuth();
    await auth?.authStateReady();
    if (!auth?.currentUser?.emailVerified) {
      return { success: false, shareId: treeData.id, shareUrl: '', error: 'Для публікації увійдіть через Google.' };
    }

    const rawData: Record<string, any> = {
      id: treeData.id,
      title: treeData.title || 'Родинне дерево',
      authorName: treeData.authorName || 'Дослідник родоводу',
      authorEmail: treeData.authorEmail || '',
      ownerUid: auth.currentUser.uid,
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

    await publishPublicTree(db, treeData.id, treeData.database as any, treeData.rootPersonId);

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
    if (isFirestoreQuotaError(err)) {
      useCloudSyncStore.getState().setQuotaExceeded(true);
      markQuotaExceededToday(true);
      const firestore = getDbInstance();
      if (firestore) {
        disableNetwork(firestore).catch(() => {});
      }
    }
    handleFirestoreError(err, OperationType.WRITE, `sharedTrees/${treeData.id}`);
    return {
      success: false,
      shareId: treeData.id,
      shareUrl: '',
      error: isFirestoreQuotaError(err) ? 'Добовий ліміт запису до хмари вичерпано' : (err?.message || 'Помилка публікації дерева в хмару')
    };
  }
}

/** Fetch only the active, deceased-only public projection. */
async function getPublicTreeFromCloud(shareId: string): Promise<SharedTreeData | null> {
  const db = getDbInstance();
  if (!db) return null;
  const result = await getPublicTree(db, shareId);
  if (!result) return null;
  return {
    id: shareId, title: 'Родовід: померлі особи', authorName: '',
    createdAt: result.updatedAt, updatedAt: result.updatedAt,
    rootPersonId: result.database.rootPersonId || '', mode: 'readonly', isPinProtected: false,
    hideLivingDates: true, publicOnly: true, personsCount: Object.keys(result.database.persons).length,
    database: result.database
  };
}

/** Private snapshots require real Firebase Authentication and project membership. */
export async function getSharedTreeFromCloud(shareId: string): Promise<{
  success: boolean;
  data?: SharedTreeData;
  error?: string;
}> {
  try {
    const db = getDbInstance();
    if (!db) return { success: false, error: 'База Firestore недоступна' };
    const auth = getFirebaseAuth();
    await auth?.authStateReady();
    if (auth?.currentUser?.emailVerified) {
      try {
        const snapshot = await getDocFromServer(doc(db, 'sharedTrees', shareId));
        if (snapshot.exists()) return { success: true, data: snapshot.data() as SharedTreeData };
      } catch (error: any) {
        if (error?.code !== 'permission-denied') throw error;
      }
    }
    const data = await getPublicTreeFromCloud(shareId);
    if (data) return { success: true, data };
    return { success: false, error: 'Публічну версію ще не опубліковано або доступ відкликано.' };
  } catch (err: any) {
    return { success: false, error: err?.code === 'permission-denied'
      ? 'Публічну версію ще не опубліковано або доступ відкликано.'
      : (err?.message || 'Не вдалося завантажити родинне дерево') };
  }
}

export function subscribeToSharedTreeCloud(
  shareId: string,
  callback: (tree: SharedTreeData | null) => void,
  publicOnly: boolean = false
): () => void {
  const db = getDbInstance();
  if (!db) { callback(null); return () => {}; }
  let disposed = false;
  let revision = 0;
  const ref = doc(db, publicOnly ? 'publicTrees' : 'sharedTrees', shareId);
  const unsubscribe = onSnapshot(ref, { includeMetadataChanges: true }, async snapshot => {
    if (!publicOnly && snapshot.metadata.fromCache) return;
    const currentRevision = ++revision;
    if (!snapshot.exists() || (publicOnly && !snapshot.data().enabled)) {
      callback(null);
      return;
    }
    try {
      const tree = publicOnly ? await getPublicTreeFromCloud(shareId) : snapshot.data() as SharedTreeData;
      if (!disposed && currentRevision === revision) callback(tree);
    } catch {
      if (!disposed && currentRevision === revision) callback(null);
    }
  }, () => { if (!disposed) { revision++; callback(null); } });
  return () => { disposed = true; revision++; unsubscribe(); };
}
