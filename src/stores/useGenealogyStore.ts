import { create } from 'zustand';
import { Person, Family, Source, LifeEvent, GenealogyDatabase, GitConfig, SharedInvite } from '../types';

const STORAGE_KEY = 'genealogy_workstation_data_v2';

export const INITIAL_PERSONS: Person[] = [
  {
    id: 'p1',
    firstName: 'Остап',
    lastName: 'Коваленко',
    patronymic: 'Григорович',
    prefix: 'козак',
    gender: 'M',
    birthDate: '1845-04-12',
    birthYear: 1845,
    birthPlace: 'с. Чернечий Яр, Полтавська губ.',
    deathDate: '1918-11-20',
    deathYear: 1918,
    deathPlace: 'с. Чернечий Яр',
    occupation: 'Коваль, сотник громади',
    estateOrSocialStatus: 'Козак',
    confession: 'Православний',
    notes: 'Засновник родинної кузні біля річки Ворскла. Згаданий у сповідному розписі 1880 р.',
    bio: 'Засновник родинної кузні біля річки Ворскла. Згаданий у сповідному розписі 1880 р.',
    fatherId: 'p10',
    motherId: 'p11',
    spouseIds: ['p2'],
    childrenIds: ['p3', 'p4', 'p5'],
    parentFamilyId: 'f4',
    spouseFamilyIds: ['f1'],
    generation: 1,
    tags: ['Коваль', 'Полтавщина']
  },
  {
    id: 'p2',
    firstName: 'Марія',
    lastName: 'Коваленко',
    maidenName: 'Лисенко',
    patronymic: 'Іванівна',
    gender: 'F',
    birthDate: '1850-08-19',
    birthYear: 1850,
    birthPlace: 'м. Диканька',
    deathDate: '1924-03-14',
    deathYear: 1924,
    deathPlace: 'с. Чернечий Яр',
    estateOrSocialStatus: 'Козачка',
    confession: 'Православна',
    notes: 'Знана травниця та майстриня вишивки.',
    bio: 'Знана травниця та майстриня вишивки.',
    spouseIds: ['p1'],
    childrenIds: ['p3', 'p4', 'p5'],
    spouseFamilyIds: ['f1'],
    generation: 1
  },
  {
    id: 'p3',
    firstName: 'Іван',
    lastName: 'Коваленко',
    patronymic: 'Остапович',
    gender: 'M',
    birthDate: '1878-02-10',
    birthYear: 1878,
    birthPlace: 'с. Чернечий Яр',
    deathDate: '1943-09-15',
    deathYear: 1943,
    deathPlace: 'м. Полтава',
    occupation: 'Вчитель початкових класів',
    fatherId: 'p1',
    motherId: 'p2',
    spouseIds: ['p6'],
    childrenIds: ['p7', 'p8'],
    parentFamilyId: 'f1',
    spouseFamilyIds: ['f2'],
    generation: 2
  },
  {
    id: 'p4',
    firstName: 'Ганна',
    lastName: 'Шевченко',
    maidenName: 'Коваленко',
    gender: 'F',
    birthDate: '1882-06-25',
    birthYear: 1882,
    birthPlace: 'с. Чернечий Яр',
    deathDate: '1960-01-18',
    deathYear: 1960,
    fatherId: 'p1',
    motherId: 'p2',
    parentFamilyId: 'f1',
    generation: 2
  },
  {
    id: 'p5',
    firstName: 'Петро',
    lastName: 'Коваленко',
    gender: 'M',
    birthDate: '1886-11-03',
    birthYear: 1886,
    birthPlace: 'с. Чернечий Яр',
    deathDate: '1920-05-12',
    deathYear: 1920,
    fatherId: 'p1',
    motherId: 'p2',
    parentFamilyId: 'f1',
    generation: 2
  },
  {
    id: 'p6',
    firstName: 'Олена',
    lastName: 'Коваленко',
    maidenName: 'Гриценко',
    patronymic: 'Василівна',
    gender: 'F',
    birthDate: '1884-05-14',
    birthYear: 1884,
    birthPlace: 'м. Охтирка',
    deathDate: '1958-12-02',
    deathYear: 1958,
    spouseIds: ['p3'],
    childrenIds: ['p7', 'p8'],
    spouseFamilyIds: ['f2'],
    generation: 2
  },
  {
    id: 'p7',
    firstName: 'Михайло',
    lastName: 'Коваленко',
    patronymic: 'Іванович',
    gender: 'M',
    birthDate: '1912-09-08',
    birthYear: 1912,
    birthPlace: 'с. Чернечий Яр',
    deathDate: '1988-04-30',
    deathYear: 1988,
    occupation: 'Агроном',
    fatherId: 'p3',
    motherId: 'p6',
    spouseIds: ['p9'],
    childrenIds: ['p12'],
    parentFamilyId: 'f2',
    spouseFamilyIds: ['f3'],
    generation: 3
  },
  {
    id: 'p8',
    firstName: 'Софія',
    lastName: 'Коваленко',
    patronymic: 'Іванівна',
    gender: 'F',
    birthDate: '1916-03-22',
    birthYear: 1916,
    deathDate: '1995-10-11',
    fatherId: 'p3',
    motherId: 'p6',
    parentFamilyId: 'f2',
    generation: 3
  },
  {
    id: 'p9',
    firstName: 'Катерина',
    lastName: 'Коваленко',
    maidenName: 'Бондар',
    patronymic: 'Семенівна',
    gender: 'F',
    birthDate: '1918-12-05',
    birthYear: 1918,
    deathDate: '2002-07-19',
    spouseIds: ['p7'],
    childrenIds: ['p12'],
    spouseFamilyIds: ['f3'],
    generation: 3
  },
  {
    id: 'p10',
    firstName: 'Григорій',
    lastName: 'Коваленко',
    patronymic: 'Данилович',
    gender: 'M',
    birthDate: '1815-01-10',
    birthYear: 1815,
    deathDate: '1889-08-04',
    deathYear: 1889,
    generation: 0,
    childrenIds: ['p1'],
    spouseFamilyIds: ['f4']
  },
  {
    id: 'p11',
    firstName: 'Параскева',
    lastName: 'Коваленко',
    patronymic: 'Федорівна',
    gender: 'F',
    birthDate: '1820-10-15',
    birthYear: 1820,
    deathDate: '1895-02-18',
    deathYear: 1895,
    generation: 0,
    childrenIds: ['p1'],
    spouseFamilyIds: ['f4']
  },
  {
    id: 'p12',
    firstName: 'Богдан',
    lastName: 'Коваленко',
    patronymic: 'Михайлович',
    gender: 'M',
    birthDate: '1952-07-14',
    birthYear: 1952,
    birthPlace: 'м. Полтава',
    isLiving: true,
    occupation: 'Інженер-конструктор',
    fatherId: 'p7',
    motherId: 'p9',
    parentFamilyId: 'f3',
    generation: 4
  }
];

