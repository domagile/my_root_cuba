/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Edit3,
  ExternalLink,
  Archive,
  Trash2,
  Tag,
  Hash,
  Layers,
  Filter,
  LayoutGrid,
  FolderOpen,
  Link as LinkIcon,
  ChevronDown,
  ChevronRight,
  FileText
} from 'lucide-react';
import { GenealogyDatabase, Source } from '../../types/genealogy';
import { useUIStore } from '../../../stores/useUIStore';
import { getThemeConfig } from '../../../utils/theme';
import { ConfirmDeleteModal } from '../../../components/common/ConfirmDeleteModal';

interface SourcesViewProps {
  database: GenealogyDatabase;
  onSelectPerson: (id: string) => void;
  onOpenAddSource: () => void;
  onEditSource: (id: string) => void;
  onDeleteSource?: (id: string) => void;
}

type GroupByOption = 'none' | 'documentType' | 'repository' | 'tag';

// Helper to determine document type if not explicitly set
const detectDocumentType = (source: Source): string => {
  if (source.documentType) return source.documentType;
  const title = (source.title || '').toLowerCase();
  const notes = (source.notes || '').toLowerCase();
  const text = `${title} ${notes}`;

  if (text.includes('метрич')) return 'Метричні книги';
  if (text.includes('сповід') || text.includes('исповед')) return 'Сповідальні розписи';
  if (text.includes('ревіз') || text.includes('ревиз')) return 'Ревізькі казки';
  if (text.includes('акт') || text.includes('рагс') || text.includes('рацс')) return 'Акти цивільного стану';
  if (text.includes('дворян') || text.includes('грамот')) return 'Дворянські справи та книги';
  if (text.includes('дерево') || text.includes('родовід') || text.includes('генеалог') || text.includes('familio')) {
    return 'Родовідні розписи та схеми';
  }
  if (text.includes('книга') || text.includes('газет') || text.includes('видан')) return 'Друковані видання та книги';
  if (text.includes('фонд') || text.includes('справа') || text.includes('опис') || source.repository) {
    return 'Архівні справи та фонди';
  }
  return 'Інші джерела';
};

// Helper to render text with clickable links
const renderTextWithLinks = (text: string, themeColorClass: string) => {
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
          className={`${themeColorClass} underline hover:opacity-80 inline-flex items-center gap-0.5 break-all font-medium`}
        >
          <span>{part}</span>
          <ExternalLink className="w-2.5 h-2.5 inline shrink-0" />
        </a>
      );
    }
    return part;
  });
};

