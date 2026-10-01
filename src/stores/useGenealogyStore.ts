import { create } from 'zustand';
import { Person, Family, Source, LifeEvent, GenealogyDatabase, GitConfig, PlaceDossier } from '../types';
import { FAMILIO_PERSONS, FAMILIO_FAMILIES, FAMILIO_SOURCES, FAMILIO_EVENTS } from '../data/familioData';
import { savePersonDoc, deletePersonDoc, saveFamilyDoc, deleteFamilyDoc, saveSourceDoc, deleteSourceDoc, saveEventDoc, deleteEventDoc, savePlaceDoc, deletePlaceDoc } from '../lib/firebase';
import { useCloudSyncStore } from './useCloudSyncStore';
import { findRootPersonId } from '../rodovid/utils/relationship';
import { resolveInitialPersonId, saveUserTreeState } from '../utils/userTreeState';
import { isUserWhitelisted } from '../rodovid/utils/privacy';
import { useAuthStore } from './useAuthStore';
import { isDemoPerson, isDemoFamily, isDemoSource, isDemoEvent } from '../utils/demoPurge';
import { executeMerge, MergeResult, ImportHistorySession, ResolvedPersonConflictRecord } from '../rodovid/utils/mergeDatabase';

function notifySyncChange(action?: () => void) {
  try {
    const syncStore = useCloudSyncStore.getState();
    syncStore.markUnsavedChange();
    if (syncStore.syncMode === 'auto' && action) {
      action();
    }
  } catch {}
}

const STORAGE_KEY = 'genealogy_workstation_data_v4_familio';
export const TOMBSTONE_STORAGE_KEY = 'genealogy_deleted_tombstone_ids_v1';

export function getTombstoneIds(): Set<string> {
  try {
    const raw = localStorage.getItem(TOMBSTONE_STORAGE_KEY);
    const set = new Set<string>(raw ? JSON.parse(raw) : []);
    const trashRaw = localStorage.getItem(`${STORAGE_KEY}_trashPersons`);
    if (trashRaw) {
      const trashList = JSON.parse(trashRaw);
      if (Array.isArray(trashList)) {
        trashList.forEach((t: any) => {
          if (t && t.id) set.add(t.id);
        });
      }
    }
    return set;
  } catch {
    return new Set();
  }
}

export function addTombstoneIds(ids: string[]): void {
  try {
    const current = getTombstoneIds();
    ids.forEach((id) => current.add(id));
    localStorage.setItem(TOMBSTONE_STORAGE_KEY, JSON.stringify(Array.from(current)));
  } catch {}
}

export function removeTombstoneId(id: string): void {
  try {
    const current = getTombstoneIds();
    current.delete(id);
    localStorage.setItem(TOMBSTONE_STORAGE_KEY, JSON.stringify(Array.from(current)));
  } catch {}
}

export const INITIAL_PERSONS: Person[] = FAMILIO_PERSONS.filter((p) => !isDemoPerson(p));
export const INITIAL_FAMILIES: Record<string, Family> = Object.fromEntries(
  Object.entries(FAMILIO_FAMILIES).filter(([k, v]) => !isDemoFamily(k, v))
);
export const INITIAL_SOURCES: Record<string, Source> = Object.fromEntries(
  Object.entries(FAMILIO_SOURCES).filter(([k, v]) => !isDemoSource(k, v))
);
export const INITIAL_EVENTS: Record<string, LifeEvent> = Object.fromEntries(
  Object.entries(FAMILIO_EVENTS).filter(([k, v]) => !isDemoEvent(k, v))
);

