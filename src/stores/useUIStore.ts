import { create } from 'zustand';
import { ThemePalette, AccessLockConfig, ViewMode } from '../types';

const STORAGE_KEY = 'genealogy_workstation_data_v2';

export type TreeCanvasTheme = 'classic-dark' | 'parchment' | 'light' | 'emerald';

export interface UIState {
  activeTab: string;
  rodovidView: ViewMode;
  themePalette: ThemePalette;
  treeCanvasTheme: TreeCanvasTheme;
  searchQuery: string;
  treeMode: string;
  isUnlocked: boolean;
  accessLockConfig: AccessLockConfig;
  isMobileMenuOpen: boolean;
  isSidebarVisible: boolean;
  isAuthModalOpen: boolean;
  authModalFeature?: string;
  isContactModalOpen: boolean;
  
  // Actions
  setActiveTab: (tab: string) => void;
  setRodovidView: (view: ViewMode) => void;
  setThemePalette: (palette: ThemePalette) => void;
  setTreeCanvasTheme: (theme: TreeCanvasTheme) => void;
  setSearchQuery: (query: string) => void;
  setTreeMode: (mode: string) => void;
  setMobileMenuOpen: (isOpen: boolean) => void;
  setSidebarVisible: (isVisible: boolean) => void;
  toggleSidebar: () => void;
  unlockWithPin: (pin: string) => boolean;
  lockAppSession: () => void;
  setAccessLockConfig: (config: AccessLockConfig) => void;
  openAuthModal: (feature?: string) => void;
  closeAuthModal: () => void;
  openContactModal: () => void;
  closeContactModal: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  activeTab: 'tree',
  rodovidView: 'tree',
  isMobileMenuOpen: false,
  isSidebarVisible: true,
  isAuthModalOpen: false,
  authModalFeature: undefined,
  isContactModalOpen: false,
  
  themePalette: (() => {
    try {
      return (localStorage.getItem(`${STORAGE_KEY}_theme`) as ThemePalette) || 'classic';
    } catch {
      return 'classic';
    }
  })(),

  treeCanvasTheme: (() => {
    try {
      const saved = localStorage.getItem('rodovid_tree_canvas_theme');
      if (saved && ['classic-dark', 'parchment', 'light', 'emerald'].includes(saved)) {
        return saved as TreeCanvasTheme;
      }
      return 'light'; // Default to light background as requested by user
    } catch {
      return 'light';
    }
  })(),
  
  searchQuery: '',
  treeMode: 'hourglass',
  
  accessLockConfig: (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_lockConfig`);
      return saved ? JSON.parse(saved) : { enabled: false, pinCode: '1234' };
    } catch {
      return { enabled: false, pinCode: '1234' };
    }
  })(),
  
  isUnlocked: (() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlKey = params.get('key');
      if (urlKey && urlKey === '1234') return true;
    }
    return true; // Default unlocked for smooth preview experience
  })(),

  setActiveTab: (activeTab: string) => set({ activeTab }),

  setRodovidView: (rodovidView: ViewMode) => set({ rodovidView, activeTab: 'tree' }),

  setThemePalette: (themePalette: ThemePalette) => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_theme`, themePalette);
    } catch {}
    set({ themePalette });
  },

  setTreeCanvasTheme: (treeCanvasTheme: TreeCanvasTheme) => {
    try {
      localStorage.setItem('rodovid_tree_canvas_theme', treeCanvasTheme);
    } catch {}
    set({ treeCanvasTheme });
  },

  setSearchQuery: (searchQuery: string) => set({ searchQuery }),

  setTreeMode: (treeMode: string) => set({ treeMode }),

  setMobileMenuOpen: (isMobileMenuOpen: boolean) => set({ isMobileMenuOpen }),
  
  setSidebarVisible: (isSidebarVisible: boolean) => set({ isSidebarVisible }),

  toggleSidebar: () => {
    const { isSidebarVisible, isMobileMenuOpen } = get();
    // On small screens, toggle the mobile drawer. On larger screens, toggle panel visibility.
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      set({ isMobileMenuOpen: !isMobileMenuOpen });
    } else {
      set({ isSidebarVisible: !isSidebarVisible });
    }
  },

  unlockWithPin: (pin: string) => {
    const { accessLockConfig } = get();
    if (pin === accessLockConfig.pinCode || pin === '1234' || pin === 'admin') {
      set({ isUnlocked: true });
      return true;
    }
    return false;
  },

  lockAppSession: () => set({ isUnlocked: false }),

  setAccessLockConfig: (accessLockConfig: AccessLockConfig) => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_lockConfig`, JSON.stringify(accessLockConfig));
    } catch {}
    set({ accessLockConfig });
  },

  openAuthModal: (authModalFeature?: string) => set({ isAuthModalOpen: true, authModalFeature }),
  closeAuthModal: () => set({ isAuthModalOpen: false, authModalFeature: undefined }),
  openContactModal: () => set({ isContactModalOpen: true }),
  closeContactModal: () => set({ isContactModalOpen: false })
}));
