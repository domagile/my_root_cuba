import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { TreeView } from '../../src/rodovid/components/views/TreeView';
import { treeViewDatabase } from '../fixtures/treeViewDatabase';
import '../../src/index.css';

const log: string[] = [];
const seed = new URLSearchParams(location.search).get('seed');
if (seed) localStorage.setItem('rodovid_user_tree_state_tree-view-qa@example.invalid', JSON.stringify(JSON.parse(seed)));
if (new URLSearchParams(location.search).has('invalidCamera')) {
  localStorage.setItem('rodovid_user_tree_state_tree-view-qa@example.invalid', JSON.stringify({
    selectedPersonId: 'root', scale: 1e-308, pan: { x: 123, y: null }, updatedAt: 'synthetic'
  }));
}
let edit!: (id: string, firstName: string) => void;
let show!: (visible: boolean) => void;
let changeRoot!: (id: string) => void;
function Fixture() {
  const [database, setDatabase] = useState(() => treeViewDatabase(new URLSearchParams(location.search).has('wide')));
  const [active, setActive] = useState('root');
  const [visible, setVisible] = useState(true);
  show = setVisible;
  changeRoot = setActive;
  edit = (id, firstName) => setDatabase(previous => ({ ...previous, persons: { ...previous.persons,
    [id]: { ...previous.persons[id], firstName } } }));
  return <div style={{ height: '100vh' }}>
    {visible && <TreeView database={database} activePersonId={active} onSelectPerson={setActive} onChangeRoot={setActive}
      onOpenAddChild={id => log.push(`add-child:${id}`)} onOpenAddParent={id => log.push(`add-parent:${id}`)}
      onEditPerson={id => log.push(`edit:${id}`)} />}
  </div>;
}
createRoot(document.getElementById('root')!).render(new URLSearchParams(location.search).has('strict')
  ? <React.StrictMode><Fixture /></React.StrictMode> : <Fixture />);
(window as any).treeViewHarness = {
  edit: (id: string, firstName: string) => flushSync(() => edit(id, firstName)),
  show: (visible: boolean) => flushSync(() => show(visible)),
  changeRoot: (id: string) => flushSync(() => changeRoot(id)), log
};