export const INITIAL_FAMILIES: Record<string, Family> = {
  f1: {
    id: 'f1',
    husbandId: 'p1',
    wifeId: 'p2',
    relationshipType: 'Married',
    children: [
      { personId: 'p3', relationType: 'Biological' },
      { personId: 'p4', relationType: 'Biological' },
      { personId: 'p5', relationType: 'Biological' }
    ],
    childrenIds: ['p3', 'p4', 'p5'],
    marriageDate: '1875-10-18',
    marriageYear: 1875,
    marriagePlace: 'Церква св. Миколая, Диканька'
  },
  f2: {
    id: 'f2',
    husbandId: 'p3',
    wifeId: 'p6',
    relationshipType: 'Married',
    children: [
      { personId: 'p7', relationType: 'Biological' },
      { personId: 'p8', relationType: 'Biological' }
    ],
    childrenIds: ['p7', 'p8'],
    marriageDate: '1908-01-26',
    marriageYear: 1908,
    marriagePlace: 'Покровська церква, с. Чернечий Яр'
  },
  f3: {
    id: 'f3',
    husbandId: 'p7',
    wifeId: 'p9',
    relationshipType: 'Married',
    children: [
      { personId: 'p12', relationType: 'Biological' }
    ],
    childrenIds: ['p12'],
    marriageDate: '1940-06-12',
    marriageYear: 1940,
    marriagePlace: 'м. Полтава'
  },
  f4: {
    id: 'f4',
    husbandId: 'p10',
    wifeId: 'p11',
    relationshipType: 'Married',
    children: [
      { personId: 'p1', relationType: 'Biological' }
    ],
    childrenIds: ['p1'],
    marriageDate: '1840-02-15',
    marriageYear: 1840
  }
};

