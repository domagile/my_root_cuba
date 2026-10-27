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
  deleteMatrixEntryDoc,
  batchSaveEntities,
  batchDeleteEntities
} from '../lib/firebase';
import { isDemoResearchItem } from '../utils/demoPurge';
import { persistLocalData, idbGet } from '../utils/indexedDbStorage';

const STORAGE_KEY = 'genealogy_workstation_data_v2';

export const INITIAL_METRICS: MetricRecord[] = [];
export const INITIAL_DOCUMENTS: GenealogyDocument[] = [];
export const INITIAL_TASKS: GenealogyTask[] = [];
export const INITIAL_HYPOTHESES: GenealogyHypothesis[] = [];
export const INITIAL_FINDINGS: GenealogyFinding[] = [];
export const INITIAL_REQUESTS: ArchiveRequest[] = [];
export const INITIAL_MATRIX: YearMatrixEntry[] = [];

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
  batchAddMetricRecords: (records: MetricRecord[]) => void;

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

  // Purge Demo Data
  purgeDemoResearchData: () => void;
  hydrateFromIndexedDB: () => Promise<void>;
}

export const useResearchStore = create<ResearchDataState>((set, get) => ({
  metricRecords: (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_metrics`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((m) => !isDemoResearchItem(m));
        }
      }
      return [];
    } catch {
      return [];
    }
  })(),

  documents: (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_documents`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((d) => !isDemoResearchItem(d));
        }
      }
      return [];
    } catch {
      return [];
    }
  })(),

  tasks: (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_tasks`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((t) => !isDemoResearchItem(t));
        }
      }
      return [];
    } catch {
      return [];
    }
  })(),

  findings: (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_findings`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((f) => !isDemoResearchItem(f));
        }
      }
      return [];
    } catch {
      return [];
    }
  })(),

  hypotheses: (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_hypotheses`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((h) => !isDemoResearchItem(h));
        }
      }
      return [];
    } catch {
      return [];
    }
  })(),

  requests: (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_requests`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((r) => !isDemoResearchItem(r));
        }
      }
      return [];
    } catch {
      return [];
    }
  })(),

  matrixEntries: (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_matrix`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((e) => !isDemoResearchItem(e));
        }
      }
      return [];
    } catch {
      return [];
    }
  })(),

  rangeAnalyses: [],

  setMetricRecords: (updater) =>
    set((state) => {
      const next = typeof updater === 'function' ? updater(state.metricRecords) : updater;
      persistLocalData(`${STORAGE_KEY}_metrics`, next);
      return { metricRecords: next };
    }),

  addMetricRecord: (record, data) =>
    set((state) => {
      const newRec = typeof record === 'string' ? { id: `m-${Date.now()}`, title: record, ...(data || {}) } : record;
      const next = [...state.metricRecords, newRec];
      persistLocalData(`${STORAGE_KEY}_metrics`, next);
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
      persistLocalData(`${STORAGE_KEY}_metrics`, next);
      if (updatedRec) saveMetricRecordDoc(updatedRec);
      return { metricRecords: next };
    }),

  deleteMetricRecord: (id) =>
    set((state) => {
      const next = state.metricRecords.filter((m) => m.id !== id);
      persistLocalData(`${STORAGE_KEY}_metrics`, next);
      deleteMetricRecordDoc(id);
      return { metricRecords: next };
    }),

  batchSetMetricRecords: (records) =>
    set(() => {
      persistLocalData(`${STORAGE_KEY}_metrics`, records);
      return { metricRecords: records };
    }),

  batchAddMetricRecords: (records) =>
    set((state) => {
      if (!records || records.length === 0) return state;
      const next = [...state.metricRecords, ...records];
      persistLocalData(`${STORAGE_KEY}_metrics`, next);
      batchSaveEntities('metricRecords', records).catch(() => {});
      return { metricRecords: next };
    }),

  setDocuments: (updater) =>
    set((state) => {
      const next = typeof updater === 'function' ? updater(state.documents) : updater;
      persistLocalData(`${STORAGE_KEY}_documents`, next);
      return { documents: next };
    }),

  addDocument: (docItem, data) =>
    set((state) => {
      const newDoc = typeof docItem === 'string' ? { id: `doc-${Date.now()}`, title: docItem, ...(data || {}) } : docItem;
      const next = [...state.documents, newDoc];
      persistLocalData(`${STORAGE_KEY}_documents`, next);
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
      persistLocalData(`${STORAGE_KEY}_documents`, next);
      if (updatedDoc) saveDocumentDoc(updatedDoc);
      return { documents: next };
    }),

  deleteDocument: (id) =>
    set((state) => {
      const next = state.documents.filter((d) => d.id !== id);
      persistLocalData(`${STORAGE_KEY}_documents`, next);
      deleteDocumentDoc(id);
      return { documents: next };
    }),

  setTasks: (updater) =>
    set((state) => {
      const next = typeof updater === 'function' ? updater(state.tasks) : updater;
      persistLocalData(`${STORAGE_KEY}_tasks`, next);
      return { tasks: next };
    }),

  addTask: (taskItem, data) =>
    set((state) => {
      const newTask = typeof taskItem === 'string' ? { id: `t-${Date.now()}`, title: taskItem, ...(data || {}) } : taskItem;
      const next = [...state.tasks, newTask];
      persistLocalData(`${STORAGE_KEY}_tasks`, next);
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
      persistLocalData(`${STORAGE_KEY}_tasks`, next);
      if (updatedTask) saveTaskDoc(updatedTask);
      return { tasks: next };
    }),

  deleteTask: (id) =>
    set((state) => {
      const next = state.tasks.filter((t) => t.id !== id);
      persistLocalData(`${STORAGE_KEY}_tasks`, next);
      deleteTaskDoc(id);
      return { tasks: next };
    }),

  setFindings: (updater) =>
    set((state) => {
      const next = typeof updater === 'function' ? updater(state.findings) : updater;
      persistLocalData(`${STORAGE_KEY}_findings`, next);
      return { findings: next };
    }),

  addFinding: (findingItem, data) =>
    set((state) => {
      const newF = typeof findingItem === 'string' ? { id: `f-${Date.now()}`, title: findingItem, ...(data || {}) } : findingItem;
      const next = [...state.findings, newF];
      persistLocalData(`${STORAGE_KEY}_findings`, next);
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
      persistLocalData(`${STORAGE_KEY}_findings`, next);
      if (updatedF) saveFindingDoc(updatedF);
      return { findings: next };
    }),

  deleteFinding: (id) =>
    set((state) => {
      const next = state.findings.filter((m) => m.id !== id);
      persistLocalData(`${STORAGE_KEY}_findings`, next);
      deleteFindingDoc(id);
      return { findings: next };
    }),

  setHypotheses: (updater) =>
    set((state) => {
      const next = typeof updater === 'function' ? updater(state.hypotheses) : updater;
      persistLocalData(`${STORAGE_KEY}_hypotheses`, next);
      return { hypotheses: next };
    }),

  addHypothesis: (hypoItem, data) =>
    set((state) => {
      const newH = typeof hypoItem === 'string' ? { id: `h-${Date.now()}`, title: hypoItem, ...(data || {}) } : hypoItem;
      const next = [...state.hypotheses, newH];
      persistLocalData(`${STORAGE_KEY}_hypotheses`, next);
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
      persistLocalData(`${STORAGE_KEY}_hypotheses`, next);
      if (updatedH) saveHypothesisDoc(updatedH);
      return { hypotheses: next };
    }),

  deleteHypothesis: (id) =>
    set((state) => {
      const next = state.hypotheses.filter((h) => h.id !== id);
      persistLocalData(`${STORAGE_KEY}_hypotheses`, next);
      deleteHypothesisDoc(id);
      return { hypotheses: next };
    }),

  setRequests: (updater) =>
    set((state) => {
      const next = typeof updater === 'function' ? updater(state.requests) : updater;
      persistLocalData(`${STORAGE_KEY}_requests`, next);
      return { requests: next };
    }),

  addRequest: (reqItem, data) =>
    set((state) => {
      const newR = typeof reqItem === 'string' ? { id: `req-${Date.now()}`, requestSubject: reqItem, ...(data || {}) } : reqItem;
      const next = [...state.requests, newR];
      persistLocalData(`${STORAGE_KEY}_requests`, next);
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
      persistLocalData(`${STORAGE_KEY}_requests`, next);
      if (updatedR) saveRequestDoc(updatedR);
      return { requests: next };
    }),

  deleteRequest: (id) =>
    set((state) => {
      const next = state.requests.filter((r) => r.id !== id);
      persistLocalData(`${STORAGE_KEY}_requests`, next);
      deleteRequestDoc(id);
      return { requests: next };
    }),

  setMatrixEntries: (updater) =>
    set((state) => {
      const next = typeof updater === 'function' ? updater(state.matrixEntries) : updater;
      persistLocalData(`${STORAGE_KEY}_matrix`, next);
      return { matrixEntries: next };
    }),

  addMatrixEntry: (entryItem, data) =>
    set((state) => {
      const newE = typeof entryItem === 'string' ? { id: `mx-${Date.now()}`, village: entryItem, ...(data || {}) } : entryItem;
      const next = [...state.matrixEntries, newE];
      persistLocalData(`${STORAGE_KEY}_matrix`, next);
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
      persistLocalData(`${STORAGE_KEY}_matrix`, next);
      if (updatedE) saveMatrixEntryDoc(updatedE);
      return { matrixEntries: next };
    }),

  deleteMatrixEntry: (id) =>
    set((state) => {
      const next = state.matrixEntries.filter((e) => e.id !== id);
      persistLocalData(`${STORAGE_KEY}_matrix`, next);
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

  purgeDemoResearchData: () =>
    set((state) => {
      const cleanMetrics = state.metricRecords.filter((m) => !isDemoResearchItem(m));
      const cleanDocs = state.documents.filter((d) => !isDemoResearchItem(d));
      const cleanTasks = state.tasks.filter((t) => !isDemoResearchItem(t));
      const cleanFindings = state.findings.filter((f) => !isDemoResearchItem(f));
      const cleanHypotheses = state.hypotheses.filter((h) => !isDemoResearchItem(h));
      const cleanRequests = state.requests.filter((r) => !isDemoResearchItem(r));
      const cleanMatrix = state.matrixEntries.filter((e) => !isDemoResearchItem(e));

      persistLocalData(`${STORAGE_KEY}_metrics`, cleanMetrics);
      persistLocalData(`${STORAGE_KEY}_documents`, cleanDocs);
      persistLocalData(`${STORAGE_KEY}_tasks`, cleanTasks);
      persistLocalData(`${STORAGE_KEY}_findings`, cleanFindings);
      persistLocalData(`${STORAGE_KEY}_hypotheses`, cleanHypotheses);
      persistLocalData(`${STORAGE_KEY}_requests`, cleanRequests);
      persistLocalData(`${STORAGE_KEY}_matrix`, cleanMatrix);

      return {
        metricRecords: cleanMetrics,
        documents: cleanDocs,
        tasks: cleanTasks,
        findings: cleanFindings,
        hypotheses: cleanHypotheses,
        requests: cleanRequests,
        matrixEntries: cleanMatrix,
        rangeAnalyses: []
      };
    }),

  hydrateFromIndexedDB: async () => {
    try {
      const [m, d, t, f, h, r, mx] = await Promise.all([
        idbGet<MetricRecord[]>(`${STORAGE_KEY}_metrics`),
        idbGet<GenealogyDocument[]>(`${STORAGE_KEY}_documents`),
        idbGet<GenealogyTask[]>(`${STORAGE_KEY}_tasks`),
        idbGet<GenealogyFinding[]>(`${STORAGE_KEY}_findings`),
        idbGet<GenealogyHypothesis[]>(`${STORAGE_KEY}_hypotheses`),
        idbGet<ArchiveRequest[]>(`${STORAGE_KEY}_requests`),
        idbGet<YearMatrixEntry[]>(`${STORAGE_KEY}_matrix`)
      ]);
      const state = get();
      const updates: Partial<ResearchDataState> = {};
      if (Array.isArray(m) && m.length > state.metricRecords.length) updates.metricRecords = m;
      if (Array.isArray(d) && d.length > state.documents.length) updates.documents = d;
      if (Array.isArray(t) && t.length > state.tasks.length) updates.tasks = t;
      if (Array.isArray(f) && f.length > state.findings.length) updates.findings = f;
      if (Array.isArray(h) && h.length > state.hypotheses.length) updates.hypotheses = h;
      if (Array.isArray(r) && r.length > state.requests.length) updates.requests = r;
      if (Array.isArray(mx) && mx.length > state.matrixEntries.length) updates.matrixEntries = mx;
      if (Object.keys(updates).length > 0) set(updates);
    } catch {}
  }
}));
