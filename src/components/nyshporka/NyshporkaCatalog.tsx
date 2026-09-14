import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  Search, 
  ExternalLink, 
  BookOpen, 
  Filter, 
  Plus, 
  Check, 
  Layers, 
  FileSpreadsheet,
  Globe2
} from 'lucide-react';
import archivesData from '../../data/nyshporka/archives.json';
import dahmoCases from '../../data/nyshporka/dahmo_sample_cases.json';

interface NyshporkaCatalogProps {
  theme: any;
  onSelectCase?: (caseItem: any) => void;
}

export const NyshporkaCatalog: React.FC<NyshporkaCatalogProps> = ({ theme, onSelectCase }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState<'ALL' | 'UA' | 'PL' | 'MD'>('ALL');
  const [selectedRepoId, setSelectedRepoId] = useState<string>('DAHMO');
  const [viewSection, setViewSection] = useState<'archives' | 'cases'>('archives');
  const [addedCases, setAddedCases] = useState<Set<string>>(new Set());

  const rawRepos = (archivesData as any).repositories || {};
  const rawFonds = (archivesData as any).fonds || [];

  const repositories = useMemo(() => {
    return Object.entries(rawRepos).map(([key, value]: [string, any]) => ({
      id: key,
      label: value.label || key,
      name: value.name || '',
      country: value.country || 'UA',
      sites: value.sites || {},
      codes: value.codes || {},
      aliases: value.aliases || []
    }));
  }, [rawRepos]);

  const filteredRepos = useMemo(() => {
    return repositories.filter(repo => {
      const matchCountry = countryFilter === 'ALL' || repo.country === countryFilter;
      const q = searchQuery.toLowerCase();
      const matchQuery = !q || 
        repo.label.toLowerCase().includes(q) || 
        repo.name.toLowerCase().includes(q) ||
        (repo.aliases && repo.aliases.some((a: string) => a.toLowerCase().includes(q)));
      return matchCountry && matchQuery;
    });
  }, [repositories, countryFilter, searchQuery]);

  const selectedRepo = rawRepos[selectedRepoId] || repositories[0];

  const filteredCases = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return (dahmoCases as any[]).filter(c => {
      if (!q) return true;
      return (
        c.description.toLowerCase().includes(q) ||
        c.fondTitle.toLowerCase().includes(q) ||
        c.fondNo.toLowerCase().includes(q) ||
        c.caseNo.toLowerCase().includes(q) ||
        c.date.toLowerCase().includes(q)
      );
    });
  }, [searchQuery]);

  const handleAddCase = (c: any) => {
    const key = `${c.fondNo}-${c.invLabel}-${c.caseNo}`;
    setAddedCases(prev => new Set(prev).add(key));
    if (onSelectCase) {
      onSelectCase(c);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className={`text-xl font-bold ${theme.cardTitle} flex items-center gap-2`}>
            <Building2 className="w-5 h-5 text-amber-500" />
            Каталог архівів та описів фондів
          </h2>
          <p className={`text-xs ${theme.cardSubtext} mt-0.5`}>
            Довідник державних архівів України, Молдови, Польщі та база архівних справ
          </p>
        </div>

        {/* Section switcher */}
        <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-xl p-1 border border-neutral-200 dark:border-neutral-700 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setViewSection('archives')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              viewSection === 'archives'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:text-neutral-100'
            }`}
          >
            🏛 Державні архіви ({repositories.length})
          </button>
          <button
            type="button"
            onClick={() => setViewSection('cases')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              viewSection === 'cases'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:text-neutral-100'
            }`}
          >
            📋 Справи з описів (ДАХмО)
          </button>
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className={`p-4 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm`}>
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              viewSection === 'archives' 
                ? 'Пошук за назвою або абревіатурою (напр. ЦДІАК, ДАХмО, Київ)...' 
                : 'Пошук справи за номером, повітом, описом чи роком...'
            }
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400"
          />
        </div>

        {viewSection === 'archives' && (
          <div className="flex items-center gap-1.5 shrink-0">
            {(['ALL', 'UA', 'PL', 'MD'] as const).map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setCountryFilter(c)}
                className={`px-3 py-1.5 text-xs rounded-xl font-medium transition-colors cursor-pointer ${
                  countryFilter === c
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                {c === 'ALL' ? 'Всі країни' : c === 'UA' ? '🇺🇦 Україна' : c === 'PL' ? '🇵🇱 Польща' : '🇲🇩 Молдова'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Section 1: Archives Directory */}
      {viewSection === 'archives' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Archives List */}
          <div className="md:col-span-5 space-y-2 max-h-[580px] overflow-y-auto pr-1">
            {filteredRepos.map(repo => {
              const isSelected = selectedRepoId === repo.id;
              return (
                <div
                  key={repo.id}
                  onClick={() => setSelectedRepoId(repo.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500 text-neutral-900 dark:text-neutral-100 shadow-sm'
                      : `${theme.cardBg} ${theme.cardBorder} hover:border-neutral-300 dark:hover:border-neutral-700`
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                          {repo.label}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-mono">
                          {repo.country}
                        </span>
                      </div>
                      <p className={`text-xs ${theme.cardSubtext} line-clamp-2 mt-1`}>
                        {repo.name}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Archive Detail View */}
          <div className={`md:col-span-7 p-6 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-sm space-y-5`}>
            {selectedRepo ? (
              <>
                <div className="flex items-start justify-between gap-4 border-b pb-4 border-neutral-200 dark:border-neutral-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 text-xs font-bold font-mono">
                        {selectedRepo.label}
                      </span>
                      <span className="text-xs font-medium text-neutral-500">
                        Країна: {selectedRepo.country === 'UA' ? 'Україна' : selectedRepo.country === 'PL' ? 'Польща' : 'Молдова'}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mt-2">
                      {selectedRepo.name}
                    </h3>
                  </div>
                </div>

                {/* Digital Collection Links */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
                    Оцифровані каталоги та онлайн-колекції
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {selectedRepo.sites && Object.entries(selectedRepo.sites).map(([siteKey, siteVal]: [string, any]) => (
                      <a
                        key={siteKey}
                        href={siteVal.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 hover:bg-neutral-200 dark:hover:bg-neutral-700/80 border border-neutral-200 dark:border-neutral-700 transition-colors flex items-center justify-between group"
                      >
                        <div>
                          <div className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 capitalize flex items-center gap-1.5">
                            <Globe2 className="w-3.5 h-3.5 text-amber-500" />
                            {siteKey === 'archium' ? 'Archium (Е-каталог)' : siteKey === 'fs' ? 'FamilySearch плівки' : siteKey}
                          </div>
                          <div className="text-[10px] text-neutral-500 truncate max-w-[180px] mt-0.5">
                            {siteVal.url}
                          </div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-neutral-400 group-hover:text-amber-500 transition-colors" />
                      </a>
                    ))}
                  </div>
                </div>

                {/* Archival Identifiers / Codes */}
                {selectedRepo.codes && Object.keys(selectedRepo.codes).length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
                      Шифри в базах даних
                    </h4>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {Object.entries(selectedRepo.codes).map(([k, v]: [string, any]) => (
                        <div key={k} className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                          <span className="text-neutral-400 font-mono text-[10px] uppercase mr-1">{k}:</span>
                          <span className="font-medium text-neutral-800 dark:text-neutral-200">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sample Key Fonds */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
                    Ключові генеалогічні фонди
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700">
                      <div className="font-bold text-neutral-900 dark:text-neutral-100">
                        Фонд 315. Подільська духовна консисторія (1795–1920)
                      </div>
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                        Метричні книги, сповідні розписи, шлюбні обшуки, клірові відомості Подільської губернії.
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700">
                      <div className="font-bold text-neutral-900 dark:text-neutral-100">
                        Фонд 226. Подільська казенна палата
                      </div>
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                        Ревізькі казки (переписи податного населення 1795–1858 рр.).
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-neutral-400 text-xs">
                Виберіть архів зі списку ліворуч для перегляду деталей
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section 2: DAHMO Cases Database */}
      {viewSection === 'cases' && (
        <div className="space-y-3">
          <div className="text-xs text-neutral-500 flex items-center justify-between">
            <span>Знайдено справ: {filteredCases.length}</span>
            <span className="text-[11px] italic">Джерело: ДАХмО Archium E-Catalog (Кам'янецький та Проскурівський повіти)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1">
            {filteredCases.map((c, i) => {
              const key = `${c.fondNo}-${c.invLabel}-${c.caseNo}`;
              const isAdded = addedCases.has(key);

              return (
                <div 
                  key={i} 
                  className={`p-4 rounded-xl ${theme.cardBg} border ${theme.cardBorder} hover:border-neutral-300 dark:hover:border-neutral-700 transition-all flex flex-col justify-between shadow-xs`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-mono text-xs font-bold">
                        Ф. {c.fondNo}, {c.invLabel}, спр. {c.caseNo}
                      </span>
                      <span className="text-[11px] font-mono text-neutral-500">
                        {c.date} · {c.sheets} арк.
                      </span>
                    </div>

                    <p className="text-xs text-neutral-800 dark:text-neutral-200 font-medium line-clamp-3 leading-relaxed">
                      {c.description}
                    </p>

                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                      {c.fondTitle}
                    </div>
                  </div>

                  <div className="pt-3 mt-2 border-t border-neutral-200 dark:border-neutral-800/80 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => handleAddCase(c)}
                      disabled={isAdded}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        isAdded
                          ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Взято в роботу
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          Взяти в бібліотеку
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
