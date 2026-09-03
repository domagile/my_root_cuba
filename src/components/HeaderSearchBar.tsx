import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Search, 
  X, 
  GitFork, 
  User, 
  Calendar, 
  MapPin, 
  Sparkles, 
  UserPlus, 
  ArrowRight, 
  PieChart, 
  FileText,
  Briefcase,
  Zap,
  Layers,
  Maximize2
} from 'lucide-react';
import { useGenealogy, useUIStore } from '../context/GenealogyContext';
import { Person } from '../types';
import { getThemeConfig } from '../utils/theme';
import { 
  executeGlobalTreeSearch, 
  SearchCategory, 
  GlobalSearchResult 
} from '../utils/globalTreeSearch';

interface HeaderSearchBarProps {
  onOpenAddPerson?: () => void;
  onInspectPerson?: (id: string) => void;
  onOpenGlobalModal?: () => void;
}

export const HeaderSearchBar: React.FC<HeaderSearchBarProps> = ({
  onOpenAddPerson,
  onInspectPerson,
  onOpenGlobalModal
}) => {
  const { 
    persons, 
    selectedPersonId, 
    setSelectedPersonId, 
    themePalette,
    setActiveTab,
    searchQuery,
    setSearchQuery
  } = useGenealogy();

  const setRodovidView = useUIStore((s) => s.setRodovidView);
  const theme = getThemeConfig(themePalette);

  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [categoryFilter, setCategoryFilter] = useState<SearchCategory>('all');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format Person Full Name helper
  const getPersonDetails = (p: Person) => {
    const given = p.name?.given || p.firstName || '';
    const surname = p.name?.surname || p.lastName || '';
    const patronymic = p.name?.patronymic || p.patronymic || '';
    const maiden = p.name?.maidenName || p.maidenName || '';
    
    const fullName = [surname, given, patronymic].filter(Boolean).join(' ') || 'Без імені';
    
    // Years & Life span
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
      given,
      surname,
      patronymic,
      maiden,
      lifeSpan,
      bYear,
      dYear,
      place,
      occupation: p.occupation || '',
      gender: p.gender || 'other'
    };
  };

  // Search Results using multi-field fuzzy search engine
  const searchResults: GlobalSearchResult[] = useMemo(() => {
    const query = searchQuery.trim();
    if (!query) {
      // If query is empty and popup is open, show recently selected or root persons
      const activePersons = persons.filter((p) => !p.isDeleted);
      const rootPerson = activePersons.find((p) => p.id === selectedPersonId);
      const topRecents = activePersons.slice(0, 6);
      const initialPersons = rootPerson && !topRecents.some((p) => p.id === rootPerson.id)
        ? [rootPerson, ...topRecents.slice(0, 5)]
        : topRecents;

      return initialPersons.map((p) => ({
        person: p,
        score: 100,
        bestMatch: {
          category: 'name',
          field: 'Ключова особа',
          matchedText: p.lastName || p.firstName || '',
          isFuzzy: false,
          score: 100
        },
        allMatches: [],
        isFuzzy: false,
        matchedCategories: { name: true, place: false, note: false }
      }));
    }

    return executeGlobalTreeSearch(persons, query, categoryFilter, { maxResults: 15 });
  }, [persons, searchQuery, selectedPersonId, categoryFilter]);

  // Reset keyboard selection on search query or category filter change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [searchQuery, categoryFilter]);

  // Handle jump to person in tree
  const handleSelectPersonInTree = (personId: string) => {
    setSelectedPersonId(personId);
    setActiveTab('tree');
    setRodovidView('tree');
    setIsOpen(false);
  };

  // Handle jump to person in fan chart
  const handleSelectPersonInFan = (personId: string) => {
    setSelectedPersonId(personId);
    setActiveTab('tree');
    setRodovidView('fan');
    setIsOpen(false);
  };

  // Handle open person details card
  const handleOpenPersonCard = (personId: string) => {
    setSelectedPersonId(personId);
    if (onInspectPerson) {
      onInspectPerson(personId);
    }
    setIsOpen(false);
  };

  // Keyboard navigation inside search dropdown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
        handleSelectPersonInTree(searchResults[selectedIndex].person.id);
      } else if (searchResults.length > 0) {
        handleSelectPersonInTree(searchResults[0].person.id);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[selectedIndex] as HTMLElement;
      if (item) {
        item.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  return (
    <div ref={containerRef} className="relative flex-1 max-w-[240px] sm:max-w-xs md:max-w-sm">
      {/* Search Input Box */}
      <div className="relative flex items-center">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-60 text-amber-500 shrink-0 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Пошук: імена, місця, замітки..."
          className={`w-full pl-9 pr-14 py-1.5 ${theme.inputBg} border ${theme.inputBorder} rounded-xl text-xs md:text-sm ${theme.inputText} placeholder-opacity-60 focus:outline-hidden focus:ring-2 focus:ring-[#B88E3E]/50 focus:border-[#B88E3E] transition-all shadow-xs`}
        />

        <div className="absolute right-2 flex items-center gap-1">
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                inputRef.current?.focus();
              }}
              className="p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
              title="Очистити пошук"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {onOpenGlobalModal && (
            <button
              type="button"
              onClick={onOpenGlobalModal}
              className="hidden sm:flex items-center p-0.5 px-1 rounded-md text-[10px] font-mono opacity-50 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              title="Розширений глобальний пошук (⌘K)"
            >
              ⌘K
            </button>
          )}
        </div>
      </div>

      {/* Live Autocomplete Results Dropdown */}
      {isOpen && (
        <div 
          className={`absolute left-0 top-full mt-1.5 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-2xl z-50 overflow-hidden ${theme.cardTitle} animate-in fade-in zoom-in-95 duration-150 w-[320px] sm:w-[420px] md:w-[460px] max-w-[94vw]`}
        >
          {/* Dropdown Header with Category Filters */}
          <div className="p-2.5 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold opacity-75 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-[#B88E3E]" />
                {searchQuery.trim() ? (
                  <span>Знайдено: <strong>{searchResults.length}</strong> збігів</span>
                ) : (
                  <span>Ключові особи у родинному дереві</span>
                )}
              </span>

              <div className="flex items-center gap-1.5">
                {onOpenGlobalModal && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onOpenGlobalModal();
                    }}
                    className="text-[10px] font-bold text-[#B88E3E] hover:underline flex items-center gap-0.5 cursor-pointer"
                    title="Відкрити повнорозмірне вікно пошуку"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>Розширений</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Category Switcher Pills */}
            {searchQuery.trim() && (
              <div className="flex items-center gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('all')}
                  className={`px-2 py-0.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                    categoryFilter === 'all'
                      ? 'bg-[#B88E3E] text-white shadow-xs'
                      : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 opacity-70'
                  }`}
                >
                  Всі
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('name')}
                  className={`px-2 py-0.5 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                    categoryFilter === 'name'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 opacity-70'
                  }`}
                >
                  <User className="w-2.5 h-2.5" />
                  <span>Імена</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('place')}
                  className={`px-2 py-0.5 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                    categoryFilter === 'place'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 opacity-70'
                  }`}
                >
                  <MapPin className="w-2.5 h-2.5" />
                  <span>Місця</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('note')}
                  className={`px-2 py-0.5 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                    categoryFilter === 'note'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 opacity-70'
                  }`}
                >
                  <FileText className="w-2.5 h-2.5" />
                  <span>Замітки</span>
                </button>
              </div>
            )}
          </div>

          {/* Results List */}
          <div ref={listRef} className="max-h-[360px] overflow-y-auto divide-y divide-black/5 dark:divide-white/5">
            {searchResults.length > 0 ? (
              searchResults.map((res, idx) => {
                const person = res.person;
                const details = getPersonDetails(person);
                const isSelected = idx === selectedIndex;
                const isCurrentRoot = person.id === selectedPersonId;
                const isMale = details.gender === 'male' || details.gender === 'M';
                const isFemale = details.gender === 'female' || details.gender === 'F';

                return (
                  <div
                    key={person.id}
                    onClick={() => handleSelectPersonInTree(person.id)}
                    className={`group p-2.5 sm:px-3 sm:py-2.5 flex items-start justify-between gap-2.5 transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-[#B88E3E]/15 dark:bg-[#B88E3E]/25' 
                        : 'hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    {/* Left: Avatar & Bio */}
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      {/* Avatar */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border shadow-xs mt-0.5 ${
                        person.avatar || person.photoUrl
                          ? 'border-[#B88E3E]/40 overflow-hidden'
                          : isMale
                          ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30'
                          : isFemale
                          ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                          : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                      }`}>
                        {person.avatar || person.photoUrl ? (
                          <img 
                            src={person.avatar || person.photoUrl} 
                            alt={details.fullName} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <User className="w-4 h-4" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-xs truncate max-w-[200px]">
                            {details.fullName}
                          </span>
                          {details.maiden && (
                            <span className="text-[10px] opacity-70 italic">
                              (до шлюбу {details.maiden})
                            </span>
                          )}
                          {isCurrentRoot && (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                              В центрі
                            </span>
                          )}
                        </div>

                        {/* Meta tags: Dates & Places */}
                        <div className="flex items-center gap-2 text-[11px] opacity-75 truncate mt-0.5">
                          {details.lifeSpan && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-amber-500 shrink-0" />
                              <span>{details.lifeSpan}</span>
                            </span>
                          )}
                          {details.place && (
                            <span className="hidden sm:flex items-center gap-1 truncate">
                              <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                              <span className="truncate max-w-[130px]">{details.place}</span>
                            </span>
                          )}
                        </div>

                        {/* Search Match Reason Indicator */}
                        {searchQuery.trim() && res.bestMatch && (
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap text-[10px]">
                            <span className={`px-1.5 py-0.2 rounded-md font-semibold flex items-center gap-1 ${
                              res.bestMatch.category === 'name'
                                ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30'
                                : res.bestMatch.category === 'place'
                                ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30'
                                : 'bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border border-indigo-500/30'
                            }`}>
                              {res.bestMatch.category === 'place' && <MapPin className="w-2.5 h-2.5" />}
                              {res.bestMatch.category === 'note' && <FileText className="w-2.5 h-2.5" />}
                              {res.bestMatch.category === 'name' && <User className="w-2.5 h-2.5" />}
                              <span>{res.bestMatch.field}</span>
                            </span>

                            {res.isFuzzy && (
                              <span className="px-1.5 py-0.2 rounded-md font-semibold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 flex items-center gap-0.5">
                                <Zap className="w-2.5 h-2.5 text-sky-500" />
                                <span>Нечіткий збіг</span>
                              </span>
                            )}

                            {res.bestMatch.highlightSnippet && (
                              <span className="text-[10px] italic opacity-80 truncate max-w-[220px]">
                                «{res.bestMatch.highlightSnippet}»
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Quick Action Buttons */}
                    <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 mt-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectPersonInTree(person.id);
                        }}
                        className="p-1.5 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-[#B88E3E] hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                        title="Центрувати дерево на цій особі"
                      >
                        <GitFork className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectPersonInFan(person.id);
                        }}
                        className="hidden sm:block p-1.5 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-[#B88E3E] hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                        title="Відкрити віялову діаграму"
                      >
                        <PieChart className="w-3.5 h-3.5" />
                      </button>

                      {onInspectPerson && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenPersonCard(person.id);
                          }}
                          className="p-1.5 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-[#B88E3E] hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                          title="Переглянути детальну анкету"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-6 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                  <Search className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-xs sm:text-sm">Нічого не знайдено за запитом «{searchQuery}»</p>
                  <p className="text-[11px] opacity-70 mt-1">
                    Пошук перевіряє імена, місця та замітки. Спробуйте змінити пошукове слово.
                  </p>
                </div>
                {onOpenAddPerson && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onOpenAddPerson();
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${theme.accentBtn} ${theme.accentBtnText} font-bold text-xs transition-colors shadow-xs cursor-pointer`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Додати нову особу</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Footer action: jump to full persons tab or open modal */}
          <div className="p-2 border-t border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setActiveTab('persons');
                setRodovidView('persons');
                setIsOpen(false);
              }}
              className="py-1 px-2.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[11px] font-bold text-[#B88E3E] flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Реєстр усіх осіб ({persons.length})</span>
              <ArrowRight className="w-3 h-3" />
            </button>

            {onOpenGlobalModal && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenGlobalModal();
                }}
                className="py-1 px-2.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[11px] font-semibold opacity-75 hover:opacity-100 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Всі фільтри та опції</span>
                <Sparkles className="w-3 h-3 text-amber-500" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
