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
  Globe2,
  Calendar,
  SlidersHorizontal,
  RotateCcw,
  X,
  Tag,
  Tags,
  FolderTree,
  Hash
} from 'lucide-react';
import archivesData from '../../data/nyshporka/archives.json';
import dahmoCases from '../../data/nyshporka/dahmo_sample_cases.json';

interface NyshporkaCatalogProps {
  theme: any;
  onSelectCase?: (caseItem: any) => void;
}

// Popular genealogical tag suggestions for archival research
export const POPULAR_TAG_SUGGESTIONS = [
  'метрична книга',
  'сповідний розпис',
  'ревізька казка',
  'шлюбні обшуки',
  'клірова відомість',
  'посімейний список',
  'перепис населення',
  'евакуація',
  'судова справа',
  'листування'
];

export const getCaseKey = (c: any): string => {
  return `${c.fondNo}-${c.invLabel}-${c.caseNo}`;
};

// Automatic tag detection based on archival case title and description
export const getInitialAutoTags = (c: any): string[] => {
  const text = `${c.description || ''} ${c.fondTitle || ''}`.toLowerCase();
  const tags: string[] = [];
  if (text.includes('метричн')) tags.push('метрична книга');
  if (text.includes('сповідн')) tags.push('сповідний розпис');
  if (text.includes('ревіз')) tags.push('ревізька казка');
  if (text.includes('шлюб')) tags.push('шлюбні обшуки');
  if (text.includes('кліров')) tags.push('клірова відомість');
  if (text.includes('посімейн')) tags.push('посімейний список');
  if (text.includes('перепис')) tags.push('перепис населення');
  if (text.includes('евакуац')) tags.push('евакуація');
  if (text.includes('суд')) tags.push('судова справа');
  if (text.includes('листуван')) tags.push('листування');
  return Array.from(new Set(tags));
};

// Helper to extract 4-digit years from case date/description strings
const parseCaseYears = (c: any): { startYear: number | null; endYear: number | null } => {
  const text = `${c.date || ''} ${c.description || ''}`;
  const matches = text.match(/\b(1[6-9]\d{2}|20\d{2})\b/g);
  if (!matches || matches.length === 0) return { startYear: null, endYear: null };
  const nums = matches.map(Number);
  return {
    startYear: Math.min(...nums),
    endYear: Math.max(...nums)
  };
};