export const INITIAL_SOURCES: Record<string, Source> = {
  s1: {
    id: 's1',
    title: 'Метрична книга церкви Покрови Пресвятої Богородиці 1878 року',
    repository: 'Державний архів Полтавської області (ДАПО)',
    archiveReference: 'Ф. 1011, Оп. 1, Спр. 45, Арк. 12 зв.',
    archiveFund: 'Фонд 1011',
    inventory: 'Опис 1',
    caseNumber: 'Справа 45',
    page: 'Арк. 12 зв.',
    notes: 'Запис №14 про народження та хрещення Івана Остаповича Коваленка.'
  },
  s2: {
    id: 's2',
    title: 'Сповідний розпис Диканської протопопії 1880 р.',
    repository: 'ЦДІАК України',
    archiveReference: 'Ф. 127, Оп. 1015, Спр. 122, Арк. 88',
    archiveFund: 'Ф. 127',
    inventory: 'Оп. 1015',
    caseNumber: 'Спр. 122',
    page: 'Арк. 88',
    notes: 'Повний поіменний список родини козака Остапа Григоровича Коваленка.'
  }
};

export const INITIAL_EVENTS: Record<string, LifeEvent> = {
  e1: {
    id: 'e1',
    type: 'birth',
    title: 'Народження Остапа Коваленка',
    date: '1845-04-12',
    year: 1845,
    place: 'с. Чернечий Яр',
    personId: 'p1',
    sourceId: 's2'
  },
  e2: {
    id: 'e2',
    type: 'marriage',
    title: 'Шлюб Остапа Коваленка та Марії Лисенко',
    date: '1875-10-18',
    year: 1875,
    place: 'м. Диканька',
    familyId: 'f1'
  }
};

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
  sharedInvites: SharedInvite[];
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
  addSharedInvite: (invite: any, role?: string) => void;
  deleteSharedInvite: (id: string) => void;
  setGoogleDriveEmail: (email: string) => void;
  exportGedcomData: () => void;
  resetPersonsToSample: () => void;
}

