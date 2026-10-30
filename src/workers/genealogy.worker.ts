/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Web Worker for Off-Main-Thread Genealogy Computations
 * Offloads heavy tasks: GEDCOM parsing, duplicate person scanning, merge pre-analysis, and tree data audit
 */

import { parseGedcom } from '../rodovid/utils/gedcom';
import { analyzeMerge } from '../rodovid/utils/mergeDatabase';
import { detectDuplicatePersons } from '../utils/duplicateDetector';
import { runTreeDataHealthAudit } from '../utils/treeAudit';
import { calculateKinship } from '../rodovid/utils/relationship';

export interface WorkerMessageRequest {
  id: string;
  action: 'PARSE_GEDCOM' | 'DETECT_DUPLICATES' | 'ANALYZE_MERGE' | 'AUDIT_TREE' | 'CALCULATE_KINSHIP';
  payload: any;
}

export interface WorkerMessageResponse {
  id: string;
  type: 'PROGRESS' | 'SUCCESS' | 'ERROR';
  payload?: any;
  error?: string;
}

self.addEventListener('message', (event: MessageEvent<WorkerMessageRequest>) => {
  const { id, action, payload } = event.data;

  if (!id || !action) return;

  const onProgress = (percent: number) => {
    const msg: WorkerMessageResponse = {
      id,
      type: 'PROGRESS',
      payload: percent
    };
    self.postMessage(msg);
  };

  try {
    switch (action) {
      case 'PARSE_GEDCOM': {
        const text = payload?.text || '';
        const result = parseGedcom(text, onProgress);
        const msg: WorkerMessageResponse = {
          id,
          type: 'SUCCESS',
          payload: result
        };
        self.postMessage(msg);
        break;
      }

      case 'DETECT_DUPLICATES': {
        const persons = payload?.persons || [];
        const filterIgnored = Boolean(payload?.filterIgnored);
        const explicitIgnoredKeys = payload?.explicitIgnoredKeys;
        const result = detectDuplicatePersons(persons, filterIgnored, onProgress, explicitIgnoredKeys);
        const msg: WorkerMessageResponse = {
          id,
          type: 'SUCCESS',
          payload: result
        };
        self.postMessage(msg);
        break;
      }

      case 'ANALYZE_MERGE': {
        const currentDb = payload?.currentDb;
        const incomingDb = payload?.incomingDb;
        const result = analyzeMerge(currentDb, incomingDb, onProgress);
        const msg: WorkerMessageResponse = {
          id,
          type: 'SUCCESS',
          payload: result
        };
        self.postMessage(msg);
        break;
      }

      case 'AUDIT_TREE': {
        const persons = payload?.persons || [];
        const families = payload?.families || {};
        const result = runTreeDataHealthAudit(persons, families);
        const msg: WorkerMessageResponse = {
          id,
          type: 'SUCCESS',
          payload: result
        };
        self.postMessage(msg);
        break;
      }

      case 'CALCULATE_KINSHIP': {
        const database = payload?.database;
        const personAId = payload?.personAId;
        const personBId = payload?.personBId;
        const result = calculateKinship(database, personAId, personBId);
        const msg: WorkerMessageResponse = {
          id,
          type: 'SUCCESS',
          payload: result
        };
        self.postMessage(msg);
        break;
      }

      default: {
        const msg: WorkerMessageResponse = {
          id,
          type: 'ERROR',
          error: `Невідома дія: ${action}`
        };
        self.postMessage(msg);
      }
    }
  } catch (err: any) {
    const msg: WorkerMessageResponse = {
      id,
      type: 'ERROR',
      error: err?.message || String(err)
    };
    self.postMessage(msg);
  }
});