export const SourcesView: React.FC<SourcesViewProps> = ({
  database,
  onOpenAddSource,
  onEditSource,
  onDeleteSource
}) => {
  const themePalette = useUIStore((s) => s.themePalette);
  const theme = getThemeConfig(themePalette);
  const isDark = theme.category === 'dark';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<GroupByOption>('none');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [sourceToDelete, setSourceToDelete] = useState<{ id: string; title: string } | null>(null);

  const sources = useMemo(() => {
    return Object.values(database.sources || {}) as Source[];
  }, [database]);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const tagMap: Record<string, number> = {};
    sources.forEach((s) => {
      if (Array.isArray(s.tags)) {
        s.tags.forEach((t) => {
          const clean = t.trim().replace(/^#+/, '');
          if (clean) {
            tagMap[clean] = (tagMap[clean] || 0) + 1;
          }
        });
      }
    });
    return Object.entries(tagMap)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }, [sources]);

  // Filter sources based on search and selected tag
  const filteredSources = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return sources.filter((s) => {
      // Tag filter
      if (selectedTag) {
        const hasTag =
          Array.isArray(s.tags) &&
          s.tags.some((t) => t.trim().replace(/^#+/, '').toLowerCase() === selectedTag.toLowerCase());
        if (!hasTag) return false;
      }

      // Search query filter
      if (!q) return true;

      const titleMatch = s.title?.toLowerCase().includes(q);
      const repoMatch = s.repository?.toLowerCase().includes(q) || s.archive?.toLowerCase().includes(q);
      const refMatch =
        s.archiveReference?.toLowerCase().includes(q) ||
        s.archiveFund?.toLowerCase().includes(q) ||
        s.fund?.toLowerCase().includes(q) ||
        s.inventory?.toLowerCase().includes(q) ||
        s.caseNumber?.toLowerCase().includes(q);
      const notesMatch = s.notes?.toLowerCase().includes(q) || s.transcription?.toLowerCase().includes(q);
      const authorMatch = s.author?.toLowerCase().includes(q);
      const docTypeMatch = s.documentType?.toLowerCase().includes(q);
      const tagsMatch = Array.isArray(s.tags) && s.tags.some((t) => t.toLowerCase().includes(q));
      const customFieldsMatch =
        Array.isArray(s.customFields) &&
        s.customFields.some(
          (cf) => cf.label?.toLowerCase().includes(q) || cf.value?.toLowerCase().includes(q)
        );

      return (
        titleMatch ||
        repoMatch ||
        refMatch ||
        notesMatch ||
        authorMatch ||
        docTypeMatch ||
        tagsMatch ||
        customFieldsMatch
      );
    });
  }, [sources, searchQuery, selectedTag]);

  // Grouped sources structure
  const groupedSources = useMemo(() => {
    if (groupBy === 'none') {
      return [{ groupKey: 'all', title: 'Усі джерела', items: filteredSources }];
    }

    const groups: Record<string, { title: string; icon?: string; items: Source[] }> = {};

    filteredSources.forEach((source) => {
      let key = 'Інше';
      let displayTitle = 'Інше';

      if (groupBy === 'documentType') {
        key = detectDocumentType(source);
        displayTitle = key;
      } else if (groupBy === 'repository') {
        key = source.repository?.trim() || source.archive?.trim() || 'Без вказання архівосховища';
        displayTitle = key;
      } else if (groupBy === 'tag') {
        if (Array.isArray(source.tags) && source.tags.length > 0) {
          source.tags.forEach((tag) => {
            const cleanTag = tag.trim().replace(/^#+/, '');
            const tagKey = `#${cleanTag}`;
            if (!groups[tagKey]) {
              groups[tagKey] = { title: tagKey, items: [] };
            }
            if (!groups[tagKey].items.some((item) => item.id === source.id)) {
              groups[tagKey].items.push(source);
            }
          });
          return;
        } else {
          key = 'Без хештегів';
          displayTitle = 'Без хештегів';
        }
      }

      if (!groups[key]) {
        groups[key] = { title: displayTitle, items: [] };
      }
      groups[key].items.push(source);
    });

    return Object.entries(groups)
      .map(([groupKey, data]) => ({
        groupKey,
        title: data.title,
        items: data.items
      }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [filteredSources, groupBy]);

  const toggleGroupCollapse = (groupKey: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  const handleConfirmDelete = () => {
    if (sourceToDelete && onDeleteSource) {
      onDeleteSource(sourceToDelete.id);
      setSourceToDelete(null);
    }
  };

  return (
    <div className={`max-w-7xl mx-auto px-4 py-6 space-y-6 ${theme.textPrimary}`}>
      {/* Top action bar */}
      <div
        className={`${theme.cardBg} border ${theme.cardBorder} rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4`}
      >
        <div>
          <h2 className={`text-xl font-bold ${theme.textPrimary} flex items-center gap-2.5`}>
            <BookOpen className="w-5 h-5 text-amber-500" />
            <span>Джерела та Архівні Документи ({sources.length})</span>
          </h2>
          <p className={`text-xs ${theme.textMuted} mt-1`}>
            Реєстр метричних книг, ревізьких казок, сповідних розписів, посилань та користувацьких полів
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search */}
          <div className="relative flex-1 sm:w-64">
            <Search className={`w-4 h-4 absolute left-3 top-2.5 ${theme.textMuted}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Пошук (назва, архів, тег, шифр)..."
              className={`w-full pl-9 pr-4 py-2 text-xs ${theme.inputBg} border ${theme.inputBorder} rounded-xl ${theme.textPrimary} focus:outline-none focus:border-amber-500`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-xs text-neutral-400 hover:text-neutral-200"
              >
                ✕
              </button>
            )}
          </div>

          {/* Grouping dropdown */}
          <div className="relative flex items-center">
            <div className="flex items-center gap-1.5 px-3 py-2 text-xs bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl relative">
              <Filter className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="text-[11px] text-neutral-400 font-medium hidden sm:inline">Групування:</span>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as GroupByOption)}
                aria-label="Оберіть режим групування джерел"
                className={`bg-transparent text-xs font-bold ${theme.textPrimary} focus:outline-none cursor-pointer pr-5 appearance-none`}
              >
                <option value="none" className={isDark ? 'bg-neutral-900 text-neutral-100' : 'bg-white text-neutral-900'}>
                  Всі (без групування)
                </option>
                <option value="documentType" className={isDark ? 'bg-neutral-900 text-neutral-100' : 'bg-white text-neutral-900'}>
                  За типом документа
                </option>
                <option value="repository" className={isDark ? 'bg-neutral-900 text-neutral-100' : 'bg-white text-neutral-900'}>
                  За архівом / репозиторієм
                </option>
                <option value="tag" className={isDark ? 'bg-neutral-900 text-neutral-100' : 'bg-white text-neutral-900'}>
                  За хештегами
                </option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Add Source button */}
          <button
            onClick={onOpenAddSource}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-sm cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Додати джерело</span>
          </button>
        </div>
      </div>

      {/* Tags quick filter bar */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap px-1 text-xs">
          <span className="text-[11px] font-bold text-neutral-400 flex items-center gap-1 mr-1">
            <Tag className="w-3 h-3 text-amber-500" /> Теги:
          </span>
          {selectedTag && (
            <button
              type="button"
              onClick={() => setSelectedTag(null)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-600 text-white shadow-xs transition-colors cursor-pointer"
            >
              <span>#{selectedTag}</span>
              <span className="text-[10px] ml-0.5 opacity-80 hover:opacity-100">✕</span>
            </button>
          )}
          {allTags.map((t) => {
            const isCurrent = selectedTag?.toLowerCase() === t.tag.toLowerCase();
            if (isCurrent) return null;
            return (
              <button
                key={t.tag}
                type="button"
                onClick={() => setSelectedTag(t.tag)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-black/20 hover:bg-amber-500/20 text-neutral-400 hover:text-amber-400 border-white/5'
                    : 'bg-white hover:bg-amber-50 text-neutral-600 hover:text-amber-700 border-black/5'
                }`}
              >
                #{t.tag} <span className="opacity-50 text-[10px]">({t.count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Source Groups or Flat List */}
      <div className="space-y-6">
        {groupedSources.map((group) => {
          const isCollapsed = collapsedGroups[group.groupKey];

          return (
            <div key={group.groupKey} className="space-y-3">
              {/* Group Header (if grouped) */}
              {groupBy !== 'none' && (
                <button
                  type="button"
                  onClick={() => toggleGroupCollapse(group.groupKey)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl ${theme.cardBg} border ${theme.cardBorder} text-left hover:border-amber-500/40 transition-colors cursor-pointer`}
                >
                  <div className="flex items-center gap-2.5">
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-amber-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-amber-500" />
                    )}
                    <FolderOpen className="w-4 h-4 text-amber-500" />
                    <span className="font-bold text-sm">{group.title}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20">
                      {group.items.length}
                    </span>
                  </div>
                  <span className="text-[11px] text-neutral-400">
                    {isCollapsed ? 'Розгорнути' : 'Згорнути'}
                  </span>
                </button>
              )}

              {/* Group Content */}
              {!isCollapsed && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.items.map((source) => {
                    const docTypeLabel =
                      source.documentType || detectDocumentType(source);

                    return (
                      <div
                        key={source.id}
                        className={`p-5 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} hover:border-amber-500/60 transition-all flex flex-col justify-between space-y-4 shadow-xs hover:shadow-md`}
                      >
                        <div className="space-y-3">
                          {/* Card Header: Type Badge & Action Buttons */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg ${
                                  isDark
                                    ? 'bg-amber-950/70 text-amber-400 border border-amber-800/60'
                                    : 'bg-amber-100 text-amber-900 border border-amber-300'
                                }`}
                              >
                                {docTypeLabel}
                              </span>
                              {source.publication && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-neutral-400 border border-black/5 dark:border-white/5">
                                  {source.publication}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => onEditSource(source.id)}
                                className={`p-1.5 ${theme.textMuted} hover:text-amber-500 rounded-lg hover:bg-neutral-500/10 transition-colors cursor-pointer`}
                                title="Редагувати джерело"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              {onDeleteSource && (
                                <button
                                  onClick={() =>
                                    setSourceToDelete({
                                      id: source.id,
                                      title: source.title || 'Архівне джерело'
                                    })
                                  }
                                  className={`p-1.5 ${theme.textMuted} hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer`}
                                  title="Видалити джерело"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Title */}
                          <h3 className={`font-bold text-sm ${theme.textPrimary} leading-snug line-clamp-2`}>
                            {source.title}
                          </h3>

                          {/* Repository / Archive */}
                          {(source.repository || source.archive) && (
                            <div className={`text-xs ${theme.textMuted} flex items-center gap-1.5`}>
                              <Archive className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span className="line-clamp-1 font-medium">
                                {source.repository || source.archive}
                              </span>
                            </div>
                          )}

                          {/* Author / Creator */}
                          {source.author && (
                            <p className="text-[11px] text-neutral-400 italic line-clamp-1">
                              Укладач: {source.author}
                            </p>
                          )}

                          {/* Archive Reference Badges (Fund, Inventory, Case, Page) */}
                          {(source.archiveReference ||
                            source.archiveFund ||
                            source.fund ||
                            source.inventory ||
                            source.caseNumber ||
                            source.page) && (
                            <div
                              className={`p-2.5 rounded-xl ${theme.surfaceBg} font-mono text-xs ${
                                isDark ? 'text-amber-300' : 'text-amber-900'
                              } flex flex-wrap gap-1.5 border ${theme.borderSubtle}`}
                            >
                              {source.archiveReference ? (
                                <span>{source.archiveReference}</span>
                              ) : (
                                <>
                                  {(source.archiveFund || source.fund) && (
                                    <span>Фонд {source.archiveFund || source.fund}</span>
                                  )}
                                  {source.inventory && <span>Опис {source.inventory}</span>}
                                  {source.caseNumber && <span>Справа {source.caseNumber}</span>}
                                  {source.page && <span>Арк. {source.page}</span>}
                                </>
                              )}
                            </div>
                          )}

                          {/* Notes / Transcription with auto-links */}
                          {(source.notes || source.transcription) && (
                            <p className={`text-xs ${theme.textSecondary} line-clamp-3 italic pt-0.5 leading-relaxed`}>
                              "{renderTextWithLinks(
                                source.notes || source.transcription || '',
                                isDark ? 'text-amber-400' : 'text-amber-700'
                              )}"
                            </p>
                          )}

                          {/* Custom Fields (Власні поля з лінками та іншим) */}
                          {Array.isArray(source.customFields) && source.customFields.length > 0 && (
                            <div className="pt-2 border-t border-black/5 dark:border-white/5 space-y-1.5">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1">
                                <Layers className="w-3 h-3 text-amber-500" />
                                <span>Власні поля ({source.customFields.length}):</span>
                              </div>
                              <div className="space-y-1">
                                {source.customFields.map((cf, idx) => {
                                  const isLink =
                                    cf.type === 'link' ||
                                    cf.value?.startsWith('http://') ||
                                    cf.value?.startsWith('https://');

                                  return (
                                    <div
                                      key={cf.id || idx}
                                      className="flex items-start justify-between gap-2 text-xs py-0.5"
                                    >
                                      <span className="text-neutral-500 text-[11px] shrink-0 font-medium">
                                        {cf.label}:
                                      </span>
                                      {isLink ? (
                                        <a
                                          href={cf.value}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="text-amber-600 dark:text-amber-400 hover:underline font-bold text-[11px] inline-flex items-center gap-1 truncate max-w-[70%]"
                                          title={cf.value}
                                        >
                                          <span className="truncate">{cf.value}</span>
                                          <ExternalLink className="w-3 h-3 shrink-0" />
                                        </a>
                                      ) : (
                                        <span
                                          className={`font-medium ${theme.textPrimary} text-[11px] text-right truncate`}
                                        >
                                          {cf.value || '—'}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Tags & Hashtags Badges */}
                          {Array.isArray(source.tags) && source.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {source.tags.map((tag) => {
                                const cleanTag = tag.trim().replace(/^#+/, '');
                                return (
                                  <button
                                    key={tag}
                                    type="button"
                                    onClick={() => setSelectedTag(cleanTag)}
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-colors cursor-pointer ${
                                      selectedTag?.toLowerCase() === cleanTag.toLowerCase()
                                        ? 'bg-amber-500 text-white border-amber-600'
                                        : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 hover:bg-amber-500/20'
                                    }`}
                                  >
                                    #{cleanTag}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Card Footer: Clickable primary URL link */}
                        {(source.url || source.documentLink) && (
                          <div className="pt-2 border-t border-black/5 dark:border-white/5">
                            <a
                              href={source.url || source.documentLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/25 text-xs font-bold flex items-center justify-between transition-colors shadow-2xs group"
                            >
                              <span className="flex items-center gap-1.5 truncate">
                                <LinkIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span className="truncate">Переглянути першоджерело онлайн</span>
                              </span>
                              <ExternalLink className="w-3.5 h-3.5 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {filteredSources.length === 0 && (
          <div
            className={`p-12 text-center ${theme.cardBg} border ${theme.cardBorder} rounded-2xl ${theme.textMuted} text-xs space-y-3`}
          >
            <BookOpen className="w-8 h-8 text-neutral-400 mx-auto opacity-50" />
            <p className="font-medium">
              {searchQuery || selectedTag
                ? 'За вашим запитом джерел не знайдено'
                : 'Реєстр джерел порожній. Натисніть «+ Додати джерело», щоб додати перший документ.'}
            </p>
            {(searchQuery || selectedTag) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedTag(null);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-amber-500/15 text-amber-500 text-xs font-bold hover:bg-amber-500/25 cursor-pointer transition-colors"
              >
                Скинути фільтри
              </button>
            )}
          </div>
        )}
      </div>

      {sourceToDelete && (
        <ConfirmDeleteModal
          isOpen={!!sourceToDelete}
          title="Видалити архівне джерело"
          itemName={sourceToDelete.title}
          itemType="архівне джерело"
          message={`Ви дійсно бажаєте видалити джерело «${sourceToDelete.title}»? Посилання на це джерело в документах та подіях будуть збережені, але запис буде видалено з реєстру.`}
          confirmText="Так, видалити джерело"
          cancelText="Скасувати"
          onConfirm={handleConfirmDelete}
          onClose={() => setSourceToDelete(null)}
          isPermanent={true}
        />
      )}
    </div>
  );
};
