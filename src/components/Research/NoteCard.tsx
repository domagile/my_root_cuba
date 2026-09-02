/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Pin,
  CheckSquare,
  Square,
  MoreVertical,
  Palette,
  Tag,
  Copy,
  Archive,
  RotateCcw,
  Trash2,
  ExternalLink,
  Plus,
  X,
  User,
  Check
} from 'lucide-react';
import { ResearchNote, NoteColor, ChecklistItem } from '../../types';
import { useNotesStore } from '../../stores/useNotesStore';
import { useUIStore } from '../../stores/useUIStore';
import { getThemeConfig } from '../../utils/theme';

export const NOTE_COLORS: { id: NoteColor; label: string; swatch: string }[] = [
  { id: 'default', label: 'За замовчуванням', swatch: 'bg-neutral-200 dark:bg-neutral-700 border border-neutral-400/40' },
  { id: 'amber', label: 'Пісочний / Золотий', swatch: 'bg-amber-300 dark:bg-amber-600' },
  { id: 'emerald', label: 'М’ятно-зелений', swatch: 'bg-emerald-300 dark:bg-emerald-600' },
  { id: 'teal', label: 'Бірюзовий', swatch: 'bg-teal-300 dark:bg-teal-600' },
  { id: 'sky', label: 'Блакитний', swatch: 'bg-sky-300 dark:bg-sky-600' },
  { id: 'indigo', label: 'Сутінки / Індиго', swatch: 'bg-indigo-300 dark:bg-indigo-600' },
  { id: 'purple', label: 'Лавандовий', swatch: 'bg-purple-300 dark:bg-purple-600' },
  { id: 'rose', label: 'Рожевий', swatch: 'bg-rose-300 dark:bg-rose-600' },
  { id: 'coral', label: 'Кораловий', swatch: 'bg-orange-300 dark:bg-orange-600' },
  { id: 'slate', label: 'Грифельний', swatch: 'bg-slate-300 dark:bg-slate-600' }
];

export const getNoteColorClasses = (color: NoteColor = 'default', isDark: boolean): string => {
  switch (color) {
    case 'amber':
      return isDark
        ? 'bg-[#291e0a] border-[#573e12] text-amber-100 hover:border-amber-400/60'
        : 'bg-[#fef9c3] border-[#fde047] text-amber-950 hover:border-amber-400';
    case 'emerald':
      return isDark
        ? 'bg-[#062c1e] border-[#0e5c3e] text-emerald-100 hover:border-emerald-400/60'
        : 'bg-[#dcfce7] border-[#86efac] text-emerald-950 hover:border-emerald-400';
    case 'teal':
      return isDark
        ? 'bg-[#062a2a] border-[#0f5454] text-teal-100 hover:border-teal-400/60'
        : 'bg-[#ccfbf1] border-[#5eead4] text-teal-950 hover:border-teal-400';
    case 'sky':
      return isDark
        ? 'bg-[#08283b] border-[#104e73] text-sky-100 hover:border-sky-400/60'
        : 'bg-[#e0f2fe] border-[#7dd3fc] text-sky-950 hover:border-sky-400';
    case 'indigo':
      return isDark
        ? 'bg-[#181838] border-[#31316b] text-indigo-100 hover:border-indigo-400/60'
        : 'bg-[#e0e7ff] border-[#a5b4fc] text-indigo-950 hover:border-indigo-400';
    case 'purple':
      return isDark
        ? 'bg-[#281533] border-[#4f2468] text-purple-100 hover:border-purple-400/60'
        : 'bg-[#f3e8ff] border-[#d8b4fe] text-purple-950 hover:border-purple-400';
    case 'rose':
      return isDark
        ? 'bg-[#33111c] border-[#6b213b] text-rose-100 hover:border-rose-400/60'
        : 'bg-[#ffe4e6] border-[#fda4af] text-rose-950 hover:border-rose-400';
    case 'coral':
      return isDark
        ? 'bg-[#33180c] border-[#663116] text-orange-100 hover:border-orange-400/60'
        : 'bg-[#ffedd5] border-[#fdba74] text-orange-950 hover:border-orange-400';
    case 'slate':
      return isDark
        ? 'bg-[#1e293b] border-[#334155] text-slate-100 hover:border-slate-400/60'
        : 'bg-[#f1f5f9] border-[#cbd5e1] text-slate-900 hover:border-slate-400';
    case 'default':
    default:
      return isDark
        ? 'bg-[#18181b] border-neutral-800 text-neutral-100 hover:border-neutral-600'
        : 'bg-white border-neutral-200 text-neutral-900 hover:border-neutral-400';
  }
};