export const normalizePerson = (p: Person): Person => {
  const given = p.name?.given || p.firstName || '';
  const surname = p.name?.surname || p.lastName || '';
  const patronymic = p.name?.patronymic || p.patronymic;
  const maidenName = p.name?.maidenName || p.maidenName;
  const prefix = p.name?.prefix || p.prefix;
  const avatar = p.avatarUrl || p.avatar || p.photoUrl;
  const estate = p.estateOrSocialStatus || p.estate || p.socialStatus;

  const rawBirth = p.birthDate !== undefined && p.birthDate !== null ? String(p.birthDate).trim() : undefined;
  const rawDeath = p.deathDate !== undefined && p.deathDate !== null ? String(p.deathDate).trim() : undefined;

  let deathYear = p.deathYear === null || p.deathYear === undefined ? undefined : Number(p.deathYear);
  let deathDate = rawDeath;

  // Clean phantom death year for persons where the user did not enter a death date
  // (e.g. Maria Nadtochey's phantom 1962 from earlier tests)
  const isNadtochey =
    surname.toLowerCase().includes('надточей') ||
    given.toLowerCase().includes('надточей') ||
    (p.lastName || '').toLowerCase().includes('надточей');

  if (isNadtochey && deathYear === 1962 && (!deathDate || deathDate === '1962')) {
    deathYear = undefined;
    deathDate = undefined;
  }

  if (p.isLiving) {
    deathYear = undefined;
    deathDate = undefined;
  }

  if (!p.isLiving && deathYear === undefined && deathDate) {
    const deathYearMatch = deathDate.match(/\b(1\d{3}|20\d{2})\b/);
    if (deathYearMatch) deathYear = parseInt(deathYearMatch[1], 10);
  }

  // Ensure birthDate is never empty if birthYear exists, and birthYear is extracted from birthDate
  const birthDate = rawBirth || (p.birthYear ? String(p.birthYear) : undefined);
  const birthYearMatch = birthDate ? birthDate.match(/\b(1\d{3}|20\d{2})\b/) : null;
  const birthYear = p.birthYear !== undefined && p.birthYear !== null ? Number(p.birthYear) : (birthYearMatch ? parseInt(birthYearMatch[1], 10) : undefined);

  return {
    ...p,
    firstName: given,
    lastName: surname,
    patronymic,
    maidenName,
    prefix,
    name: {
      given,
      surname,
      patronymic,
      maidenName,
      prefix
    },
    birthYear,
    birthDate,
    deathYear,
    deathDate,
    gender: p.gender === 'female' || p.gender === 'F' ? 'female' : 'male',
    avatar,
    avatarUrl: avatar,
    photoUrl: avatar,
    estate,
    socialStatus: estate,
    estateOrSocialStatus: estate
  };
};

