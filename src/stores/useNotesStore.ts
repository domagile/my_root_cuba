import { create } from 'zustand';
import { ResearchNote, NoteColor, ChecklistItem } from '../types';
import { saveNoteDoc, deleteNoteDoc } from '../lib/firebase';

const STORAGE_KEY = 'genealogy_research_notes_v1';

export const SAMPLE_NOTES: ResearchNote[] = [
  {
    id: 'note-1',
    title: '📌 Гіпотеза: Походження роду Коваленків від сотника Гадяцького полку',
    content: 'За козацьким реєстром 1756 року знайдено згадку про сотника Василя Коваля. Сповідні розписи 1860 року села Чернечий Яр вказують спадковий козацький стан для всієї родини Остапа Коваленка.\n\nНеобхідно порівняти з ревізькими казками 1795 та 1811 рр. з ДАПО.',
    isChecklist: false,
    color: 'amber',
    isPinned: true,
    isArchived: false,
    isTrash: false,
    tags: ['гіпотеза', 'гадяч', 'полтавщина', 'козаки'],
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString()
  },
  {
    id: 'note-2',
    title: '📋 План замовлення та опрацювання справ у ДАПО (Полтава)',
    content: '',
    isChecklist: true,
    checklistItems: [
      { id: 'cli-1', text: 'Фонд 1011, Опис 1, Спр. 45 (Метрична книга 1878 р. с. Чернечий Яр) — знайдено запис про народження Івана', isCompleted: true },
      { id: 'cli-2', text: 'Фонд 1011, Опис 1, Спр. 38 (Метрична книга 1875 р. с. Чернечий Яр) — запис про шлюб Остапа та Марії', isCompleted: true },
      { id: 'cli-3', text: 'Фонд 987, Опис 2, Спр. 114 (10-та ревізька казка 1858 р. козаків хутора)', isCompleted: false },
      { id: 'cli-4', text: 'Сповідний розпис Покровської церкви 1860 року (перевірити склад двору Коваленків)', isCompleted: false },
      { id: 'cli-5', text: 'Справа про підтвердження дворянських або козацьких прав роду (Фонд 212)', isCompleted: false }
    ],
    color: 'emerald',
    isPinned: true,
    isArchived: false,
    isTrash: false,
    tags: ['архів', 'ДАПО', 'план', 'метрики'],
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: 'note-3',
    title: '📜 Знахідка: Метричний запис №14 про народження Івана (1878 р.)',
    content: '«10 лютого 1878 року народжений, 12 охрещений Іоанн. Батьки: козак Остап Григорійович Коваленко та його законна дружина Марія Іванівна, обоє православні.\nВосприємники (хрещені): козак хутора Чернечий Яр Степан Шевченко та козачка Ганна Дяченко».',
    isChecklist: false,
    color: 'sky',
    isPinned: false,
    isArchived: false,
    isTrash: false,
    tags: ['знахідка', 'метрика', '1878', 'хрещені'],
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: 'note-4',
    title: '🎙️ Питання для родинного інтерв’ю з бабусею Марією',
    content: '',
    isChecklist: true,
    checklistItems: [
      { id: 'cli-6', text: 'Дізнатися дівоче прізвище прабабусі Євдокії (підтверджено: Лисенко)', isCompleted: true },
      { id: 'cli-7', text: 'Чи збереглися старі листи, грамоти або документи до 1917 року?', isCompleted: false },
      { id: 'cli-8', text: 'Розпитати про брата дідуся Петра, який виїхав на заробітки у 1920-х рр.', isCompleted: false },
      { id: 'cli-9', text: 'Оцифрувати та підписати чорно-білий фотоальбом 1930–1950 років', isCompleted: false }
    ],
    color: 'rose',
    isPinned: false,
    isArchived: false,
    isTrash: false,
    tags: ['інтервю', 'родина', 'спогади', 'фото'],
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString()
  },
  {
    id: 'note-5',
    title: '🧬 Аналіз ДНК-збігу (GEDmatch / MyHeritage)',
    content: 'Виявлено збіг 142 cM (4 спільні сегменти) з дослідником Олександром Ковалем (Канада).\n\nНайбільший спільний сегмент на 7-й хромосомі: 44.2 cM. Спільний предок імовірно по лінії Григорія Коваленка (~1820–1885 рр.). Необхідно зіставити родоводи до 5-го коліна.',
    isChecklist: false,
    color: 'purple',
    isPinned: false,
    isArchived: false,
    isTrash: false,
    tags: ['ДНК', 'генетика', 'збіг', 'канада'],
    createdAt: new Date(Date.now() - 86400000 * 6).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 3).toISOString()
  },
  {
    id: 'note-6',
    title: '🏛️ Контакти архівів та корисні генеалогічні ресурси',
    content: '• ДАПО (Полтава): читальний зал вівторок-четвер 10:00-16:00, ел. пошта dapo@archive.gov.ua\n• ЦДІАК України (Київ): Фонд 127 (Київська духовна консисторія)\n• FamilySearch каталоги: мікрофільми Полтавської єпархії (метрики 1780-1920)\n• Форум uagenealogy.com.ua',
    isChecklist: false,
    color: 'slate',
    isPinned: false,
    isArchived: false,
    isTrash: false,
    tags: ['архів', 'контакти', 'посилання'],
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 4).toISOString()
  }
];

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
  resetToDefaultSampleNotes: () => void;
}

export const useNotesStore = create<NotesStoreState>((set, get) => ({
  notes: (() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return SAMPLE_NOTES;
    } catch {
      return SAMPLE_NOTES;
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

  resetToDefaultSampleNotes: () => {
    set(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(SAMPLE_NOTES));
      } catch {}
      SAMPLE_NOTES.forEach((sn) => saveNoteDoc(sn));
      return { notes: SAMPLE_NOTES };
    });
  }
}));