interface NoteCardProps {
  note: ResearchNote;
  onOpenEdit: (note: ResearchNote) => void;
  onTagClick?: (tag: string) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({ note, onOpenEdit, onTagClick }) => {
  const themePalette = useUIStore((s) => s.themePalette);
  const theme = getThemeConfig(themePalette);
  const isDark = theme.category === 'dark';

  const {
    togglePin,
    toggleArchive,
    deleteNote,
    restoreNote,
    setNoteColor,
    duplicateNote,
    toggleChecklistItem
  } = useNotesStore();

  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const colorPickerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setIsColorPickerOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const colorClasses = getNoteColorClasses(note.color, isDark);

  // Split checklist items if checklist mode
  const checklistItems = note.checklistItems || [];
  const activeItems = checklistItems.filter((item) => !item.isCompleted);
  const completedItems = checklistItems.filter((item) => item.isCompleted);

  // Helper to render text with auto-links
  const renderTextWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-amber-600 dark:text-amber-400 underline hover:opacity-80 inline-flex items-center gap-0.5 break-all font-medium"
          >
            <span>{part}</span>
            <ExternalLink className="w-2.5 h-2.5 inline shrink-0" />
          </a>
        );
      }
      return part;
    });
  };

  return (
    <div
      onClick={() => onOpenEdit(note)}
      className={`group relative rounded-2xl border p-4 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md flex flex-col justify-between ${colorClasses} break-inside-avoid`}
    >
      {/* Pin button in top-right */}
      {!note.isTrash && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            togglePin(note.id);
          }}
          className={`absolute top-3 right-3 p-1.5 rounded-full transition-all cursor-pointer ${
            note.isPinned
              ? 'text-amber-500 bg-amber-500/15 opacity-100'
              : 'text-neutral-400 hover:text-amber-500 hover:bg-black/5 dark:hover:bg-white/5 opacity-0 group-hover:opacity-100 focus:opacity-100'
          }`}
          title={note.isPinned ? 'Відкріпити нотатку' : 'Закріпити нотатку'}
        >
          <Pin className={`w-4 h-4 ${note.isPinned ? 'fill-amber-500 rotate-45' : ''}`} />
        </button>
      )}

      {/* Main Content Area */}
      <div className="space-y-2.5">
        {/* Title */}
        {note.title && (
          <h3 className="font-bold text-sm leading-snug pr-7 line-clamp-2">{note.title}</h3>
        )}

        {/* Text Content */}
        {!note.isChecklist && note.content && (
          <div className="text-xs opacity-90 leading-relaxed whitespace-pre-wrap line-clamp-8">
            {renderTextWithLinks(note.content)}
          </div>
        )}

        {/* Checklist Content */}
        {note.isChecklist && (
          <div className="space-y-1.5 text-xs">
            {/* Active / Uncompleted Items */}
            {activeItems.map((item) => (
              <div
                key={item.id}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleChecklistItem(note.id, item.id);
                }}
                className="flex items-start gap-2 py-0.5 hover:opacity-80 transition-opacity"
              >
                <Square className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
                <span className="leading-snug break-words line-clamp-2">{item.text}</span>
              </div>
            ))}

            {/* Completed Items */}
            {completedItems.length > 0 && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCompleted(!showCompleted);
                  }}
                  className="text-[11px] font-semibold opacity-70 hover:opacity-100 flex items-center gap-1 my-1"
                >
                  <CheckSquare className="w-3 h-3 text-emerald-500" />
                  <span>
                    Виконано ({completedItems.length}) {showCompleted ? '▲' : '▼'}
                  </span>
                </button>

                {showCompleted && (
                  <div className="space-y-1 pl-1">
                    {completedItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleChecklistItem(note.id, item.id);
                        }}
                        className="flex items-start gap-2 py-0.5 opacity-60 line-through"
                      >
                        <CheckSquare className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span className="leading-snug break-words line-clamp-2">{item.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Attached Image Preview */}
        {note.imageUrl && (
          <div className="rounded-xl overflow-hidden border border-black/10 dark:border-white/10 max-h-48 mt-2">
            <img
              src={note.imageUrl}
              alt="Вкладення"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Tags / Labels */}
        {Array.isArray(note.tags) && note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1.5">
            {note.tags.map((t) => {
              const clean = t.replace(/^#+/, '');
              return (
                <span
                  key={clean}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onTagClick) onTagClick(clean);
                  }}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-black/10 dark:bg-white/10 opacity-80 hover:opacity-100 hover:bg-amber-500/20 hover:text-amber-500 transition-colors flex items-center gap-0.5"
                >
                  #{clean}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Card Bottom Toolbar (Keep Actions) */}
      <div className="mt-4 pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        {note.isTrash ? (
          /* Trash Actions */
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                restoreNote(note.id);
              }}
              className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-500/10 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              title="Відновити з кошика"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Відновити</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                deleteNote(note.id, true);
              }}
              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              title="Видалити назавжди"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Видалити</span>
            </button>
          </div>
        ) : (
          /* Active Card Actions */
          <>
            <div className="flex items-center gap-0.5">
              {/* Color Palette Button & Popup */}
              <div className="relative" ref={colorPickerRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsColorPickerOpen(!isColorPickerOpen);
                  }}
                  className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  title="Змінити колір нотатки"
                >
                  <Palette className="w-3.5 h-3.5" />
                </button>

                {isColorPickerOpen && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-full left-0 mb-2 p-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl flex items-center gap-1 z-30"
                  >
                    {NOTE_COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setNoteColor(note.id, c.id);
                          setIsColorPickerOpen(false);
                        }}
                        className={`w-5 h-5 rounded-full ${c.swatch} transition-transform hover:scale-125 flex items-center justify-center cursor-pointer ${
                          note.color === c.id ? 'ring-2 ring-amber-500' : ''
                        }`}
                        title={c.label}
                      >
                        {note.color === c.id && <Check className="w-3 h-3 text-neutral-900 dark:text-white" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Duplicate Note */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  duplicateNote(note.id);
                }}
                className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                title="Створити копію"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>

              {/* Archive Note */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleArchive(note.id);
                }}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  note.isArchived
                    ? 'text-amber-500 bg-amber-500/10'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title={note.isArchived ? 'Розархівувати' : 'Архівувати'}
              >
                <Archive className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Right Side Delete Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                deleteNote(note.id);
              }}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="Перемістити в кошик"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