export interface GenealogyDataState {
  persons: Person[];
  families: Record<string, Family>;
  sources: Record<string, Source>;
  events: Record<string, LifeEvent>;
  places: Record<string, PlaceDossier>;
  trashPersons: Person[];
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
  restorePerson: (id: string) => void;
  restorePersons: (ids: string[]) => void;
  permanentlyDeletePerson: (id: string) => void;
  permanentlyDeletePersons: (ids: string[]) => void;
  emptyTrash: () => void;
  getPersonById: (id: string) => Person | undefined;
  mergePersons: (payload: {
    updatedPersons: Person[];
    updatedFamilies: Record<string, Family>;
    masterPerson?: Person;
    deletedPersonIds: string[];
  }) => void;

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
            try {
              localStorage.setItem(`${STORAGE_KEY}_persons`, JSON.stringify(deduplicated));
            } catch {}
            return deduplicated;
          }
        }
      }
      return INITIAL_PERSONS.map(normalizePerson);
    } catch {
      return INITIAL_PERSONS.map(normalizePerson);
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
      try {
        localStorage.setItem(`${STORAGE_KEY}_persons`, JSON.stringify(deduplicated));
      } catch {}

      return { persons: deduplicated };
    }),

  setSelectedPersonId: (selectedPersonId) => {
    try {
      const { currentUser, whitelist } = useAuthStore.getState();
      const isAuth = isUserWhitelisted(currentUser, whitelist);

      if (isAuth && currentUser?.email && selectedPersonId) {
        // Persist to the authorized user's state
        saveUserTreeState(currentUser.email, { selectedPersonId });
      }

      // Persist to localStorage so the focused person is preserved across reloads
      if (selectedPersonId) {
        localStorage.setItem(`${STORAGE_KEY}_selectedPersonId`, selectedPersonId);
      }
    } catch {}
    set({ selectedPersonId });
  },

  addPerson: (person) =>
    set((state) => {
      const normalized = normalizePerson(person);
      const exists = state.persons.some((p) => p.id === normalized.id);
      const next = exists
        ? state.persons.map((p) => (p.id === normalized.id ? normalized : p))
        : [...state.persons, normalized];
      try {
        localStorage.setItem(`${STORAGE_KEY}_persons`, JSON.stringify(next));
      } catch {}
      notifySyncChange(() => savePersonDoc(normalized));
      return { persons: next };
    }),

  updatePerson: (person) =>
    set((state) => {
      const normalized = normalizePerson(person);
      const next = state.persons.map((p) => (p.id === person.id ? normalized : p));
      try {
        localStorage.setItem(`${STORAGE_KEY}_persons`, JSON.stringify(next));
      } catch {}
      notifySyncChange(() => savePersonDoc(normalized));
      return { persons: next };
    }),

  updatePersons: (updatedPersons) =>
    set((state) => {
      const normalizedMap = new Map<string, Person>();
      updatedPersons.forEach((p) => {
        const norm = normalizePerson(p);
        normalizedMap.set(norm.id, norm);
      });
      notifySyncChange(() => {
        updatedPersons.forEach((p) => savePersonDoc(normalizePerson(p)));
      });
      const next = state.persons.map((p) => normalizedMap.get(p.id) || p);
      try {
        localStorage.setItem(`${STORAGE_KEY}_persons`, JSON.stringify(next));
      } catch {}
      return { persons: next };
    }),

  deletePerson: (id) =>
    set((state) => {
      addTombstoneIds([id]);
      const target = state.persons.find((p) => p.id === id);
      const nextTrash = target
        ? [...state.trashPersons, { ...target, isDeleted: true, deletedAt: new Date().toISOString() }]
        : state.trashPersons;
      const nextPersons = state.persons.filter((p) => p.id !== id);

      // Clean up family references
      const nextFamilies: Record<string, Family> = {};
      Object.entries(state.families).forEach(([fId, fam]) => {
        nextFamilies[fId] = {
          ...fam,
          husbandId: fam.husbandId === id ? undefined : fam.husbandId,
          wifeId: fam.wifeId === id ? undefined : fam.wifeId,
          children: (fam.children || []).filter((c) => c.personId !== id),
          childrenIds: (fam.childrenIds || []).filter((cId) => cId !== id)
        };
      });

      try {
        localStorage.setItem(`${STORAGE_KEY}_persons`, JSON.stringify(nextPersons));
        localStorage.setItem(`${STORAGE_KEY}_trashPersons`, JSON.stringify(nextTrash));
        localStorage.setItem(`${STORAGE_KEY}_families`, JSON.stringify(nextFamilies));
      } catch {}
      notifySyncChange(() => deletePersonDoc(id));

      return { persons: nextPersons, trashPersons: nextTrash, families: nextFamilies };
    }),

  deletePersons: (ids) =>
    set((state) => {
      addTombstoneIds(ids);
      const targets = state.persons.filter((p) => ids.includes(p.id));
      const nextTrash = [
        ...state.trashPersons,
        ...targets.map((t) => ({ ...t, isDeleted: true, deletedAt: new Date().toISOString() }))
      ];
      const nextPersons = state.persons.filter((p) => !ids.includes(p.id));

      try {
        localStorage.setItem(`${STORAGE_KEY}_persons`, JSON.stringify(nextPersons));
        localStorage.setItem(`${STORAGE_KEY}_trashPersons`, JSON.stringify(nextTrash));
      } catch {}
      notifySyncChange(() => ids.forEach((id) => deletePersonDoc(id)));

      return { persons: nextPersons, trashPersons: nextTrash };
    }),

  restorePerson: (id) =>
    set((state) => {
      removeTombstoneId(id);
      const target = state.trashPersons.find((p) => p.id === id);
      if (!target) return state;

      const restored: Person = {
        ...target,
        isDeleted: false,
        deletedAt: undefined
      };
      const nextTrash = state.trashPersons.filter((p) => p.id !== id);
      const normalizedRestored = normalizePerson(restored);
      const nextPersons = [...state.persons, normalizedRestored];

      try {
        localStorage.setItem(`${STORAGE_KEY}_persons`, JSON.stringify(nextPersons));
        localStorage.setItem(`${STORAGE_KEY}_trashPersons`, JSON.stringify(nextTrash));
      } catch {}
      notifySyncChange(() => savePersonDoc(normalizedRestored));

      return { persons: nextPersons, trashPersons: nextTrash };
    }),

  restorePersons: (ids) =>
    set((state) => {
      const targets = state.trashPersons.filter((p) => ids.includes(p.id));
      if (targets.length === 0) return state;

      const restored = targets.map((t) =>
        normalizePerson({ ...t, isDeleted: false, deletedAt: undefined })
      );
      const nextTrash = state.trashPersons.filter((p) => !ids.includes(p.id));
      const nextPersons = [...state.persons, ...restored];

      try {
        localStorage.setItem(`${STORAGE_KEY}_persons`, JSON.stringify(nextPersons));
        localStorage.setItem(`${STORAGE_KEY}_trashPersons`, JSON.stringify(nextTrash));
      } catch {}
      notifySyncChange(() => restored.forEach((r) => savePersonDoc(r)));

      return { persons: nextPersons, trashPersons: nextTrash };
    }),

  permanentlyDeletePerson: (id) =>
    set((state) => {
      const nextTrash = state.trashPersons.filter((p) => p.id !== id);
      try {
        localStorage.setItem(`${STORAGE_KEY}_trashPersons`, JSON.stringify(nextTrash));
      } catch {}
      notifySyncChange(() => deletePersonDoc(id));
      return { trashPersons: nextTrash };
    }),

  permanentlyDeletePersons: (ids) =>
    set((state) => {
      const nextTrash = state.trashPersons.filter((p) => !ids.includes(p.id));
      try {
        localStorage.setItem(`${STORAGE_KEY}_trashPersons`, JSON.stringify(nextTrash));
      } catch {}
      notifySyncChange(() => ids.forEach((id) => deletePersonDoc(id)));
      return { trashPersons: nextTrash };
    }),

  emptyTrash: () =>
    set((state) => {
      const ids = state.trashPersons.map((p) => p.id);
      try {
        localStorage.setItem(`${STORAGE_KEY}_trashPersons`, JSON.stringify([]));
      } catch {}
      notifySyncChange(() => ids.forEach((id) => deletePersonDoc(id)));
      return { trashPersons: [] };
    }),

  getPersonById: (id) => get().persons.find((p) => p.id === id),

  mergePersons: (payload) =>
    set((state) => {
      const deletedIds = payload.deletedPersonIds || [];
      const deletedSet = new Set(deletedIds);

      // Filter deleted from updated persons
      const nextPersons = payload.updatedPersons
        .filter((p) => p && p.id && !deletedSet.has(p.id))
        .map(normalizePerson);

      const seen = new Set<string>();
      const deduplicated: Person[] = [];
      for (const p of nextPersons) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          deduplicated.push(p);
        }
      }

      // Add deleted targets to trash
      const targets = state.persons.filter((p) => deletedSet.has(p.id));
      const masterName = payload.masterPerson?.name?.given || payload.masterPerson?.id || 'основним профілем';
      const newTrashItems = targets.map((t) => ({
        ...t,
        isDeleted: true,
        deletedAt: new Date().toISOString(),
        notes: (t.notes ? t.notes + ' • ' : '') + `Об'єднано з ${masterName}`
      }));
      const nextTrash = [...state.trashPersons, ...newTrashItems];

      // Record in genealogy_merged_person_ids
      try {
        let mergedMap: Record<string, string> = {};
        const raw = localStorage.getItem('genealogy_merged_person_ids');
        if (raw) mergedMap = JSON.parse(raw);
        deletedIds.forEach((id) => {
          mergedMap[id] = payload.masterPerson?.id || 'merged';
        });
        localStorage.setItem('genealogy_merged_person_ids', JSON.stringify(mergedMap));
      } catch {}

      try {
        localStorage.setItem(`${STORAGE_KEY}_persons`, JSON.stringify(deduplicated));
        localStorage.setItem(`${STORAGE_KEY}_trashPersons`, JSON.stringify(nextTrash));
        localStorage.setItem(`${STORAGE_KEY}_families`, JSON.stringify(payload.updatedFamilies));
      } catch {}

      // Fire synchronization: delete all duplicate docs from Firestore and save master & updated docs
      notifySyncChange(() => {
        deletedIds.forEach((id) => deletePersonDoc(id));
        if (payload.masterPerson) {
          savePersonDoc(normalizePerson(payload.masterPerson));
        }
        // Save updated persons
        deduplicated.forEach((p) => {
          const prev = state.persons.find((op) => op.id === p.id);
          if (!prev || JSON.stringify(prev) !== JSON.stringify(p)) {
            savePersonDoc(p);
          }
        });
        // Save updated families
        Object.values(payload.updatedFamilies).forEach((f) => {
          const prev = state.families[f.id];
          if (!prev || JSON.stringify(prev) !== JSON.stringify(f)) {
            saveFamilyDoc(f);
          }
        });
      });

      return {
        persons: deduplicated,
        trashPersons: nextTrash,
        families: payload.updatedFamilies,
        selectedPersonId: payload.masterPerson?.id || state.selectedPersonId
      };
    }),

  // Families
  setFamilies: (updater) =>
    set((state) => {
      const nextFamilies = typeof updater === 'function' ? updater(state.families) : updater;
      try {
        localStorage.setItem(`${STORAGE_KEY}_families`, JSON.stringify(nextFamilies));
      } catch {}

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
          notifySyncChange(() => savePersonDoc(normalizePerson(updated)));
        }
        return updated;
      });

      try {
        localStorage.setItem(`${STORAGE_KEY}_families`, JSON.stringify(nextFamilies));
        localStorage.setItem(`${STORAGE_KEY}_persons`, JSON.stringify(nextPersons));
      } catch {}
      notifySyncChange(() => saveFamilyDoc(family));

      return { families: nextFamilies, persons: nextPersons };
    }),

  deleteFamily: (id) =>
    set((state) => {
      const nextFamilies = { ...state.families };
      delete nextFamilies[id];
      try {
        localStorage.setItem(`${STORAGE_KEY}_families`, JSON.stringify(nextFamilies));
      } catch {}
      notifySyncChange(() => deleteFamilyDoc(id));
      return { families: nextFamilies };
    }),

  // Sources
  setSources: (updater) =>
    set((state) => {
      const nextSources = typeof updater === 'function' ? updater(state.sources) : updater;
      try {
        localStorage.setItem(`${STORAGE_KEY}_sources`, JSON.stringify(nextSources));
      } catch {}
      return { sources: nextSources };
    }),

  saveSource: (source) =>
    set((state) => {
      const nextSources = { ...state.sources, [source.id]: source };
      try {
        localStorage.setItem(`${STORAGE_KEY}_sources`, JSON.stringify(nextSources));
      } catch {}
      notifySyncChange(() => saveSourceDoc(source));
      return { sources: nextSources };
    }),

  deleteSource: (id) =>
    set((state) => {
      const nextSources = { ...state.sources };
      delete nextSources[id];
      try {
        localStorage.setItem(`${STORAGE_KEY}_sources`, JSON.stringify(nextSources));
      } catch {}
      notifySyncChange(() => deleteSourceDoc(id));
      return { sources: nextSources };
    }),

  // Events
  setEvents: (updater) =>
    set((state) => {
      const nextEvents = typeof updater === 'function' ? updater(state.events) : updater;
      try {
        localStorage.setItem(`${STORAGE_KEY}_events`, JSON.stringify(nextEvents));
      } catch {}
      return { events: nextEvents };
    }),

  saveEvent: (event) =>
    set((state) => {
      const nextEvents = { ...state.events, [event.id]: event };
      try {
        localStorage.setItem(`${STORAGE_KEY}_events`, JSON.stringify(nextEvents));
      } catch {}
      notifySyncChange(() => saveEventDoc(event));
      return { events: nextEvents };
    }),

  deleteEvent: (id) =>
    set((state) => {
      const nextEvents = { ...state.events };
      delete nextEvents[id];
      try {
        localStorage.setItem(`${STORAGE_KEY}_events`, JSON.stringify(nextEvents));
      } catch {}
      notifySyncChange(() => deleteEventDoc(id));
      return { events: nextEvents };
    }),

  setPlaces: (updater) =>
    set((state) => {
      const nextPlaces = typeof updater === 'function' ? updater(state.places) : updater;
      try {
        localStorage.setItem(`${STORAGE_KEY}_places`, JSON.stringify(nextPlaces));
      } catch {}
      return { places: nextPlaces };
    }),

  savePlace: (place) =>
    set((state) => {
      const key = place.id || place.placeName.trim();
      const updatedPlace = { ...place, id: key, updatedAt: new Date().toISOString() };
      const nextPlaces = { ...state.places, [key]: updatedPlace };
      try {
        localStorage.setItem(`${STORAGE_KEY}_places`, JSON.stringify(nextPlaces));
      } catch {}
      notifySyncChange(() => savePlaceDoc(updatedPlace));
      return { places: nextPlaces };
    }),

  deletePlace: (idOrName) =>
    set((state) => {
      const nextPlaces = { ...state.places };
      delete nextPlaces[idOrName];
      try {
        localStorage.setItem(`${STORAGE_KEY}_places`, JSON.stringify(nextPlaces));
      } catch {}
      notifySyncChange(() => deletePlaceDoc(idOrName));
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

  loadGenealogyDatabase: (db: GenealogyDatabase, meta?: { fileName?: string }) =>
    set((state) => {
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

      try {
        localStorage.setItem(`${STORAGE_KEY}_persons`, JSON.stringify(incomingPersons));
        localStorage.setItem(`${STORAGE_KEY}_families`, JSON.stringify(incomingFamilies));
        localStorage.setItem(`${STORAGE_KEY}_sources`, JSON.stringify(incomingSources));
        localStorage.setItem(`${STORAGE_KEY}_events`, JSON.stringify(incomingEvents));
        localStorage.setItem(`${STORAGE_KEY}_places`, JSON.stringify(incomingPlaces));
        localStorage.setItem(`${STORAGE_KEY}_importHistory`, JSON.stringify(updatedHistory));
      } catch {}

      // Synchronize to Firestore docs only if in auto mode; in manual mode marks unsaved changes for manual push
      notifySyncChange(() => {
        incomingPersons.forEach((p) => savePersonDoc(p));
        Object.values(incomingFamilies).forEach((f) => saveFamilyDoc(f));
      });

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

    try {
      localStorage.setItem(`${STORAGE_KEY}_persons`, JSON.stringify(mergedPersons));
      localStorage.setItem(`${STORAGE_KEY}_families`, JSON.stringify(mergedFamilies));
      localStorage.setItem(`${STORAGE_KEY}_sources`, JSON.stringify(mergedSources));
      localStorage.setItem(`${STORAGE_KEY}_events`, JSON.stringify(mergedEvents));
      localStorage.setItem(`${STORAGE_KEY}_places`, JSON.stringify(mergedPlaces));
      localStorage.setItem(`${STORAGE_KEY}_importHistory`, JSON.stringify(updatedHistory));
    } catch {}

    // Synchronize merged/new persons and families to Firestore docs only if in auto mode; in manual mode marks unsaved changes
    notifySyncChange(() => {
      mergedPersons.forEach((p) => savePersonDoc(p));
      Object.values(mergedFamilies).forEach((f) => saveFamilyDoc(f));
    });

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
      try {
        localStorage.setItem(`${STORAGE_KEY}_importHistory`, JSON.stringify(updated));
      } catch {}
      return { importHistory: updated };
    }),

  clearImportHistory: () =>
    set(() => {
      try {
        localStorage.removeItem(`${STORAGE_KEY}_importHistory`);
      } catch {}
      return { importHistory: [] };
    }),

  setGitConfig: (gitConfig) => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_gitConfig`, JSON.stringify(gitConfig));
    } catch {}
    set({ gitConfig });
  },

  setGoogleDriveEmail: (googleDriveEmail) => set({ googleDriveEmail }),

  exportGedcomData: () => {
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
      try {
        localStorage.setItem(`${STORAGE_KEY}_persons`, JSON.stringify(cleanPersons));
        localStorage.setItem(`${STORAGE_KEY}_families`, JSON.stringify(cleanFamilies));
        localStorage.setItem(`${STORAGE_KEY}_sources`, JSON.stringify(cleanSources));
        localStorage.setItem(`${STORAGE_KEY}_events`, JSON.stringify(cleanEvents));
      } catch {}
      return {
        persons: cleanPersons,
        families: cleanFamilies,
        sources: cleanSources,
        events: cleanEvents
      };
    })
}));
