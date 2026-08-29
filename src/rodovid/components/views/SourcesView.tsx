/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { BookOpen, Plus, Search, Edit3, ExternalLink, Archive } from 'lucide-react';
import { GenealogyDatabase, Source } from '../../types/genealogy';
import { useUIStore } from '../../../stores/useUIStore';
import { getThemeConfig } from '../../../utils/theme';

interface SourcesViewProps {
  database: GenealogyDatabase;
  onSelectPerson: (id: string) => void;
  onOpenAddSource: () => void;
  onEditSource: (id: string) => void;
}

export const SourcesView: React.FC<SourcesViewProps> = ({
  database,
  onSelectPerson,
  onOpenAddSource,
  onEditSource
}) => {
  const themePalette = useUIStore((s) => s.themePalette);
  const theme = getThemeConfig(themePalette);
  const isDark = theme.category === 'dark';

  const [searchQuery, setSearchQuery] = useState('');
  
  const sources = useMemo(() => {
    return Object.values(database.sources || {}) as Source[];
  }, [database]);

  const filteredSources = sources.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      s.title?.toLowerCase().includes(q) ||
      s.repository?.toLowerCase().includes(q) ||
      s.archiveFund?.toLowerCase().includes(q) ||
      s.notes?.toLowerCase().includes(q)
    );
  });

  return (
    <div className={`max-w-7xl mx-auto px-4 py-6 space-y-6 ${theme.textPrimary}`}>
      {/* Top action bar */}
      <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
        <div>
          <h2 className={`text-xl font-bold ${theme.textPrimary} flex items-center gap-2`}>
            <BookOpen className="w-5 h-5 text-amber-500" />
            <span>Джерела та Архівні Документи ({sources.length})</span>
          </h2>
          <p className={`text-xs ${theme.textMuted} mt-1`}>
            Реєстр метричних книг, ревізьких казок, сповідних розписів та архівних посилань
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className={`w-4 h-4 absolute left-3 top-3 ${theme.textMuted}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Пошук джерел..."
              className={`pl-9 pr-4 py-2 text-xs ${theme.inputBg} border ${theme.inputBorder} rounded-lg ${theme.textPrimary} focus:outline-none focus:border-amber-500`}
            />
          </div>
          <button
            onClick={onOpenAddSource}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs rounded-lg flex items-center gap-2 transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Додати джерело</span>
          </button>
        </div>
      </div>

      {/* Grid of sources */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSources.map((source) => (
          <div
            key={source.id}
            className={`p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} hover:border-amber-500/60 transition-all flex flex-col justify-between space-y-4 shadow-xs`}
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                  isDark ? 'bg-amber-950/60 text-amber-400 border border-amber-800/60' : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}>
                  {source.repository ? 'Архівний фонд' : 'Джерело'}
                </span>
                <button
                  onClick={() => onEditSource(source.id)}
                  className={`p-1.5 ${theme.textMuted} hover:text-amber-500 rounded-lg hover:bg-neutral-500/10 transition-colors cursor-pointer`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>

              <h3 className={`font-bold text-sm ${theme.textPrimary} line-clamp-2`}>
                {source.title}
              </h3>

              {source.repository && (
                <div className={`text-xs ${theme.textMuted} flex items-center gap-1.5`}>
                  <Archive className="w-3.5 h-3.5 text-amber-500" />
                  <span className="line-clamp-1">{source.repository}</span>
                </div>
              )}

              {(source.archiveFund || source.inventory || source.caseNumber) && (
                <div className={`p-2 rounded-lg ${theme.surfaceBg} font-mono text-xs ${isDark ? 'text-amber-300/90' : 'text-amber-800'} flex flex-wrap gap-2 border ${theme.borderSubtle}`}>
                  {source.archiveFund && <span>{source.archiveFund}</span>}
                  {source.inventory && <span>{source.inventory}</span>}
                  {source.caseNumber && <span>{source.caseNumber}</span>}
                  {source.page && <span>{source.page}</span>}
                </div>
              )}

              {source.notes && (
                <p className={`text-xs ${theme.textSecondary} line-clamp-3 italic pt-1`}>
                  "{source.notes}"
                </p>
              )}
            </div>

            {source.url && (
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-amber-600 hover:text-amber-500 hover:underline flex items-center gap-1 mt-2"
              >
                <span>Переглянути першоджерело</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        ))}

        {filteredSources.length === 0 && (
          <div className={`col-span-full p-12 text-center ${theme.cardBg} border ${theme.cardBorder} rounded-xl ${theme.textMuted} text-xs`}>
            Джерел не знайдено або реєстр порожній
          </div>
        )}
      </div>
    </div>
  );
};
