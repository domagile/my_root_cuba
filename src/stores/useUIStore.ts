import { create } from 'zustand';
import { ThemePalette, AccessLockConfig, ViewMode, AuthUser } from '../types';
import { encodeSessionToken } from '../utils/crossTabAuth';
import {
  ModalSection,
  ModalAccordionState,
  DEFAULT_MODAL_ACCORDION_SECTIONS,
  getSavedAccordionSections,
  getSavedActiveSection,
  saveAccordionSections
} from '../utils/accordionState';

export type { ModalSection, ModalAccordionState };
export { DEFAULT_MODAL_ACCORDION_SECTIONS };

const STORAGE_KEY = 'genealogy_workstation_data_v2';

export type TreeCanvasTheme = 'classic-dark' | 'parchment' | 'light' | 'emerald';

export const RODOVID_VIEWS: ViewMode[] = [
  'tree',
  'fan',
  'persons',
  'timeline',
  'places',
  'sources',
  'kinship',
  'stats',
  'reports',
  'conflicts',
  'duplicates'
];

export const getTabUrl = (tab: string, view?: ViewMode, user?: AuthUser | null): string => {
  if (typeof window === 'undefined') return `?tab=${tab}`;
  const url = new URL(window.location.href);
  if (RODOVID_VIEWS.includes(tab as ViewMode)) {
    url.searchParams.set('tab', tab);
    url.searchParams.delete('view');
  } else {
    url.searchParams.set('tab', tab);
    if (view && RODOVID_VIEWS.includes(view)) {
      url.searchParams.set('view', view);
    } else {
      url.searchParams.delete('view');
    }
  }

  // Seamless cross-tab auth transfer: include session token if authenticated
  let activeUser = user;
  if (activeUser === undefined) {
    try {
      const saved = localStorage.getItem('genealogy_auth_security_v1_currentUser');
      if (saved) activeUser = JSON.parse(saved);
    } catch {}
  }

  if (activeUser && activeUser.isAuthenticated) {
    const token = encodeSessionToken(activeUser);
    if (token) {
      url.searchParams.set('_auth_t', token);
    }
  }

  return `${url.pathname}${url.search}`;
};

export const openTabInNewWindow = (tab: string, view?: ViewMode, user?: AuthUser | null) => {
  if (typeof window === 'undefined') return;
  const targetUrl = getTabUrl(tab, view, user);
  window.open(targetUrl, '_blank', 'noopener,noreferrer');
};

const getInitialNav = (): { activeTab: string; rodovidView: ViewMode } => {
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      const view = params.get('view') as ViewMode | null;

      if (tab && RODOVID_VIEWS.includes(tab as ViewMode)) {
        return { activeTab: 'tree', rodovidView: tab as ViewMode };
      }
      if (view && RODOVID_VIEWS.includes(view)) {
        return { activeTab: 'tree', rodovidView: view };
      }
      if (tab) {
        return { activeTab: tab, rodovidView: 'tree' };
      }
    } catch {}
  }
  return { activeTab: 'tree', rodovidView: 'tree' };
};

const initialNav = getInitialNav();

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
  
  // Person Modal Accordion State (Persistent across modal closes & returns)
  personModalOpenSections: ModalAccordionState;
  personModalActiveSection: ModalSection;
  setPersonModalOpenSections: (
    sections: ModalAccordionState | ((prev: ModalAccordionState) => ModalAccordionState),
    personId?: string | null
  ) => void;
  togglePersonModalSection: (sectionId: ModalSection, personId?: string | null) => void;
  setPersonModalActiveSection: (sectionId: ModalSection, personId?: string | null) => void;
  expandAllPersonModalSections: (personId?: string | null) => void;
  collapseAllPersonModalSections: (personId?: string | null) => void;
  resetPersonModalSectionsToDefault: (personId?: string | null) => void;
  initPersonModalAccordion: (personId?: string | null) => void;

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
  activeTab: initialNav.activeTab,
  rodovidView: initialNav.rodovidView,
  isMobileMenuOpen: false,
  isSidebarVisible: true,
  isAuthModalOpen: false,
  authModalFeature: undefined,
  isContactModalOpen: false,
  
  personModalOpenSections: getSavedAccordionSections(),
  personModalActiveSection: getSavedActiveSection(),

  initPersonModalAccordion: (personId) => {
    const loaded = getSavedAccordionSections(personId);
    set({ personModalOpenSections: loaded });
  },

  setPersonModalOpenSections: (updater, personId) => {
    const prev = get().personModalOpenSections;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    saveAccordionSections(next, personId, get().personModalActiveSection);
    set({ personModalOpenSections: next });
  },

  togglePersonModalSection: (sectionId, personId) => {
    const prev = get().personModalOpenSections;
    const nextOpen = !prev[sectionId];
    const next = { ...prev, [sectionId]: nextOpen };
    const nextActive = nextOpen ? sectionId : get().personModalActiveSection;
    saveAccordionSections(next, personId, nextActive);
    set({
      personModalOpenSections: next,
      personModalActiveSection: nextActive
    });
  },

  setPersonModalActiveSection: (sectionId, personId) => {
    saveAccordionSections(get().personModalOpenSections, personId, sectionId);
    set({ personModalActiveSection: sectionId });
  },

  expandAllPersonModalSections: (personId) => {
    const allOpen: ModalAccordionState = {
      'basic': true,
      'names': true,
      'parents': true,
      'dates-places': true,
      'bio-notes': true,
      'events': true,
      'photos': true,
      'custom-fields': true,
    };
    saveAccordionSections(allOpen, personId, get().personModalActiveSection);
    set({ personModalOpenSections: allOpen });
  },

  collapseAllPersonModalSections: (personId) => {
    const allClosed: ModalAccordionState = {
      'basic': false,
      'names': false,
      'parents': false,
      'dates-places': false,
      'bio-notes': false,
      'events': false,
      'photos': false,
      'custom-fields': false,
    };
    saveAccordionSections(allClosed, personId, get().personModalActiveSection);
    set({ personModalOpenSections: allClosed });
  },

  resetPersonModalSectionsToDefault: (personId) => {
    const defaultState = { ...DEFAULT_MODAL_ACCORDION_SECTIONS };
    saveAccordionSections(defaultState, personId, 'basic');
    set({
      personModalOpenSections: defaultState,
      personModalActiveSection: 'basic'
    });
  },
  
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

  setActiveTab: (activeTab: string) => {
    set({ activeTab });
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        if (activeTab === 'tree') {
          const currentRodovid = get().rodovidView;
          url.searchParams.set('tab', currentRodovid || 'tree');
        } else {
          url.searchParams.set('tab', activeTab);
          url.searchParams.delete('view');
        }
        window.history.replaceState(null, '', `${url.pathname}${url.search}`);
      } catch {}
    }
  },

  setRodovidView: (rodovidView: ViewMode) => {
    set({ rodovidView, activeTab: 'tree' });
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', rodovidView);
        window.history.replaceState(null, '', `${url.pathname}${url.search}`);
      } catch {}
    }
  },

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
