/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useCallback, useMemo } from 'react';
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
  AccessLockConfig
} from '../types';
import { subscribeToProjectData, saveProjectDataToCloud, fetchAllProjectDataFromCloud } from '../lib/firebase';
import { useUIStore } from '../stores/useUIStore';
import { useGenealogyStore, normalizePerson, INITIAL_PERSONS } from '../stores/useGenealogyStore';
import { useResearchStore, INITIAL_METRICS, INITIAL_DOCUMENTS, INITIAL_TASKS, INITIAL_FINDINGS, INITIAL_HYPOTHESES, INITIAL_REQUESTS, INITIAL_MATRIX } from '../stores/useResearchStore';
import { useCloudSyncStore, CloudSyncStatus } from '../stores/useCloudSyncStore';

export { useUIStore } from '../stores/useUIStore';
export { useGenealogyStore, normalizePerson } from '../stores/useGenealogyStore';
export { useResearchStore } from '../stores/useResearchStore';
export { useCloudSyncStore } from '../stores/useCloudSyncStore';

export interface GenealogyContextType {
  // Cloud Sync
  syncStatus: CloudSyncStatus;
  lastSyncTime: string | null;
  lastSyncError: string | null;
  isManualPushing: boolean;
  isManualPulling: boolean;
  triggerUploadToCloud: () => Promise<{ success: boolean; message: string }>;
  triggerDownloadFromCloud: () => Promise<{ success: boolean; message: string; count?: number }>;

  // UI & View State
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
  setPersons: (persons: Person[] | ((prev: Person[]) => Person[])) => void;
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

  // Families, Sources & Events (Unified Domain Layer)
  families: Record<string, any>;
  setFamilies: (families: any) => void;
  saveFamily: (family: any) => void;
  deleteFamily: (id: string) => void;

  sources: Record<string, any>;
  setSources: (sources: any) => void;
  saveSource: (source: any) => void;
  deleteSource: (id: string) => void;

  events: Record<string, any>;
  setEvents: (events: any) => void;
  saveEvent: (event: any) => void;
  deleteEvent: (id: string) => void;

  getGenealogyDatabase: () => any;
  loadGenealogyDatabase: (db: any) => void;

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
  googleDriveEmail: string;
  setGoogleDriveEmail: (email: string) => void;

  // Import / Export
  exportJsonData: () => void;
  exportGedcomData: () => void;
  importJsonData: (jsonStr: string) => boolean;
  resetToSampleData: () => void;
}

const GenealogyContext = createContext<GenealogyContextType | null>(null);

