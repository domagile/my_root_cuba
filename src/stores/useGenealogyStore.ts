import { saveSnapshot, getSnapshot } from '../utils/persistentBackup';
import { preparePersonMerge, mergeRecordsFingerprint, sameMergeValue, type MergePayload, type PersonMergeRecovery } from '../services/personMergeRecovery';
import { getMergedPersonMap, recordMergedPersonChanges, hydrateMergedPersonState, getPendingMergedPersonChanges } from '../utils/mergedPersonState';
import { hydrateIgnoredDuplicateState, getPendingIgnoredDuplicateChanges } from '../utils/ignoredDuplicateState';
import { create } from 'zustand';
import { normalizePerson } from '../utils/personNormalization';
import { removeFamilyMemberships, restoreFamilyMemberships, FAMILY_RESTORE_STORAGE_KEY, type FamilyRestoreHistory, type RestorePersonsResult } from '../services/familyRestoreService';
import { reconcileCloudTrash } from '../services/cloudTrashService';
export { normalizePerson } from '../utils/personNormalization';
import { Person, Family, Source, LifeEvent, GenealogyDatabase, GitConfig, PlaceDossier } from '../types';
import { FAMILIO_PERSONS, FAMILIO_FAMILIES, FAMILIO_SOURCES, FAMILIO_EVENTS } from '../data/familioData';
import {
  savePersonDoc,
  savePersonDeltaDoc,
  saveFamilyDoc,
  deleteFamilyDoc,
  saveSourceDoc,
  deleteSourceDoc,
  saveEventDoc,
  deleteEventDoc,
  savePlaceDoc,
  deletePlaceDoc,
  batchSaveEntities,
  batchDeleteEntities
} from '../lib/firebase';
import { useCloudSyncStore, EntitySyncType, isQuotaExceededToday } from './useCloudSyncStore';
import { synchronizePersonDeltas, queueCloudSync } from '../services/cloudSyncService';
import { computePersonDelta } from '../utils/personDelta';
import { findRootPersonId } from '../rodovid/utils/relationship';
import { resolveInitialPersonId, saveUserTreeState } from '../utils/userTreeState';
import { isUserWhitelisted } from '../rodovid/utils/privacy';
import { useAuthStore } from './useAuthStore';
import { isDemoPerson, isDemoFamily, isDemoSource, isDemoEvent } from '../utils/demoPurge';
import { executeMerge, MergeResult, ImportHistorySession, ResolvedPersonConflictRecord, getPersonAncestorsIds } from '../rodovid/utils/mergeDatabase';
import { purgeUnknownPlaceholderPersons, cleanDatabaseFromUnknownPersons, isUnknownPlaceholderPerson } from '../rodovid/utils/unknownPersonCleaner';
import { persistLocalData, readLocalDataSync, idbGet, flushPendingLocalWrites, batchLocalWrites } from '../utils/indexedDbStorage';
import { clearDuplicateDetectorCache } from '../utils/duplicateDetector';
import { clearTreeAuditCache } from '../utils/treeAudit';
import { clearKinshipCache } from '../rodovid/utils/relationship';
import { clearGlobalSearchCache } from '../utils/globalTreeSearch';
import { clearTreeLayoutCache } from '../rodovid/utils/treeLayout';
import { getGitHubConfig, savePlaceDossierToGitHub } from '../services/githubService';
import { acceptCloudTombstones, getTombstoneIds, getPendingDeletionChanges, recordPersonDeletionChanges, hydratePersonDeletionState, TOMBSTONE_STORAGE_KEY } from '../utils/personDeletionState';
export { getTombstoneIds, TOMBSTONE_STORAGE_KEY } from '../utils/personDeletionState';

export function invalidateAllTreeCaches(): void {
  try {
    clearDuplicateDetectorCache();
    clearTreeAuditCache();
    clearKinshipCache();
    clearGlobalSearchCache();
    clearTreeLayoutCache();
  } catch {}
}

export function notifySyncChange(
  arg1?: (() => void) | EntitySyncType,
  arg2?: string | (() => void),
  arg3?: () => void
) {
  try {
    const syncStore = useCloudSyncStore.getState();
    if (typeof arg1 === 'string' && typeof arg2 === 'string') {
      syncStore.markDirty(arg1 as EntitySyncType, arg2);
      if (syncStore.syncMode === 'auto' && arg3) {
        arg3();
      }
    } else if (typeof arg1 === 'function') {
      syncStore.markUnsavedChange();
      if (syncStore.syncMode === 'auto') {
        arg1();
      }
    } else {
      syncStore.markUnsavedChange();
    }
  } catch {}
}

export function notifySyncDelete(
  type: EntitySyncType,
  id: string,
  action?: () => void
) {
  try {
    const syncStore = useCloudSyncStore.getState();
    syncStore.markDeleted(type, id);
    if (syncStore.syncMode === 'auto' && action) {
      action();
    }
  } catch {}
}

// Cloud Delta Batch Debouncer & Coalescer (Point 5 Optimization)
const pendingCloudPersonDeltas = new Map<string, Partial<Person>>();
let cloudDeltaDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const CLOUD_DELTA_DEBOUNCE_MS = 600;

export function scheduleCloudPersonDelta(personId: string, delta: Partial<Person>) {
  if (!personId || !delta || Object.keys(delta).length === 0) return;
  const syncStore = useCloudSyncStore.getState();
  syncStore.markPersonDirtyWithDelta(personId, delta);

  if (syncStore.syncMode !== 'auto' || syncStore.isQuotaExceeded || isQuotaExceededToday()) {
    return;
  }

  // Merge into coalesced delta
  const existing = pendingCloudPersonDeltas.get(personId) || {};
  pendingCloudPersonDeltas.set(personId, { ...existing, ...delta });

  if (cloudDeltaDebounceTimer) {
    clearTimeout(cloudDeltaDebounceTimer);
  }

  cloudDeltaDebounceTimer = setTimeout(() => {
    cloudDeltaDebounceTimer = null;
    void flushPendingCloudDeltas();
  }, CLOUD_DELTA_DEBOUNCE_MS);
}

export async function flushPendingCloudDeltas(): Promise<void> {
  if (cloudDeltaDebounceTimer) {
    clearTimeout(cloudDeltaDebounceTimer);
    cloudDeltaDebounceTimer = null;
  }
  const ids = Array.from(pendingCloudPersonDeltas.keys());
  pendingCloudPersonDeltas.clear();
  await synchronizePersonDeltas(ids, savePersonDeltaDoc);
}

const STORAGE_KEY = 'genealogy_workstation_data_v4_familio';
export function addTombstoneIds(ids: string[]): void {
  recordPersonDeletionChanges(ids, true);
  useCloudSyncStore.getState().markProjectUploadPending();
}
export function removeTombstoneId(id: string): void {
  recordPersonDeletionChanges([id], false);
  useCloudSyncStore.getState().markProjectUploadPending();
}

