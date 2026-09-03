import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, 
  X, 
  User, 
  MapPin, 
  FileText, 
  Calendar, 
  GitFork, 
  PieChart, 
  Sparkles, 
  ArrowRight,
  Filter,
  Check,
  Zap,
  Globe,
  Briefcase,
  Layers,
  ChevronRight
} from 'lucide-react';
import { useGenealogy, useUIStore } from '../context/GenealogyContext';
import { Person } from '../types';
import { getThemeConfig } from '../utils/theme';
import { 
  executeGlobalTreeSearch, 
  SearchCategory, 
  GlobalSearchResult 
} from '../utils/globalTreeSearch';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInspectPerson?: (id: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onInspectPerson
}) => {
  const { 
    persons, 
    selectedPersonId, 
    setSelectedPersonId, 
    themePalette,
    setActiveTab
  } = useGenealogy();

  const setRodovidView = useUIStore((s) => s.setRodovidView);
  const theme = getThemeConfig(themePalette);

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SearchCategory>('all');
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    } else {
      setQuery('');
      setSelectedIndex(-1);
    }
  }, [isOpen]);

  // Compute search results across all categories
  const allCategoryResults = useMemo(() => {
    if (!query.trim()) return [];
    return executeGlobalTreeSearch(persons, query, 'all', { maxResults: 100 });
  }, [persons, query]);

  // Filtered by active category tab
  const filteredResults = useMemo(() => {
    if (!query.trim()) return [];
    if (selectedCategory === 'all') return allCategoryResults.slice(0, 40);
    return executeGlobalTreeSearch(persons, query, selectedCategory, { maxResults: 40 });
  }, [persons, query, selectedCategory, allCategoryResults]);

  // Category counts
  const categoryCounts = useMemo(() => {
    if (!query.trim()) return { all: 0, name: 0, place: 0, note: 0 };
    let name = 0;
    let place = 0;
    let note = 0;
    allCategoryResults.forEach((r) => {
      if (r.matchedCategories.name) name++;
      if (r.matchedCategories.place) place++;
      if (r.matchedCategories.note) note++;
    });
    return { all: allCategoryResults.length, name, place, note };
  }, [allCategoryResults, query]);

  // Reset selected keyboard index on query or filter change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [query, selectedCategory]);

  // Format Person Full Name & Life details
  const getPersonMeta = (p: Person) => {
    const given = p.name?.given || p.firstName || '';
    const surname = p.name?.surname || p.lastName || '';
    const patronymic = p.name?.patronymic || p.patronymic || '';
    const maiden = p.name?.maidenName || p.maidenName || '';
    const fullName = [surname, given, patronymic].filter(Boolean).join(' ') || 'Без імені';

    const bYear = p.birthYear || (p.birthDate ? p.birthDate.substring(0, 4) : '');
    const dYear = p.deathYear || (p.deathDate ? p.deathDate.substring(0, 4) : '');

    let lifeSpan = '';
    if (bYear && dYear) {
      const age = Number(dYear) - Number(bYear);
      lifeSpan = `${bYear} – ${dYear}${age > 0 ? ` (${age} р.)` : ''}`;
    } else if (bYear) {
      if (p.isLiving) {
        const currentYear = new Date().getFullYear();
        const age = currentYear - Number(bYear);
        lifeSpan = `нар. ${bYear} (живий${age > 0 ? `, ${age} р.` : ''})`;
      } else {
        lifeSpan = `нар. ${bYear}`;
      }
    } else if (dYear) {
      lifeSpan = `пом. ${dYear}`;
    }

    const place = p.birthPlace || p.deathPlace || p.residencePlace || '';

    return {
      fullName,
      maiden,
      lifeSpan,
      place,
      gender: p.gender || 'other'
    };
  };

  // Actions
  const handleSelectInTree = (personId: string) => {
    setSelectedPersonId(personId);
    setActiveTab('tree');
    setRodovidView('tree');
    onClose();
  };

  const handleSelectInFan = (personId: string) => {
    setSelectedPersonId(personId);
    setActiveTab('tree');
    setRodovidView('fan');
    onClose();
  };

  const handleOpenDossier = (personId: string) => {
    setSelectedPersonId(personId);
    if (onInspectPerson) {
      onInspectPerson(personId);
    }
    onClose();
  };

  const handleOpenPlacesMap = () => {
    setActiveTab('tree');
    setRodovidView('map');
    onClose();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }

    if (filteredResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < filteredResults.length) {
        handleSelectInTree(filteredResults[selectedIndex].person.id);
      } else if (filteredResults.length > 0) {
        handleSelectInTree(filteredResults[0].person.id);
      }
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (selectedIndex >= 0 && resultsContainerRef.current) {
      const activeEl = resultsContainerRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 sm:pt-16 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="fixed inset-0"
        onClick={onClose}
      />

      <div 
        className={`relative w-full max-w-3xl rounded-3xl ${theme.cardBg} border ${theme.cardBorder} shadow-2xl overflow-hidden flex flex-col max-h-[88vh] z-10 ${theme.cardTitle} animate-in zoom-in-95 duration-150`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Modal Header & Search Input */}
        <div className="p-4 sm:p-5 border-b border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold flex items-center gap-2">
                  Глобальний пошук по дереву
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    Нечіткий збіг (Fuzzy Search)
                  </span>
                </h2>
                <p className="text-[11px] opacity-60">
                  Пошук серед {persons.length} осіб: імена, варіанти написання, місця подій та архівні замітки
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors cursor-pointer"
              title="Закрити (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex items-center">
            <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-500 shrink-0 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Введіть прізвище, ім'я, село, повіт, фах чи фразу з заміток..."
              className={`w-full pl-11 pr-10 py-3 ${theme.inputBg} border ${theme.inputBorder} rounded-2xl text-sm sm:text-base ${theme.inputText} placeholder-opacity-50 focus:outline-hidden focus:ring-2 focus:ring-[#B88E3E]/50 focus:border-[#B88E3E] transition-all shadow-inner`}
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
                title="Очистити"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 pt-1 scrollbar-none text-xs">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-[#B88E3E] text-white shadow-xs'
                  : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 opacity-80'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Всі збіги</span>
              {query.trim() && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${selectedCategory === 'all' ? 'bg-black/20 text-white' : 'bg-black/10 dark:bg-white/10'}`}>
                  {categoryCounts.all}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory('name')}
              className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                selectedCategory === 'name'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 opacity-80'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Імена та прізвища</span>
              {query.trim() && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${selectedCategory === 'name' ? 'bg-black/20 text-white' : 'bg-black/10 dark:bg-white/10'}`}>
                  {categoryCounts.name}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory('place')}
              className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                selectedCategory === 'place'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 opacity-80'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Місця подій</span>
              {query.trim() && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${selectedCategory === 'place' ? 'bg-black/20 text-white' : 'bg-black/10 dark:bg-white/10'}`}>
                  {categoryCounts.place}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory('note')}
              className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                selectedCategory === 'note'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 opacity-80'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Замітки та біографія</span>
              {query.trim() && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${selectedCategory === 'note' ? 'bg-black/20 text-white' : 'bg-black/10 dark:bg-white/10'}`}>
                  {categoryCounts.note}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Results List or Empty State */}
        <div 
          ref={resultsContainerRef}
          className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 divide-y divide-black/5 dark:divide-white/5"
        >
          {query.trim() ? (
            filteredResults.length > 0 ? (
              filteredResults.map((result, idx) => {
                const p = result.person;
                const meta = getPersonMeta(p);
                const isSelected = idx === selectedIndex;
                const isCurrentRoot = p.id === selectedPersonId;
                const isMale = meta.gender === 'male' || meta.gender === 'M';
                const isFemale = meta.gender === 'female' || meta.gender === 'F';

                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectInTree(p.id)}
                    className={`pt-2.5 first:pt-0 rounded-2xl p-3 transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-[#B88E3E]/15 border-[#B88E3E]/40 shadow-sm'
                        : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: Avatar & Identity Info */}
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border shadow-xs ${
                          p.avatar || p.photoUrl
                            ? 'border-[#B88E3E]/40 overflow-hidden'
                            : isMale
                            ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30'
                            : isFemale
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                            : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                        }`}>
                          {p.avatar || p.photoUrl ? (
                            <img 
                              src={p.avatar || p.photoUrl} 
                              alt={meta.fullName} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <User className="w-5 h-5" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-sm sm:text-base leading-tight">
                              {meta.fullName}
                            </h3>
                            {meta.maiden && (
                              <span className="text-xs opacity-75 italic">
                                (дівоче: {meta.maiden})
                              </span>
                            )}
                            {isCurrentRoot && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                                В центрі дерева
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs opacity-75 mt-1 flex-wrap">
                            {meta.lifeSpan && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span>{meta.lifeSpan}</span>
                              </span>
                            )}
                            {meta.place && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                <span className="truncate max-w-[200px]">{meta.place}</span>
                              </span>
                            )}
                            {p.occupation && (
                              <span className="flex items-center gap-1">
                                <Briefcase className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                <span className="truncate max-w-[160px]">{p.occupation}</span>
                              </span>
                            )}
                          </div>

                          {/* Match Reason Banner */}
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                            {/* Category Badge */}
                            <span className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 ${
                              result.bestMatch.category === 'name'
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                                : result.bestMatch.category === 'place'
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30'
                            }`}>
                              {result.bestMatch.category === 'name' && <User className="w-3 h-3" />}
                              {result.bestMatch.category === 'place' && <MapPin className="w-3 h-3" />}
                              {result.bestMatch.category === 'note' && <FileText className="w-3 h-3" />}
                              <span>{result.bestMatch.field}</span>
                            </span>

                            {/* Fuzzy Match Badge if applicable */}
                            {result.isFuzzy && (
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 flex items-center gap-1">
                                <Zap className="w-3 h-3 text-sky-500" />
                                <span>
                                  {result.bestMatch.fuzzyType === 'keyboard' 
                                    ? 'Розкладка клавіатури' 
                                    : result.bestMatch.fuzzyType === 'phonetic'
                                    ? 'Фонетичний збіг'
                                    : result.bestMatch.fuzzyType === 'stem'
                                    ? 'Відмінкова форма'
                                    : 'Нечіткий збіг (typo)'}
                                </span>
                              </span>
                            )}

                            {/* High match score badge */}
                            <span className="text-[10px] opacity-60 font-mono">
                              Збіг: {result.score}%
                            </span>
                          </div>

                          {/* Snippet from notes or places if present */}
                          {result.bestMatch.highlightSnippet && (
                            <div className="mt-1.5 p-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 text-xs italic opacity-85 leading-relaxed font-sans">
                              «{result.bestMatch.highlightSnippet}»
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Quick Action Buttons */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectInTree(p.id);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-[#B88E3E] text-white hover:bg-[#A57D33] text-xs font-semibold flex items-center gap-1 transition-all shadow-xs cursor-pointer"
                          title="Центрувати дерево на цій особі"
                        >
                          <GitFork className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">В дерево</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectInFan(p.id);
                          }}
                          className="p-1.5 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-xs font-semibold transition-colors cursor-pointer"
                          title="Віялова діаграма"
                        >
                          <PieChart className="w-4 h-4 text-amber-500" />
                        </button>

                        {onInspectPerson && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDossier(p.id);
                            }}
                            className="p-1.5 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-xs font-semibold transition-colors cursor-pointer"
                            title="Детальна анкета особи"
                          >
                            <FileText className="w-4 h-4 text-indigo-500" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-inner">
                  <Search className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base">
                    Нічого не знайдено за запитом «{query}»
                  </h3>
                  <p className="text-xs opacity-70 mt-1 max-w-md mx-auto">
                    Спробуйте ввести лише частину прізвища, назву села без префікса «с.» або переключіть категорію на «Всі збіги». Алгоритм нечіткого пошуку автоматично виправляє одруківки та розкладку клавіатури.
                  </p>
                </div>
              </div>
            )
          ) : (
            /* Empty Query - Prompt & Recent Persons */
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-inner">
                <Search className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base">Почніть вводити для пошуку</h3>
                <p className="text-xs opacity-70 mt-1 max-w-md mx-auto leading-relaxed">
                  Пошук здійснюється одночасно за <strong>іменами</strong> (включно з дівочими та варіантами), 
                  <strong> місцями подій</strong> (народження, шлюб, смерть, історичні парафії) та <strong>архівними замітками</strong> з автокорекцією помилок.
                </p>
              </div>

              {/* Sample Search Pills */}
              <div className="pt-2">
                <p className="text-[11px] font-semibold opacity-60 uppercase tracking-wider mb-2">
                  Швидкі підказки для пошуку:
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {['Шевченко', 'Київ', 'Полтава', 'священник', 'козак', '1890', 'смерть'].map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      onClick={() => setQuery(sample)}
                      className="px-2.5 py-1 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-[#B88E3E]/20 hover:text-[#B88E3E] text-xs font-semibold transition-all cursor-pointer border border-black/5 dark:border-white/5"
                    >
                      «{sample}»
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:px-5 border-t border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between text-xs opacity-70">
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline font-mono text-[11px]">
              <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-sans">↑↓</kbd> навігація
            </span>
            <span className="hidden sm:inline font-mono text-[11px]">
              <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-sans">Enter</kbd> перейти до дерева
            </span>
            <span className="font-mono text-[11px]">
              <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-sans">Esc</kbd> закрити
            </span>
          </div>

          <button
            type="button"
            onClick={handleOpenPlacesMap}
            className="text-[#B88E3E] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
          >
            <span>Карта всіх місць</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
