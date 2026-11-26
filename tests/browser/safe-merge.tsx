import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SmartMergeModal } from '../../src/rodovid/components/modals/SmartMergeModal';
import { MergePersonsByIdModal } from '../../src/components/modals/MergePersonsByIdModal';
import { ConflictsView } from '../../src/rodovid/components/views/ConflictsView';
import { UndoPersonMergeButton } from '../../src/components/UndoPersonMergeButton';
import { useGenealogyStore, normalizePerson } from '../../src/stores/useGenealogyStore';
import { useCloudSyncStore } from '../../src/stores/useCloudSyncStore';
import { comparePersonPair, isDuplicatePairIgnored } from '../../src/utils/duplicateDetector';
import { flushPendingLocalWrites, persistLocalData } from '../../src/utils/indexedDbStorage';
import { getAllSnapshots } from '../../src/utils/persistentBackup';
import { getMergedPersonMap } from '../../src/utils/mergedPersonState';
import '../../src/index.css';
const key = 'genealogy_workstation_data_v4_familio';
const initial = [
  { id: 'qa-merge-a', gender: 'M', firstName: 'Іван', lastName: 'Тестовий', birthDate: '1900', deathDate: '1980', fatherId: 'dad' },
  { id: 'qa-merge-b', gender: 'M', firstName: 'Іван', lastName: 'Тестовий', birthDate: '1900', deathDate: '1980', fatherId: 'dad', notes: 'New evidence' },
  { id: 'qa-child', gender: 'F', firstName: 'Марія', lastName: 'Тестова', fatherId: 'qa-merge-b' }
].map(person => normalizePerson(person as any));
let failure = false;
const transaction = IDBDatabase.prototype.transaction;
IDBDatabase.prototype.transaction = function (...args: any[]) {
  const tx = transaction.apply(this, args as any);
  if (failure && this.name === 'GenealogyWorkstationPersistence' && args[1] === 'readwrite') {
    const objectStore = tx.objectStore.bind(tx);
    tx.objectStore = name => { const object = objectStore(name), put = object.put.bind(object);
      object.put = (...values) => { const request = put(...values); request.addEventListener('success', () => tx.abort()); return request; }; return object; };
  }
  return tx;
};
async function initialize() {
  if (!localStorage.getItem('qa-merge-seeded')) {
    useGenealogyStore.setState({ persons: initial, families: { 'qa-family': { id: 'qa-family', husbandId: 'qa-merge-b', children: [{ personId: 'qa-child' }] } }, trashPersons: [], selectedPersonId: 'qa-merge-b', lastPersonMergeSnapshotId: null });
    const state = useGenealogyStore.getState();
    for (const field of ['persons', 'families', 'trashPersons', 'selectedPersonId', 'lastPersonMergeSnapshotId']) persistLocalData(`${key}_${field}`, state[field]);
    await flushPendingLocalWrites(); localStorage.setItem('qa-merge-seeded', '1');
  } else await useGenealogyStore.getState().hydrateFromIndexedDB();
  useCloudSyncStore.setState({ syncMode: 'manual' });
}
function Fixture() {
  const state = useGenealogyStore(), [ready, setReady] = useState(false), [open, setOpen] = useState(false);
  const [pair, setPair] = useState<any>(null), view = new URLSearchParams(location.search).get('view');
  useEffect(() => { void initialize().then(() => setReady(true)); }, []);
  return <main style={{ padding: 20, color: 'white' }}><p data-testid="ready">{ready ? 'ready' : 'loading'}</p>
    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 15 }}><UndoPersonMergeButton /></div>
    <p>Осіб: <span data-testid="persons">{state.persons.length}</span></p>
    {view === 'conflicts' ? <ConflictsView persons={state.persons} families={state.families} initialSubTab="duplicates" onUpdatePersons={state.setPersons} onUpdateFamilies={state.setFamilies} />
      : <button onClick={() => { setPair({ ...comparePersonPair(state.persons[0], state.persons[1]), personA: state.persons[0], personB: state.persons[1] }); setOpen(true); }}>Порівняти</button>}
    {open && (view === 'by-id' ? <MergePersonsByIdModal isOpen onClose={() => setOpen(false)} initialPersonAId="qa-merge-a" initialPersonBId="qa-merge-b" />
      : <SmartMergeModal pair={pair} allPersons={state.persons} allFamilies={state.families} isOpen onClose={() => setOpen(false)}
        onMergeComplete={async (updatedPersons, updatedFamilies, _name, extra) => {
          await state.mergePersons({ updatedPersons, updatedFamilies, masterPerson: extra?.masterPerson,
            deletedPersonIds: [extra!.deletedPersonId!], sourcePersons: state.persons, sourceFamilies: state.families });
        }} />)}
  </main>;
}
(window as any).mergeQA = {
  fail: value => { failure = value; },
  edit: () => { const state = useGenealogyStore.getState(); state.setPersons(state.persons.map(person => person.id === 'qa-child' ? { ...person, notes: 'Later edit' } : person)); },
  editCompared: () => { const state = useGenealogyStore.getState(); state.setPersons(state.persons.map(person => person.id === 'qa-merge-a' ? { ...person, notes: 'Changed after opening' } : person)); },
  stats: async () => ({ persons: useGenealogyStore.getState().persons, families: useGenealogyStore.getState().families,
    selected: useGenealogyStore.getState().selectedPersonId, checkpoint: useGenealogyStore.getState().lastPersonMergeSnapshotId,
    snapshots: (await getAllSnapshots()).length, mapping: getMergedPersonMap(), ignored: isDuplicatePairIgnored('qa-merge-a', 'qa-merge-b') })
};
createRoot(document.getElementById('root')!).render(<Fixture />);
