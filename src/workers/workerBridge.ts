/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Worker Bridge for Off-Main-Thread Computations
 * Manages Web Worker lifecycle with Promise-based dispatch and synchronous main-thread fallback
 */

import { GenealogyDatabase, Person, Family } from '../rodovid/types/genealogy';
import { MergeAnalysis, analyzeMerge } from '../rodovid/utils/mergeDatabase';
import { parseGedcom } from '../rodovid/utils/gedcom';
import { DuplicatePair } from '../types';
import { detectDuplicatePersons, getIgnoredDuplicatePairKeys } from '../utils/duplicateDetector';
import { TreeHealthReport, runTreeDataHealthAudit } from '../utils/treeAudit';
import { calculateKinship, KinshipCalculationResult } from '../rodovid/utils/relationship';
import { WorkerMessageRequest, WorkerMessageResponse } from './genealogy.worker';

let workerInstance: Worker | null = null;
let workerInitializationFailed = false;

interface PendingTask {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  onProgress?: (percent: number) => void;
}

const pendingTasks = new Map<string, PendingTask>();

function getWorker(): Worker | null {
  if (workerInitializationFailed) return null;
  if (typeof window === 'undefined' || typeof Worker === 'undefined') return null;

  if (!workerInstance) {
    try {
      workerInstance = new Worker(new URL('./genealogy.worker.ts', import.meta.url), {
        type: 'module'
      });

      workerInstance.onmessage = (event: MessageEvent<WorkerMessageResponse>) => {
        const { id, type, payload, error } = event.data;
        const task = pendingTasks.get(id);
        if (!task) return;

        if (type === 'PROGRESS') {
          if (task.onProgress && typeof payload === 'number') {
            task.onProgress(payload);
          }
        } else if (type === 'SUCCESS') {
          pendingTasks.delete(id);
          task.resolve(payload);
        } else if (type === 'ERROR') {
          pendingTasks.delete(id);
          task.reject(new Error(error || 'Worker execution error'));
        }
      };

      workerInstance.onerror = (err) => {
        console.warn('Genealogy Web Worker encountered an error, falling back to main thread:', err);
        // Fail all pending tasks and clear worker
        pendingTasks.forEach((task) => {
          task.reject(new Error('Web Worker process terminated or failed'));
        });
        pendingTasks.clear();
        if (workerInstance) {
          workerInstance.terminate();
          workerInstance = null;
        }
        workerInitializationFailed = true;
      };
    } catch (err) {
      console.warn('Unable to initialize Web Worker, using main-thread fallback:', err);
      workerInitializationFailed = true;
      return null;
    }
  }

  return workerInstance;
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Offloads GEDCOM text parsing to background worker.
 * Keeps UI at 60 FPS and reports parsing percentage.
 */
export async function parseGedcomAsync(
  text: string,
  onProgress?: (percent: number) => void
): Promise<GenealogyDatabase> {
  const worker = getWorker();

  if (!worker) {
    // Graceful synchronous main-thread fallback
    return parseGedcom(text, onProgress);
  }

  const id = generateRequestId();

  return new Promise<GenealogyDatabase>((resolve, reject) => {
    pendingTasks.set(id, {
      resolve,
      reject: (err) => {
        console.warn('Worker task failed, retrying on main thread:', err);
        try {
          resolve(parseGedcom(text, onProgress));
        } catch (syncErr) {
          reject(syncErr);
        }
      },
      onProgress
    });

    const msg: WorkerMessageRequest = {
      id,
      action: 'PARSE_GEDCOM',
      payload: { text }
    };
    worker.postMessage(msg);
  });
}

/**
 * Offloads full-tree duplicate person detection to background worker.
 */
export async function detectDuplicatesAsync(
  persons: Person[],
  filterIgnored = false,
  explicitIgnoredKeys?: string[],
  onProgress?: (percent: number) => void
): Promise<DuplicatePair[]> {
  const worker = getWorker();
  const ignoredKeys = explicitIgnoredKeys || (filterIgnored ? Array.from(getIgnoredDuplicatePairKeys()) : undefined);

  if (!worker) {
    return detectDuplicatePersons(persons, filterIgnored, onProgress, ignoredKeys);
  }

  const id = generateRequestId();

  return new Promise<DuplicatePair[]>((resolve, reject) => {
    pendingTasks.set(id, {
      resolve,
      reject: (err) => {
        console.warn('Worker duplicate search failed, retrying on main thread:', err);
        try {
          resolve(detectDuplicatePersons(persons, filterIgnored, onProgress, ignoredKeys));
        } catch (syncErr) {
          reject(syncErr);
        }
      },
      onProgress
    });

    const msg: WorkerMessageRequest = {
      id,
      action: 'DETECT_DUPLICATES',
      payload: {
        persons,
        filterIgnored,
        explicitIgnoredKeys: ignoredKeys
      }
    };
    worker.postMessage(msg);
  });
}

/**
 * Offloads pre-merge pairwise analysis and conflict evaluation to background worker.
 */
export async function analyzeMergeAsync(
  currentDb: GenealogyDatabase,
  incomingDb: GenealogyDatabase,
  onProgress?: (percent: number) => void
): Promise<MergeAnalysis> {
  const worker = getWorker();

  if (!worker) {
    return analyzeMerge(currentDb, incomingDb, onProgress);
  }

  const id = generateRequestId();

  return new Promise<MergeAnalysis>((resolve, reject) => {
    pendingTasks.set(id, {
      resolve,
      reject: (err) => {
        console.warn('Worker merge analysis failed, retrying on main thread:', err);
        try {
          resolve(analyzeMerge(currentDb, incomingDb, onProgress));
        } catch (syncErr) {
          reject(syncErr);
        }
      },
      onProgress
    });

    const msg: WorkerMessageRequest = {
      id,
      action: 'ANALYZE_MERGE',
      payload: { currentDb, incomingDb }
    };
    worker.postMessage(msg);
  });
}

/**
 * Offloads tree health and structural integrity audit to background worker.
 */
export async function auditTreeAsync(
  persons: Person[],
  families: Record<string, Family>
): Promise<TreeHealthReport> {
  const worker = getWorker();

  if (!worker) {
    return runTreeDataHealthAudit(persons, families);
  }

  const id = generateRequestId();

  return new Promise<TreeHealthReport>((resolve, reject) => {
    pendingTasks.set(id, {
      resolve,
      reject: (err) => {
        console.warn('Worker audit failed, retrying on main thread:', err);
        try {
          resolve(runTreeDataHealthAudit(persons, families));
        } catch (syncErr) {
          reject(syncErr);
        }
      }
    });

    const msg: WorkerMessageRequest = {
      id,
      action: 'AUDIT_TREE',
      payload: { persons, families }
    };
    worker.postMessage(msg);
  });
}

/**
 * Offloads BFS genealogical graph pathfinding, LCA common ancestor computation,
 * and kinship degree calculation to background Web Worker.
 * Preserves 60 FPS UI responsiveness on multi-thousand node genealogies.
 */
export async function calculateKinshipAsync(
  database: GenealogyDatabase,
  personAId: string,
  personBId: string
): Promise<KinshipCalculationResult> {
  const worker = getWorker();

  if (!worker) {
    return calculateKinship(database, personAId, personBId);
  }

  const id = generateRequestId();

  return new Promise<KinshipCalculationResult>((resolve, reject) => {
    pendingTasks.set(id, {
      resolve,
      reject: (err) => {
        console.warn('Worker kinship calculation failed, retrying on main thread:', err);
        try {
          resolve(calculateKinship(database, personAId, personBId));
        } catch (syncErr) {
          reject(syncErr);
        }
      }
    });

    const msg: WorkerMessageRequest = {
      id,
      action: 'CALCULATE_KINSHIP',
      payload: { database, personAId, personBId }
    };
    worker.postMessage(msg);
  });
}
