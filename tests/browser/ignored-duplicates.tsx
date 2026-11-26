import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SmartMergeModal } from '../../src/rodovid/components/modals/SmartMergeModal';
import { detectDuplicatePersons, clearDuplicateDetectorCache, ignoreDuplicatePair, unignoreDuplicatePair } from '../../src/utils/duplicateDetector';
import { applyCloudIgnoredDuplicateSnapshot, getPendingIgnoredDuplicateChanges, hydrateIgnoredDuplicateState } from '../../src/utils/ignoredDuplicateState';
import { applyIgnoredDuplicateChanges } from '../../src/utils/ignoredDuplicateKeys';
import { synchronizeProject } from '../../src/services/cloudSyncService';
import { useCloudSyncStore } from '../../src/stores/useCloudSyncStore';
import '../../src/index.css';

const persons: any[] = [
  { id: 'synthetic_a', firstName: 'Іван', lastName: 'Тестовий', gender: 'M', birthDate: '1900', deathDate: '1980', fatherId: 'dad' },
  { id: 'synthetic_b', firstName: 'Іван', lastName: 'Тестовий', gender: 'M', birthDate: '1900', deathDate: '1980', fatherId: 'dad' }
];
let server = JSON.parse(localStorage.getItem('qa_ignored_duplicate_server') || '{"keys":[],"revision":0}');
let uploads = 0, callbacks = 0, failed = false, merges = 0;
let rescan!: () => void;
const api = { savePersonDoc: async () => true, savePersonDeltaDoc: async () => true, batchDeleteEntities: async () => true,
  saveProjectDataToCloud: async () => true,
  updateIgnoredDuplicatePairs: async changes => {
    uploads++; if (failed) return null;
    server = { keys: applyIgnoredDuplicateChanges(server.keys, changes), revision: server.revision + 1 };
    localStorage.setItem('qa_ignored_duplicate_server', JSON.stringify(server)); return server;
  } };
const data = () => ({ persons, families: {}, events: {}, sources: {}, places: {}, metricRecords: [], documents: [],
  tasks: [], findings: [], hypotheses: [], requests: [], matrixEntries: [] });
useCloudSyncStore.getState().setSyncMode('manual');
function Fixture() {
  const [revision, setRevision] = useState(0), [open, setOpen] = useState(false), [ready, setReady] = useState(false);
  rescan = () => { clearDuplicateDetectorCache(); setRevision(value => value + 1); };
  useEffect(() => {
    const update = () => setRevision(value => value + 1);
    window.addEventListener('rodovid_ignored_duplicates_changed', update);
    void hydrateIgnoredDuplicateState().then(() => { setReady(true); update(); });
    return () => window.removeEventListener('rodovid_ignored_duplicates_changed', update);
  }, []);
  const pairs = useMemo(() => detectDuplicatePersons(persons, true), [revision]);
  return <main style={{ padding: 30, color: 'white' }}>
    <h1>Синтетичні особи · без робочої хмари</h1>
    <p data-testid="ready">{ready ? 'ready' : 'loading'}</p>
    <p>Активні пропозиції: <span data-testid="count">{pairs.length}</span></p>
    <button onClick={() => setOpen(true)} disabled={!pairs.length}>Порівняти осіб</button>
    {open && pairs[0] && <SmartMergeModal pair={pairs[0]} allPersons={persons} allFamilies={{}} isOpen
      onClose={() => setOpen(false)} onMergeComplete={() => { merges++; throw new Error('Merging is not part of this fixture'); }}
      onMarkNotDuplicate={new URLSearchParams(location.search).has('fallback') ? undefined : pair => {
        callbacks++; ignoreDuplicatePair(pair.personA.id, pair.personB.id);
      }} />}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
(window as any).ignoredQA = {
  rescan: () => rescan(), cloud: snapshot => applyCloudIgnoredDuplicateSnapshot(snapshot),
  undo: () => unignoreDuplicatePair('synthetic_a', 'synthetic_b'),
  upload: async () => { const result = await synchronizeProject(data, api); rescan(); return result; },
  fail: (value: boolean) => { failed = value; },
  stats: () => ({ pending: Object.keys(getPendingIgnoredDuplicateChanges()).length, uploads, callbacks, merges,
    persons: persons.length, server })
};
