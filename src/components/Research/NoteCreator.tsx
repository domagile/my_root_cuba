/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Pin,
  CheckSquare,
  Square,
  Image as ImageIcon,
  Palette,
  Tag,
  Plus,
  X,
  Check
} from 'lucide-react';
import { NoteColor, ChecklistItem } from '../../types';
import { useNotesStore } from '../../stores/useNotesStore';
import { useUIStore } from '../../stores/useUIStore';
import { getThemeConfig } from '../../utils/theme';
import { NOTE_COLORS, getNoteColorClasses } from './NoteCard';

const POPULAR_RESEARCH_TAGS = [
  'гіпотеза',
  'архів',
  'ДАПО',
  'метрика',
  'ревізія',
  'сповідний',
  'знахідка',
  'ДНК',
  'інтервю',
  'родина',
  'козаки',
  'завдання'
];

export const NoteCreator: React.FC = () => {
  const themePalette = useUIStore((s) => s.themePalette);
  const theme = getThemeConfig(themePalette);
  const isDark = theme.category === 'dark';

  const { addNote } = useNotesStore();

  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isChecklist, setIsChecklist] = useState(false);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [color, setColor] = useState<NoteColor>('default');
  const [isPinned, setIsPinned] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const newChecklistInputRef = useRef<HTMLInputElement>(null);

  // Auto-save & close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleCloseAndSave();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [title, content, checklistItems, color, isPinned, tags, imageUrl, isChecklist, isExpanded]);

  const handleCloseAndSave = () => {
    const hasText = content.trim().length > 0;
    const hasTitle = title.trim().length > 0;
    const hasItems = checklistItems.some((item) => item.text.trim().length > 0);
    const hasImage = imageUrl.trim().length > 0;

    if (hasTitle || hasText || hasItems || hasImage) {
      addNote({
        title: title.trim(),
        content: content.trim(),
        isChecklist,
        checklistItems: checklistItems.filter((i) => i.text.trim().length > 0),
        color,
        isPinned,
        tags,
        imageUrl: imageUrl.trim() || undefined
      });
    }

    // Reset fields
    resetForm();
  };

  const resetForm = () => {
    setIsExpanded(false);
    setTitle('');
    setContent('');
    setIsChecklist(false);
    setChecklistItems([]);
    setNewChecklistText('');
    setColor('default');
    setIsPinned(false);
    setTags([]);
    setNewTagInput('');
    setImageUrl('');
    setShowImageInput(false);
    setShowTagInput(false);
    setIsColorPickerOpen(false);
  };

  const handleAddChecklistItem = () => {
    if (!newChecklistText.trim()) return;
    setChecklistItems((prev) => [
      ...prev,
      {
        id: `cli-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        text: newChecklistText.trim(),
        isCompleted: false
      }
    ]);
    setNewChecklistText('');
    setTimeout(() => {
      newChecklistInputRef.current?.focus();
    }, 50);
  };

  const handleRemoveChecklistItem = (id: string) => {
    setChecklistItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleToggleChecklistItem = (id: string) => {
    setChecklistItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, isCompleted: !i.isCompleted } : i))
    );
  };

  const handleAddTag = (tagToAdd: string) => {
    const clean = tagToAdd.trim().replace(/^#+/, '');
    if (clean && !tags.includes(clean)) {
      setTags((prev) => [...prev, clean]);
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const colorClasses = isExpanded
    ? getNoteColorClasses(color, isDark)
    : `${theme.cardBg} border ${theme.cardBorder}`;

  return (
    <div
      ref={containerRef}
      className={`w-full max-w-2xl mx-auto rounded-2xl border transition-all duration-200 shadow-md ${colorClasses}`}
    >
      {/* Collapsed View (Google Keep trigger bar) */}
      {!isExpanded ? (
        <div
          onClick={() => setIsExpanded(true)}
          className="p-3.5 flex items-center justify-between gap-3 cursor-text"
        >
          <span className={`text-sm ${theme.textMuted} font-medium select-none pl-2`}>
            Створити нотатку розслідування...
          </span>
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => {
                setIsChecklist(true);
                setIsExpanded(true);
                setTimeout(() => newChecklistInputRef.current?.focus(), 100);
              }}
              className={`p-2 rounded-xl ${theme.textMuted} hover:${theme.textPrimary} hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer`}
              title="Створити список справ / чекліст"
            >
              <CheckSquare className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setShowImageInput(true);
                setIsExpanded(true);
              }}
              className={`p-2 rounded-xl ${theme.textMuted} hover:${theme.textPrimary} hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer`}
              title="Додати зображення чи документ"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setIsPinned(true);
                setIsExpanded(true);
              }}
              className={`p-2 rounded-xl ${theme.textMuted} hover:${theme.textPrimary} hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer`}
              title="Створити закріплену нотатку"
            >
              <Pin className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Expanded Composer */
        <div className="p-4 space-y-3">
          {/* Header with Title & Pin */}
          <div className="flex items-start justify-between gap-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Заголовок нотатки..."
              className="w-full bg-transparent font-bold text-sm sm:text-base focus:outline-none placeholder:opacity-60"
              autoFocus={!isChecklist}
            />
            <button
              type="button"
              onClick={() => setIsPinned(!isPinned)}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                isPinned
                  ? 'text-amber-500 bg-amber-500/15'
                  : 'text-neutral-400 hover:text-amber-500 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              title={isPinned ? 'Відкріпити' : 'Закріпити зверху'}
            >
              <Pin className={`w-4 h-4 ${isPinned ? 'fill-amber-500 rotate-45' : ''}`} />
            </button>
          </div>

          {/* Content Area: Plain Text or Checklist */}
          {!isChecklist ? (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Текст розслідування, цитата з книги, гіпотеза чи посилання..."
              rows={3}
              className="w-full bg-transparent text-xs sm:text-sm focus:outline-none resize-none leading-relaxed placeholder:opacity-60"
            />
          ) : (
            /* Checklist Editor */
            <div className="space-y-2 text-xs sm:text-sm">
              {checklistItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2 group">
                  <button
                    type="button"
                    onClick={() => handleToggleChecklistItem(item.id)}
                    className="cursor-pointer"
                  >
                    {item.isCompleted ? (
                      <CheckSquare className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Square className="w-4 h-4 text-neutral-400" />
                    )}
                  </button>
                  <input
                    type="text"
                    value={item.text}
                    onChange={(e) => {
                      const val = e.target.value;
                      setChecklistItems((prev) =>
                        prev.map((i) => (i.id === item.id ? { ...i, text: val } : i))
                      );
                    }}
                    className={`w-full bg-transparent focus:outline-none ${
                      item.isCompleted ? 'line-through opacity-60' : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveChecklistItem(item.id)}
                    className="p-1 text-neutral-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {/* Add item input */}
              <div className="flex items-center gap-2 pt-1">
                <Plus className="w-4 h-4 text-neutral-400 shrink-0" />
                <input
                  ref={newChecklistInputRef}
                  type="text"
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddChecklistItem();
                    }
                  }}
                  placeholder="Додати пункт списку (Enter)..."
                  className="w-full bg-transparent text-xs focus:outline-none placeholder:opacity-60"
                />
                {newChecklistText && (
                  <button
                    type="button"
                    onClick={handleAddChecklistItem}
                    className="px-2 py-0.5 rounded bg-amber-500 text-white text-[10px] font-bold cursor-pointer"
                  >
                    Додати
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Optional Image URL Input */}
          {showImageInput && (
            <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[11px] flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
                  <span>Посилання на зображення або скан документа (URL):</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowImageInput(false);
                    setImageUrl('');
                  }}
                  className="text-neutral-400 hover:text-rose-500"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/scan.jpg"
                className="w-full px-2.5 py-1.5 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:outline-none focus:border-amber-500 text-xs"
              />
            </div>
          )}

          {/* Tags / Labels */}
          {showTagInput && (
            <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[11px] flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-amber-500" />
                  <span>Додати тематичні мітки / хештеги:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowTagInput(false)}
                  className="text-neutral-400 hover:text-neutral-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Popular quick tags */}
              <div className="flex flex-wrap gap-1">
                {POPULAR_RESEARCH_TAGS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleAddTag(t)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-colors cursor-pointer ${
                      tags.includes(t)
                        ? 'bg-amber-500 text-white border-amber-600'
                        : 'bg-black/5 dark:bg-white/5 text-neutral-400 hover:text-amber-500 border-black/5 dark:border-white/5'
                    }`}
                  >
                    #{t}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 pt-1">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag(newTagInput);
                    }
                  }}
                  placeholder="Власний тег (натисніть Enter)..."
                  className="flex-1 px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleAddTag(newTagInput)}
                  className="px-2.5 py-1 bg-amber-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  Додати
                </button>
              </div>
            </div>
          )}

          {/* Active Tags display */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {tags.map((t) => (
                <span
                  key={t}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-black/10 dark:bg-white/10 flex items-center gap-1"
                >
                  #{t}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    className="hover:text-rose-500 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Actions Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5">
            <div className="flex items-center gap-1 relative">
              {/* Color Picker Toggle */}
              <button
                type="button"
                onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                title="Обрати колір картки"
              >
                <Palette className="w-4 h-4" />
              </button>

              {isColorPickerOpen && (
                <div className="absolute bottom-full left-0 mb-2 p-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl flex items-center gap-1 z-30">
                  {NOTE_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setColor(c.id);
                        setIsColorPickerOpen(false);
                      }}
                      className={`w-5 h-5 rounded-full ${c.swatch} transition-transform hover:scale-125 flex items-center justify-center cursor-pointer ${
                        color === c.id ? 'ring-2 ring-amber-500' : ''
                      }`}
                      title={c.label}
                    >
                      {color === c.id && <Check className="w-3 h-3 text-neutral-900 dark:text-white" />}
                    </button>
                  ))}
                </div>
              )}

              {/* Checklist Toggle */}
              <button
                type="button"
                onClick={() => setIsChecklist(!isChecklist)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isChecklist
                    ? 'text-amber-500 bg-amber-500/10 font-bold'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title={isChecklist ? 'Перемкнути на звичайний текст' : 'Перемкнути на список з чекбоксами'}
              >
                <CheckSquare className="w-4 h-4" />
              </button>

              {/* Tag button */}
              <button
                type="button"
                onClick={() => setShowTagInput(!showTagInput)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  showTagInput || tags.length > 0
                    ? 'text-amber-500 bg-amber-500/10'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title="Додати теги / мітки"
              >
                <Tag className="w-4 h-4" />
              </button>

              {/* Image button */}
              <button
                type="button"
                onClick={() => setShowImageInput(!showImageInput)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  showImageInput || imageUrl
                    ? 'text-amber-500 bg-amber-500/10'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title="Прикріпити зображення"
              >
                <ImageIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Save / Close Button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCloseAndSave}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Зберегти
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
