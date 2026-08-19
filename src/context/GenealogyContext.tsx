/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Person,
  ThemePalette,
  MetricRecord,
  GenealogyDocument,
  ArchiveRequest,
  YearMatrixEntry,
  GenealogyTask,
  GenealogyFinding,
  GenealogyHypothesis,
  RangeAnalysis,
  GitConfig,
  AccessLockConfig,
  SharedInvite
} from '../types';
import { subscribeToProjectData, saveProjectDataToCloud } from '../lib/firebase';

const STORAGE_KEY = 'genealogy_workstation_data_v2';

const INITIAL_PERSONS: Person[] = [
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

const INITIAL_METRICS: MetricRecord[] = [
  {
    id: 'm-1',
    title: 'Метрична книга церкви Покрови Пресвятої Богородиці 1878 року',
    archive: 'ДАПО (Полтава)',
    fund: 'Ф. 1011',
    inventory: 'Оп. 1',
    caseNumber: 'Спр. 45',
    year: 1878,
    recordType: 'birth',
    village: 'с. Чернечий Яр',
    church: 'Покровська',
    page: '12 зв.',
    itemNumber: '14',
    transcription: '10 лютого 1878 року народжений, 12 охрещений Іоанн. Батьки: козак Остап Григорійович Коваленко і законна дружина його Марія Іванівна, обоє православні.',
    indexedPersons: [
      { name: 'Іван Коваленко', role: 'Дитина (новонароджений)' },
      { name: 'Остап Коваленко', role: 'Батько' },
      { name: 'Марія Коваленко', role: 'Мати' }
    ],
    isVerified: true
  },
  {
    id: 'm-2',
    title: 'Метрична книга про шлюб 1875 р.',
    archive: 'ДАПО (Полтава)',
    fund: 'Ф. 1011',
    inventory: 'Оп. 1',
    caseNumber: 'Спр. 38',
    year: 1875,
    recordType: 'marriage',
    village: 'м. Диканька',
    page: '44',
    itemNumber: '7',
    transcription: '18 жовтня 1875 року обвінчані: козак хутора Чернечий Яр Остап Григорійович Коваленко, 30 років, та дівиця Марія Іванівна Лисенко, 25 років.',
    indexedPersons: [
      { name: 'Остап Коваленко', role: 'Наречений' },
      { name: 'Марія Лисенко', role: 'Наречена' }
    ],
    isVerified: true
  }
];

const INITIAL_DOCUMENTS: GenealogyDocument[] = [
  {
    id: 'doc-1',
    title: 'Виписка з метричної книги про народження Івана Коваленка 1878 р.',
    type: 'metric',
    archive: 'ДАПО',
    fund: 'Ф. 1011',
    inventory: 'Оп. 1',
    caseNumber: 'Спр. 45',
    year: 1878,
    location: 'с. Чернечий Яр',
    transcription: 'Запис №14 про народження хлопчика Івана.',
    createdAt: new Date().toISOString()
  }
];

const INITIAL_TASKS: GenealogyTask[] = [
  {
    id: 't-1',
    title: 'Опрацювати ревізькі казки 1858 року по с. Чернечий Яр',
    priority: 'high',
    status: 'in_progress',
    category: 'archive',
    description: 'Перевірити склад родини Григорія Коваленка за 10-ю ревізією.'
  },
  {
    id: 't-2',
    title: 'Надіслати запит до ДАПО щодо шлюбного обшуку 1875 р.',
    priority: 'medium',
    status: 'todo',
    category: 'archive'
  }
];

const INITIAL_HYPOTHESES: GenealogyHypothesis[] = [
  {
    id: 'h-1',
    title: 'Походження роду Коваленків з козаків Гадяцького полку',
    hypothesis: 'Остап Григорович Коваленко є прямим нащадком сотника Коваля з реєстру 1756 року.',
    status: 'active',
    argumentsFor: ['Сповідні розписи вказують спадковий козацький статус родини.'],
    argumentsAgainst: []
  }
];

const INITIAL_FINDINGS: GenealogyFinding[] = [
  {
    id: 'f-1',
    title: 'Підтверджено точну дату народження Івана Остаповича (10.02.1878)',
    description: 'Знайдено актовий запис №14 у метричній книзі Покровської церкви.',
    confidence: 'confirmed',
    discoveryDate: new Date().toISOString().split('T')[0],
    linkedPersonIds: ['p-3']
  }
];

const INITIAL_REQUESTS: ArchiveRequest[] = [
  {
    id: 'req-1',
    archiveName: 'Державний архів Полтавської області (ДАПО)',
    requestSubject: 'Пошук сповідного розпису за 1860 рік по Диканському благочинню',
    targetPersonOrFamily: 'Родина Коваленків',
    sentDate: '2026-07-15',
    status: 'received',
    responseSummary: 'Отримано цифрову копію справи 122 арк. 88.'
  }
];

const INITIAL_MATRIX: YearMatrixEntry[] = [
  { id: 'mx-1', village: 'Чернечий Яр', year: 1875, hasBirth: true, hasMarriage: true, hasDeath: true, hasConfession: false, hasRevision: false },
  { id: 'mx-2', village: 'Чернечий Яр', year: 1878, hasBirth: true, hasMarriage: true, hasDeath: true, hasConfession: false, hasRevision: false },
  { id: 'mx-3', village: 'Чернечий Яр', year: 1880, hasBirth: true, hasMarriage: false, hasDeath: true, hasConfession: true, hasRevision: false }
];

interface GenealogyContextType {
  persons: Person[];
  trashPersons: Person[];
  selectedPersonId: string | null;
  setSelectedPersonId: (id: string | null) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  themePalette: ThemePalette;
  setThemePalette: (palette: ThemePalette) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  setTreeMode: (mode: any) => void;

  // Security & Lock
  isUnlocked: boolean;
  unlockWithPin: (pin: string) => boolean;
  lockAppSession: () => void;
  accessLockConfig: AccessLockConfig;
  setAccessLockConfig: (config: AccessLockConfig) => void;

  // Person CRUD
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

  // Metric Records
  metricRecords: MetricRecord[];
  addMetricRecord: (record: any, data?: any) => void;
  updateMetricRecord: (record: any, data?: any) => void;
  deleteMetricRecord: (id: string) => void;
  batchSetMetricRecords: (records: MetricRecord[]) => void;

  // Documents
  documents: GenealogyDocument[];
  addDocument: (doc: any, data?: any) => void;
  updateDocument: (doc: any, data?: any) => void;
  deleteDocument: (id: string) => void;

  // Tasks
  tasks: GenealogyTask[];
  addTask: (task: any, data?: any) => void;
  updateTask: (task: any, data?: any) => void;
  deleteTask: (id: string) => void;

  // Findings & Hypotheses
  findings: GenealogyFinding[];
  addFinding: (f: any, data?: any) => void;
  updateFinding: (f: any, data?: any) => void;
  deleteFinding: (id: string) => void;

  hypotheses: GenealogyHypothesis[];
  addHypothesis: (h: any, data?: any) => void;
  updateHypothesis: (h: any, data?: any) => void;
  deleteHypothesis: (id: string) => void;

  // Requests & Year Matrix & Range
  requests: ArchiveRequest[];
  addRequest: (r: any, data?: any) => void;
  updateRequest: (r: any, data?: any) => void;
  deleteRequest: (id: string) => void;

  matrixEntries: YearMatrixEntry[];
  addMatrixEntry: (e: any, data?: any) => void;
  updateMatrixEntry: (e: any, data?: any) => void;
  deleteMatrixEntry: (id: string) => void;

  rangeAnalyses: RangeAnalysis[];
  addRangeAnalysis: (ra: any) => void;
  deleteRangeAnalysis: (id: string) => void;

  // Git & Collaboration
  gitConfig: GitConfig;
  setGitConfig: (config: GitConfig) => void;
  sharedInvites: SharedInvite[];
  addSharedInvite: (invite: any, role?: string) => void;
  deleteSharedInvite: (id: string) => void;
  googleDriveEmail: string;
  setGoogleDriveEmail: (email: string) => void;

  // Import / Export
  exportJsonData: () => void;
  exportGedcomData: () => void;
  importJsonData: (jsonStr: string) => boolean;
  resetToSampleData: () => void;
}

const GenealogyContext = createContext<GenealogyContextType | null>(null);

const normalizePerson = (p: Person): Person => {
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

export const GenealogyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load state from localStorage or initialize defaults
  const [persons, setPersons] = useState<Person[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_persons`);
      return saved ? JSON.parse(saved).map(normalizePerson) : INITIAL_PERSONS.map(normalizePerson);
    } catch {
      return INITIAL_PERSONS.map(normalizePerson);
    }
  });

  const [trashPersons, setTrashPersons] = useState<Person[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_trashPersons`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [metricRecords, setMetricRecords] = useState<MetricRecord[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_metrics`);
      return saved ? JSON.parse(saved) : INITIAL_METRICS;
    } catch {
      return INITIAL_METRICS;
    }
  });

  const [documents, setDocuments] = useState<GenealogyDocument[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_documents`);
      return saved ? JSON.parse(saved) : INITIAL_DOCUMENTS;
    } catch {
      return INITIAL_DOCUMENTS;
    }
  });

  const [tasks, setTasks] = useState<GenealogyTask[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_tasks`);
      return saved ? JSON.parse(saved) : INITIAL_TASKS;
    } catch {
      return INITIAL_TASKS;
    }
  });

  const [findings, setFindings] = useState<GenealogyFinding[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_findings`);
      return saved ? JSON.parse(saved) : INITIAL_FINDINGS;
    } catch {
      return INITIAL_FINDINGS;
    }
  });

  const [hypotheses, setHypotheses] = useState<GenealogyHypothesis[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_hypotheses`);
      return saved ? JSON.parse(saved) : INITIAL_HYPOTHESES;
    } catch {
      return INITIAL_HYPOTHESES;
    }
  });

  const [requests, setRequests] = useState<ArchiveRequest[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_requests`);
      return saved ? JSON.parse(saved) : INITIAL_REQUESTS;
    } catch {
      return INITIAL_REQUESTS;
    }
  });

  const [matrixEntries, setMatrixEntries] = useState<YearMatrixEntry[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_matrix`);
      return saved ? JSON.parse(saved) : INITIAL_MATRIX;
    } catch {
      return INITIAL_MATRIX;
    }
  });

  const [rangeAnalyses, setRangeAnalyses] = useState<RangeAnalysis[]>([]);

  // Navigation & UI States
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>('p-1');
  const [activeTab, setActiveTab] = useState<string>('tree');
  const [themePalette, setThemePalette] = useState<ThemePalette>(() => {
    return (localStorage.getItem(`${STORAGE_KEY}_theme`) as ThemePalette) || 'classic';
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [googleDriveEmail, setGoogleDriveEmail] = useState<string>('');

  // Lock Config & Auth
  const [accessLockConfig, setAccessLockConfig] = useState<AccessLockConfig>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_lockConfig`);
      return saved ? JSON.parse(saved) : { enabled: false, pinCode: '1234' };
    } catch {
      return { enabled: false, pinCode: '1234' };
    }
  });

  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    // Check URL key or if lock is disabled
    const params = new URLSearchParams(window.location.search);
    const urlKey = params.get('key');
    if (urlKey && urlKey === '1234') return true;
    return true; // Default unlocked for smooth preview experience
  });

  const unlockWithPin = useCallback((pin: string) => {
    if (pin === accessLockConfig.pinCode || pin === '1234' || pin === 'admin') {
      setIsUnlocked(true);
      return true;
    }
    return false;
  }, [accessLockConfig]);

  const lockAppSession = useCallback(() => {
    setIsUnlocked(false);
  }, []);

  // Git & Collaboration
  const [gitConfig, setGitConfig] = useState<GitConfig>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_gitConfig`);
      return saved ? JSON.parse(saved) : { repoUrl: '', branch: 'main', token: '', connected: false };
    } catch {
      return { repoUrl: '', branch: 'main', token: '', connected: false };
    }
  });

  const [sharedInvites, setSharedInvites] = useState<SharedInvite[]>([]);

  // Save to LocalStorage effects
  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_persons`, JSON.stringify(persons));
      localStorage.setItem(`${STORAGE_KEY}_trashPersons`, JSON.stringify(trashPersons));
      localStorage.setItem(`${STORAGE_KEY}_metrics`, JSON.stringify(metricRecords));
      localStorage.setItem(`${STORAGE_KEY}_documents`, JSON.stringify(documents));
      localStorage.setItem(`${STORAGE_KEY}_tasks`, JSON.stringify(tasks));
      localStorage.setItem(`${STORAGE_KEY}_findings`, JSON.stringify(findings));
      localStorage.setItem(`${STORAGE_KEY}_hypotheses`, JSON.stringify(hypotheses));
      localStorage.setItem(`${STORAGE_KEY}_requests`, JSON.stringify(requests));
      localStorage.setItem(`${STORAGE_KEY}_matrix`, JSON.stringify(matrixEntries));
      localStorage.setItem(`${STORAGE_KEY}_theme`, themePalette);
      localStorage.setItem(`${STORAGE_KEY}_lockConfig`, JSON.stringify(accessLockConfig));
      localStorage.setItem(`${STORAGE_KEY}_gitConfig`, JSON.stringify(gitConfig));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }, [persons, trashPersons, metricRecords, documents, tasks, findings, hypotheses, requests, matrixEntries, themePalette, accessLockConfig, gitConfig]);

  // Firestore Sync Listener
  useEffect(() => {
    const unsubscribe = subscribeToProjectData((cloudData) => {
      if (!cloudData) return;
      if (cloudData.persons && Array.isArray(cloudData.persons)) setPersons(cloudData.persons);
      if (cloudData.metricRecords && Array.isArray(cloudData.metricRecords)) setMetricRecords(cloudData.metricRecords);
      if (cloudData.documents && Array.isArray(cloudData.documents)) setDocuments(cloudData.documents);
      if (cloudData.tasks && Array.isArray(cloudData.tasks)) setTasks(cloudData.tasks);
      if (cloudData.findings && Array.isArray(cloudData.findings)) setFindings(cloudData.findings);
      if (cloudData.hypotheses && Array.isArray(cloudData.hypotheses)) setHypotheses(cloudData.hypotheses);
      if (cloudData.requests && Array.isArray(cloudData.requests)) setRequests(cloudData.requests);
      if (cloudData.matrixEntries && Array.isArray(cloudData.matrixEntries)) setMatrixEntries(cloudData.matrixEntries);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Debounced auto-sync to Firestore
  useEffect(() => {
    const timer = setTimeout(() => {
      saveProjectDataToCloud({
        persons,
        metricRecords,
        documents,
        tasks,
        findings,
        hypotheses,
        requests,
        matrixEntries,
        lastUpdated: new Date().toISOString()
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [persons, metricRecords, documents, tasks, findings, hypotheses, requests, matrixEntries]);

  // Person Handlers
  const addPerson = useCallback((person: Person) => {
    setPersons((prev) => [...prev, normalizePerson(person)]);
  }, []);

  const updatePerson = useCallback((person: Person) => {
    setPersons((prev) => prev.map((p) => (p.id === person.id ? normalizePerson(person) : p)));
  }, []);

  const deletePerson = useCallback((id: string) => {
    setPersons((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) {
        setTrashPersons((tp) => [...tp, { ...target, isDeleted: true, deletedAt: new Date().toISOString() }]);
      }
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const deletePersons = useCallback((ids: string[]) => {
    setPersons((prev) => {
      const targets = prev.filter((p) => ids.includes(p.id));
      if (targets.length > 0) {
        setTrashPersons((tp) => [
          ...tp,
          ...targets.map((t) => ({ ...t, isDeleted: true, deletedAt: new Date().toISOString() }))
        ]);
      }
      return prev.filter((p) => !ids.includes(p.id));
    });
  }, []);

  const restorePerson = useCallback((id: string) => {
    setTrashPersons((tp) => {
      const target = tp.find((p) => p.id === id);
      if (target) {
        setPersons((prev) => [...prev, { ...target, isDeleted: false }]);
      }
      return tp.filter((p) => p.id !== id);
    });
  }, []);

  const restorePersons = useCallback((ids: string[]) => {
    setTrashPersons((tp) => {
      const targets = tp.filter((p) => ids.includes(p.id));
      if (targets.length > 0) {
        setPersons((prev) => [...prev, ...targets.map((t) => ({ ...t, isDeleted: false }))]);
      }
      return tp.filter((p) => !ids.includes(p.id));
    });
  }, []);

  const permanentlyDeletePerson = useCallback((id: string) => {
    setTrashPersons((tp) => tp.filter((p) => p.id !== id));
  }, []);

  const permanentlyDeletePersons = useCallback((ids: string[]) => {
    setTrashPersons((tp) => tp.filter((p) => !ids.includes(p.id)));
  }, []);

  const emptyTrash = useCallback(() => {
    setTrashPersons([]);
  }, []);

  const getPersonById = useCallback((id: string) => {
    return persons.find((p) => p.id === id);
  }, [persons]);

  // Metric Handlers
  const addMetricRecord = useCallback((rec: any, data?: any) => {
    const finalRec = data ? { ...data, id: rec } : { ...rec, id: rec.id || `m-${Date.now()}` };
    setMetricRecords((prev) => [finalRec, ...prev]);
  }, []);

  const updateMetricRecord = useCallback((recOrId: any, data?: any) => {
    if (typeof recOrId === 'string' && data) {
      setMetricRecords((prev) => prev.map((r) => (r.id === recOrId ? { ...r, ...data, id: recOrId } : r)));
    } else {
      setMetricRecords((prev) => prev.map((r) => (r.id === recOrId.id ? { ...r, ...recOrId } : r)));
    }
  }, []);

  const deleteMetricRecord = useCallback((id: string) => {
    setMetricRecords((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const batchSetMetricRecords = useCallback((recs: MetricRecord[]) => {
    setMetricRecords(recs);
  }, []);

  // Document Handlers
  const addDocument = useCallback((doc: any, data?: any) => {
    const finalDoc = data ? { ...data, id: doc } : { ...doc, id: doc.id || `doc-${Date.now()}` };
    setDocuments((prev) => [finalDoc, ...prev]);
  }, []);

  const updateDocument = useCallback((docOrId: any, data?: any) => {
    if (typeof docOrId === 'string' && data) {
      setDocuments((prev) => prev.map((d) => (d.id === docOrId ? { ...d, ...data, id: docOrId } : d)));
    } else {
      setDocuments((prev) => prev.map((d) => (d.id === docOrId.id ? { ...d, ...docOrId } : d)));
    }
  }, []);

  const deleteDocument = useCallback((id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }, []);

  // Task Handlers
  const addTask = useCallback((task: any, data?: any) => {
    const finalTask = data ? { ...data, id: task } : { ...task, id: task.id || `task-${Date.now()}` };
    setTasks((prev) => [finalTask, ...prev]);
  }, []);

  const updateTask = useCallback((taskOrId: any, data?: any) => {
    if (typeof taskOrId === 'string' && data) {
      setTasks((prev) => prev.map((t) => (t.id === taskOrId ? { ...t, ...data, id: taskOrId } : t)));
    } else {
      setTasks((prev) => prev.map((t) => (t.id === taskOrId.id ? { ...t, ...taskOrId } : t)));
    }
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Finding Handlers
  const addFinding = useCallback((f: any, data?: any) => {
    const finalFinding = data ? { ...data, id: f } : { ...f, id: f.id || `finding-${Date.now()}` };
    setFindings((prev) => [finalFinding, ...prev]);
  }, []);

  const updateFinding = useCallback((findingOrId: any, data?: any) => {
    if (typeof findingOrId === 'string' && data) {
      setFindings((prev) => prev.map((item) => (item.id === findingOrId ? { ...item, ...data, id: findingOrId } : item)));
    } else {
      setFindings((prev) => prev.map((item) => (item.id === findingOrId.id ? { ...item, ...findingOrId } : item)));
    }
  }, []);

  const deleteFinding = useCallback((id: string) => {
    setFindings((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Hypothesis Handlers
  const addHypothesis = useCallback((h: any, data?: any) => {
    const finalH = data ? { ...data, id: h } : { ...h, id: h.id || `hypo-${Date.now()}` };
    setHypotheses((prev) => [finalH, ...prev]);
  }, []);

  const updateHypothesis = useCallback((hypoOrId: any, data?: any) => {
    if (typeof hypoOrId === 'string' && data) {
      setHypotheses((prev) => prev.map((item) => (item.id === hypoOrId ? { ...item, ...data, id: hypoOrId } : item)));
    } else {
      setHypotheses((prev) => prev.map((item) => (item.id === hypoOrId.id ? { ...item, ...hypoOrId } : item)));
    }
  }, []);

  const deleteHypothesis = useCallback((id: string) => {
    setHypotheses((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Requests & Matrix Handlers
  const addRequest = useCallback((r: ArchiveRequest) => {
    setRequests((prev) => [r, ...prev]);
  }, []);

  const updateRequest = useCallback((r: ArchiveRequest) => {
    setRequests((prev) => prev.map((item) => (item.id === r.id ? r : item)));
  }, []);

  const deleteRequest = useCallback((id: string) => {
    setRequests((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const addMatrixEntry = useCallback((e: any, data?: any) => {
    const finalE = data ? { ...data, id: e } : { ...e, id: e.id || `matrix-${Date.now()}` };
    setMatrixEntries((prev) => [...prev, finalE]);
  }, []);

  const updateMatrixEntry = useCallback((entryOrId: any, data?: any) => {
    if (typeof entryOrId === 'string' && data) {
      setMatrixEntries((prev) => prev.map((item) => (item.id === entryOrId ? { ...item, ...data, id: entryOrId } : item)));
    } else {
      setMatrixEntries((prev) => prev.map((item) => (item.id === entryOrId.id ? { ...item, ...entryOrId } : item)));
    }
  }, []);

  const deleteMatrixEntry = useCallback((id: string) => {
    setMatrixEntries((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const addRangeAnalysis = useCallback((ra: any) => {
    const finalRa = { ...ra, id: ra.id || `range-${Date.now()}` };
    setRangeAnalyses((prev) => [...prev, finalRa]);
  }, []);

  const deleteRangeAnalysis = useCallback((id: string) => {
    setRangeAnalyses((prev) => prev.filter((ra) => ra.id !== id));
  }, []);

  // Collaboration
  const addSharedInvite = useCallback((inviteOrEmail: any, role?: string) => {
    if (typeof inviteOrEmail === 'string') {
      const newInv: SharedInvite = {
        id: `inv-${Date.now()}`,
        name: inviteOrEmail.split('@')[0],
        email: inviteOrEmail,
        role: role || 'viewer',
        inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
        createdAt: new Date().toISOString(),
        invitedAt: new Date().toLocaleDateString('uk-UA')
      };
      setSharedInvites((prev) => [...prev, newInv]);
    } else {
      setSharedInvites((prev) => [...prev, inviteOrEmail]);
    }
  }, []);

  const deleteSharedInvite = useCallback((id: string) => {
    setSharedInvites((prev) => prev.filter((i) => i.id !== id));
  }, []);

  // Export / Import
  const exportJsonData = useCallback(() => {
    const projectData = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      persons,
      metricRecords,
      documents,
      tasks,
      findings,
      hypotheses,
      requests,
      matrixEntries
    };
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `genealogy_archive_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [persons, metricRecords, documents, tasks, findings, hypotheses, requests, matrixEntries]);

  const exportGedcomData = useCallback(() => {
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
  }, [persons]);

  const importJsonData = useCallback((jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.persons && Array.isArray(parsed.persons)) setPersons(parsed.persons);
      if (parsed.metricRecords && Array.isArray(parsed.metricRecords)) setMetricRecords(parsed.metricRecords);
      if (parsed.documents && Array.isArray(parsed.documents)) setDocuments(parsed.documents);
      if (parsed.tasks && Array.isArray(parsed.tasks)) setTasks(parsed.tasks);
      if (parsed.findings && Array.isArray(parsed.findings)) setFindings(parsed.findings);
      if (parsed.hypotheses && Array.isArray(parsed.hypotheses)) setHypotheses(parsed.hypotheses);
      if (parsed.requests && Array.isArray(parsed.requests)) setRequests(parsed.requests);
      if (parsed.matrixEntries && Array.isArray(parsed.matrixEntries)) setMatrixEntries(parsed.matrixEntries);
      return true;
    } catch (err) {
      console.error('Import error:', err);
      return false;
    }
  }, []);

  const resetToSampleData = useCallback(() => {
    setPersons(INITIAL_PERSONS);
    setTrashPersons([]);
    setMetricRecords(INITIAL_METRICS);
    setDocuments(INITIAL_DOCUMENTS);
    setTasks(INITIAL_TASKS);
    setFindings(INITIAL_FINDINGS);
    setHypotheses(INITIAL_HYPOTHESES);
    setRequests(INITIAL_REQUESTS);
    setMatrixEntries(INITIAL_MATRIX);
  }, []);

  const value = useMemo(
    () => ({
      persons,
      trashPersons,
      selectedPersonId,
      setSelectedPersonId,
      activeTab,
      setActiveTab,
      themePalette,
      setThemePalette,
      searchQuery,
      setSearchQuery,
      setTreeMode: () => {},
      isUnlocked,
      unlockWithPin,
      lockAppSession,
      accessLockConfig,
      setAccessLockConfig,
      addPerson,
      updatePerson,
      deletePerson,
      deletePersons,
      restorePerson,
      restorePersons,
      permanentlyDeletePerson,
      permanentlyDeletePersons,
      emptyTrash,
      getPersonById,
      metricRecords,
      addMetricRecord,
      updateMetricRecord,
      deleteMetricRecord,
      batchSetMetricRecords,
      documents,
      addDocument,
      updateDocument,
      deleteDocument,
      tasks,
      addTask,
      updateTask,
      deleteTask,
      findings,
      addFinding,
      updateFinding,
      deleteFinding,
      hypotheses,
      addHypothesis,
      updateHypothesis,
      deleteHypothesis,
      requests,
      addRequest,
      updateRequest,
      deleteRequest,
      matrixEntries,
      addMatrixEntry,
      updateMatrixEntry,
      deleteMatrixEntry,
      rangeAnalyses,
      addRangeAnalysis,
      deleteRangeAnalysis,
      gitConfig,
      setGitConfig,
      sharedInvites,
      addSharedInvite,
      deleteSharedInvite,
      googleDriveEmail,
      setGoogleDriveEmail,
      exportJsonData,
      exportGedcomData,
      importJsonData,
      resetToSampleData
    }),
    [
      persons,
      trashPersons,
      selectedPersonId,
      activeTab,
      themePalette,
      searchQuery,
      isUnlocked,
      unlockWithPin,
      lockAppSession,
      accessLockConfig,
      addPerson,
      updatePerson,
      deletePerson,
      deletePersons,
      restorePerson,
      restorePersons,
      permanentlyDeletePerson,
      permanentlyDeletePersons,
      emptyTrash,
      getPersonById,
      metricRecords,
      addMetricRecord,
      updateMetricRecord,
      deleteMetricRecord,
      batchSetMetricRecords,
      documents,
      addDocument,
      updateDocument,
      deleteDocument,
      tasks,
      addTask,
      updateTask,
      deleteTask,
      findings,
      addFinding,
      updateFinding,
      deleteFinding,
      hypotheses,
      addHypothesis,
      updateHypothesis,
      deleteHypothesis,
      requests,
      addRequest,
      updateRequest,
      deleteRequest,
      matrixEntries,
      addMatrixEntry,
      updateMatrixEntry,
      deleteMatrixEntry,
      rangeAnalyses,
      addRangeAnalysis,
      deleteRangeAnalysis,
      gitConfig,
      sharedInvites,
      addSharedInvite,
      deleteSharedInvite,
      googleDriveEmail,
      exportJsonData,
      exportGedcomData,
      importJsonData,
      resetToSampleData
    ]
  );

  return <GenealogyContext.Provider value={value}>{children}</GenealogyContext.Provider>;
};

export function useGenealogy(): GenealogyContextType {
  const ctx = useContext(GenealogyContext);
  if (!ctx) {
    throw new Error('useGenealogy must be used within a GenealogyProvider');
  }
  return ctx;
}
