import { create } from 'zustand';
import { useGenealogyStore } from '../../src/stores/useGenealogyStore';
export { useUIStore } from '../../src/stores/useUIStore';
export const useAuthStore = create<any>(() => ({ currentUser: { email: 'qa@example.invalid', isAuthenticated: true, role: 'editor' }, whitelist: [] }));
export const isMasterAdminEmail = () => false;
export const useGenealogy = () => ({ ...useGenealogyStore(), themePalette: 'classic', metricRecords: [], documents: [], tasks: [], findings: [],
  hypotheses: [], requests: [], matrixEntries: [], theme: {}, isWhitelisted: true });
export { useGenealogyStore };
export const getGitHubConfig = () => ({ isConfigured: false });
const forbidden = () => { throw new Error('Unexpected external write in isolated merge QA'); };
export const savePlaceDossierToGitHub = forbidden;
export const savePersonDoc = forbidden, savePersonDeltaDoc = forbidden, saveFamilyDoc = forbidden, deleteFamilyDoc = forbidden,
  saveSourceDoc = forbidden, deleteSourceDoc = forbidden, saveEventDoc = forbidden, deleteEventDoc = forbidden,
  savePlaceDoc = forbidden, deletePlaceDoc = forbidden, batchSaveEntities = forbidden, batchDeleteEntities = forbidden;

// Person editing is outside this merge fixture; its unrelated lazy views are not loaded.
export const PersonDetailModal = () => null;
