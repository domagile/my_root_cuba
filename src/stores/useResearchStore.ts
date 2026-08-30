import { create } from 'zustand';
import {
  MetricRecord,
  GenealogyDocument,
  ArchiveRequest,
  YearMatrixEntry,
  GenealogyTask,
  GenealogyFinding,
  GenealogyHypothesis,
  RangeAnalysis
} from '../types';
import {
  saveMetricRecordDoc,
  deleteMetricRecordDoc,
  saveDocumentDoc,
  deleteDocumentDoc,
  saveTaskDoc,
  deleteTaskDoc,
  saveFindingDoc,
  deleteFindingDoc,
  saveHypothesisDoc,
  deleteHypothesisDoc,
  saveRequestDoc,
  deleteRequestDoc,
  saveMatrixEntryDoc,
  deleteMatrixEntryDoc
} from '../lib/firebase';

const STORAGE_KEY = 'genealogy_workstation_data_v2';

export const INITIAL_METRICS: MetricRecord[] = [
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

export const INITIAL_DOCUMENTS: GenealogyDocument[] = [
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

export const INITIAL_TASKS: GenealogyTask[] = [
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

export const INITIAL_HYPOTHESES: GenealogyHypothesis[] = [
  {
    id: 'h-1',
    title: 'Походження роду Коваленків з козаків Гадяцького полку',
    hypothesis: 'Остап Григорович Коваленко є прямим нащадком сотника Коваля з реєстру 1756 року.',
    status: 'active',
    argumentsFor: ['Сповідні розписи вказують спадковий козацький статус родини.'],
    argumentsAgainst: []
  }
];

export const INITIAL_FINDINGS: GenealogyFinding[] = [
  {
    id: 'f-1',
    title: 'Підтверджено точну дату народження Івана Остаповича (10.02.1878)',
    description: 'Знайдено актовий запис №14 у метричній книзі Покровської церкви.',
    confidence: 'confirmed',
    discoveryDate: new Date().toISOString().split('T')[0],
    linkedPersonIds: ['p-3']
  }
];

export const INITIAL_REQUESTS: ArchiveRequest[] = [
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

export const INITIAL_MATRIX: YearMatrixEntry[] = [
  { id: 'mx-1', village: 'Чернечий Яр', year: 1875, hasBirth: true, hasMarriage: true, hasDeath: true, hasConfession: false, hasRevision: false },
  { id: 'mx-2', village: 'Чернечий Яр', year: 1878, hasBirth: true, hasMarriage: true, hasDeath: true, hasConfession: false, hasRevision: false },
  { id: 'mx-3', village: 'Чернечий Яр', year: 1880, hasBirth: true, hasMarriage: false, hasDeath: true, hasConfession: true, hasRevision: false }
];

export interface ResearchDataState {
  metricRecords: MetricRecord[];
  documents: GenealogyDocument[];
  tasks: GenealogyTask[];
  findings: GenealogyFinding[];
  hypotheses: GenealogyHypothesis[];
  requests: ArchiveRequest[];
  matrixEntries: YearMatrixEntry[];
  rangeAnalyses: RangeAnalysis[];

  // Metric Records
  setMetricRecords: (records: MetricRecord[] | ((prev: MetricRecord[]) => MetricRecord[])) => void;
  addMetricRecord: (record: any, data?: any) => void;
  updateMetricRecord: (record: any, data?: any) => void;
  deleteMetricRecord: (id: string) => void;
  batchSetMetricRecords: (records: MetricRecord[]) => void;

  // Documents
  setDocuments: (docs: GenealogyDocument[] | ((prev: GenealogyDocument[]) => GenealogyDocument[])) => void;
  addDocument: (doc: any, data?: any) => void;
  updateDocument: (doc: any, data?: any) => void;
  deleteDocument: (id: string) => void;

  // Tasks
  setTasks: (tasks: GenealogyTask[] | ((prev: GenealogyTask[]) => GenealogyTask[])) => void;
  addTask: (task: any, data?: any) => void;
  updateTask: (task: any, data?: any) => void;
  deleteTask: (id: string) => void;

  // Findings
  setFindings: (findings: GenealogyFinding[] | ((prev: GenealogyFinding[]) => GenealogyFinding[])) => void;
  addFinding: (f: any, data?: any) => void;
  updateFinding: (f: any, data?: any) => void;
  deleteFinding: (id: string) => void;

  // Hypotheses
  setHypotheses: (hypotheses: GenealogyHypothesis[] | ((prev: GenealogyHypothesis[]) => GenealogyHypothesis[])) => void;
  addHypothesis: (h: any, data?: any) => void;
  updateHypothesis: (h: any, data?: any) => void;
  deleteHypothesis: (id: string) => void;

  // Requests
  setRequests: (requests: ArchiveRequest[] | ((prev: ArchiveRequest[]) => ArchiveRequest[])) => void;
  addRequest: (r: any, data?: any) => void;
  updateRequest: (r: any, data?: any) => void;
  deleteRequest: (id: string) => void;

  // Matrix
  setMatrixEntries: (entries: YearMatrixEntry[] | ((prev: YearMatrixEntry[]) => YearMatrixEntry[])) => void;
  addMatrixEntry: (e: any, data?: any) => void;
  updateMatrixEntry: (e: any, data?: any) => void;
  deleteMatrixEntry: (id: string) => void;

  // Range
  addRangeAnalysis: (ra: any) => void;
  deleteRangeAnalysis: (id: string) => void;

  // Reset
  resetResearchToSample: () => void;
}

export const useResearchStore = create<ResearchDataState>((set) => ({
  metricRecords: (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_metrics`);
      return saved ? JSON.parse(saved) : INITIAL_METRICS;
    } catch {
      return INITIAL_METRICS;
    }
  })(),

  documents: (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_documents`);
      return saved ? JSON.parse(saved) : INITIAL_DOCUMENTS;
    } catch {
      return INITIAL_DOCUMENTS;
    }
  })(),

  tasks: (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_tasks`);
      return saved ? JSON.parse(saved) : INITIAL_TASKS;
    } catch {
      return INITIAL_TASKS;
    }
  })(),

  findings: (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_findings`);
      return saved ? JSON.parse(saved) : INITIAL_FINDINGS;
    } catch {
      return INITIAL_FINDINGS;
    }
  })(),

  hypotheses: (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_hypotheses`);
      return saved ? JSON.parse(saved) : INITIAL_HYPOTHESES;
    } catch {
      return INITIAL_HYPOTHESES;
    }
  })(),

  requests: (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_requests`);
      return saved ? JSON.parse(saved) : INITIAL_REQUESTS;
    } catch {
      return INITIAL_REQUESTS;
    }
  })(),

  matrixEntries: (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_matrix`);
      return saved ? JSON.parse(saved) : INITIAL_MATRIX;
    } catch {
      return INITIAL_MATRIX;
    }
  })(),

  rangeAnalyses: [],

  setMetricRecords: (updater) =>
    set((state) => {
      const next = typeof updater === 'function' ? updater(state.metricRecords) : updater;
      try {
        localStorage.setItem(`${STORAGE_KEY}_metrics`, JSON.stringify(next));
      } catch {}
      return { metricRecords: next };
    }),

  addMetricRecord: (record, data) =>
    set((state) => {
      const newRec = typeof record === 'string' ? { id: `m-${Date.now()}`, title: record, ...(data || {}) } : record;
      const next = [...state.metricRecords, newRec];
      try {
        localStorage.setItem(`${STORAGE_KEY}_metrics`, JSON.stringify(next));
      } catch {}
      saveMetricRecordDoc(newRec);
      return { metricRecords: next };
    }),

  updateMetricRecord: (record, data) =>
    set((state) => {
      const id = typeof record === 'string' ? record : record.id;
      const patch = typeof record === 'string' ? data : record;
      let updatedRec: any = null;
      const next = state.metricRecords.map((m) => {
        if (m.id === id) {
          updatedRec = { ...m, ...patch };
          return updatedRec;
        }
        return m;
      });
      try {
        localStorage.setItem(`${STORAGE_KEY}_metrics`, JSON.stringify(next));
      } catch {}
      if (updatedRec) saveMetricRecordDoc(updatedRec);
      return { metricRecords: next };
    }),

  deleteMetricRecord: (id) =>
    set((state) => {
      const next = state.metricRecords.filter((m) => m.id !== id);
      try {
        localStorage.setItem(`${STORAGE_KEY}_metrics`, JSON.stringify(next));
      } catch {}
      deleteMetricRecordDoc(id);
      return { metricRecords: next };
    }),

  batchSetMetricRecords: (records) =>
    set(() => {
      try {
        localStorage.setItem(`${STORAGE_KEY}_metrics`, JSON.stringify(records));
      } catch {}
      return { metricRecords: records };
    }),

  setDocuments: (updater) =>
    set((state) => {
      const next = typeof updater === 'function' ? updater(state.documents) : updater;
      try {
        localStorage.setItem(`${STORAGE_KEY}_documents`, JSON.stringify(next));
      } catch {}
      return { documents: next };
    }),

  addDocument: (docItem, data) =>
    set((state) => {
      const newDoc = typeof docItem === 'string' ? { id: `doc-${Date.now()}`, title: docItem, ...(data || {}) } : docItem;
      const next = [...state.documents, newDoc];
      try {
        localStorage.setItem(`${STORAGE_KEY}_documents`, JSON.stringify(next));
      } catch {}
      saveDocumentDoc(newDoc);
      return { documents: next };
    }),

  updateDocument: (docItem, data) =>
    set((state) => {
      const id = typeof docItem === 'string' ? docItem : docItem.id;
      const patch = typeof docItem === 'string' ? data : docItem;
      let updatedDoc: any = null;
      const next = state.documents.map((d) => {
        if (d.id === id) {
          updatedDoc = { ...d, ...patch };
          return updatedDoc;
        }
        return d;
      });
      try {
        localStorage.setItem(`${STORAGE_KEY}_documents`, JSON.stringify(next));
      } catch {}
      if (updatedDoc) saveDocumentDoc(updatedDoc);
      return { documents: next };
    }),

  deleteDocument: (id) =>
    set((state) => {
      const next = state.documents.filter((d) => d.id !== id);
      try {
        localStorage.setItem(`${STORAGE_KEY}_documents`, JSON.stringify(next));
      } catch {}
      deleteDocumentDoc(id);
      return { documents: next };
    }),

  setTasks: (updater) =>
    set((state) => {
      const next = typeof updater === 'function' ? updater(state.tasks) : updater;
      try {
        localStorage.setItem(`${STORAGE_KEY}_tasks`, JSON.stringify(next));
      } catch {}
      return { tasks: next };
    }),

  addTask: (taskItem, data) =>
    set((state) => {
      const newTask = typeof taskItem === 'string' ? { id: `t-${Date.now()}`, title: taskItem, ...(data || {}) } : taskItem;
      const next = [...state.tasks, newTask];
      try {
        localStorage.setItem(`${STORAGE_KEY}_tasks`, JSON.stringify(next));
      } catch {}
      saveTaskDoc(newTask);
      return { tasks: next };
    }),

  updateTask: (taskItem, data) =>
    set((state) => {
      const id = typeof taskItem === 'string' ? taskItem : taskItem.id;
      const patch = typeof taskItem === 'string' ? data : taskItem;
      let updatedTask: any = null;
      const next = state.tasks.map((t) => {
        if (t.id === id) {
          updatedTask = { ...t, ...patch };
          return updatedTask;
        }
        return t;
      });
      try {
        localStorage.setItem(`${STORAGE_KEY}_tasks`, JSON.stringify(next));
      } catch {}
      if (updatedTask) saveTaskDoc(updatedTask);
      return { tasks: next };
    }),

  deleteTask: (id) =>
    set((state) => {
      const next = state.tasks.filter((t) => t.id !== id);
      try {
        localStorage.setItem(`${STORAGE_KEY}_tasks`, JSON.stringify(next));
      } catch {}
      deleteTaskDoc(id);
      return { tasks: next };
    }),

  setFindings: (updater) =>
    set((state) => {
      const next = typeof updater === 'function' ? updater(state.findings) : updater;
      try {
        localStorage.setItem(`${STORAGE_KEY}_findings`, JSON.stringify(next));
      } catch {}
      return { findings: next };
    }),

  addFinding: (findingItem, data) =>
    set((state) => {
      const newF = typeof findingItem === 'string' ? { id: `f-${Date.now()}`, title: findingItem, ...(data || {}) } : findingItem;
      const next = [...state.findings, newF];
      try {
        localStorage.setItem(`${STORAGE_KEY}_findings`, JSON.stringify(next));
      } catch {}
      saveFindingDoc(newF);
      return { findings: next };
    }),

  updateFinding: (findingItem, data) =>
    set((state) => {
      const id = typeof findingItem === 'string' ? findingItem : findingItem.id;
      const patch = typeof findingItem === 'string' ? data : findingItem;
      let updatedF: any = null;
      const next = state.findings.map((f) => {
        if (f.id === id) {
          updatedF = { ...f, ...patch };
          return updatedF;
        }
        return f;
      });
      try {
        localStorage.setItem(`${STORAGE_KEY}_findings`, JSON.stringify(next));
      } catch {}
      if (updatedF) saveFindingDoc(updatedF);
      return { findings: next };
    }),

  deleteFinding: (id) =>
    set((state) => {
      const next = state.findings.filter((f) => f.id !== id);
      try {
        localStorage.setItem(`${STORAGE_KEY}_findings`, JSON.stringify(next));
      } catch {}
      deleteFindingDoc(id);
      return { findings: next };
    }),

  setHypotheses: (updater) =>
    set((state) => {
      const next = typeof updater === 'function' ? updater(state.hypotheses) : updater;
      try {
        localStorage.setItem(`${STORAGE_KEY}_hypotheses`, JSON.stringify(next));
      } catch {}
      return { hypotheses: next };
    }),

  addHypothesis: (hypoItem, data) =>
    set((state) => {
      const newH = typeof hypoItem === 'string' ? { id: `h-${Date.now()}`, title: hypoItem, ...(data || {}) } : hypoItem;
      const next = [...state.hypotheses, newH];
      try {
        localStorage.setItem(`${STORAGE_KEY}_hypotheses`, JSON.stringify(next));
      } catch {}
      saveHypothesisDoc(newH);
      return { hypotheses: next };
    }),

  updateHypothesis: (hypoItem, data) =>
    set((state) => {
      const id = typeof hypoItem === 'string' ? hypoItem : hypoItem.id;
      const patch = typeof hypoItem === 'string' ? data : hypoItem;
      let updatedH: any = null;
      const next = state.hypotheses.map((h) => {
        if (h.id === id) {
          updatedH = { ...h, ...patch };
          return updatedH;
        }
        return h;
      });
      try {
        localStorage.setItem(`${STORAGE_KEY}_hypotheses`, JSON.stringify(next));
      } catch {}
      if (updatedH) saveHypothesisDoc(updatedH);
      return { hypotheses: next };
    }),

  deleteHypothesis: (id) =>
    set((state) => {
      const next = state.hypotheses.filter((h) => h.id !== id);
      try {
        localStorage.setItem(`${STORAGE_KEY}_hypotheses`, JSON.stringify(next));
      } catch {}
      deleteHypothesisDoc(id);
      return { hypotheses: next };
    }),

  setRequests: (updater) =>
    set((state) => {
      const next = typeof updater === 'function' ? updater(state.requests) : updater;
      try {
        localStorage.setItem(`${STORAGE_KEY}_requests`, JSON.stringify(next));
      } catch {}
      return { requests: next };
    }),

  addRequest: (reqItem, data) =>
    set((state) => {
      const newR = typeof reqItem === 'string' ? { id: `req-${Date.now()}`, requestSubject: reqItem, ...(data || {}) } : reqItem;
      const next = [...state.requests, newR];
      try {
        localStorage.setItem(`${STORAGE_KEY}_requests`, JSON.stringify(next));
      } catch {}
      saveRequestDoc(newR);
      return { requests: next };
    }),

  updateRequest: (reqItem, data) =>
    set((state) => {
      const id = typeof reqItem === 'string' ? reqItem : reqItem.id;
      const patch = typeof reqItem === 'string' ? data : reqItem;
      let updatedR: any = null;
      const next = state.requests.map((r) => {
        if (r.id === id) {
          updatedR = { ...r, ...patch };
          return updatedR;
        }
        return r;
      });
      try {
        localStorage.setItem(`${STORAGE_KEY}_requests`, JSON.stringify(next));
      } catch {}
      if (updatedR) saveRequestDoc(updatedR);
      return { requests: next };
    }),

  deleteRequest: (id) =>
    set((state) => {
      const next = state.requests.filter((r) => r.id !== id);
      try {
        localStorage.setItem(`${STORAGE_KEY}_requests`, JSON.stringify(next));
      } catch {}
      deleteRequestDoc(id);
      return { requests: next };
    }),

  setMatrixEntries: (updater) =>
    set((state) => {
      const next = typeof updater === 'function' ? updater(state.matrixEntries) : updater;
      try {
        localStorage.setItem(`${STORAGE_KEY}_matrix`, JSON.stringify(next));
      } catch {}
      return { matrixEntries: next };
    }),

  addMatrixEntry: (entryItem, data) =>
    set((state) => {
      const newE = typeof entryItem === 'string' ? { id: `mx-${Date.now()}`, village: entryItem, ...(data || {}) } : entryItem;
      const next = [...state.matrixEntries, newE];
      try {
        localStorage.setItem(`${STORAGE_KEY}_matrix`, JSON.stringify(next));
      } catch {}
      saveMatrixEntryDoc(newE);
      return { matrixEntries: next };
    }),

  updateMatrixEntry: (entryItem, data) =>
    set((state) => {
      const id = typeof entryItem === 'string' ? entryItem : entryItem.id;
      const patch = typeof entryItem === 'string' ? data : entryItem;
      let updatedE: any = null;
      const next = state.matrixEntries.map((e) => {
        if (e.id === id) {
          updatedE = { ...e, ...patch };
          return updatedE;
        }
        return e;
      });
      try {
        localStorage.setItem(`${STORAGE_KEY}_matrix`, JSON.stringify(next));
      } catch {}
      if (updatedE) saveMatrixEntryDoc(updatedE);
      return { matrixEntries: next };
    }),

  deleteMatrixEntry: (id) =>
    set((state) => {
      const next = state.matrixEntries.filter((e) => e.id !== id);
      try {
        localStorage.setItem(`${STORAGE_KEY}_matrix`, JSON.stringify(next));
      } catch {}
      deleteMatrixEntryDoc(id);
      return { matrixEntries: next };
    }),

  addRangeAnalysis: (ra) =>
    set((state) => ({
      rangeAnalyses: [...state.rangeAnalyses, { ...ra, id: `ra-${Date.now()}` }]
    })),

  deleteRangeAnalysis: (id) =>
    set((state) => ({
      rangeAnalyses: state.rangeAnalyses.filter((r) => r.id !== id)
    })),

  resetResearchToSample: () =>
    set(() => {
      try {
        localStorage.setItem(`${STORAGE_KEY}_metrics`, JSON.stringify(INITIAL_METRICS));
        localStorage.setItem(`${STORAGE_KEY}_documents`, JSON.stringify(INITIAL_DOCUMENTS));
        localStorage.setItem(`${STORAGE_KEY}_tasks`, JSON.stringify(INITIAL_TASKS));
        localStorage.setItem(`${STORAGE_KEY}_findings`, JSON.stringify(INITIAL_FINDINGS));
        localStorage.setItem(`${STORAGE_KEY}_hypotheses`, JSON.stringify(INITIAL_HYPOTHESES));
        localStorage.setItem(`${STORAGE_KEY}_requests`, JSON.stringify(INITIAL_REQUESTS));
        localStorage.setItem(`${STORAGE_KEY}_matrix`, JSON.stringify(INITIAL_MATRIX));
      } catch {}
      return {
        metricRecords: INITIAL_METRICS,
        documents: INITIAL_DOCUMENTS,
        tasks: INITIAL_TASKS,
        findings: INITIAL_FINDINGS,
        hypotheses: INITIAL_HYPOTHESES,
        requests: INITIAL_REQUESTS,
        matrixEntries: INITIAL_MATRIX,
        rangeAnalyses: []
      };
    })
}));
