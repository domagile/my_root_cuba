import { create } from 'zustand';
import { Person, GitConfig, SharedInvite } from '../types';

const STORAGE_KEY = 'genealogy_workstation_data_v2';

export const INITIAL_PERSONS: Person[] = [
  {
    id: 'p-1',
    firstName: 'Остап',
    lastName: 'Коваленко',
    gender: 'male',
    birthDate: '1845-04-12',
    birthYear: 1845,
    birthPlace: 'с. Чернечий Яр, Полтавська губ.',
    deathDate: '1918-11-20',
    deathYear: 1918,
    deathPlace: 'с. Чернечий Яр',
    occupation: 'Коваль, сотник громади',
    estateOrSocialStatus: 'Козак',
    confession: 'Православний',
    notes: 'Засновник родинної кузні. Згаданий у сповідному розписі 1880 р.',
    fatherId: 'p-10',
    motherId: 'p-11',
    spouseIds: ['p-2'],
    childrenIds: ['p-3', 'p-4', 'p-5'],
    generation: 1
  },
  {
    id: 'p-2',
    firstName: 'Марія',
    lastName: 'Коваленко',
    maidenName: 'Лисенко',
    gender: 'female',
    birthDate: '1850-08-19',
    birthYear: 1850,
    birthPlace: 'м. Диканька',
    deathDate: '1924-03-14',
    deathYear: 1924,
    deathPlace: 'с. Чернечий Яр',
    estateOrSocialStatus: 'Козачка',
    confession: 'Православна',
    notes: 'Знана травниця та майстриня вишивки.',
    spouseIds: ['p-1'],
    childrenIds: ['p-3', 'p-4', 'p-5'],
    generation: 1
  },
  {
    id: 'p-3',
    firstName: 'Іван',
    lastName: 'Коваленко',
    gender: 'male',
    birthDate: '1878-02-10',
    birthYear: 1878,
    birthPlace: 'с. Чернечий Яр',
    deathDate: '1943-09-15',
    deathYear: 1943,
    deathPlace: 'м. Полтава',
    occupation: 'Вчитель початкових класів',
    fatherId: 'p-1',
    motherId: 'p-2',
    spouseIds: ['p-6'],
    childrenIds: ['p-7', 'p-8'],
    generation: 2
  },
  {
    id: 'p-4',
    firstName: 'Ганна',
    lastName: 'Шевченко',
    maidenName: 'Коваленко',
    gender: 'female',
    birthDate: '1882-06-25',
    birthYear: 1882,
    birthPlace: 'с. Чернечий Яр',
    deathDate: '1960-01-18',
    deathYear: 1960,
    fatherId: 'p-1',
    motherId: 'p-2',
    generation: 2
  },
  {
    id: 'p-5',
    firstName: 'Петро',
    lastName: 'Коваленко',
    gender: 'male',
    birthDate: '1886-11-03',
    birthYear: 1886,
    birthPlace: 'с. Чернечий Яр',
    deathDate: '1920-05-12',
    deathYear: 1920,
    fatherId: 'p-1',
    motherId: 'p-2',
    generation: 2
  },
  {
    id: 'p-6',
    firstName: 'Олена',
    lastName: 'Коваленко',
    maidenName: 'Гриценко',
    gender: 'female',
    birthDate: '1884-05-14',
    birthYear: 1884,
    birthPlace: 'м. Охтирка',
    deathDate: '1958-12-02',
    deathYear: 1958,
    spouseIds: ['p-3'],
    childrenIds: ['p-7', 'p-8'],
    generation: 2
  },
  {
    id: 'p-7',
    firstName: 'Михайло',
    lastName: 'Коваленко',
    gender: 'male',
    birthDate: '1912-09-08',
    birthYear: 1912,
    birthPlace: 'с. Чернечий Яр',
    deathDate: '1988-04-30',
    deathYear: 1988,
    occupation: 'Агроном',
    fatherId: 'p-3',
    motherId: 'p-6',
    spouseIds: ['p-9'],
    childrenIds: ['p-12'],
    generation: 3
  },
  {
    id: 'p-8',
    firstName: 'Софія',
    lastName: 'Коваленко',
    gender: 'female',
    birthDate: '1916-03-22',
    birthYear: 1916,
    deathDate: '1995-10-11',
    fatherId: 'p-3',
    motherId: 'p-6',
    generation: 3
  },
  {
    id: 'p-9',
    firstName: 'Катерина',
    lastName: 'Коваленко',
    maidenName: 'Бондар',
    gender: 'female',
    birthDate: '1918-12-05',
    birthYear: 1918,
    deathDate: '2002-07-19',
    spouseIds: ['p-7'],
    childrenIds: ['p-12'],
    generation: 3
  },
  {
    id: 'p-10',
    firstName: 'Григорій',
    lastName: 'Коваленко',
    gender: 'male',
    birthDate: '1815-01-10',
    birthYear: 1815,
    deathDate: '1889-08-04',
    deathYear: 1889,
    generation: 0,
    childrenIds: ['p-1']
  },
  {
    id: 'p-11',
    firstName: 'Параскева',
    lastName: 'Коваленко',
    gender: 'female',
    birthDate: '1820-10-15',
    birthYear: 1820,
    deathDate: '1895-02-18',
    deathYear: 1895,
    generation: 0,
    childrenIds: ['p-1']
  },
  {
    id: 'p-12',
    firstName: 'Богдан',
    lastName: 'Коваленко',
    gender: 'male',
    birthDate: '1952-07-14',
    birthYear: 1952,
    birthPlace: 'м. Полтава',
    isLiving: true,
    occupation: 'Інженер-конструктор',
    fatherId: 'p-7',
    motherId: 'p-9',
    generation: 4
  }
];

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
  trashPersons: Person[];
  selectedPersonId: string | null;
  gitConfig: GitConfig;
  sharedInvites: SharedInvite[];
  googleDriveEmail: string;

  // Actions
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

  trashPersons: (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_trashPersons`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  })(),

  selectedPersonId: 'p-1',

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

      try {
        localStorage.setItem(`${STORAGE_KEY}_persons`, JSON.stringify(nextPersons));
        localStorage.setItem(`${STORAGE_KEY}_trashPersons`, JSON.stringify(nextTrash));
      } catch {}

      return { persons: nextPersons, trashPersons: nextTrash };
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

      const restored = { ...target, isDeleted: false, deletedAt: undefined };
      const nextPersons = [...state.persons, normalizePerson(restored)];
      const nextTrash = state.trashPersons.filter((p) => p.id !== id);

      try {
        localStorage.setItem(`${STORAGE_KEY}_persons`, JSON.stringify(nextPersons));
        localStorage.setItem(`${STORAGE_KEY}_trashPersons`, JSON.stringify(nextTrash));
      } catch {}

      return { persons: nextPersons, trashPersons: nextTrash };
    }),

  restorePersons: (ids) =>
    set((state) => {
      const targets = state.trashPersons.filter((p) => ids.includes(p.id));
      const restored = targets.map((t) => normalizePerson({ ...t, isDeleted: false, deletedAt: undefined }));
      const nextPersons = [...state.persons, ...restored];
      const nextTrash = state.trashPersons.filter((p) => !ids.includes(p.id));

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
      ged += `1 SEX ${p.gender === 'female' ? 'F' : 'M'}\n`;
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
        localStorage.setItem(`${STORAGE_KEY}_trashPersons`, JSON.stringify([]));
      } catch {}
      return { persons: sample, trashPersons: [] };
    })
}));
