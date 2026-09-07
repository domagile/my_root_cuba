import { create } from 'zustand';
import { ResearchNote, NoteColor, ChecklistItem } from '../types';
import { saveNoteDoc, deleteNoteDoc } from '../lib/firebase';
import { isDemoNote } from '../utils/demoPurge';

const STORAGE_KEY = 'genealogy_research_notes_v1';

export const SAMPLE_NOTES: ResearchNote[] = [];

export type NoteFilterType = 'all' | 'pinned' | 'checklists' | 'archived' | 'trash';

export interface NotesStoreState {
  notes: ResearchNote[];
  activeFilter: NoteFilterType;
  selectedTag: string | null;
  selectedColor: NoteColor | 'all';
  searchQuery: string;
  viewMode: 'grid' | 'list';
  
  // UI states
  setActiveFilter: (filter: NoteFilterType) => void;
  setSelectedTag: (tag: string | null) => void;
  setSelectedColor: (color: NoteColor | 'all') => void;
  setSearchQuery: (q: string) => void;
  setViewMode: (mode: 'grid' | 'list') => void;

  // CRUD actions
  addNote: (note: Partial<ResearchNote>) => ResearchNote;
  updateNote: (id: string, patch: Partial<ResearchNote>) => void;
  deleteNote: (id: string, permanent?: boolean) => void;
  restoreNote: (id: string) => void;
  emptyTrash: () => void;
  
  // Quick toggles
  togglePin: (id: string) => void;
  toggleArchive: (id: string) => void;
  setNoteColor: (id: string, color: NoteColor) => void;
  duplicateNote: (id: string) => void;
  
  // Checklist actions
  toggleChecklistItem: (noteId: string, itemId: string) => void;
  addChecklistItem: (noteId: string, text: string) => void;
  updateChecklistItem: (noteId: string, itemId: string, text: string) => void;
  deleteChecklistItem: (noteId: string, itemId: string) => void;

  // Sync / Reset
  batchSetNotes: (notes: ResearchNote[]) => void;
  purgeDemoNotes: () => void;
  resetToDefaultSampleNotes?: () => void;
}

