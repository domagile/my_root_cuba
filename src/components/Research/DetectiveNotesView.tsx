/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Compass,
  Search,
  Grid,
  List,
  Pin,
  CheckSquare,
  Archive,
  Trash2,
  Tag,
  Palette,
  RotateCcw,
  Sparkles,
  Filter,
  Plus,
  X,
  FileText
} from 'lucide-react';
import { ResearchNote, NoteColor } from '../../types';
import { useNotesStore, NoteFilterType } from '../../stores/useNotesStore';
import { useUIStore } from '../../stores/useUIStore';
import { getThemeConfig } from '../../utils/theme';
import { NoteCard, NOTE_COLORS } from './NoteCard';
import { NoteCreator } from './NoteCreator';
import { NoteEditModal } from './NoteEditModal';

export const DetectiveNotesView: React.FC = () => {
  const themePalette = useUIStore((s) => s.themePalette);
  const theme = getThemeConfig(themePalette);
  const isDark = theme.category === 'dark';

  const {
    notes,
    activeFilter,
    selectedTag,
    selectedColor,
    searchQuery,
    viewMode,
    setActiveFilter,
    setSelectedTag,
    setSelectedColor,
    setSearchQuery,
    setViewMode,
    emptyTrash,
    resetToDefaultSampleNotes
  } = useNotesStore();

  const [editingNote, setEditingNote] = useState<ResearchNote | null>(null);

  // Extract all unique tags and their count from non-trash notes
  const allTagsWithCount = useMemo(() => {
    const counts: Record<string, number> = {};
    notes
      .filter((n) => !n.isTrash)
      .forEach((n) => {
        if (Array.isArray(n.tags)) {
          n.tags.forEach((t) => {
            const clean = t.replace(/^#+/, '');
            if (clean) counts[clean] = (counts[clean] || 0) + 1;
          });
        }
      });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [notes]);

  // Filter notes
  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      // 1. Trash filter
      if (activeFilter === 'trash') {
        return !!note.isTrash;
      }
      // If not in trash view, exclude trash
      if (note.isTrash) return false;

      // 2. Archive filter
      if (activeFilter === 'archived') {
        return !!note.isArchived;
      }
      // If in normal views, exclude archived
      if (note.isArchived) return false;

      // 3. Pinned only filter
      if (activeFilter === 'pinned' && !note.isPinned) return false;

      // 4. Checklist only filter
      if (activeFilter === 'checklists' && !note.isChecklist) return false;

      // 5. Tag filter
      if (selectedTag) {
        const cleanSelected = selectedTag.replace(/^#+/, '');
        const noteTags = (note.tags || []).map((t) => t.replace(/^#+/, ''));
        if (!noteTags.includes(cleanSelected)) return false;
      }

      // 6. Color filter
      if (selectedColor !== 'all' && (note.color || 'default') !== selectedColor) {
        return false;
      }

      // 7. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const inTitle = note.title?.toLowerCase().includes(q);
        const inContent = note.content?.toLowerCase().includes(q);
        const inTags = (note.tags || []).some((t) => t.toLowerCase().includes(q));
        const inChecklist = (note.checklistItems || []).some((ci) =>
          ci.text.toLowerCase().includes(q)
        );
        return inTitle || inContent || inTags || inChecklist;
      }

      return true;
    });
  }, [notes, activeFilter, selectedTag, selectedColor, searchQuery]);

  // Separate pinned and other notes for 'all' or standard views
  const { pinnedNotes, otherNotes } = useMemo(() => {
    if (activeFilter === 'trash' || activeFilter === 'archived') {
      return { pinnedNotes: [], otherNotes: filteredNotes };
    }
    const pinned: ResearchNote[] = [];
    const other: ResearchNote[] = [];
    filteredNotes.forEach((n) => {
      if (n.isPinned) pinned.push(n);
      else other.push(n);
    });
    return { pinnedNotes: pinned, otherNotes: other };
  }, [filteredNotes, activeFilter]);

  // Total counts for badges
  const counts = useMemo(() => {
    const active = notes.filter((n) => !n.isTrash && !n.isArchived);
    return {
      all: active.length,
      pinned: active.filter((n) => n.isPinned).length,
      checklists: active.filter((n) => n.isChecklist).length,
      archived: notes.filter((n) => n.isArchived && !n.isTrash).length,
      trash: notes.filter((n) => n.isTrash).length
    };
  }, [notes]);

  const gridClass =
    viewMode === 'grid'
      ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 items-start'
      : 'flex flex-col gap-3 max-w-2xl mx-auto';

  return (
    <div className={`flex-1 flex flex-col h-full min-h-0 overflow-y-auto ${theme.appBg}`}>
      {/* Top Header & Search Bar */}
      <div
        className={`sticky top-0 z-20 px-4 sm:px-6 py-3.5 border-b backdrop-blur-md ${theme.headerBg}/95 ${theme.headerBorder} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
      >
        {/* Title */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center border border-amber-500/20">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className={`font-bold text-base sm:text-lg ${theme.headerText} leading-tight`}>
                Детективні розкопки
              </h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Keep Нотатки
              </span>
            </div>
            <p className={`text-xs ${theme.textMuted}`}>
              Гіпотези, виписки з метрик, плани архівного пошуку та робочі замітки
            </p>
          </div>
        </div>

        {/* Search Bar & View Toggle */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Пошук у нотатках..."
              className={`w-full pl-9 pr-8 py-1.5 text-xs rounded-xl border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} focus:outline-none focus:border-amber-500`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Grid / List Switcher */}
          <div className={`flex items-center p-0.5 rounded-xl border ${theme.cardBorder} ${theme.cardBg}`}>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-amber-500 text-white shadow-xs font-bold'
                  : `${theme.textMuted} hover:${theme.textPrimary}`
              }`}
              title="Сітка карток"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-amber-500 text-white shadow-xs font-bold'
                  : `${theme.textMuted} hover:${theme.textPrimary}`
              }`}
              title="Список"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Google Keep Style Note Creator (Top Box) */}
        {activeFilter !== 'trash' && (
          <div className="pt-1">
            <NoteCreator />
          </div>
        )}

        {/* Filter Navigation Tabs / Pills */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* All Notes */}
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeFilter === 'all' && !selectedTag
                  ? 'bg-amber-600 text-white shadow-xs'
                  : `${theme.cardBg} border ${theme.cardBorder} ${theme.textSecondary} hover:${theme.textPrimary}`
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Всі нотатки</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeFilter === 'all' && !selectedTag
                    ? 'bg-white/20 text-white'
                    : 'bg-black/10 dark:bg-white/10'
                }`}
              >
                {counts.all}
              </span>
            </button>

            {/* Pinned */}
            <button
              type="button"
              onClick={() => setActiveFilter('pinned')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeFilter === 'pinned'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : `${theme.cardBg} border ${theme.cardBorder} ${theme.textSecondary} hover:${theme.textPrimary}`
              }`}
            >
              <Pin className="w-3.5 h-3.5 rotate-45" />
              <span>Закріплені</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeFilter === 'pinned' ? 'bg-white/20 text-white' : 'bg-black/10 dark:bg-white/10'
                }`}
              >
                {counts.pinned}
              </span>
            </button>

            {/* Checklists */}
            <button
              type="button"
              onClick={() => setActiveFilter('checklists')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeFilter === 'checklists'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : `${theme.cardBg} border ${theme.cardBorder} ${theme.textSecondary} hover:${theme.textPrimary}`
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Чеклісти</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeFilter === 'checklists' ? 'bg-white/20 text-white' : 'bg-black/10 dark:bg-white/10'
                }`}
              >
                {counts.checklists}
              </span>
            </button>

            {/* Archive */}
            <button
              type="button"
              onClick={() => setActiveFilter('archived')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeFilter === 'archived'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : `${theme.cardBg} border ${theme.cardBorder} ${theme.textSecondary} hover:${theme.textPrimary}`
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Архів</span>
              {counts.archived > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    activeFilter === 'archived' ? 'bg-white/20 text-white' : 'bg-black/10 dark:bg-white/10'
                  }`}
                >
                  {counts.archived}
                </span>
              )}
            </button>

            {/* Trash */}
            <button
              type="button"
              onClick={() => setActiveFilter('trash')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeFilter === 'trash'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : `${theme.cardBg} border ${theme.cardBorder} ${theme.textSecondary} hover:text-rose-500`
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Кошик</span>
              {counts.trash > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    activeFilter === 'trash' ? 'bg-white/20 text-white' : 'bg-rose-500/20 text-rose-500'
                  }`}
                >
                  {counts.trash}
                </span>
              )}
            </button>

            {/* Color Filter Dropdown / Chips */}
            <div className="flex items-center gap-1 pl-2 border-l border-neutral-300 dark:border-neutral-700">
              <button
                type="button"
                onClick={() => setSelectedColor('all')}
                className={`w-5 h-5 rounded-full border flex items-center justify-center text-[9px] font-bold cursor-pointer transition-transform ${
                  selectedColor === 'all'
                    ? 'ring-2 ring-amber-500 scale-110'
                    : 'opacity-60 hover:opacity-100'
                }`}
                title="Всі кольори"
              >
                ●
              </button>
              {NOTE_COLORS.slice(1).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedColor(selectedColor === c.id ? 'all' : c.id)}
                  className={`w-5 h-5 rounded-full ${c.swatch} transition-transform hover:scale-125 cursor-pointer ${
                    selectedColor === c.id ? 'ring-2 ring-amber-500 scale-110' : 'opacity-80'
                  }`}
                  title={`Фільтр: ${c.label}`}
                />
              ))}
            </div>
          </div>

          {/* Tag Filter Chips */}
          {allTagsWithCount.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className={`text-[11px] font-bold ${theme.textMuted} flex items-center gap-1`}>
                <Tag className="w-3 h-3 text-amber-500" />
                Мітки:
              </span>
              {allTagsWithCount.map(([tag, count]) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer flex items-center gap-1.5 ${
                    selectedTag === tag
                      ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                      : `${theme.cardBg} border ${theme.cardBorder} ${theme.textSecondary} hover:${theme.textPrimary}`
                  }`}
                >
                  <span>#{tag}</span>
                  <span
                    className={`text-[10px] opacity-75 px-1 py-0.2 rounded-full ${
                      selectedTag === tag ? 'bg-white/20' : 'bg-black/5 dark:bg-white/10'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              ))}
              {selectedTag && (
                <button
                  type="button"
                  onClick={() => setSelectedTag(null)}
                  className="text-xs text-rose-500 hover:underline flex items-center gap-0.5 ml-1"
                >
                  <X className="w-3 h-3" />
                  <span>Скинути мітку</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Trash Notice Banner */}
        {activeFilter === 'trash' && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 shrink-0" />
              <span>
                Нотатки в кошику можна відновити в будь-який момент або видалити назавжди.
              </span>
            </div>
            {counts.trash > 0 && (
              <button
                type="button"
                onClick={emptyTrash}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shrink-0 transition-colors cursor-pointer shadow-xs"
              >
                Очистити кошик ({counts.trash})
              </button>
            )}
          </div>
        )}

        {/* Pinned Notes Section */}
        {pinnedNotes.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                ЗАКРІПЛЕНІ ({pinnedNotes.length})
              </span>
              <div className="h-px flex-1 bg-amber-500/20" />
            </div>
            <div className={gridClass}>
              {pinnedNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onOpenEdit={(n) => setEditingNote(n)}
                  onTagClick={(t) => setSelectedTag(t)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Other Notes Section */}
        {otherNotes.length > 0 && (
          <div className="space-y-2.5">
            {pinnedNotes.length > 0 && (
              <div className="flex items-center gap-2 pt-2">
                <span className={`text-[11px] font-black uppercase tracking-wider ${theme.textMuted}`}>
                  ІНШІ НОТАТКИ ({otherNotes.length})
                </span>
                <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
              </div>
            )}
            <div className={gridClass}>
              {otherNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onOpenEdit={(n) => setEditingNote(n)}
                  onTagClick={(t) => setSelectedTag(t)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty States */}
        {filteredNotes.length === 0 && (
          <div className="text-center py-16 px-4 space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto border border-amber-500/20">
              {searchQuery ? (
                <Search className="w-8 h-8" />
              ) : activeFilter === 'trash' ? (
                <Trash2 className="w-8 h-8" />
              ) : activeFilter === 'archived' ? (
                <Archive className="w-8 h-8" />
              ) : activeFilter === 'checklists' ? (
                <CheckSquare className="w-8 h-8" />
              ) : (
                <Compass className="w-8 h-8" />
              )}
            </div>

            <div className="space-y-1">
              <h3 className={`font-bold text-base ${theme.cardTitle}`}>
                {searchQuery
                  ? `Нічого не знайдено за запитом «${searchQuery}»`
                  : activeFilter === 'trash'
                  ? 'Кошик порожній'
                  : activeFilter === 'archived'
                  ? 'Архів порожній'
                  : activeFilter === 'checklists'
                  ? 'Немає списків завдань'
                  : selectedTag
                  ? `Немає нотаток з тегом #${selectedTag}`
                  : 'Тут поки що немає детективних нотаток'}
              </h3>
              <p className={`text-xs ${theme.textMuted} max-w-md mx-auto`}>
                {searchQuery
                  ? 'Спробуйте змінити пошуковий запит або скинути фільтри'
                  : activeFilter === 'trash'
                  ? 'Видалені нотатки з’являтимуться тут перед остаточним очищенням'
                  : 'Створіть першу замітку розслідування вище або відновіть зразки нотаток.'}
              </p>
            </div>

            {!searchQuery && activeFilter === 'all' && (
              <button
                type="button"
                onClick={resetToDefaultSampleNotes}
                className="mt-3 px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 font-bold text-xs transition-colors border border-amber-500/30 cursor-pointer inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Завантажити зразки нотаток</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Google Keep Edit Modal */}
      {editingNote && (
        <NoteEditModal
          note={editingNote}
          onClose={() => setEditingNote(null)}
        />
      )}
    </div>
  );
};