export const GenealogyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Granular store bindings
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const themePalette = useUIStore((s) => s.themePalette);
  const setThemePalette = useUIStore((s) => s.setThemePalette);
  const searchQuery = useUIStore((s) => s.searchQuery);
  const setSearchQuery = useUIStore((s) => s.setSearchQuery);
  const setTreeMode = useUIStore((s) => s.setTreeMode);
  const isUnlocked = useUIStore((s) => s.isUnlocked);
  const unlockWithPin = useUIStore((s) => s.unlockWithPin);
  const lockAppSession = useUIStore((s) => s.lockAppSession);
  const accessLockConfig = useUIStore((s) => s.accessLockConfig);
  const setAccessLockConfig = useUIStore((s) => s.setAccessLockConfig);

  const persons = useGenealogyStore((s) => s.persons);
  const setPersons = useGenealogyStore((s) => s.setPersons);
  const trashPersons = useGenealogyStore((s) => s.trashPersons);
  const selectedPersonId = useGenealogyStore((s) => s.selectedPersonId);
  const setSelectedPersonId = useGenealogyStore((s) => s.setSelectedPersonId);
  const addPerson = useGenealogyStore((s) => s.addPerson);
  const updatePerson = useGenealogyStore((s) => s.updatePerson);
  const deletePerson = useGenealogyStore((s) => s.deletePerson);
  const deletePersons = useGenealogyStore((s) => s.deletePersons);
  const restorePerson = useGenealogyStore((s) => s.restorePerson);
  const restorePersons = useGenealogyStore((s) => s.restorePersons);
  const permanentlyDeletePerson = useGenealogyStore((s) => s.permanentlyDeletePerson);
  const permanentlyDeletePersons = useGenealogyStore((s) => s.permanentlyDeletePersons);
  const emptyTrash = useGenealogyStore((s) => s.emptyTrash);
  const getPersonById = useGenealogyStore((s) => s.getPersonById);
  const gitConfig = useGenealogyStore((s) => s.gitConfig);
  const setGitConfig = useGenealogyStore((s) => s.setGitConfig);
  const googleDriveEmail = useGenealogyStore((s) => s.googleDriveEmail);
  const setGoogleDriveEmail = useGenealogyStore((s) => s.setGoogleDriveEmail);
  const exportGedcomData = useGenealogyStore((s) => s.exportGedcomData);
  const resetPersonsToSample = useGenealogyStore((s) => s.resetPersonsToSample);

  const families = useGenealogyStore((s) => s.families);
  const setFamilies = useGenealogyStore((s) => s.setFamilies);
  const saveFamily = useGenealogyStore((s) => s.saveFamily);
  const deleteFamily = useGenealogyStore((s) => s.deleteFamily);

  const sources = useGenealogyStore((s) => s.sources);
  const setSources = useGenealogyStore((s) => s.setSources);
  const saveSource = useGenealogyStore((s) => s.saveSource);
  const deleteSource = useGenealogyStore((s) => s.deleteSource);

  const events = useGenealogyStore((s) => s.events);
  const setEvents = useGenealogyStore((s) => s.setEvents);
  const saveEvent = useGenealogyStore((s) => s.saveEvent);
  const deleteEvent = useGenealogyStore((s) => s.deleteEvent);

  const getGenealogyDatabase = useGenealogyStore((s) => s.getGenealogyDatabase);
  const loadGenealogyDatabase = useGenealogyStore((s) => s.loadGenealogyDatabase);

  const metricRecords = useResearchStore((s) => s.metricRecords);
  const setMetricRecords = useResearchStore((s) => s.setMetricRecords);
  const addMetricRecord = useResearchStore((s) => s.addMetricRecord);
  const updateMetricRecord = useResearchStore((s) => s.updateMetricRecord);
  const deleteMetricRecord = useResearchStore((s) => s.deleteMetricRecord);
  const batchSetMetricRecords = useResearchStore((s) => s.batchSetMetricRecords);

  const documents = useResearchStore((s) => s.documents);
  const setDocuments = useResearchStore((s) => s.setDocuments);
  const addDocument = useResearchStore((s) => s.addDocument);
  const updateDocument = useResearchStore((s) => s.updateDocument);
  const deleteDocument = useResearchStore((s) => s.deleteDocument);

  const tasks = useResearchStore((s) => s.tasks);
  const setTasks = useResearchStore((s) => s.setTasks);
  const addTask = useResearchStore((s) => s.addTask);
  const updateTask = useResearchStore((s) => s.updateTask);
  const deleteTask = useResearchStore((s) => s.deleteTask);

  const findings = useResearchStore((s) => s.findings);
  const setFindings = useResearchStore((s) => s.setFindings);
  const addFinding = useResearchStore((s) => s.addFinding);
  const updateFinding = useResearchStore((s) => s.updateFinding);
  const deleteFinding = useResearchStore((s) => s.deleteFinding);

  const hypotheses = useResearchStore((s) => s.hypotheses);
  const setHypotheses = useResearchStore((s) => s.setHypotheses);
  const addHypothesis = useResearchStore((s) => s.addHypothesis);
  const updateHypothesis = useResearchStore((s) => s.updateHypothesis);
  const deleteHypothesis = useResearchStore((s) => s.deleteHypothesis);

  const requests = useResearchStore((s) => s.requests);
  const setRequests = useResearchStore((s) => s.setRequests);
  const addRequest = useResearchStore((s) => s.addRequest);
  const updateRequest = useResearchStore((s) => s.updateRequest);
  const deleteRequest = useResearchStore((s) => s.deleteRequest);

  const matrixEntries = useResearchStore((s) => s.matrixEntries);
  const setMatrixEntries = useResearchStore((s) => s.setMatrixEntries);
  const addMatrixEntry = useResearchStore((s) => s.addMatrixEntry);
  const updateMatrixEntry = useResearchStore((s) => s.updateMatrixEntry);
  const deleteMatrixEntry = useResearchStore((s) => s.deleteMatrixEntry);

  const rangeAnalyses = useResearchStore((s) => s.rangeAnalyses);
  const addRangeAnalysis = useResearchStore((s) => s.addRangeAnalysis);
  const deleteRangeAnalysis = useResearchStore((s) => s.deleteRangeAnalysis);
  const resetResearchToSample = useResearchStore((s) => s.resetResearchToSample);

  const syncStatus = useCloudSyncStore((s) => s.status);
  const lastSyncTime = useCloudSyncStore((s) => s.lastSyncTime);
  const lastSyncError = useCloudSyncStore((s) => s.lastError);
  const isManualPushing = useCloudSyncStore((s) => s.isManualPushing);
  const isManualPulling = useCloudSyncStore((s) => s.isManualPulling);
  const setStatus = useCloudSyncStore((s) => s.setStatus);
  const setLastSyncTime = useCloudSyncStore((s) => s.setLastSyncTime);
  const setIsManualPushing = useCloudSyncStore((s) => s.setIsManualPushing);
  const setIsManualPulling = useCloudSyncStore((s) => s.setIsManualPulling);

  // Firestore Sync Listener
  useEffect(() => {
    const unsubscribe = subscribeToProjectData((cloudData) => {
      if (!cloudData) return;
      if (cloudData.persons && Array.isArray(cloudData.persons) && cloudData.persons.length > 0) {
        setPersons(cloudData.persons);
      }
      if (cloudData.families && Array.isArray(cloudData.families)) {
        const famMap: Record<string, any> = {};
        cloudData.families.forEach((f: any) => { if (f && f.id) famMap[f.id] = f; });
        setFamilies(famMap);
      }
      if (cloudData.events && Array.isArray(cloudData.events)) {
        const evMap: Record<string, any> = {};
        cloudData.events.forEach((e: any) => { if (e && e.id) evMap[e.id] = e; });
        setEvents(evMap);
      }
      if (cloudData.sources && Array.isArray(cloudData.sources)) {
        const srcMap: Record<string, any> = {};
        cloudData.sources.forEach((s: any) => { if (s && s.id) srcMap[s.id] = s; });
        setSources(srcMap);
      }
      if (cloudData.metricRecords && Array.isArray(cloudData.metricRecords)) setMetricRecords(cloudData.metricRecords);
      if (cloudData.documents && Array.isArray(cloudData.documents)) setDocuments(cloudData.documents);
      if (cloudData.tasks && Array.isArray(cloudData.tasks)) setTasks(cloudData.tasks);
      if (cloudData.findings && Array.isArray(cloudData.findings)) setFindings(cloudData.findings);
      if (cloudData.hypotheses && Array.isArray(cloudData.hypotheses)) setHypotheses(cloudData.hypotheses);
      if (cloudData.requests && Array.isArray(cloudData.requests)) setRequests(cloudData.requests);
      if (cloudData.matrixEntries && Array.isArray(cloudData.matrixEntries)) setMatrixEntries(cloudData.matrixEntries);
      setStatus('synced');
    });

    return () => {
      unsubscribe();
    };
  }, [setPersons, setFamilies, setEvents, setSources, setMetricRecords, setDocuments, setTasks, setFindings, setHypotheses, setRequests, setMatrixEntries, setStatus]);

  // Debounced auto-sync to Firestore
  useEffect(() => {
    const timer = setTimeout(() => {
      saveProjectDataToCloud({
        persons,
        families: Object.values(families || {}),
        events: Object.values(events || {}),
        sources: Object.values(sources || {}),
        metricRecords,
        documents,
        tasks,
        findings,
        hypotheses,
        requests,
        matrixEntries,
        lastUpdated: new Date().toISOString()
      }).then((ok) => {
        if (ok) {
          setStatus('synced');
          setLastSyncTime(new Date().toISOString());
        }
      });
    }, 2500);

    return () => clearTimeout(timer);
  }, [persons, families, events, sources, metricRecords, documents, tasks, findings, hypotheses, requests, matrixEntries, setStatus, setLastSyncTime]);

  // Manual Trigger: Force Upload to Cloud
  const triggerUploadToCloud = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    setIsManualPushing(true);
    setStatus('syncing');
    try {
      const ok = await saveProjectDataToCloud({
        persons,
        families: Object.values(families || {}),
        events: Object.values(events || {}),
        sources: Object.values(sources || {}),
        metricRecords,
        documents,
        tasks,
        findings,
        hypotheses,
        requests,
        matrixEntries,
        lastUpdated: new Date().toISOString()
      });

      if (ok) {
        setStatus('synced');
        setLastSyncTime(new Date().toISOString());
        setIsManualPushing(false);
        return { success: true, message: `Успішно вивантажено ${persons.length} осіб, ${Object.keys(families).length} родин та ${metricRecords.length} метричних записів у Firestore!` };
      } else {
        setStatus('error', 'Помилка запису в Firestore');
        setIsManualPushing(false);
        return { success: false, message: 'Помилка вивантаження даних у хмару Firestore.' };
      }
    } catch (err: any) {
      const msg = err?.message || 'Помилка підключення до Firebase';
      setStatus('error', msg);
      setIsManualPushing(false);
      return { success: false, message: msg };
    }
  }, [persons, families, events, sources, metricRecords, documents, tasks, findings, hypotheses, requests, matrixEntries, setStatus, setLastSyncTime, setIsManualPushing]);

  // Manual Trigger: Force Download from Cloud
  const triggerDownloadFromCloud = useCallback(async (): Promise<{ success: boolean; message: string; count?: number }> => {
    setIsManualPulling(true);
    setStatus('syncing');
    try {
      const res = await fetchAllProjectDataFromCloud();
      if (res.success && res.data) {
        const d = res.data;
        let totalCount = 0;

        if (Array.isArray(d.persons) && d.persons.length > 0) {
          setPersons(d.persons);
          totalCount += d.persons.length;
        }
        if (Array.isArray(d.families)) {
          const famMap: Record<string, any> = {};
          d.families.forEach((f: any) => { if (f && f.id) famMap[f.id] = f; });
          setFamilies(famMap);
        }
        if (Array.isArray(d.events)) {
          const evMap: Record<string, any> = {};
          d.events.forEach((e: any) => { if (e && e.id) evMap[e.id] = e; });
          setEvents(evMap);
        }
        if (Array.isArray(d.sources)) {
          const srcMap: Record<string, any> = {};
          d.sources.forEach((s: any) => { if (s && s.id) srcMap[s.id] = s; });
          setSources(srcMap);
        }
        if (Array.isArray(d.metricRecords)) {
          setMetricRecords(d.metricRecords);
          totalCount += d.metricRecords.length;
        }
        if (Array.isArray(d.documents)) setDocuments(d.documents);
        if (Array.isArray(d.tasks)) setTasks(d.tasks);
        if (Array.isArray(d.findings)) setFindings(d.findings);
        if (Array.isArray(d.hypotheses)) setHypotheses(d.hypotheses);
        if (Array.isArray(d.requests)) setRequests(d.requests);
        if (Array.isArray(d.matrixEntries)) setMatrixEntries(d.matrixEntries);

        setStatus('synced');
        setLastSyncTime(new Date().toISOString());
        setIsManualPulling(false);
        return {
          success: true,
          count: totalCount,
          message: `Дані успішно завантажено з Firestore (отримано ${d.persons?.length || 0} осіб, ${d.metricRecords?.length || 0} метрик)!`
        };
      } else {
        setStatus('error', res.error || 'Помилка читання даних з Firestore');
        setIsManualPulling(false);
        return { success: false, message: res.error || 'Не вдалося завантажити дані з Firestore.' };
      }
    } catch (err: any) {
      const msg = err?.message || 'Помилка підключення до Firebase';
      setStatus('error', msg);
      setIsManualPulling(false);
      return { success: false, message: msg };
    }
  }, [setPersons, setFamilies, setEvents, setSources, setMetricRecords, setDocuments, setTasks, setFindings, setHypotheses, setRequests, setMatrixEntries, setStatus, setLastSyncTime, setIsManualPulling]);

  // Export JSON
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

  // Import JSON
  const importJsonData = useCallback(
    (jsonStr: string) => {
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
    },
    [setPersons, setMetricRecords, setDocuments, setTasks, setFindings, setHypotheses, setRequests, setMatrixEntries]
  );

  // Reset to sample
  const resetToSampleData = useCallback(() => {
    resetPersonsToSample();
    resetResearchToSample();
  }, [resetPersonsToSample, resetResearchToSample]);

  const value = useMemo(
    () => ({
      syncStatus,
      lastSyncTime,
      lastSyncError,
      isManualPushing,
      isManualPulling,
      triggerUploadToCloud,
      triggerDownloadFromCloud,
      persons,
      setPersons,
      trashPersons,
      selectedPersonId,
      setSelectedPersonId,
      activeTab,
      setActiveTab,
      themePalette,
      setThemePalette,
      searchQuery,
      setSearchQuery,
      setTreeMode,
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
      families,
      setFamilies,
      saveFamily,
      deleteFamily,
      sources,
      setSources,
      saveSource,
      deleteSource,
      events,
      setEvents,
      saveEvent,
      deleteEvent,
      getGenealogyDatabase,
      loadGenealogyDatabase,
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
      googleDriveEmail,
      setGoogleDriveEmail,
      exportJsonData,
      exportGedcomData,
      importJsonData,
      resetToSampleData
    }),
    [
      syncStatus,
      lastSyncTime,
      lastSyncError,
      isManualPushing,
      isManualPulling,
      triggerUploadToCloud,
      triggerDownloadFromCloud,
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
      setTreeMode,
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
      families,
      setFamilies,
      saveFamily,
      deleteFamily,
      sources,
      setSources,
      saveSource,
      deleteSource,
      events,
      setEvents,
      saveEvent,
      deleteEvent,
      getGenealogyDatabase,
      loadGenealogyDatabase,
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
      googleDriveEmail,
      setGoogleDriveEmail,
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
