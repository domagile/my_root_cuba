import { create } from 'zustand';

// The real TreeView and layout run in the browser; cloud/auth stores are replaced
// only by the optional QA server. Any unexpected write fails the scenario.
const unexpectedWrite = () => { throw new Error('Unexpected store write in the tree fixture'); };
export const useGenealogyStore = create<any>(() => ({
  setPersons: unexpectedWrite, setFamilies: unexpectedWrite, mergePersons: unexpectedWrite,
  deleteAncestorsOfPerson: unexpectedWrite, loadGenealogyDatabase: unexpectedWrite
}));
const query = new URLSearchParams(location.search);
export const useAuthStore = create<any>(() => ({ currentUser: query.has('invalidCamera') || query.has('authenticated')
  ? { email: query.has('secondUser') ? 'tree-view-qa-2@example.invalid' : 'tree-view-qa@example.invalid', role: 'editor', isAuthenticated: true }
  : null, whitelist: [] }));
