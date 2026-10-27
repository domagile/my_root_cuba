/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Pin,
  CheckSquare,
  Square,
  Palette,
  Tag,
  Copy,
  Archive,
  Trash2,
  Image as ImageIcon,
  RotateCcw,
  Check,
  Plus,
  ExternalLink,
  Clock,
  Globe,
  Eye,
  Edit3
} from 'lucide-react';
import { ResearchNote, NoteColor, ChecklistItem } from '../../types';
import { useNotesStore } from '../../stores/useNotesStore';
import { useUIStore } from '../../stores/useUIStore';
import { getThemeConfig } from '../../utils/theme';
import { NOTE_COLORS, getNoteColorClasses } from './NoteCard';
import {
  renderContentWithClickableLinks,
  extractAllLinksFromNote,
  NoteLinksBar,
  getHref,
  formatUrlDisplay,
  hasLink
} from './linkHelper';

interface NoteEditModalProps {
  note: ResearchNote | null;
  onClose: () => void;
}

export const NoteEditModal: React.FC<NoteEditModalProps> = ({ note, onClose }) => {
  const themePalette = useUIStore((s) => s.themePalette);
  const theme = getThemeConfig(themePalette);
  const isDark = theme.category === 'dark';

  const {
    updateNote,
    deleteNote,
    restoreNote,
    duplicateNote,
    togglePin,
    toggleArchive,
    setNoteColor
  } = useNotesStore();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isChecklist, setIsChecklist] = useState(false);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [color, setColor] = useState<NoteColor>('default');
  const [isPinned, setIsPinned] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [showTagInput, setShowTagInput] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const newChecklistInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (note) {
      setTitle(note.title || '');
      setContent(note.content || '');
      setIsChecklist(note.isChecklist || false);
      setChecklistItems(note.checklistItems ? [...note.checklistItems] : []);
      setColor(note.color || 'default');
      setIsPinned(note.isPinned || false);
      setIsArchived(note.isArchived || false);
      setTags(note.tags ? [...note.tags] : []);
      setImageUrl(note.imageUrl || '');
      setShowImageInput(!!note.imageUrl);
      setLinkUrl(note.linkUrl || '');
      setShowLinkInput(!!note.linkUrl);
      setViewMode('edit');
    }
  }, [note]);

  if (!note) return null;

  const activeExtractedLinks = extractAllLinksFromNote({
    ...note,
    linkUrl,
    content,
    checklistItems
  });

  const handleSaveAndClose = () => {
    updateNote(note.id, {
      title: title.trim(),
      content: content.trim(),
      isChecklist,
      checklistItems: checklistItems.filter((i) => i.text.trim().length > 0),
      color,
      isPinned,
      isArchived,
      tags,
      imageUrl: imageUrl.trim() || undefined,
      linkUrl: linkUrl.trim() || undefined
    });
    onClose();
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
    setTimeout(() => newChecklistInputRef.current?.focus(), 50);
  };

  const handleToggleChecklistItem = (id: string) => {
    setChecklistItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, isCompleted: !i.isCompleted } : i))
    );
  };

  const handleRemoveChecklistItem = (id: string) => {
    setChecklistItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleAddTag = (t: string) => {
    const clean = t.trim().replace(/^#+/, '');
    if (clean && !tags.includes(clean)) {
      setTags((prev) => [...prev, clean]);
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (t: string) => {
    setTags((prev) => prev.filter((item) => item !== t));
  };

  const colorClasses = getNoteColorClasses(color, isDark);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      {/* Click backdrop to save and close */}
      <div className="fixed inset-0" onClick={handleSaveAndClose} />

      <div
        ref={modalRef}
        className={`relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border shadow-2xl p-5 flex flex-col justify-between gap-4 z-10 transition-colors ${colorClasses}`}
      >
        {/* Modal Top Bar */}
        <div className="flex items-start justify-between gap-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Заголовок..."
            className="w-full bg-transparent font-bold text-base sm:text-lg focus:outline-none placeholder:opacity-60"
          />
          <div className="flex items-center gap-1 shrink-0">
            {!note.isTrash && (
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
            )}
            <button
              type="button"
              onClick={handleSaveAndClose}
              className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="Закрити"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Active Clickable Links Bar (Auto-extracted) */}
        {activeExtractedLinks.length > 0 && (
          <NoteLinksBar links={activeExtractedLinks} className="shadow-xs" />
        )}

        {/* Modal Content */}
        <div className="space-y-3 flex-1 min-h-[140px]">
          {/* Mode Switcher for Text Notes */}
          {!isChecklist && (
            <div className="flex items-center justify-between pb-1 border-b border-black/5 dark:border-white/5">
              <span className="text-[11px] font-semibold opacity-70">Вміст нотатки:</span>
              <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('edit')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                    viewMode === 'edit'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                  title="Редагувати текст"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Редагувати</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('preview')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                    viewMode === 'preview'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                  title="Перегляд з активними лінками"
                >
                  <Eye className="w-3 h-3" />
                  <span>Перегляд лінків</span>
                </button>
              </div>
            </div>
          )}

          {!isChecklist ? (
            viewMode === 'edit' ? (
              <div className="space-y-2">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Текст нотатки або розслідування (можна вставляти посилання, наприклад ra.ee/dgs/...)..."
                  rows={8}
                  className="w-full bg-transparent text-sm focus:outline-none resize-none leading-relaxed placeholder:opacity-60"
                />
                {activeExtractedLinks.length > 0 && (
                  <div className="pt-1">
                    <NoteLinksBar
                      links={activeExtractedLinks}
                      label="Швидкий перехід:"
                      className="bg-amber-500/15"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full text-sm leading-relaxed whitespace-pre-wrap min-h-[160px] p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 select-text">
                {content ? (
                  renderContentWithClickableLinks(content, { stopClickPropagation: false })
                ) : (
                  <span className="opacity-50 italic">Немає тексту нотатки</span>
                )}
              </div>
            )
          ) : (
            <div className="space-y-2 text-sm">
              {checklistItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2 group">
                  <button
                    type="button"
                    onClick={() => handleToggleChecklistItem(item.id)}
                    className="cursor-pointer shrink-0"
                  >
                    {item.isCompleted ? (
                      <CheckSquare className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Square className="w-4 h-4 text-neutral-400" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
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
                    {/* Render active clickable link preview under item if URL detected */}
                    {item.text && hasLink(item.text) && (
                      <div className="text-[11px] pt-0.5 opacity-90">
                        {renderContentWithClickableLinks(item.text, { stopClickPropagation: false })}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveChecklistItem(item.id)}
                    className="p-1 text-neutral-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}

              <div className="flex items-center gap-2 pt-2 border-t border-black/5 dark:border-white/5">
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
                  placeholder="Додати пункт (Enter)..."
                  className="w-full bg-transparent text-xs sm:text-sm focus:outline-none placeholder:opacity-60"
                />
                {newChecklistText && (
                  <button
                    type="button"
                    onClick={handleAddChecklistItem}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 text-white text-xs font-bold cursor-pointer shrink-0"
                  >
                    Додати
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Attached Link URL Input / Preview Section */}
          {showLinkInput && (
            <div className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <Globe className="w-4 h-4" />
                  <span>Посилання на сайт, архів або джерело (URL):</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowLinkInput(false);
                    setLinkUrl('');
                  }}
                  className="text-neutral-400 hover:text-rose-500 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="ra.ee/dgs/..., familysearch.org або https://..."
                  className="flex-1 px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:outline-none focus:border-amber-500 text-xs"
                />
                {linkUrl && (
                  <a
                    href={getHref(linkUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 shrink-0 transition-colors shadow-2xs"
                  >
                    <span>Відкрити</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Attached Image Preview / URL Input */}
          {showImageInput && (
            <div className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-amber-500" />
                  <span>Посилання на зображення чи скан (URL):</span>
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
                className="w-full px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:outline-none focus:border-amber-500 text-xs"
              />
              {imageUrl && (
                <div className="rounded-xl overflow-hidden border border-black/10 dark:border-white/10 max-h-56 mt-2">
                  <img
                    src={imageUrl}
                    alt="Вкладення"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
          )}

          {/* Tags section */}
          {showTagInput && (
            <div className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-amber-500" />
                  <span>Додати тег або мітку:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowTagInput(false)}
                  className="text-neutral-400 hover:text-neutral-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
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
                  placeholder="Введіть мітку (натисніть Enter)..."
                  className="flex-1 px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleAddTag(newTagInput)}
                  className="px-3 py-1.5 bg-amber-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Додати
                </button>
              </div>
            </div>
          )}

          {/* Active Tags Chips */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {tags.map((t) => (
                <span
                  key={t}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-black/10 dark:bg-white/10 flex items-center gap-1.5"
                >
                  #{t}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    className="hover:text-rose-500 cursor-pointer text-sm"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Modal Timestamp info */}
        <div className="flex items-center gap-2 text-[11px] opacity-60">
          <Clock className="w-3 h-3" />
          <span>
            Змінено: {new Date(note.updatedAt).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' })}
          </span>
        </div>

        {/* Modal Footer Toolbar */}
        <div className="flex items-center justify-between pt-3 border-t border-black/5 dark:border-white/5">
          <div className="flex items-center gap-1 relative">
            {/* Color Swatch Picker */}
            <button
              type="button"
              onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
              className="p-2 rounded-xl text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title="Змінити колір"
            >
              <Palette className="w-4 h-4" />
            </button>

            {isColorPickerOpen && (
              <div className="absolute bottom-full left-0 mb-2 p-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl flex items-center gap-1.5 z-30">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setColor(c.id);
                      setIsColorPickerOpen(false);
                    }}
                    className={`w-6 h-6 rounded-full ${c.swatch} transition-transform hover:scale-125 flex items-center justify-center cursor-pointer ${
                      color === c.id ? 'ring-2 ring-amber-500' : ''
                    }`}
                    title={c.label}
                  >
                    {color === c.id && <Check className="w-3.5 h-3.5 text-neutral-900 dark:text-white" />}
                  </button>
                ))}
              </div>
            )}

            {/* Checklist Toggle */}
            <button
              type="button"
              onClick={() => setIsChecklist(!isChecklist)}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                isChecklist
                  ? 'text-amber-500 bg-amber-500/10 font-bold'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
              }`}
              title={isChecklist ? 'Перемкнути на звичайний текст' : 'Перемкнути на список з чекбоксами'}
            >
              <CheckSquare className="w-4 h-4" />
            </button>

            {/* Tag Button */}
            <button
              type="button"
              onClick={() => setShowTagInput(!showTagInput)}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                showTagInput
                  ? 'text-amber-500 bg-amber-500/10'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
              }`}
              title="Додати тег"
            >
              <Tag className="w-4 h-4" />
            </button>

            {/* Image Button */}
            <button
              type="button"
              onClick={() => setShowImageInput(!showImageInput)}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                showImageInput
                  ? 'text-amber-500 bg-amber-500/10'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
              }`}
              title="Додати зображення"
            >
              <ImageIcon className="w-4 h-4" />
            </button>

            {/* Link Button */}
            <button
              type="button"
              onClick={() => setShowLinkInput(!showLinkInput)}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                showLinkInput || linkUrl
                  ? 'text-amber-500 bg-amber-500/10'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
              }`}
              title="Додати посилання (URL)"
            >
              <Globe className="w-4 h-4" />
            </button>

            {/* Duplicate Button */}
            <button
              type="button"
              onClick={() => {
                duplicateNote(note.id);
                onClose();
              }}
              className="p-2 rounded-xl text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title="Створити копію нотатки"
            >
              <Copy className="w-4 h-4" />
            </button>

            {/* Archive Button */}
            <button
              type="button"
              onClick={() => {
                toggleArchive(note.id);
                onClose();
              }}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                isArchived
                  ? 'text-amber-500 bg-amber-500/10'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
              }`}
              title={isArchived ? 'Розархівувати' : 'Архівувати'}
            >
              <Archive className="w-4 h-4" />
            </button>

            {/* Delete / Trash Button */}
            <button
              type="button"
              onClick={() => {
                deleteNote(note.id);
                onClose();
              }}
              className="p-2 rounded-xl text-neutral-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
              title={note.isTrash ? 'Видалити назавжди' : 'Перемістити в кошик'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleSaveAndClose}
            className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};
