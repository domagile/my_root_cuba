import { create } from 'zustand';
import { Person, Family, Source, LifeEvent, GenealogyDatabase, GitConfig } from '../types';
import { FAMILIO_PERSONS, FAMILIO_FAMILIES, FAMILIO_SOURCES, FAMILIO_EVENTS } from '../data/familioData';
import { savePersonDoc, deletePersonDoc, saveFamilyDoc, deleteFamilyDoc, saveSourceDoc, deleteSourceDoc, saveEventDoc, deleteEventDoc } from '../lib/firebase';

const STORAGE_KEY = 'genealogy_workstation_data_v4_familio';

export const INITIAL_PERSONS: Person[] = FAMILIO_PERSONS;
export const INITIAL_FAMILIES: Record<string, Family> = FAMILIO_FAMILIES;
export const INITIAL_SOURCES: Record<string, Source> = FAMILIO_SOURCES;
export const INITIAL_EVENTS: Record<string, LifeEvent> = FAMILIO_EVENTS;

export const normalizePerson = (p: Person): Person => {
  const given = p.name?.given || p.firstName || '';
  const surname = p.name?.surname || p.lastName || '';
  const patronymic = p.name?.patronymic || p.patronymic;
  const maidenName = p.name?.maidenName || p.maidenName;
  const prefix = p.name?.prefix || p.prefix;
  const avatar = p.avatarUrl || p.avatar || p.photoUrl;
  const estate = p.estateOrSocialStatus || p.estate || p.socialStatus;

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
  trashPersons: Person[];
  selectedPersonId: string | null;
  gitConfig: GitConfig;
  googleDriveEmail: string;

  // Person Actions
  setPersons: (persons: Person[] | ((prev: Person[]) => Person[])) => void;
  setSelectedPersonId: (id: string | null) => void;
  addPerson: (person: Person) => void;
  updatePerson: (person: Person) => void;
  deletePerson: (id: string) => void;
  deletePersons: (ids: string[]) => void;
  restorePerson: (id: string) => void;
  restorePersons: (ids: string[]) => void;
  permanentlyDeletePerson: (id: string) => void;
  permanentlyDeletePersons: (ids: string[]) => void;
  emptyTrash: () => void;
  getPersonById: (id: string) => Person | undefined;

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

  // Whole Database & Integrations
  getGenealogyDatabase: () => GenealogyDatabase;
  loadGenealogyDatabase: (db: GenealogyDatabase) => void;
  setGitConfig: (config: GitConfig) => void;
  setGoogleDriveEmail: (email: string) => void;
  exportGedcomData: () => void;
  resetPersonsToSample: () => void;
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
          return parsed.map(normalizePerson);
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
          return parsed;
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
          return parsed;
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
          return parsed;
        }
      }
      return INITIAL_EVENTS;
    } catch {
      return INITIAL_EVENTS;
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
      const saved = localStorage.getItem(`${STORAGE_KEY}_selectedPersonId`);
      if (saved) return saved;
      const personsSaved = localStorage.getItem(`${STORAGE_KEY}_persons`);
      if (personsSaved) {
        const parsed = JSON.parse(personsSaved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed[0].id;
        }
      }
      return 'p_bom_olga';
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
      try {
        localStorage.setItem(`${STORAGE_KEY}_persons`, JSON.stringify(normalized));
      } catch {}
      return { persons: normalized };
    }),

  setSelectedPersonId: (selectedPersonId) => {
    try {
      if (selectedPersonId) {
        localStorage.setItem(`${STORAGE_KEY}_selectedPersonId`, selectedPersonId);
      } else {
        localStorage.removeItem(`${STORAGE_KEY}_selectedPersonId`);
      }
    } catch {}
    set({ selectedPersonId });
  },

  addPerson: (person) =>
    set((state) => {
      const normalized = normalizePerson(person);
      const next = [...state.persons, normalized];
      try {
        localStorage.setItem(`${STORAGE_KEY}_persons`, JSON.stringify(next));
      } catch {}
      savePersonDoc(normalized);
      return { persons: next };
    }),

  updatePerson: (person) =>
    set((state) => {
      const normalized = normalizePerson(person);
      const next = state.persons.map((p) => (p.id === person.id ? normalized : p));
      try {
        localStorage.setItem(`${STORAGE_KEY}_persons`, JSON.stringify(next));
      } catch {}
      savePersonDoc(normalized);
      return { persons: next };
    }),

  deletePerson: (id) =>
    set((state) => {
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
      deletePersonDoc(id);

      return { persons: nextPersons, trashPersons: nextTrash, families: nextFamilies };
    }),

  deletePersons: (ids) =>
    set((state) => {
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
      ids.forEach((id) => deletePersonDoc(id));

      return { persons: nextPersons, trashPersons: nextTrash };
    }),

  restorePerson: (id) =>
    set((state) => {
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
      savePersonDoc(normalizedRestored);

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
      restored.forEach((r) => savePersonDoc(r));

      return { persons: nextPersons, trashPersons: nextTrash };
    }),

  permanentlyDeletePerson: (id) =>
    set((state) => {
      const nextTrash = state.trashPersons.filter((p) => p.id !== id);
      try {
        localStorage.setItem(`${STORAGE_KEY}_trashPersons`, JSON.stringify(nextTrash));
      } catch {}
      deletePersonDoc(id);
      return { trashPersons: nextTrash };
    }),

  permanentlyDeletePersons: (ids) =>
    set((state) => {
      const nextTrash = state.trashPersons.filter((p) => !ids.includes(p.id));
      try {
        localStorage.setItem(`${STORAGE_KEY}_trashPersons`, JSON.stringify(nextTrash));
      } catch {}
      ids.forEach((id) => deletePersonDoc(id));
      return { trashPersons: nextTrash };
    }),

  emptyTrash: () =>
    set(() => {
      try {
        localStorage.setItem(`${STORAGE_KEY}_trashPersons`, JSON.stringify([]));
      } catch {}
      return { trashPersons: [] };
    }),

  getPersonById: (id) => get().persons.find((p) => p.id === id),

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
      // Synchronize person parent/spouse references
      const nextPersons = state.persons.map((p) => {
        let updated = { ...p };
        if (family.husbandId === p.id || family.wifeId === p.id) {
          const spouseFams = Array.isArray(p.spouseFamilyIds) ? [...p.spouseFamilyIds] : [];
          if (!spouseFams.includes(family.id)) {
            spouseFams.push(family.id);
            updated.spouseFamilyIds = spouseFams;
          }
        }
        const isChild = (family.children || []).some((c) => c.personId === p.id) || (family.childrenIds || []).includes(p.id);
        if (isChild) {
          updated.parentFamilyId = family.id;
          if (family.husbandId && !updated.fatherId) updated.fatherId = family.husbandId;
          if (family.wifeId && !updated.motherId) updated.motherId = family.wifeId;
        }
        return updated;
      });

      try {
        localStorage.setItem(`${STORAGE_KEY}_families`, JSON.stringify(nextFamilies));
        localStorage.setItem(`${STORAGE_KEY}_persons`, JSON.stringify(nextPersons));
      } catch {}
      saveFamilyDoc(family);

      return { families: nextFamilies, persons: nextPersons };
    }),

  deleteFamily: (id) =>
    set((state) => {
      const nextFamilies = { ...state.families };
      delete nextFamilies[id];
      try {
        localStorage.setItem(`${STORAGE_KEY}_families`, JSON.stringify(nextFamilies));
      } catch {}
      deleteFamilyDoc(id);
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
      saveSourceDoc(source);
      return { sources: nextSources };
    }),

  deleteSource: (id) =>
    set((state) => {
      const nextSources = { ...state.sources };
      delete nextSources[id];
      try {
        localStorage.setItem(`${STORAGE_KEY}_sources`, JSON.stringify(nextSources));
      } catch {}
      deleteSourceDoc(id);
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
      saveEventDoc(event);
      return { events: nextEvents };
    }),

  deleteEvent: (id) =>
    set((state) => {
      const nextEvents = { ...state.events };
      delete nextEvents[id];
      try {
        localStorage.setItem(`${STORAGE_KEY}_events`, JSON.stringify(nextEvents));
      } catch {}
      deleteEventDoc(id);
      return { events: nextEvents };
    }),

  // Unified Database export / import
  getGenealogyDatabase: (): GenealogyDatabase => {
    const { persons, families, sources, events, selectedPersonId } = get();
    const personsRecord: Record<string, Person> = {};
    persons.forEach((p) => {
      personsRecord[p.id] = p;
    });

    return {
      metadata: {
        title: 'Родовід родини Коваленків та Шевченків',
        description: 'Єдина база даних родоводу',
        lastModified: new Date().toISOString(),
        author: 'Дослідник'
      },
      rootPersonId: selectedPersonId || persons[0]?.id || 'p1',
      persons: personsRecord,
      families,
      sources,
      events,
      lastModified: new Date().toISOString()
    };
  },

  loadGenealogyDatabase: (db: GenealogyDatabase) =>
    set(() => {
      const incomingPersons = db.persons ? Object.values(db.persons).map(normalizePerson) : [];
      const incomingFamilies = db.families || {};
      const incomingSources = db.sources || {};
      const incomingEvents = db.events || {};

      try {
        localStorage.setItem(`${STORAGE_KEY}_persons`, JSON.stringify(incomingPersons));
        localStorage.setItem(`${STORAGE_KEY}_families`, JSON.stringify(incomingFamilies));
        localStorage.setItem(`${STORAGE_KEY}_sources`, JSON.stringify(incomingSources));
        localStorage.setItem(`${STORAGE_KEY}_events`, JSON.stringify(incomingEvents));
      } catch {}

      return {
        persons: incomingPersons,
        families: incomingFamilies,
        sources: incomingSources,
        events: incomingEvents,
        selectedPersonId: db.rootPersonId || incomingPersons[0]?.id || null
      };
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

  resetPersonsToSample: () =>
    set(() => {
      const sample = INITIAL_PERSONS.map(normalizePerson);
      try {
        localStorage.setItem(`${STORAGE_KEY}_persons`, JSON.stringify(sample));
        localStorage.setItem(`${STORAGE_KEY}_families`, JSON.stringify(INITIAL_FAMILIES));
        localStorage.setItem(`${STORAGE_KEY}_sources`, JSON.stringify(INITIAL_SOURCES));
        localStorage.setItem(`${STORAGE_KEY}_events`, JSON.stringify(INITIAL_EVENTS));
        localStorage.setItem(`${STORAGE_KEY}_trashPersons`, JSON.stringify([]));
      } catch {}
      return {
        persons: sample,
        families: INITIAL_FAMILIES,
        sources: INITIAL_SOURCES,
        events: INITIAL_EVENTS,
        trashPersons: []
      };
    })
}));