export const useNotesStore = create<NotesStoreState>((set, get) => ({
  notes: (() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((n) => !isDemoNote(n));
        }
      }
      return [];
    } catch {
      return [];
    }
  })(),

  activeFilter: 'all',
  selectedTag: null,
  selectedColor: 'all',
  searchQuery: '',
  viewMode: 'grid',

  setActiveFilter: (filter) => set({ activeFilter: filter, selectedTag: null }),
  setSelectedTag: (tag) => set({ selectedTag: tag, activeFilter: 'all' }),
  setSelectedColor: (color) => set({ selectedColor: color }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setViewMode: (mode) => set({ viewMode: mode }),

  addNote: (noteData) => {
    const now = new Date().toISOString();
    const newNote: ResearchNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: noteData.title || '',
      content: noteData.content || '',
      isChecklist: noteData.isChecklist || false,
      checklistItems: noteData.checklistItems || [],
      color: noteData.color || 'default',
      isPinned: noteData.isPinned || false,
      isArchived: false,
      isTrash: false,
      tags: noteData.tags || [],
      reminderDate: noteData.reminderDate,
      linkedPersonIds: noteData.linkedPersonIds || [],
      imageUrl: noteData.imageUrl,
      linkUrl: noteData.linkUrl,
      createdAt: now,
      updatedAt: now
    };

    set((state) => {
      const next = [newNote, ...state.notes];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      saveNoteDoc(newNote);
      return { notes: next };
    });

    return newNote;
  },

  updateNote: (id, patch) => {
    set((state) => {
      let updatedItem: ResearchNote | null = null;
      const next = state.notes.map((n) => {
        if (n.id === id) {
          updatedItem = {
            ...n,
            ...patch,
            updatedAt: new Date().toISOString()
          };
          return updatedItem;
        }
        return n;
      });

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      if (updatedItem) saveNoteDoc(updatedItem);
      return { notes: next };
    });
  },

  deleteNote: (id, permanent = false) => {
    set((state) => {
      const target = state.notes.find((n) => n.id === id);
      if (!target) return state;

      let next: ResearchNote[];
      if (permanent || target.isTrash) {
        // Permanent delete
        next = state.notes.filter((n) => n.id !== id);
        deleteNoteDoc(id);
      } else {
        // Soft delete into trash
        next = state.notes.map((n) =>
          n.id === id ? { ...n, isTrash: true, isPinned: false, updatedAt: new Date().toISOString() } : n
        );
        const updated = next.find((n) => n.id === id);
        if (updated) saveNoteDoc(updated);
      }

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return { notes: next };
    });
  },

  restoreNote: (id) => {
    set((state) => {
      let restored: ResearchNote | null = null;
      const next = state.notes.map((n) => {
        if (n.id === id) {
          restored = { ...n, isTrash: false, updatedAt: new Date().toISOString() };
          return restored;
        }
        return n;
      });

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      if (restored) saveNoteDoc(restored);
      return { notes: next };
    });
  },

  emptyTrash: () => {
    set((state) => {
      const trashIds = state.notes.filter((n) => n.isTrash).map((n) => n.id);
      trashIds.forEach((id) => deleteNoteDoc(id));

      const next = state.notes.filter((n) => !n.isTrash);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return { notes: next };
    });
  },

  togglePin: (id) => {
    set((state) => {
      let updated: ResearchNote | null = null;
      const next = state.notes.map((n) => {
        if (n.id === id) {
          updated = { ...n, isPinned: !n.isPinned, isArchived: false, updatedAt: new Date().toISOString() };
          return updated;
        }
        return n;
      });

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      if (updated) saveNoteDoc(updated);
      return { notes: next };
    });
  },

  toggleArchive: (id) => {
    set((state) => {
      let updated: ResearchNote | null = null;
      const next = state.notes.map((n) => {
        if (n.id === id) {
          const willArchive = !n.isArchived;
          updated = {
            ...n,
            isArchived: willArchive,
            isPinned: willArchive ? false : n.isPinned,
            updatedAt: new Date().toISOString()
          };
          return updated;
        }
        return n;
      });

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      if (updated) saveNoteDoc(updated);
      return { notes: next };
    });
  },

  setNoteColor: (id, color) => {
    get().updateNote(id, { color });
  },

  duplicateNote: (id) => {
    const original = get().notes.find((n) => n.id === id);
    if (!original) return;

    const copy: Partial<ResearchNote> = {
      title: original.title ? `${original.title} (Копія)` : 'Копія нотатки',
      content: original.content,
      isChecklist: original.isChecklist,
      checklistItems: original.checklistItems?.map((ci) => ({ ...ci, id: `cli-${Date.now()}-${Math.random()}` })),
      color: original.color,
      tags: original.tags ? [...original.tags] : [],
      isPinned: false,
      imageUrl: original.imageUrl,
      linkUrl: original.linkUrl,
      linkedPersonIds: original.linkedPersonIds ? [...original.linkedPersonIds] : []
    };
    get().addNote(copy);
  },

  toggleChecklistItem: (noteId, itemId) => {
    set((state) => {
      let updated: ResearchNote | null = null;
      const next = state.notes.map((n) => {
        if (n.id === noteId && Array.isArray(n.checklistItems)) {
          const newItems = n.checklistItems.map((ci) =>
            ci.id === itemId ? { ...ci, isCompleted: !ci.isCompleted } : ci
          );
          updated = { ...n, checklistItems: newItems, updatedAt: new Date().toISOString() };
          return updated;
        }
        return n;
      });

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      if (updated) saveNoteDoc(updated);
      return { notes: next };
    });
  },

  addChecklistItem: (noteId, text) => {
    if (!text.trim()) return;
    set((state) => {
      let updated: ResearchNote | null = null;
      const next = state.notes.map((n) => {
        if (n.id === noteId) {
          const currentItems = Array.isArray(n.checklistItems) ? n.checklistItems : [];
          const newItem: ChecklistItem = {
            id: `cli-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            text: text.trim(),
            isCompleted: false
          };
          updated = { ...n, checklistItems: [...currentItems, newItem], updatedAt: new Date().toISOString() };
          return updated;
        }
        return n;
      });

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      if (updated) saveNoteDoc(updated);
      return { notes: next };
    });
  },

  updateChecklistItem: (noteId, itemId, text) => {
    set((state) => {
      let updated: ResearchNote | null = null;
      const next = state.notes.map((n) => {
        if (n.id === noteId && Array.isArray(n.checklistItems)) {
          const newItems = n.checklistItems.map((ci) =>
            ci.id === itemId ? { ...ci, text } : ci
          );
          updated = { ...n, checklistItems: newItems, updatedAt: new Date().toISOString() };
          return updated;
        }
        return n;
      });

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      if (updated) saveNoteDoc(updated);
      return { notes: next };
    });
  },

  deleteChecklistItem: (noteId, itemId) => {
    set((state) => {
      let updated: ResearchNote | null = null;
      const next = state.notes.map((n) => {
        if (n.id === noteId && Array.isArray(n.checklistItems)) {
          const newItems = n.checklistItems.filter((ci) => ci.id !== itemId);
          updated = { ...n, checklistItems: newItems, updatedAt: new Date().toISOString() };
          return updated;
        }
        return n;
      });

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      if (updated) saveNoteDoc(updated);
      return { notes: next };
    });
  },

  batchSetNotes: (notesList) => {
    set(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notesList));
      } catch {}
      return { notes: notesList };
    });
  },

  purgeDemoNotes: () => {
    set((state) => {
      const clean = state.notes.filter((n) => !isDemoNote(n));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
      } catch {}
      return { notes: clean };
    });
  },

  resetToDefaultSampleNotes: () => {
    set((state) => {
      const clean = state.notes.filter((n) => !isDemoNote(n));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
      } catch {}
      return { notes: clean };
    });
  }
}));
