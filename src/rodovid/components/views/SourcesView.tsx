/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { BookOpen, Plus, Search, Edit3, ExternalLink, Archive } from 'lucide-react';
import { GenealogyDatabase, Source } from '../../types/genealogy';

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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-900 text-slate-100 p-6 space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-[#B88E3E]" />
            <span>Джерела та Архівні Документи ({sources.length})</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Реєстр метричних книг, ревізьких казок, сповідних розписів та архівних посилань
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Пошук джерел..."
              className="pl-9 pr-4 py-2 text-sm bg-slate-800 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-[#B88E3E]"
            />
          </div>
          <button
            onClick={onOpenAddSource}
            className="px-4 py-2 bg-[#B88E3E] hover:bg-[#A37B30] text-white font-medium text-sm rounded-xl flex items-center gap-2 transition-all shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Додати джерело</span>
          </button>
        </div>
      </div>

      {/* Grid of sources */}
      <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSources.map((source) => (
          <div
            key={source.id}
            className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/80 hover:border-[#B88E3E]/60 transition-all flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#B88E3E]/20 text-[#B88E3E] border border-[#B88E3E]/30">
                  {source.repository ? 'Архівний фонд' : 'Джерело'}
                </span>
                <button
                  onClick={() => onEditSource(source.id)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>

              <h3 className="font-bold text-base text-slate-100 line-clamp-2">
                {source.title}
              </h3>

              {source.repository && (
                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Archive className="w-3.5 h-3.5 text-[#B88E3E]" />
                  <span className="line-clamp-1">{source.repository}</span>
                </div>
              )}

              {(source.archiveFund || source.inventory || source.caseNumber) && (
                <div className="p-2 rounded-lg bg-slate-900/80 font-mono text-xs text-amber-300/90 flex flex-wrap gap-2 border border-slate-700/50">
                  {source.archiveFund && <span>{source.archiveFund}</span>}
                  {source.inventory && <span>{source.inventory}</span>}
                  {source.caseNumber && <span>{source.caseNumber}</span>}
                  {source.page && <span>{source.page}</span>}
                </div>
              )}

              {source.notes && (
                <p className="text-xs text-slate-400 line-clamp-3 italic pt-1">
                  "{source.notes}"
                </p>
              )}
            </div>

            {source.url && (
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[#B88E3E] hover:underline flex items-center gap-1 mt-2"
              >
                <span>Переглянути першоджерело</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        ))}

        {filteredSources.length === 0 && (
          <div className="col-span-full p-12 text-center text-slate-500">
            Джерел не знайдено або реєстр порожній
          </div>
        )}
      </div>
    </div>
  );
};