export const NyshporkaCatalog: React.FC<NyshporkaCatalogProps> = ({ theme, onSelectCase }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState<'ALL' | 'UA' | 'PL' | 'MD'>('ALL');
  const [fromYear, setFromYear] = useState<string>('');
  const [toYear, setToYear] = useState<string>('');
  const [selectedRepoId, setSelectedRepoId] = useState<string>('DAHMO');
  const [viewSection, setViewSection] = useState<'archives' | 'cases'>('archives');
  const [addedCases, setAddedCases] = useState<Set<string>>(new Set());

  // Tags state with localStorage persistence
  const [caseTags, setCaseTags] = useState<Record<string, string[]>>(() => {
    try {
      const raw = localStorage.getItem('nyshporka_case_tags');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse nyshporka_case_tags from localStorage', e);
    }
    // Initialize with detected tags from case records
    const initial: Record<string, string[]> = {};
    (dahmoCases as any[]).forEach(c => {
      const key = getCaseKey(c);
      const auto = getInitialAutoTags(c);
      if (auto.length > 0) {
        initial[key] = auto;
      }
    });
    return initial;
  });

  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [groupByTags, setGroupByTags] = useState<boolean>(false);
  const [activeTagAddCase, setActiveTagAddCase] = useState<string | null>(null);
  const [newTagInput, setNewTagInput] = useState<string>('');

  const saveTagsToStorage = (updated: Record<string, string[]>) => {
    setCaseTags(updated);
    try {
      localStorage.setItem('nyshporka_case_tags', JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save nyshporka_case_tags', e);
    }
  };

  const handleAddTag = (caseKey: string, rawTag: string) => {
    const clean = rawTag.trim().toLowerCase();
    if (!clean) return;
    const current = caseTags[caseKey] || [];
    if (current.includes(clean)) {
      setActiveTagAddCase(null);
      setNewTagInput('');
      return;
    }
    const updated = {
      ...caseTags,
      [caseKey]: [...current, clean]
    };
    saveTagsToStorage(updated);
    setActiveTagAddCase(null);
    setNewTagInput('');
  };

  const handleRemoveTag = (caseKey: string, tagToRemove: string) => {
    const current = caseTags[caseKey] || [];
    const updatedTags = current.filter(t => t !== tagToRemove);
    const updated = {
      ...caseTags,
      [caseKey]: updatedTags
    };
    saveTagsToStorage(updated);
    if (selectedTag === tagToRemove) {
      const stillExists = Object.values(updated).some(tags => tags.includes(tagToRemove));
      if (!stillExists) {
        setSelectedTag(null);
      }
    }
  };

  const allTagsWithCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (dahmoCases as any[]).forEach(c => {
      const key = getCaseKey(c);
      const tags = caseTags[key] || [];
      tags.forEach(t => {
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [caseTags]);

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
    const q = searchQuery.toLowerCase().trim();
    const rawMin = fromYear ? parseInt(fromYear, 10) : null;
    const rawMax = toYear ? parseInt(toYear, 10) : null;
    let minVal = rawMin;
    let maxVal = rawMax;
    if (minVal !== null && maxVal !== null && !isNaN(minVal) && !isNaN(maxVal) && minVal > maxVal) {
      minVal = rawMax;
      maxVal = rawMin;
    }

    return (dahmoCases as any[]).filter(c => {
      const key = getCaseKey(c);
      const tags = caseTags[key] || [];

      // Tag filter
      if (selectedTag && !tags.includes(selectedTag)) {
        return false;
      }

      // Text query match
      if (q) {
        const matchQuery = (
          c.description?.toLowerCase().includes(q) ||
          c.fondTitle?.toLowerCase().includes(q) ||
          c.fondNo?.toLowerCase().includes(q) ||
          c.caseNo?.toLowerCase().includes(q) ||
          c.date?.toLowerCase().includes(q) ||
          tags.some((t: string) => t.toLowerCase().includes(q))
        );
        if (!matchQuery) return false;
      }

      // Year range filter
      if (minVal !== null || maxVal !== null) {
        const { startYear, endYear } = parseCaseYears(c);
        if (startYear === null && endYear === null) {
          return false;
        }
        const caseStart = startYear ?? endYear!;
        const caseEnd = endYear ?? startYear!;

        if (minVal !== null && !isNaN(minVal) && caseEnd < minVal) {
          return false;
        }
        if (maxVal !== null && !isNaN(maxVal) && caseStart > maxVal) {
          return false;
        }
      }

      return true;
    });
  }, [searchQuery, fromYear, toYear, selectedTag, caseTags]);

  const groupedCases = useMemo(() => {
    if (!groupByTags) return null;
    const map: Record<string, any[]> = {};
    filteredCases.forEach(c => {
      const key = getCaseKey(c);
      const tags = caseTags[key] || [];
      if (tags.length === 0) {
        if (!map['Без тегів']) map['Без тегів'] = [];
        map['Без тегів'].push(c);
      } else {
        tags.forEach(t => {
          if (!map[t]) map[t] = [];
          map[t].push(c);
        });
      }
    });
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [filteredCases, groupByTags, caseTags]);

  const applyYearPreset = (from: string, to: string) => {
    setFromYear(from);
    setToYear(to);
  };

  const resetYearFilter = () => {
    setFromYear('');
    setToYear('');
  };

  const isYearFilterActive = Boolean(fromYear || toYear);

  const handleAddCase = (c: any) => {
    const key = getCaseKey(c);
    setAddedCases(prev => new Set(prev).add(key));
    if (onSelectCase) {
      onSelectCase({
        ...c,
        tags: caseTags[key] || []
      });
    }
  };

  const renderCaseCard = (c: any, indexOrKey: any) => {
    const key = getCaseKey(c);
    const isAdded = addedCases.has(key);
    const tags = caseTags[key] || [];
    const isAddingTag = activeTagAddCase === key;

    return (
      <div 
        key={indexOrKey} 
        className={`p-4 rounded-xl ${theme.cardBg} border ${theme.cardBorder} hover:border-neutral-300 dark:hover:border-neutral-700 transition-all flex flex-col justify-between shadow-xs`}
      >
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-mono text-xs font-bold">
              Ф. {c.fondNo}, {c.invLabel}, спр. {c.caseNo}
            </span>
            <span className="text-[11px] font-mono text-neutral-500 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-amber-500/70" />
              <span className="font-semibold text-neutral-700 dark:text-neutral-300">{c.date}</span>
              <span>· {c.sheets} арк.</span>
            </span>
          </div>

          <p className="text-xs text-neutral-800 dark:text-neutral-200 font-medium line-clamp-3 leading-relaxed">
            {c.description}
          </p>

          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
            {c.fondTitle}
          </div>

          {/* Tags section on case card */}
          <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800/80">
            <div className="flex flex-wrap items-center gap-1.5">
              {tags.map(tag => {
                const isTagActive = selectedTag === tag;
                return (
                  <span
                    key={tag}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                      isTagActive
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedTag(isTagActive ? null : tag)}
                      className="cursor-pointer hover:underline flex items-center gap-1"
                      title={`Фільтрувати за тегом "${tag}"`}
                    >
                      <Tag className="w-2.5 h-2.5 opacity-70" />
                      <span>{tag}</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveTag(key, tag);
                      }}
                      className="p-0.5 rounded hover:bg-black/15 dark:hover:bg-white/20 text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                      title={`Видалити тег "${tag}"`}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                );
              })}

              {!isAddingTag && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTagAddCase(key);
                    setNewTagInput('');
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-dashed border-neutral-300 dark:border-neutral-700 transition-colors cursor-pointer"
                  title="Додати новий тег до цієї справи"
                >
                  <Plus className="w-2.5 h-2.5 text-amber-500" />
                  <span>Додати тег</span>
                </button>
              )}
            </div>

            {/* Inline tag adder */}
            {isAddingTag && (
              <div className="mt-2 p-2.5 rounded-xl bg-neutral-100/90 dark:bg-neutral-800/90 border border-neutral-200 dark:border-neutral-700 space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <Tag className="w-3 h-3 text-neutral-400 absolute left-2 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      autoFocus
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag(key, newTagInput);
                        } else if (e.key === 'Escape') {
                          setActiveTagAddCase(null);
                          setNewTagInput('');
                        }
                      }}
                      placeholder="Введіть тег (напр. метрична книга, сповідний розпис)..."
                      className="w-full pl-6 pr-2 py-1 text-xs rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddTag(key, newTagInput)}
                    disabled={!newTagInput.trim()}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-950 font-bold text-xs cursor-pointer transition-colors"
                  >
                    Додати
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTagAddCase(null);
                      setNewTagInput('');
                    }}
                    className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                    title="Скасувати"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Popular suggestion chips */}
                <div className="flex flex-wrap items-center gap-1 pt-1">
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium mr-1">
                    Швидкі варіанти:
                  </span>
                  {POPULAR_TAG_SUGGESTIONS.filter(t => !tags.includes(t)).slice(0, 6).map(sug => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => handleAddTag(key, sug)}
                      className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 hover:border-amber-500 text-neutral-700 dark:text-neutral-300 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-2.5 h-2.5" />
                      {sug}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
            📋 Справи з описів ({isYearFilterActive ? `${filteredCases.length}/${(dahmoCases as any[]).length}` : (dahmoCases as any[]).length})
          </button>
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className={`p-4 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-sm`}>
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

        {viewSection === 'cases' && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800/80 px-2.5 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs">
              <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="text-neutral-500 dark:text-neutral-400 text-xs font-medium">Роки:</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="1700"
                  max="2000"
                  placeholder="1800"
                  value={fromYear}
                  onChange={(e) => setFromYear(e.target.value)}
                  className="w-16 px-1.5 py-0.5 text-xs text-center rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono text-neutral-900 dark:text-neutral-100"
                  title="Початковий рік діапазону (напр. 1800)"
                />
                <span className="text-neutral-400 text-xs font-bold">—</span>
                <input
                  type="number"
                  min="1700"
                  max="2000"
                  placeholder="1900"
                  value={toYear}
                  onChange={(e) => setToYear(e.target.value)}
                  className="w-16 px-1.5 py-0.5 text-xs text-center rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono text-neutral-900 dark:text-neutral-100"
                  title="Кінцевий рік діапазону (напр. 1900)"
                />
              </div>
              {isYearFilterActive && (
                <button
                  type="button"
                  onClick={resetYearFilter}
                  className="p-1 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                  title="Очистити роки"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick Year Range Presets (for cases section) */}
      {viewSection === 'cases' && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-neutral-100/70 dark:bg-neutral-800/50 border border-neutral-200/80 dark:border-neutral-700/80 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium flex items-center gap-1 mr-1">
              <SlidersHorizontal className="w-3 h-3 text-amber-500" />
              Швидкий період:
            </span>
            <button
              type="button"
              onClick={resetYearFilter}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                !isYearFilterActive
                  ? 'bg-amber-500 text-slate-950 font-bold border-amber-500 shadow-xs'
                  : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 border-neutral-200 dark:border-neutral-700'
              }`}
            >
              Всі роки
            </button>
            <button
              type="button"
              onClick={() => applyYearPreset('1800', '1900')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                fromYear === '1800' && toYear === '1900'
                  ? 'bg-amber-500 text-slate-950 font-bold border-amber-500 shadow-xs'
                  : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 border-neutral-200 dark:border-neutral-700'
              }`}
            >
              1800–1900 (XIX ст.)
            </button>
            <button
              type="button"
              onClick={() => applyYearPreset('', '1850')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                fromYear === '' && toYear === '1850'
                  ? 'bg-amber-500 text-slate-950 font-bold border-amber-500 shadow-xs'
                  : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 border-neutral-200 dark:border-neutral-700'
              }`}
            >
              до 1850 р.
            </button>
            <button
              type="button"
              onClick={() => applyYearPreset('1850', '1900')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                fromYear === '1850' && toYear === '1900'
                  ? 'bg-amber-500 text-slate-950 font-bold border-amber-500 shadow-xs'
                  : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 border-neutral-200 dark:border-neutral-700'
              }`}
            >
              1850–1900 рр.
            </button>
            <button
              type="button"
              onClick={() => applyYearPreset('1900', '')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                fromYear === '1900' && toYear === ''
                  ? 'bg-amber-500 text-slate-950 font-bold border-amber-500 shadow-xs'
                  : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 border-neutral-200 dark:border-neutral-700'
              }`}
            >
              після 1900 р. (XX ст.)
            </button>
          </div>

          {isYearFilterActive && (
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 font-mono text-[11px] font-semibold flex items-center gap-1.5">
                <span>Діапазон: {fromYear || '1780'}–{toYear || '1946'} рр.</span>
                <button
                  type="button"
                  onClick={resetYearFilter}
                  className="hover:opacity-75 cursor-pointer"
                  title="Скинути"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
              <button
                type="button"
                onClick={resetYearFilter}
                className="text-[11px] text-neutral-500 hover:text-rose-500 dark:text-neutral-400 dark:hover:text-rose-400 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Скинути
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tag Filtering & Grouping Bar (for cases section) */}
      {viewSection === 'cases' && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 p-2.5 rounded-xl bg-neutral-100/70 dark:bg-neutral-800/50 border border-neutral-200/80 dark:border-neutral-700/80 text-xs">
          <div className="flex flex-wrap items-center gap-1.5 flex-1">
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium flex items-center gap-1 mr-1">
              <Tags className="w-3.5 h-3.5 text-amber-500" />
              Теги справ:
            </span>
            <button
              type="button"
              onClick={() => setSelectedTag(null)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                !selectedTag
                  ? 'bg-amber-500 text-slate-950 font-bold border-amber-500 shadow-xs'
                  : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 border-neutral-200 dark:border-neutral-700'
              }`}
            >
              Всі справи ({filteredCases.length})
            </button>
            {allTagsWithCounts.map(([tag, count]) => {
              const isSelected = selectedTag === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSelectedTag(isSelected ? null : tag)}
                  className={`px-2 py-0.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border inline-flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 font-bold border-amber-500 shadow-xs'
                      : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 border-neutral-200 dark:border-neutral-700'
                  }`}
                  title={`Фільтрувати справи за тегом "${tag}"`}
                >
                  <Tag className="w-2.5 h-2.5 opacity-70" />
                  <span>{tag}</span>
                  <span className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                    isSelected ? 'bg-black/15 text-slate-950 font-bold' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-300'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            {selectedTag && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-[11px] font-semibold flex items-center gap-1">
                <span>Тег: {selectedTag}</span>
                <button
                  type="button"
                  onClick={() => setSelectedTag(null)}
                  className="hover:opacity-75 cursor-pointer"
                  title="Скинути фільтр за тегом"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={() => setGroupByTags(prev => !prev)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border inline-flex items-center gap-1.5 ${
                groupByTags
                  ? 'bg-amber-500 text-slate-950 font-bold border-amber-500 shadow-xs'
                  : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 border-neutral-200 dark:border-neutral-700'
              }`}
              title={groupByTags ? 'Вимкнути групування за тегами' : 'Групувати справи за тегами'}
            >
              <FolderTree className="w-3.5 h-3.5 text-amber-500" />
              <span>Групувати за тегами</span>
            </button>
          </div>
        </div>
      )}

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
          <div className="text-xs text-neutral-500 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span>Знайдено справ: <strong className="text-neutral-900 dark:text-neutral-100 font-mono">{filteredCases.length}</strong></span>
              {isYearFilterActive && (
                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  (роки: {fromYear || '1780'}–{toYear || '1946'})
                </span>
              )}
              {selectedTag && (
                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                  (тег: <strong>#{selectedTag}</strong>)
                </span>
              )}
              {groupByTags && (
                <span className="text-[11px] text-neutral-400 font-medium">
                  (групування за тегами)
                </span>
              )}
            </div>
            <span className="text-[11px] italic">Джерело: ДАХмО Archium E-Catalog (Кам'янецький та Проскурівський повіти)</span>
          </div>

          {filteredCases.length === 0 ? (
            <div className={`p-12 text-center rounded-2xl ${theme.cardBg} border border-dashed ${theme.cardBorder} flex flex-col items-center justify-center`}>
              <Calendar className="w-12 h-12 text-amber-500/40 mb-3" />
              <p className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                Не знайдено справ за вказаними критеріями
              </p>
              <p className={`text-xs ${theme.cardSubtext} mt-1 max-w-md`}>
                {selectedTag
                  ? `Жодної справи не знайдено з тегом "${selectedTag}"${isYearFilterActive ? ` у періоді ${fromYear || '...'}–${toYear || '...'} рр.` : ''}. Спробуйте скинути тег або змінити критерії пошуку.`
                  : isYearFilterActive
                  ? `У діапазоні ${fromYear || '...'}–${toYear || '...'} рр. немає відповідних справ з каталогу. Спробуйте розширити діапазон років або скинути фільтр.`
                  : 'Спробуйте змінити пошуковий запит.'}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                {selectedTag && (
                  <button
                    type="button"
                    onClick={() => setSelectedTag(null)}
                    className="px-3.5 py-1.5 rounded-xl bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-900 dark:text-neutral-100 font-semibold text-xs cursor-pointer inline-flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <X className="w-3.5 h-3.5" />
                    Скинути фільтр тегів
                  </button>
                )}
                {isYearFilterActive && (
                  <button
                    type="button"
                    onClick={resetYearFilter}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs cursor-pointer inline-flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Скинути фільтр років
                  </button>
                )}
              </div>
            </div>
          ) : groupByTags && groupedCases ? (
            <div className="space-y-6 max-h-[600px] overflow-y-auto pr-1">
              {groupedCases.map(([groupTag, casesInGroup]) => (
                <div key={groupTag} className="space-y-2.5">
                  <div className="flex items-center justify-between pb-1.5 border-b border-neutral-200 dark:border-neutral-800">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400">
                        <Tag className="w-3.5 h-3.5" />
                      </span>
                      <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 capitalize">
                        {groupTag}
                      </h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-mono font-semibold">
                        {casesInGroup.length}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {casesInGroup.map((c, i) => renderCaseCard(c, `${groupTag}-${i}`))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1">
              {filteredCases.map((c, i) => renderCaseCard(c, i))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