export const INITIAL_PERSONS: Person[] = (() => {
  const seen = new Set<string>();
  return FAMILIO_PERSONS
    .filter((p) => !isDemoPerson(p))
    .filter((p) => {
      if (!p || !p.id || seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
})();
export const INITIAL_FAMILIES: Record<string, Family> = Object.fromEntries(
  Object.entries(FAMILIO_FAMILIES).filter(([k, v]) => !isDemoFamily(k, v))
);
export const INITIAL_SOURCES: Record<string, Source> = Object.fromEntries(
  Object.entries(FAMILIO_SOURCES).filter(([k, v]) => !isDemoSource(k, v))
);
export const INITIAL_EVENTS: Record<string, LifeEvent> = Object.fromEntries(
  Object.entries(FAMILIO_EVENTS).filter(([k, v]) => !isDemoEvent(k, v))
);


export interface GenealogyDataState {
  persons: Person[];
  families: Record<string, Family>;
  sources: Record<string, Source>;
  events: Record<string, LifeEvent>;
  places: Record<string, PlaceDossier>;
  trashPersons: Person[];
  deletedFamilyLinks: FamilyRestoreHistory;
  applyConfirmedCloudDeletionState: (ids: string[], persons?: Person[], mergedIds?: string[]) => void;
  selectedPersonId: string | null;
  gitConfig: GitConfig;
  googleDriveEmail: string;

  // Person Actions
  setPersons: (persons: Person[] | ((prev: Person[]) => Person[])) => void;
  setSelectedPersonId: (id: string | null) => void;
  addPerson: (person: Person) => void;
  updatePerson: (person: Person) => void;
  updatePersons: (persons: Person[]) => void;
  deletePerson: (id: string) => void;
  deletePersons: (ids: string[]) => void;
  restorePerson: (id: string) => RestorePersonsResult;
  restorePersons: (ids: string[]) => RestorePersonsResult;
  permanentlyDeletePerson: (id: string) => void;
  permanentlyDeletePersons: (ids: string[]) => void;
  emptyTrash: () => void;

  getPersonById: (id: string) => Person | undefined;
  deleteAncestorsOfPerson: (personId: string) => {
    deletedCount: number;
    deletedPersonIds: string[];
    rootPersonName: string;
  };
  mergeInProgress: boolean;
  lastPersonMergeSnapshotId: string | null;
  mergePersons: (payload: MergePayload) => Promise<{ snapshotId: string; persisted: boolean }>;
  undoLastPersonMerge: () => Promise<{ persisted: boolean }>;


  // Family Actions
  setFamilies: (families: Record<string, Family> | ((prev: Record<string, Family>) => Record<string, Family>)) => void;
  saveFamily: (family: Family) => void;
  deleteFamily: (id: string) => void;

  // Source Actions
  setSources: (sources: Record<string, Source> | ((prev: Record<string, Source>) => Record<string, Source>)) => void;
  saveSource: (source: Source) => void;
  deleteSource: (id: string) => void;

  // Event Actions
  setEvents: (events: Record<string, LifeEvent> | ((prev: Record<string, LifeEvent>) => Record<string, LifeEvent>)) => void;
  saveEvent: (event: LifeEvent) => void;
  deleteEvent: (id: string) => void;

  // Place Actions
  setPlaces: (places: Record<string, PlaceDossier> | ((prev: Record<string, PlaceDossier>) => Record<string, PlaceDossier>)) => void;
  savePlace: (place: PlaceDossier) => void;
  deletePlace: (idOrName: string) => void;

  // Whole Database & Integrations
  getGenealogyDatabase: () => GenealogyDatabase;
  loadGenealogyDatabase: (db: GenealogyDatabase, meta?: { fileName?: string }) => void;
  mergeGenealogyDatabase: (db: GenealogyDatabase, precalculatedResult?: MergeResult, meta?: { fileName?: string }) => MergeResult;
  importHistory: ImportHistorySession[];
  addImportHistorySession: (session: ImportHistorySession) => void;
  clearImportHistory: () => void;
  setGitConfig: (config: GitConfig) => void;
  setGoogleDriveEmail: (email: string) => void;
  exportGedcomData: () => void;
  purgeDemoDataFromTree: () => void;
  purgeUnknownPersons: () => { deletedCount: number; deletedIds: string[] };
  hydrateFromIndexedDB: () => Promise<void>;
}

export const useGenealogyStore = create<GenealogyDataState>((set, get) => ({
  persons: (() => {
    try {
      // Clear legacy storage keys if present
      ['genealogy_workstation_data_v1_persons', 'genealogy_workstation_data_v2_persons', 'genealogy_workstation_data_v3_persons'].forEach(k => {
        try { localStorage.removeItem(k); } catch {}
      });

      const saved = localStorage.getItem(`${STORAGE_KEY}_persons`);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const tombstones = getTombstoneIds();
          const cleaned = parsed.filter((p) => !isDemoPerson(p) && !tombstones.has(p.id));
          if (cleaned.length > 0) {
            const normalizedList = cleaned.map(normalizePerson);
            const seen = new Set<string>();
            const deduplicated: Person[] = [];
            for (const p of normalizedList) {
              if (p && p.id && !seen.has(p.id) && !tombstones.has(p.id)) {
                seen.add(p.id);
                deduplicated.push(p);
              }
            }
            // Auto-clean unknown placeholder persons with no specified ancestors
            let rawFam: Record<string, Family> = {};
            try {
              const sf = localStorage.getItem(`${STORAGE_KEY}_families`);
              if (sf) rawFam = JSON.parse(sf);
            } catch {}
            const { cleanedPersons, cleanedFamilies, deletedIds } = purgeUnknownPlaceholderPersons(deduplicated, rawFam);
            if (deletedIds.length > 0) {
              try {
                localStorage.setItem(`${STORAGE_KEY}_families`, JSON.stringify(cleanedFamilies));
              } catch {}
            }
            try {
              localStorage.setItem(`${STORAGE_KEY}_persons`, JSON.stringify(cleanedPersons));
            } catch {}
            return cleanedPersons;
          }
        }
      }
      const { cleanedPersons } = purgeUnknownPlaceholderPersons(INITIAL_PERSONS.map(normalizePerson), INITIAL_FAMILIES);
      return cleanedPersons;
    } catch {
      const { cleanedPersons } = purgeUnknownPlaceholderPersons(INITIAL_PERSONS.map(normalizePerson), INITIAL_FAMILIES);
      return cleanedPersons;
    }
  })(),

  families: (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_families`);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const cleaned: Record<string, Family> = {};
          for (const [k, v] of Object.entries(parsed)) {
            if (!isDemoFamily(k, v)) {
              cleaned[k] = v as Family;
            }
          }
          return cleaned;
        }
      }
      return INITIAL_FAMILIES;
    } catch {
      return INITIAL_FAMILIES;
    }
  })(),

  sources: (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_sources`);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const cleaned: Record<string, Source> = {};
          for (const [k, v] of Object.entries(parsed)) {
            if (!isDemoSource(k, v)) cleaned[k] = v as Source;
          }
          return cleaned;
        }
      }
      return INITIAL_SOURCES;
    } catch {
      return INITIAL_SOURCES;
    }
  })(),

  events: (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_events`);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const cleaned: Record<string, LifeEvent> = {};
          for (const [k, v] of Object.entries(parsed)) {
            if (!isDemoEvent(k, v)) cleaned[k] = v as LifeEvent;
          }
          return cleaned;
        }
      }
      return INITIAL_EVENTS;
    } catch {
      return INITIAL_EVENTS;
    }
  })(),

  places: (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_places`);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed;
        }
      }
      return {};
    } catch {
      return {};
    }
  })(),

  deletedFamilyLinks: readLocalDataSync<FamilyRestoreHistory>(FAMILY_RESTORE_STORAGE_KEY) || {},

  trashPersons: (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_trashPersons`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  })(),

  selectedPersonId: (() => {
    try {
      const personsSaved = localStorage.getItem(`${STORAGE_KEY}_persons`);
      const personsList: Person[] = personsSaved ? JSON.parse(personsSaved) : INITIAL_PERSONS;
      const savedSelected = localStorage.getItem(`${STORAGE_KEY}_selectedPersonId`);
      if (savedSelected && personsList.some((p) => p.id === savedSelected)) {
        return savedSelected;
      }
      return resolveInitialPersonId(personsList);
    } catch {
      return 'p_bom_olga';
    }
  })(),

  gitConfig: (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_gitConfig`);
      return saved ? JSON.parse(saved) : { repoUrl: '', branch: 'main', token: '', connected: false };
    } catch {
      return { repoUrl: '', branch: 'main', token: '', connected: false };
    }
  })(),

  googleDriveEmail: '',

  applyConfirmedCloudDeletionState: (ids, persons, mergedIds = []) => set(state => {
    const next = reconcileCloudTrash(state, ids, persons, getPendingDeletionChanges(), new Set(mergedIds));
    acceptCloudTombstones(ids);
    if (next === state) return state;
    persistLocalData(`${STORAGE_KEY}_persons`, next.persons);
    persistLocalData(`${STORAGE_KEY}_trashPersons`, next.trashPersons);
    invalidateAllTreeCaches();
    return { persons: next.persons, trashPersons: next.trashPersons };
  }),

  setPersons: (updater) =>
    set((state) => {
      const nextPersons = typeof updater === 'function' ? updater(state.persons) : updater;
      const normalized = nextPersons.map(normalizePerson);
      const seen = new Set<string>();
      const deduplicated: Person[] = [];
      for (const p of normalized) {
        if (p && p.id && !seen.has(p.id)) {
          seen.add(p.id);
          deduplicated.push(p);
        }
      }

      const { cleanedPersons, cleanedFamilies, deletedIds } = purgeUnknownPlaceholderPersons(deduplicated, state.families);
      persistLocalData(`${STORAGE_KEY}_persons`, cleanedPersons);
      if (deletedIds.length > 0) {
        persistLocalData(`${STORAGE_KEY}_families`, cleanedFamilies);
      }

      return {
        persons: cleanedPersons,
        ...(deletedIds.length > 0 ? { families: cleanedFamilies } : {})
      };
    }),

  setSelectedPersonId: (selectedPersonId) => {
    try {
      const { currentUser, whitelist } = useAuthStore.getState();
      const isAuth = isUserWhitelisted(currentUser, whitelist);

      if (isAuth && currentUser?.email && selectedPersonId) {
        // Persist to the authorized user's state
        saveUserTreeState(currentUser.email, { selectedPersonId });
      }

      // Persist so the focused person is preserved across reloads
      if (selectedPersonId) {
        persistLocalData(`${STORAGE_KEY}_selectedPersonId`, selectedPersonId);
      }
    } catch {}
    set({ selectedPersonId });
  },

  addPerson: (person) =>
    set((state) => {
      if (isUnknownPlaceholderPerson(person)) {
        return state;
      }
      const normalized = normalizePerson(person);
      if (isUnknownPlaceholderPerson(normalized)) {
        return state;
      }
      const exists = state.persons.some((p) => p.id === normalized.id);
      const next = exists
        ? state.persons.map((p) => (p.id === normalized.id ? normalized : p))
        : [...state.persons, normalized];
      persistLocalData(`${STORAGE_KEY}_persons`, next);
      notifySyncChange('persons', normalized.id, () => savePersonDoc(normalized));
      return { persons: next };
    }),

  updatePerson: (person) =>
    set((state) => {
      const normalized = normalizePerson(person);
      const prevPerson = state.persons.find((p) => p.id === person.id);
      const delta = computePersonDelta(prevPerson, normalized);

      const next = state.persons.map((p) => (p.id === person.id ? normalized : p));
      persistLocalData(`${STORAGE_KEY}_persons`, next);

      // Debounced & coalesced delta cloud sync
      scheduleCloudPersonDelta(normalized.id, delta);

      return { persons: next };
    }),

  updatePersons: (updatedPersons) =>
    set((state) => {
      const normalizedMap = new Map<string, Person>();

      updatedPersons.forEach((p) => {
        const norm = normalizePerson(p);
        normalizedMap.set(norm.id, norm);
        const prevPerson = state.persons.find((existing) => existing.id === norm.id);
        const delta = computePersonDelta(prevPerson, norm);

        // Debounced & coalesced delta cloud sync
        scheduleCloudPersonDelta(norm.id, delta);
      });
      const next = state.persons.map((p) => normalizedMap.get(p.id) || p);
      persistLocalData(`${STORAGE_KEY}_persons`, next);
      return { persons: next };
    }),

  deletePerson: (id) => get().deletePersons([id]),

  deletePersons: (ids) => set(state => {
    const selected = new Set(ids);
    const targets = state.persons.filter(person => selected.has(person.id));
    if (!targets.length) return state;
    const deletedIds = new Set(targets.map(person => person.id));
    const removed = removeFamilyMemberships(state.families, deletedIds);
    const deletedFamilyLinks = { ...state.deletedFamilyLinks, ...removed.history };
    const nextTrash = [...state.trashPersons.filter(person => !deletedIds.has(person.id)),
      ...targets.map(person => ({ ...person, isDeleted: true, deletedAt: new Date().toISOString() }))];
    const nextPersons = state.persons.filter(person => !deletedIds.has(person.id));
    persistLocalData(`${STORAGE_KEY}_persons`, nextPersons);
    persistLocalData(`${STORAGE_KEY}_trashPersons`, nextTrash);
    persistLocalData(`${STORAGE_KEY}_families`, removed.families);
    persistLocalData(FAMILY_RESTORE_STORAGE_KEY, deletedFamilyLinks);
    addTombstoneIds([...deletedIds]);
    deletedIds.forEach(id => useCloudSyncStore.getState().markDeleted('persons', id));
    removed.changedIds.forEach(id => useCloudSyncStore.getState().markDirty('families', id));
    invalidateAllTreeCaches();
    return { persons: nextPersons, trashPersons: nextTrash, families: removed.families, deletedFamilyLinks };
  }),

  restorePerson: (id) => get().restorePersons([id]),

  restorePersons: (ids) => {
    let result: RestorePersonsResult = { restoredCount: 0, skippedFamilyLinks: 0 };
    set((state) => {
      const selected = new Set(ids);
      const targets = state.trashPersons.filter((person) => selected.has(person.id));
      if (!targets.length) return state;
      const restoredById = new Map(targets.map((person) => [person.id,
        normalizePerson({ ...person, isDeleted: false, deletedAt: undefined })]));
      const restoredIds = [...restoredById.keys()];
      const activeIds = new Set(state.persons.map(person => person.id));
      const nextPersons = [...state.persons, ...[...restoredById.values()].filter(person => !activeIds.has(person.id))];
      const nextTrash = state.trashPersons.filter(person => !restoredById.has(person.id));
      const recovered = restoreFamilyMemberships(state.families, state.deletedFamilyLinks, restoredIds);
      result = { restoredCount: restoredIds.length, skippedFamilyLinks: recovered.skippedFamilyLinks };
      persistLocalData(`${STORAGE_KEY}_families`, recovered.families);
      persistLocalData(FAMILY_RESTORE_STORAGE_KEY, recovered.remaining);
      recovered.changedIds.forEach(id => useCloudSyncStore.getState().markDirty('families', id));
      persistLocalData(`${STORAGE_KEY}_persons`, nextPersons);
      persistLocalData(`${STORAGE_KEY}_trashPersons`, nextTrash);
      recordPersonDeletionChanges(restoredIds, false);
      restoredIds.forEach(id => useCloudSyncStore.getState().markDirty('persons', id));
      useCloudSyncStore.getState().markProjectUploadPending();
      invalidateAllTreeCaches();
      return { persons: nextPersons, trashPersons: nextTrash, families: recovered.families, deletedFamilyLinks: recovered.remaining };
    });
    return result;
  },

  permanentlyDeletePerson: (id) => get().permanentlyDeletePersons([id]),

  permanentlyDeletePersons: (ids) => set(state => {
    if (!ids.length) return state;
    const selected = new Set(ids);
    const nextTrash = state.trashPersons.filter(person => !selected.has(person.id));
    const deletedFamilyLinks = Object.fromEntries(Object.entries(state.deletedFamilyLinks).filter(([id]) => !selected.has(id)));
    addTombstoneIds(ids);
    persistLocalData(`${STORAGE_KEY}_trashPersons`, nextTrash);
    persistLocalData(FAMILY_RESTORE_STORAGE_KEY, deletedFamilyLinks);
    ids.forEach(id => useCloudSyncStore.getState().markDeleted('persons', id));
    return { trashPersons: nextTrash, deletedFamilyLinks };
  }),

  emptyTrash: () => get().permanentlyDeletePersons(get().trashPersons.map(person => person.id)),

  getPersonById: (id) => get().persons.find((p) => p.id === id),

  deleteAncestorsOfPerson: (personId: string) => {
    const state = get();
    const personsMap: Record<string, Person> = {};
    state.persons.forEach((p) => {
      personsMap[p.id] = p;
    });

    const target = personsMap[personId];
    if (!target) {
      return { deletedCount: 0, deletedPersonIds: [], rootPersonName: '' };
    }

    const ancestorIds = getPersonAncestorsIds(personId, personsMap, state.families);
    const targetName = `${target.name?.surname || target.lastName || ''} ${target.name?.given || target.firstName || ''}`.trim() || target.id;

    if (ancestorIds.size === 0) {
      if (target.fatherId || target.motherId || target.parentFamilyId) {
        const updatedTarget = { ...target, fatherId: undefined, motherId: undefined, parentFamilyId: undefined };
        const next = state.persons.map((p) => (p.id === target.id ? updatedTarget : p));
        persistLocalData(`${STORAGE_KEY}_persons`, next);
        savePersonDoc(updatedTarget).catch(() => {});
        set({ persons: next });
      }
      return { deletedCount: 0, deletedPersonIds: [], rootPersonName: targetName };
    }

    const ancestorIdsList = Array.from(ancestorIds);
    const ancestorIdsSet = new Set(ancestorIdsList);

    // 1. Immediately record in tombstones (both local and cloud)
    addTombstoneIds(ancestorIdsList);

    // 2. Mark and batch delete ancestors from Firestore
    ancestorIdsList.forEach((id) => useCloudSyncStore.getState().markDeleted('persons', id));

    // 3. Sever parents on target person
    const updatedTarget: Person = {
      ...target,
      fatherId: undefined,
      motherId: undefined,
      parentFamilyId: undefined
    };

    // 4. Filter remaining persons
    const remainingPersons = state.persons
      .filter((p) => !ancestorIdsSet.has(p.id))
      .map((p) => (p.id === target.id ? updatedTarget : p));

    // 5. Clean up families
    const nextFamilies: Record<string, Family> = {};
    const deletedFamilyIds: string[] = [];
    Object.entries(state.families).forEach(([fId, fam]) => {
      const isHusbandAncestor = fam.husbandId && ancestorIdsSet.has(fam.husbandId);
      const isWifeAncestor = fam.wifeId && ancestorIdsSet.has(fam.wifeId);
      if (isHusbandAncestor && isWifeAncestor) {
        deletedFamilyIds.push(fId);
        useCloudSyncStore.getState().markDeleted('families', fId);
        return;
      }
      nextFamilies[fId] = {
        ...fam,
        husbandId: isHusbandAncestor ? undefined : fam.husbandId,
        wifeId: isWifeAncestor ? undefined : fam.wifeId,
        children: (fam.children || []).filter((c) => !ancestorIdsSet.has(c.personId)),
        childrenIds: (fam.childrenIds || []).filter((cId) => !ancestorIdsSet.has(cId))
      };
    });

    if (deletedFamilyIds.length > 0 && useCloudSyncStore.getState().syncMode === 'auto') {
      batchDeleteEntities('families', deletedFamilyIds).catch(() => {});
    }

    persistLocalData(`${STORAGE_KEY}_persons`, remainingPersons);
    persistLocalData(`${STORAGE_KEY}_families`, nextFamilies);

    savePersonDoc(updatedTarget).catch(() => {});
    notifySyncChange('persons', updatedTarget.id, () => savePersonDoc(updatedTarget));

    invalidateAllTreeCaches();
    set({
      persons: remainingPersons,
      families: nextFamilies
    });

    return {
      deletedCount: ancestorIdsList.length,
      deletedPersonIds: ancestorIdsList,
      rootPersonName: targetName
    };
  },

  mergeInProgress: false,
  lastPersonMergeSnapshotId: readLocalDataSync<string>(`${STORAGE_KEY}_lastPersonMergeSnapshotId`),
  mergePersons: async (payload) => {
    if (get().mergeInProgress) throw new Error('Інша операція злиття ще виконується.');
    set({ mergeInProgress: true });
    try {
      return await queueCloudSync(async () => {
        const before = get(), beforeFingerprint = mergeRecordsFingerprint(before);
        const next = preparePersonMerge(before, payload);
        const existingMapping = getMergedPersonMap();
        if (next.deletedIds.some(id => existingMapping[id])) throw new Error('Особа вже має зв’язок злиття. Оновіть базу перед операцією.');
        const recovery: PersonMergeRecovery = {
          version: 1, afterFingerprint: mergeRecordsFingerprint(next), deletedPersonIds: next.deletedIds,
          mergedInto: next.mapping, previousSelectedId: before.selectedPersonId,
          afterSelectedId: next.selectedPersonId, previousSnapshotId: before.lastPersonMergeSnapshotId
        };
        const snapshot = await saveSnapshot({ persons: before.persons, families: before.families, sources: before.sources,
          events: before.events, places: before.places, trashPersons: before.trashPersons, whitelist: [] },
          `Перед злиттям ${next.deletedIds.length} дублікатів`, recovery);
        if (!snapshot) throw new Error('Не вдалося зберегти контрольну точку. Злиття не виконано.');
        if (mergeRecordsFingerprint(get()) !== beforeFingerprint || !sameMergeValue(getMergedPersonMap(), existingMapping)) {
          throw new Error('Дані змінилися під час збереження контрольної точки. Повторіть порівняння.');
        }
        // No outbound writes before a confirmed recovery point and a fresh input check.
        batchLocalWrites(() => {
          recordPersonDeletionChanges(next.deletedIds, true);
          recordMergedPersonChanges(next.mapping);
          persistLocalData(`${STORAGE_KEY}_persons`, next.persons);
          persistLocalData(`${STORAGE_KEY}_families`, next.families);
          persistLocalData(`${STORAGE_KEY}_trashPersons`, next.trashPersons);
          persistLocalData(`${STORAGE_KEY}_selectedPersonId`, next.selectedPersonId);
          persistLocalData(`${STORAGE_KEY}_lastPersonMergeSnapshotId`, snapshot.id);
        });
        for (const id of next.deletedIds) notifySyncDelete('persons', id);
        const previousPersons = new Map(before.persons.map(person => [person.id, person]));
        for (const person of next.persons) if (!sameMergeValue(previousPersons.get(person.id), person)) {
          useCloudSyncStore.getState().markDirty('persons', person.id);
        }
        for (const [id, family] of Object.entries(next.families)) if (!sameMergeValue(before.families[id], family)) {
          useCloudSyncStore.getState().markDirty('families', id);
        }
        useCloudSyncStore.getState().markProjectUploadPending();
        invalidateAllTreeCaches();
        set({ persons: next.persons, families: next.families, trashPersons: next.trashPersons,
          selectedPersonId: next.selectedPersonId, lastPersonMergeSnapshotId: snapshot.id });
        try { await flushPendingLocalWrites(); return { snapshotId: snapshot.id, persisted: true }; }
        catch { return { snapshotId: snapshot.id, persisted: false }; }
      });
    } finally { set({ mergeInProgress: false }); }
  },
  undoLastPersonMerge: async () => {
    if (get().mergeInProgress) throw new Error('Дочекайтеся завершення поточної операції.');
    set({ mergeInProgress: true });
    try {
      return await queueCloudSync(async () => {
        const current = get(), id = current.lastPersonMergeSnapshotId;
        if (!id) throw new Error('Немає злиття для скасування.');
        const snapshot = await getSnapshot(id), recovery = snapshot?.personMerge;
        if (!snapshot || recovery?.version !== 1) throw new Error('Контрольна точка недоступна.');
        if (mergeRecordsFingerprint(get()) !== recovery.afterFingerprint
          || Object.entries(recovery.mergedInto).some(([personId, target]) => getMergedPersonMap()[personId] !== target)) {
          throw new Error('Після злиття записи змінилися. Автоматичне скасування не перезапише ці правки; контрольна точка збережена.');
        }
        const before = snapshot.data, restored = before.persons.map(normalizePerson);
        const trashPersons = before.trashPersons || [];
        const selectedPersonId = get().selectedPersonId === recovery.afterSelectedId ? recovery.previousSelectedId : get().selectedPersonId;
        batchLocalWrites(() => {
          recordPersonDeletionChanges(recovery.deletedPersonIds, false);
          recordMergedPersonChanges(Object.fromEntries(recovery.deletedPersonIds.map(personId => [personId, null])));
          persistLocalData(`${STORAGE_KEY}_persons`, restored);
          persistLocalData(`${STORAGE_KEY}_families`, before.families);
          persistLocalData(`${STORAGE_KEY}_trashPersons`, trashPersons);
          persistLocalData(`${STORAGE_KEY}_selectedPersonId`, selectedPersonId);
          persistLocalData(`${STORAGE_KEY}_lastPersonMergeSnapshotId`, recovery.previousSnapshotId);
        });
        const previousPersons = new Map(current.persons.map(person => [person.id, person]));
        for (const person of restored) if (!sameMergeValue(previousPersons.get(person.id), person)) {
          useCloudSyncStore.getState().markDirty('persons', person.id);
        }
        for (const [familyId, family] of Object.entries(before.families)) if (!sameMergeValue(current.families[familyId], family)) {
          useCloudSyncStore.getState().markDirty('families', familyId);
        }
        useCloudSyncStore.getState().markProjectUploadPending();
        invalidateAllTreeCaches();
        set({ persons: restored, families: before.families, trashPersons, selectedPersonId,
          lastPersonMergeSnapshotId: recovery.previousSnapshotId });
        try { await flushPendingLocalWrites(); return { persisted: true }; }
        catch { return { persisted: false }; }
      });
    } finally { set({ mergeInProgress: false }); }
  },

  // Families
  setFamilies: (updater) =>
    set((state) => {
      const nextFamilies = typeof updater === 'function' ? updater(state.families) : updater;
      persistLocalData(`${STORAGE_KEY}_families`, nextFamilies);
      return { families: nextFamilies };
    }),

  saveFamily: (family) =>
    set((state) => {
      const nextFamilies = { ...state.families, [family.id]: family };
      const famChildIds = (family.childrenIds || (family.children || []).map((c) => c.personId)).filter(Boolean);

      // Synchronize person parent/spouse references
      const nextPersons = state.persons.map((p) => {
        let updated = { ...p };
        let personChanged = false;

        if (family.husbandId === p.id || family.wifeId === p.id) {
          const spouseFams = Array.isArray(p.spouseFamilyIds) ? [...p.spouseFamilyIds] : [];
          if (!spouseFams.includes(family.id)) {
            spouseFams.push(family.id);
            updated.spouseFamilyIds = spouseFams;
            personChanged = true;
          }
          if (famChildIds.length > 0) {
            const currentCIds = Array.isArray(p.childrenIds) ? p.childrenIds : [];
            const merged = Array.from(new Set([...currentCIds, ...famChildIds]));
            if (merged.length !== currentCIds.length) {
              updated.childrenIds = merged;
              personChanged = true;
            }
          }
          const otherSpouseId = family.husbandId === p.id ? family.wifeId : family.husbandId;
          if (otherSpouseId) {
            const currentSpouses = Array.isArray(p.spouseIds) ? p.spouseIds : [];
            if (!currentSpouses.includes(otherSpouseId)) {
              updated.spouseIds = [...currentSpouses, otherSpouseId];
              personChanged = true;
            }
          }
        }

        const isChild = famChildIds.includes(p.id) || (family.children || []).some((c) => c.personId === p.id);
        if (isChild) {
          if (updated.parentFamilyId !== family.id) {
            updated.parentFamilyId = family.id;
            personChanged = true;
          }
          if (family.husbandId && updated.fatherId !== family.husbandId) {
            updated.fatherId = family.husbandId;
            personChanged = true;
          }
          if (family.wifeId && updated.motherId !== family.wifeId) {
            updated.motherId = family.wifeId;
            personChanged = true;
          }
        }

        if (personChanged) {
          notifySyncChange('persons', updated.id, () => savePersonDoc(normalizePerson(updated)));
        }
        return updated;
      });

      persistLocalData(`${STORAGE_KEY}_families`, nextFamilies);
      persistLocalData(`${STORAGE_KEY}_persons`, nextPersons);
      notifySyncChange('families', family.id, () => saveFamilyDoc(family));

      return { families: nextFamilies, persons: nextPersons };
    }),

  deleteFamily: (id) =>
    set((state) => {
      const nextFamilies = { ...state.families };
      delete nextFamilies[id];
      persistLocalData(`${STORAGE_KEY}_families`, nextFamilies);
      notifySyncDelete('families', id, () => deleteFamilyDoc(id));
      return { families: nextFamilies };
    }),

  // Sources
  setSources: (updater) =>
    set((state) => {
      const nextSources = typeof updater === 'function' ? updater(state.sources) : updater;
      persistLocalData(`${STORAGE_KEY}_sources`, nextSources);
      return { sources: nextSources };
    }),

  saveSource: (source) =>
    set((state) => {
      const nextSources = { ...state.sources, [source.id]: source };
      persistLocalData(`${STORAGE_KEY}_sources`, nextSources);
      notifySyncChange('sources', source.id, () => saveSourceDoc(source));
      return { sources: nextSources };
    }),

  deleteSource: (id) =>
    set((state) => {
      const nextSources = { ...state.sources };
      delete nextSources[id];
      persistLocalData(`${STORAGE_KEY}_sources`, nextSources);
      notifySyncDelete('sources', id, () => deleteSourceDoc(id));
      return { sources: nextSources };
    }),

  // Events
  setEvents: (updater) =>
    set((state) => {
      const nextEvents = typeof updater === 'function' ? updater(state.events) : updater;
      persistLocalData(`${STORAGE_KEY}_events`, nextEvents);
      return { events: nextEvents };
    }),

  saveEvent: (event) =>
    set((state) => {
      const nextEvents = { ...state.events, [event.id]: event };
      persistLocalData(`${STORAGE_KEY}_events`, nextEvents);
      notifySyncChange('events', event.id, () => saveEventDoc(event));
      return { events: nextEvents };
    }),

  deleteEvent: (id) =>
    set((state) => {
      const nextEvents = { ...state.events };
      delete nextEvents[id];
      persistLocalData(`${STORAGE_KEY}_events`, nextEvents);
      notifySyncDelete('events', id, () => deleteEventDoc(id));
      return { events: nextEvents };
    }),

  setPlaces: (updater) =>
    set((state) => {
      const nextPlaces = typeof updater === 'function' ? updater(state.places) : updater;
      persistLocalData(`${STORAGE_KEY}_places`, nextPlaces);
      return { places: nextPlaces };
    }),

  savePlace: (place) =>
    set((state) => {
      const key = place.id || place.placeName.trim();
      const updatedPlace = { ...place, id: key, updatedAt: new Date().toISOString() };
      const nextPlaces = { ...state.places, [key]: updatedPlace };
      persistLocalData(`${STORAGE_KEY}_places`, nextPlaces);
      notifySyncChange('places', updatedPlace.id, () => savePlaceDoc(updatedPlace));

      // Auto-save village / place notebook to GitHub if configured
      try {
        const ghConfig = getGitHubConfig();
        if (ghConfig.isConfigured) {
          savePlaceDossierToGitHub(updatedPlace.placeName, updatedPlace, ghConfig).catch((err) => {
            console.warn('[GitHub AutoSync] Failed to sync place to GitHub:', err);
          });
        }
      } catch (e) {
        console.warn('[GitHub AutoSync] Error initiating GitHub sync for place:', e);
      }

      return { places: nextPlaces };
    }),

  deletePlace: (idOrName) =>
    set((state) => {
      const nextPlaces = { ...state.places };
      delete nextPlaces[idOrName];
      persistLocalData(`${STORAGE_KEY}_places`, nextPlaces);
      notifySyncDelete('places', idOrName, () => deletePlaceDoc(idOrName));
      return { places: nextPlaces };
    }),

  // Unified Database export / import
  getGenealogyDatabase: (): GenealogyDatabase => {
    const { persons, families, sources, events, places, selectedPersonId } = get();
    const personsRecord: Record<string, Person> = {};
    persons.forEach((p) => {
      personsRecord[p.id] = p;
    });

    return {
      metadata: {
        title: 'Родовід',
        description: 'Єдина база даних родоводу',
        lastModified: new Date().toISOString(),
        author: 'Дослідник'
      },
      rootPersonId: findRootPersonId(persons, selectedPersonId || undefined),
      persons: personsRecord,
      families,
      sources,
      events,
      places,
      lastModified: new Date().toISOString()
    };
  },

  loadGenealogyDatabase: (rawDb: GenealogyDatabase, meta?: { fileName?: string }) =>
    set((state) => {
      const db = cleanDatabaseFromUnknownPersons(rawDb);
      const rawIncoming = db.persons ? Object.values(db.persons).map(normalizePerson) : [];
      const seen = new Set<string>();
      const incomingPersons: Person[] = [];
      for (const p of rawIncoming) {
        if (p && p.id && !seen.has(p.id)) {
          seen.add(p.id);
          incomingPersons.push(p);
        }
      }
      const incomingFamilies = db.families || {};
      const incomingSources = db.sources || {};
      const incomingEvents = db.events || {};
      const incomingPlaces = db.places || {};

      const newSession: ImportHistorySession = {
        id: `import_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        fileName: meta?.fileName || 'Повна заміна бази (GEDCOM / JSON)',
        importType: 'replace',
        totalIncomingCount: incomingPersons.length,
        matchedCount: 0,
        newPersonsCount: incomingPersons.length,
        conflictsResolvedCount: 0,
        familiesMergedCount: 0,
        familiesAddedCount: Object.keys(incomingFamilies).length,
        resolvedPersonsWithConflicts: []
      };
      const updatedHistory = [newSession, ...(state.importHistory || [])].slice(0, 50);

      // Any persons that previously existed but are not in incoming replacement must be tombstoned and deleted from Firestore
      const incomingIds = new Set(incomingPersons.map((p) => p.id));
      const deletedPreviousPersons = state.persons.filter((p) => !incomingIds.has(p.id));
      if (deletedPreviousPersons.length > 0) {
        const delIds = deletedPreviousPersons.map((p) => p.id);
        addTombstoneIds(delIds);
        delIds.forEach((id) => useCloudSyncStore.getState().markDeleted('persons', id));
      }

      persistLocalData(`${STORAGE_KEY}_persons`, incomingPersons);
      persistLocalData(`${STORAGE_KEY}_families`, incomingFamilies);
      persistLocalData(`${STORAGE_KEY}_sources`, incomingSources);
      persistLocalData(`${STORAGE_KEY}_events`, incomingEvents);
      persistLocalData(`${STORAGE_KEY}_places`, incomingPlaces);
      persistLocalData(`${STORAGE_KEY}_importHistory`, updatedHistory);

      // Synchronize to Firestore docs only if in auto mode; in manual mode marks unsaved changes for manual push
      notifySyncChange(() => {
        batchSaveEntities('persons', incomingPersons).catch(() => {});
        batchSaveEntities('families', Object.values(incomingFamilies)).catch(() => {});
        if (Object.keys(incomingSources).length > 0) {
          batchSaveEntities('sources', Object.values(incomingSources)).catch(() => {});
        }
        if (Object.keys(incomingEvents).length > 0) {
          batchSaveEntities('events', Object.values(incomingEvents)).catch(() => {});
        }
        if (Object.keys(incomingPlaces).length > 0) {
          batchSaveEntities('places', Object.values(incomingPlaces)).catch(() => {});
        }
      });

      invalidateAllTreeCaches();
      return {
        persons: incomingPersons,
        families: incomingFamilies,
        sources: incomingSources,
        events: incomingEvents,
        places: incomingPlaces,
        importHistory: updatedHistory,
        selectedPersonId: db.rootPersonId || incomingPersons[0]?.id || null
      };
    }),

  mergeGenealogyDatabase: (db: GenealogyDatabase, precalculatedResult?: MergeResult, meta?: { fileName?: string }): MergeResult => {
    const currentDb = get().getGenealogyDatabase();
    const result = precalculatedResult || executeMerge(currentDb, db);
    const mergedPersons = Object.values(result.database.persons || {}).map(normalizePerson);
    const mergedFamilies = result.database.families || {};
    const mergedSources = result.database.sources || {};
    const mergedEvents = result.database.events || {};
    const mergedPlaces = result.database.places || {};

    // CRITICAL: Any persons from currentDb that are missing in mergedPersons or explicitly excluded (ancestors of excluded branches)
    // MUST be permanently tombstoned and deleted from Firestore docs so they NEVER resurrect!
    const excludedIds = new Set<string>(result.excludedAncestorIds || []);
    Object.keys(currentDb.persons || {}).forEach((existingId) => {
      if (!result.database.persons?.[existingId]) {
        excludedIds.add(existingId);
      }
    });

    if (excludedIds.size > 0) {
      const excludedList = Array.from(excludedIds);
      addTombstoneIds(excludedList);
      excludedList.forEach((id) => {

        notifySyncDelete('persons', id);
      });
    }

    const newSession: ImportHistorySession = {
      id: `import_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      fileName: meta?.fileName || 'Об\'єднання GEDCOM / JSON',
      importType: 'merge',
      totalIncomingCount: Object.keys(db.persons || {}).length,
      matchedCount: result.matchedCount,
      newPersonsCount: result.newPersonsCount,
      conflictsResolvedCount: result.conflictsResolvedCount,
      familiesMergedCount: result.familiesMergedCount,
      familiesAddedCount: result.familiesAddedCount,
      resolvedPersonsWithConflicts: result.resolvedPersonsWithConflicts || []
    };

    const updatedHistory = [newSession, ...(get().importHistory || [])].slice(0, 50);

    persistLocalData(`${STORAGE_KEY}_persons`, mergedPersons);
    persistLocalData(`${STORAGE_KEY}_families`, mergedFamilies);
    persistLocalData(`${STORAGE_KEY}_sources`, mergedSources);
    persistLocalData(`${STORAGE_KEY}_events`, mergedEvents);
    persistLocalData(`${STORAGE_KEY}_places`, mergedPlaces);
    persistLocalData(`${STORAGE_KEY}_importHistory`, updatedHistory);

    // Synchronize merged/new persons and families to Firestore docs only if in auto mode; in manual mode marks unsaved changes
    notifySyncChange(() => {
      batchSaveEntities('persons', mergedPersons).catch(() => {});
      batchSaveEntities('families', Object.values(mergedFamilies)).catch(() => {});
      if (Object.keys(mergedSources).length > 0) {
        batchSaveEntities('sources', Object.values(mergedSources)).catch(() => {});
      }
      if (Object.keys(mergedEvents).length > 0) {
        batchSaveEntities('events', Object.values(mergedEvents)).catch(() => {});
      }
      if (Object.keys(mergedPlaces).length > 0) {
        batchSaveEntities('places', Object.values(mergedPlaces)).catch(() => {});
      }
    });

    invalidateAllTreeCaches();
    set({
      persons: mergedPersons,
      families: mergedFamilies,
      sources: mergedSources,
      events: mergedEvents,
      places: mergedPlaces,
      importHistory: updatedHistory,
      selectedPersonId: result.database.rootPersonId || mergedPersons[0]?.id || null
    });

    return result;
  },

  importHistory: (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_importHistory`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  })(),

  addImportHistorySession: (session: ImportHistorySession) =>
    set((state) => {
      const updated = [session, ...(state.importHistory || [])].slice(0, 50);
      persistLocalData(`${STORAGE_KEY}_importHistory`, updated);
      return { importHistory: updated };
    }),

  clearImportHistory: () =>
    set(() => {
      persistLocalData(`${STORAGE_KEY}_importHistory`, []);
      return { importHistory: [] };
    }),

  setGitConfig: (gitConfig) => {
    try {
      persistLocalData(`${STORAGE_KEY}_gitConfig`, gitConfig);
    } catch {}
    set({ gitConfig });
  },

  setGoogleDriveEmail: (googleDriveEmail) => set({ googleDriveEmail }),

  exportGedcomData: () => {
    flushPendingLocalWrites().catch(() => {});
    const { persons } = get();
    let ged = '0 HEAD\n1 SOUR RODOVID_APP\n1 GEDC\n2 VERS 5.5.1\n1 CHAR UTF-8\n';
    persons.forEach((p) => {
      ged += `0 @${p.id}@ INDI\n`;
      ged += `1 NAME ${p.firstName || ''} /${p.lastName || ''}/\n`;
      ged += `1 SEX ${p.gender === 'female' || p.gender === 'F' ? 'F' : 'M'}\n`;
      if (p.birthDate || p.birthPlace) {
        ged += '1 BIRT\n';
        if (p.birthDate) ged += `2 DATE ${p.birthDate}\n`;
        if (p.birthPlace) ged += `2 PLAC ${p.birthPlace}\n`;
      }
      if (p.deathDate || p.deathPlace) {
        ged += '1 DEAT\n';
        if (p.deathDate) ged += `2 DATE ${p.deathDate}\n`;
        if (p.deathPlace) ged += `2 PLAC ${p.deathPlace}\n`;
      }
      if (p.notes) ged += `1 NOTE ${p.notes}\n`;
    });
    ged += '0 TRLR\n';
    const blob = new Blob([ged], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `genealogy_tree_${Date.now()}.ged`;
    a.click();
    URL.revokeObjectURL(url);
  },

  purgeDemoDataFromTree: () =>
    set((state) => {
      const cleanPersons = state.persons.filter((p) => !isDemoPerson(p));
      const cleanFamilies: Record<string, Family> = {};
      for (const [k, v] of Object.entries(state.families)) {
        if (!isDemoFamily(k, v)) {
          cleanFamilies[k] = v;
        }
      }
      const cleanSources: Record<string, Source> = {};
      for (const [k, v] of Object.entries(state.sources)) {
        if (!isDemoSource(k, v)) {
          cleanSources[k] = v;
        }
      }
      const cleanEvents: Record<string, LifeEvent> = {};
      for (const [k, v] of Object.entries(state.events)) {
        if (!isDemoEvent(k, v)) {
          cleanEvents[k] = v;
        }
      }
      persistLocalData(`${STORAGE_KEY}_persons`, cleanPersons);
      persistLocalData(`${STORAGE_KEY}_families`, cleanFamilies);
      persistLocalData(`${STORAGE_KEY}_sources`, cleanSources);
      persistLocalData(`${STORAGE_KEY}_events`, cleanEvents);
      return {
        persons: cleanPersons,
        families: cleanFamilies,
        sources: cleanSources,
        events: cleanEvents
      };
    }),

  purgeUnknownPersons: () => {
    const state = get();
    const { cleanedPersons, cleanedFamilies, deletedIds } = purgeUnknownPlaceholderPersons(state.persons, state.families);
    if (deletedIds.length > 0) {
      addTombstoneIds(deletedIds);
      deletedIds.forEach((id) => {

        notifySyncDelete('persons', id);
      });
      persistLocalData(`${STORAGE_KEY}_persons`, cleanedPersons);
      persistLocalData(`${STORAGE_KEY}_families`, cleanedFamilies);
      set({ persons: cleanedPersons, families: cleanedFamilies });
    }
    return { deletedCount: deletedIds.length, deletedIds };
  },

  hydrateFromIndexedDB: async () => {
    try {
      await hydratePersonDeletionState();
      await hydrateIgnoredDuplicateState();
      await hydrateMergedPersonState();
      if (Object.keys(getPendingMergedPersonChanges()).length > 0) {
        useCloudSyncStore.getState().markProjectUploadPending();
        useCloudSyncStore.getState().setStatus('pending');
      }
      const lastMergeSnapshotId = await idbGet<string>(`${STORAGE_KEY}_lastPersonMergeSnapshotId`);
      if (lastMergeSnapshotId) set({ lastPersonMergeSnapshotId: lastMergeSnapshotId });
      if (Object.keys(getPendingIgnoredDuplicateChanges()).length > 0) {
        useCloudSyncStore.getState().markProjectUploadPending();
        useCloudSyncStore.getState().setStatus('pending');
      }
      if (Object.keys(getPendingDeletionChanges()).length > 0) {
        useCloudSyncStore.getState().markProjectUploadPending();
        useCloudSyncStore.getState().setStatus('pending');
      }
      const [
        idbPersons,
        idbFamilies,
        idbSources,
        idbEvents,
        idbPlaces,
        idbTrash,
        idbHistory,
        idbSelected,
        idbFamilyLinks
      ] = await Promise.all([
        idbGet<Person[]>(`${STORAGE_KEY}_persons`),
        idbGet<Record<string, Family>>(`${STORAGE_KEY}_families`),
        idbGet<Record<string, Source>>(`${STORAGE_KEY}_sources`),
        idbGet<Record<string, LifeEvent>>(`${STORAGE_KEY}_events`),
        idbGet<Record<string, PlaceDossier>>(`${STORAGE_KEY}_places`),
        idbGet<Person[]>(`${STORAGE_KEY}_trashPersons`),
        idbGet<ImportHistorySession[]>(`${STORAGE_KEY}_importHistory`),
        idbGet<string>(`${STORAGE_KEY}_selectedPersonId`),
        idbGet<FamilyRestoreHistory>(FAMILY_RESTORE_STORAGE_KEY)
      ]);

      const updates: Partial<GenealogyDataState> = {};
      const tombstones = getTombstoneIds();

      if (Array.isArray(idbPersons)) {
        const cleaned = idbPersons
          .filter((p) => p && p.id && !tombstones.has(p.id) && !isDemoPerson(p))
          .map(normalizePerson);
        updates.persons = cleaned;
      }
      if (idbFamilies && typeof idbFamilies === 'object' && Object.keys(idbFamilies).length > 0) {
        updates.families = idbFamilies;
      }
      if (idbSources && typeof idbSources === 'object' && Object.keys(idbSources).length > 0) {
        updates.sources = idbSources;
      }
      if (idbEvents && typeof idbEvents === 'object' && Object.keys(idbEvents).length > 0) {
        updates.events = idbEvents;
      }
      if (idbPlaces && typeof idbPlaces === 'object' && Object.keys(idbPlaces).length > 0) {
        updates.places = idbPlaces;
      }
      if (idbFamilyLinks && typeof idbFamilyLinks === 'object' && !Array.isArray(idbFamilyLinks)) updates.deletedFamilyLinks = idbFamilyLinks;
      if (Array.isArray(idbTrash)) {
        updates.trashPersons = idbTrash;
      }
      if (Array.isArray(idbHistory)) {
        updates.importHistory = idbHistory;
      }
      if (idbSelected && typeof idbSelected === 'string') {
        updates.selectedPersonId = idbSelected;
      }

      if (Object.keys(updates).length > 0) {
        set(updates);
      }
    } catch {}
  }
}));
