import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, setDoc } from 'firebase/firestore';

let cachedDb: any = null;

function getDbInstance() {
  if (cachedDb) return cachedDb;
  try {
    const config: any = {};
    if (!config || !config.apiKey) return null;
    const app = !getApps().length ? initializeApp(config) : getApp();
    if (config.firestoreDatabaseId) {
      try {
        cachedDb = getFirestore(app, config.firestoreDatabaseId);
      } catch (e) {
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

function getAppDocRef() {
  try {
    const db = getDbInstance();
    if (db) {
      return doc(db, 'genealogyProjects', 'defaultProject');
    }
  } catch (e) {
    console.warn('Error creating doc ref:', e);
  }
  return null;
}

export { cachedDb as db };

export function subscribeToProjectData(onDataUpdate: (data: any) => void) {
  try {
    const docRef = getAppDocRef();
    if (!docRef) return () => {};

    return onSnapshot(
      docRef,
      (snapshot) => {
        try {
          if (snapshot.exists()) {
            onDataUpdate(snapshot.data());
          }
        } catch (e) {
          console.warn('Error handling snapshot data:', e);
        }
      },
      (error) => {
        console.warn('Firestore subscription notice (using local data):', error);
      }
    );
  } catch (err) {
    console.warn('Failed to subscribe to Firestore project data:', err);
    return () => {};
  }
}

export async function saveProjectDataToCloud(data: any) {
  try {
    const docRef = getAppDocRef();
    if (!docRef) return false;
    const cleanData = JSON.parse(JSON.stringify(data));
    await setDoc(docRef, cleanData, { merge: true });
    return true;
  } catch (err) {
    console.warn('Failed to save data to Firebase Firestore:', err);
    return false;
  }
}
