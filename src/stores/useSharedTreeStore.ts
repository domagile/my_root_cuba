import { create } from 'zustand';
import { SharedTreeData, getSharedTreeFromCloud, subscribeToSharedTreeCloud, publishSharedTreeToCloud, subscribeToFirebaseAuth } from '../lib/firebase';

let unsubscribeTree: (() => void) | undefined;
let unsubscribeAuth: (() => void) | undefined;
let loadRevision = 0;

interface SharedTreeState {
  shareId: string | null;
  isSharedMode: boolean;
  isLoading: boolean;
  error: string | null;
  sharedTree: SharedTreeData | null;
  pinRequired: boolean;
  pinVerified: boolean;
  
  // Actions
  initFromUrl: () => Promise<boolean>;
  loadSharedTree: (shareId: string) => Promise<boolean>;
  verifyPin: (pin: string) => boolean;
  exitSharedMode: () => void;
  publishTree: (treeData: SharedTreeData) => Promise<{ success: boolean; shareUrl: string; shareId: string; error?: string }>;
}

export const useSharedTreeStore = create<SharedTreeState>((set, get) => ({
  shareId: null,
  isSharedMode: false,
  isLoading: false,
  error: null,
  sharedTree: null,
  pinRequired: false,
  pinVerified: false,

  initFromUrl: async () => {
    if (typeof window === 'undefined') return false;
    const urlParams = new URLSearchParams(window.location.search);
    const shareId = urlParams.get('share') || urlParams.get('treeId') || urlParams.get('shared');

    if (shareId) {
      return get().loadSharedTree(shareId);
    }
    return false;
  },

  loadSharedTree: async (shareId: string) => {
    unsubscribeTree?.();
    unsubscribeAuth?.();
    const revision = ++loadRevision;
    set({ isLoading: true, error: null, shareId, isSharedMode: true,
      sharedTree: null, pinRequired: false, pinVerified: false });
    try {
      const res = await getSharedTreeFromCloud(shareId);
      if (revision !== loadRevision) return false;
      if (res.success && res.data) {
        const tree = res.data;
        const requiresPin = Boolean(tree.isPinProtected && tree.pinHash);

        set({
          isLoading: false,
          sharedTree: tree,
          pinRequired: requiresPin,
          pinVerified: !requiresPin,
          error: null
        });

        // Setup realtime sync for shared viewers
        unsubscribeTree = subscribeToSharedTreeCloud(shareId, (updatedTree) => {
          if (revision !== loadRevision) return;
          if (updatedTree) {
            set((state) => ({
              ...state,
              sharedTree: updatedTree, error: null
            }));
          } else {
            set({ sharedTree: null, error: 'Доступ відкликано або публічна версія оновлюється.' });
          }
        }, Boolean(tree.publicOnly));
        let initialAuthCallback = true;
        unsubscribeAuth = subscribeToFirebaseAuth(() => {
          if (initialAuthCallback) { initialAuthCallback = false; return; }
          // Drop any private snapshot immediately when the Firebase session changes.
          get().loadSharedTree(shareId);
        });

        return true;
      } else {
        set({
          isLoading: false,
          error: res.error || 'Не вдалося знайти родинне дерево за цим посиланням.',
          sharedTree: null
        });
        return false;
      }
    } catch (e: any) {
      if (revision !== loadRevision) return false;
      set({
        isLoading: false,
        error: e?.message || 'Помилка завантаження спільного дерева.',
        sharedTree: null
      });
      return false;
    }
  },

  verifyPin: (pin: string) => {
    const { sharedTree } = get();
    if (!sharedTree || !sharedTree.isPinProtected) {
      set({ pinVerified: true });
      return true;
    }

    if (sharedTree.pinHash === pin.trim()) {
      set({ pinVerified: true, error: null });
      return true;
    }

    return false;
  },

  exitSharedMode: () => {
    loadRevision++;
    unsubscribeTree?.();
    unsubscribeAuth?.();
    unsubscribeTree = undefined;
    unsubscribeAuth = undefined;
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('share');
      url.searchParams.delete('treeId');
      url.searchParams.delete('shared');
      window.history.replaceState({}, '', url.toString());
    }
    set({
      isSharedMode: false,
      shareId: null,
      sharedTree: null,
      pinRequired: false,
      pinVerified: false,
      error: null
    });
  },

  publishTree: async (treeData: SharedTreeData) => {
    return publishSharedTreeToCloud(treeData);
  }
}));
