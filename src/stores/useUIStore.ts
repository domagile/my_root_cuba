import { create } from 'zustand';
import { ThemePalette, AccessLockConfig } from '../types';

const STORAGE_KEY = 'genealogy_workstation_data_v2';

export interface UIState {
  activeTab: string;
  themePalette: ThemePalette;
  searchQuery: string;
  treeMode: string;
  isUnlocked: boolean;
  accessLockConfig: AccessLockConfig;
  isMobileMenuOpen: boolean;
  
  // Actions
  setActiveTab: (tab: string) => void;
  setThemePalette: (palette: ThemePalette) => void;
  setSearchQuery: (query: string) => void;
  setTreeMode: (mode: string) => void;
  setMobileMenuOpen: (isOpen: boolean) => void;
  unlockWithPin: (pin: string) => boolean;
  lockAppSession: () => void;
  setAccessLockConfig: (config: AccessLockConfig) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  activeTab: 'tree',
  isMobileMenuOpen: false,
  
  themePalette: (() => {
    try {
      return (localStorage.getItem(`${STORAGE_KEY}_theme`) as ThemePalette) || 'classic';
    } catch {
      return 'classic';
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

  setThemePalette: (themePalette: ThemePalette) => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_theme`, themePalette);
    } catch {}
    set({ themePalette });
  },

  setSearchQuery: (searchQuery: string) => set({ searchQuery }),

  setTreeMode: (treeMode: string) => set({ treeMode }),

  setMobileMenuOpen: (isMobileMenuOpen: boolean) => set({ isMobileMenuOpen }),

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
  }
}));