export const useGenealogyStore = create<GenealogyDataState>((set, get) => ({
  persons: (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_persons`);
      return saved ? JSON.parse(saved).map(normalizePerson) : INITIAL_PERSONS.map(normalizePerson);
    } catch {
      return INITIAL_PERSONS.map(normalizePerson);
    }
  })(),

  families: (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_families`);
      return saved ? JSON.parse(saved) : INITIAL_FAMILIES;
    } catch {
      return INITIAL_FAMILIES;
    }
  })(),

  sources: (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_sources`);
      return saved ? JSON.parse(saved) : INITIAL_SOURCES;
    } catch {
      return INITIAL_SOURCES;
    }
  })(),

  events: (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_events`);
      return saved ? JSON.parse(saved) : INITIAL_EVENTS;
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

  selectedPersonId: 'p1',

  gitConfig: (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_gitConfig`);
      return saved ? JSON.parse(saved) : { repoUrl: '', branch: 'main', token: '', connected: false };
    } catch {
      return { repoUrl: '', branch: 'main', token: '', connected: false };
    }
  })(),

  sharedInvites: [],
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

  setSelectedPersonId: (selectedPersonId) => set({ selectedPersonId }),

  addPerson: (person) =>
    set((state) => {
      const next = [...state.persons, normalizePerson(person)];
      try {
        localStorage.setItem(`${STORAGE_KEY}_persons`, JSON.stringify(next));
      } catch {}
      return { persons: next };
    }),

  updatePerson: (person) =>
    set((state) => {
      const next = state.persons.map((p) => (p.id === person.id ? normalizePerson(person) : p));
      try {
        localStorage.setItem(`${STORAGE_KEY}_persons`, JSON.stringify(next));
      } catch {}
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
      const nextPersons = [...state.persons, normalizePerson(restored)];

      try {
        localStorage.setItem(`${STORAGE_KEY}_persons`, JSON.stringify(nextPersons));
        localStorage.setItem(`${STORAGE_KEY}_trashPersons`, JSON.stringify(nextTrash));
      } catch {}

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

      return { persons: nextPersons, trashPersons: nextTrash };
    }),

  permanentlyDeletePerson: (id) =>
    set((state) => {
      const nextTrash = state.trashPersons.filter((p) => p.id !== id);
      try {
        localStorage.setItem(`${STORAGE_KEY}_trashPersons`, JSON.stringify(nextTrash));
      } catch {}
      return { trashPersons: nextTrash };
    }),

  permanentlyDeletePersons: (ids) =>
    set((state) => {
      const nextTrash = state.trashPersons.filter((p) => !ids.includes(p.id));
      try {
        localStorage.setItem(`${STORAGE_KEY}_trashPersons`, JSON.stringify(nextTrash));
      } catch {}
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

      return { families: nextFamilies, persons: nextPersons };
    }),

  deleteFamily: (id) =>
    set((state) => {
      const nextFamilies = { ...state.families };
      delete nextFamilies[id];
      try {
        localStorage.setItem(`${STORAGE_KEY}_families`, JSON.stringify(nextFamilies));
      } catch {}
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
      return { sources: nextSources };
    }),

  deleteSource: (id) =>
    set((state) => {
      const nextSources = { ...state.sources };
      delete nextSources[id];
      try {
        localStorage.setItem(`${STORAGE_KEY}_sources`, JSON.stringify(nextSources));
      } catch {}
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
      return { events: nextEvents };
    }),

  deleteEvent: (id) =>
    set((state) => {
      const nextEvents = { ...state.events };
      delete nextEvents[id];
      try {
        localStorage.setItem(`${STORAGE_KEY}_events`, JSON.stringify(nextEvents));
      } catch {}
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

  addSharedInvite: (invite, role = 'viewer') =>
    set((state) => {
      const email = typeof invite === 'string' ? invite : (invite.email || '');
      const newInv: SharedInvite = {
        id: (typeof invite === 'object' && invite.id) ? invite.id : `inv-${Date.now()}`,
        name: (typeof invite === 'object' && invite.name) ? invite.name : (email ? email.split('@')[0] : 'Гість'),
        email,
        role: (typeof invite === 'object' && invite.role ? invite.role : role) as any,
        inviteCode: (typeof invite === 'object' && invite.inviteCode) ? invite.inviteCode : Math.random().toString(36).substring(2, 8).toUpperCase(),
        createdAt: new Date().toISOString(),
        invitedAt: new Date().toISOString()
      };
      return { sharedInvites: [...state.sharedInvites, newInv] };
    }),

  deleteSharedInvite: (id) =>
    set((state) => ({
      sharedInvites: state.sharedInvites.filter((inv) => inv.id !== id)
    })),

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
