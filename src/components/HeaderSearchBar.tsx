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
  Briefcase
} from 'lucide-react';
import { useGenealogy, useUIStore } from '../context/GenealogyContext';
import { Person, ThemePalette } from '../types';
import { getThemeConfig } from '../utils/theme';
import { normalizeArchaicUkrainian } from '../utils/ukrainianPhonetics';

interface HeaderSearchBarProps {
  onOpenAddPerson?: () => void;
  onInspectPerson?: (id: string) => void;
}

export const HeaderSearchBar: React.FC<HeaderSearchBarProps> = ({
  onOpenAddPerson,
  onInspectPerson
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

    const place = p.birthPlace || p.deathPlace || '';

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

  // Search Results Filtering & Ranking
  const searchResults = useMemo(() => {
    const query = searchQuery.trim();
    if (!query) {
      // If query is empty and popup is open, show recently selected or root persons
      const activePersons = persons.filter((p) => !p.isDeleted);
      const rootPerson = activePersons.find((p) => p.id === selectedPersonId);
      const topRecents = activePersons.slice(0, 6);
      if (rootPerson && !topRecents.some((p) => p.id === rootPerson.id)) {
        return [rootPerson, ...topRecents.slice(0, 5)];
      }
      return topRecents;
    }

    const normalizedQuery = normalizeArchaicUkrainian(query);
    const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

    const scored: Array<{ person: Person; score: number }> = [];

    persons.forEach((person) => {
      if (person.isDeleted) return;

      const details = getPersonDetails(person);
      const normalizedFullName = normalizeArchaicUkrainian(details.fullName);
      const normalizedSurname = normalizeArchaicUkrainian(details.surname);
      const normalizedGiven = normalizeArchaicUkrainian(details.given);
      const normalizedPatronymic = normalizeArchaicUkrainian(details.patronymic);
      const normalizedMaiden = normalizeArchaicUkrainian(details.maiden);
      const normalizedPlace = normalizeArchaicUkrainian(details.place);
      const normalizedOccupation = normalizeArchaicUkrainian(details.occupation);
      const normalizedNotes = normalizeArchaicUkrainian(person.notes || person.bio || '');

      let score = 0;

      // Exact match bonus
      if (normalizedFullName === normalizedQuery) {
        score += 100;
      } else if (normalizedSurname.startsWith(normalizedQuery)) {
        score += 60;
      } else if (normalizedGiven.startsWith(normalizedQuery)) {
        score += 50;
      } else if (normalizedFullName.includes(normalizedQuery)) {
        score += 40;
      }

      // Check all query tokens
      let allTokensMatch = true;
      for (const token of queryTokens) {
        const inName = normalizedFullName.includes(token);
        const inMaiden = normalizedMaiden.includes(token);
        const inYear = (details.bYear && details.bYear.toString().includes(token)) || 
                       (details.dYear && details.dYear.toString().includes(token));
        const inPlace = normalizedPlace.includes(token);
        const inOcc = normalizedOccupation.includes(token);
        const inNotes = normalizedNotes.includes(token);

        if (inName) score += 20;
        else if (inMaiden) score += 15;
        else if (inYear) score += 12;
        else if (inPlace) score += 8;
        else if (inOcc) score += 6;
        else if (inNotes) score += 4;
        else {
          allTokensMatch = false;
          break;
        }
      }

      if (allTokensMatch && score > 0) {
        scored.push({ person, score });
      }
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 10).map((s) => s.person);
  }, [persons, searchQuery, selectedPersonId]);

  // Reset keyboard selection on search query change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [searchQuery]);

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
        handleSelectPersonInTree(searchResults[selectedIndex].id);
      } else if (searchResults.length > 0) {
        handleSelectPersonInTree(searchResults[0].id);
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
          placeholder="Пошук особи (ім'я, рік, село)..."
          className={`w-full pl-9 pr-8 py-1.5 ${theme.inputBg} border ${theme.inputBorder} rounded-xl text-xs md:text-sm ${theme.inputText} placeholder-opacity-60 focus:outline-hidden focus:ring-2 focus:ring-[#B88E3E]/50 focus:border-[#B88E3E] transition-all shadow-xs`}
        />
        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery('');
              inputRef.current?.focus();
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
            title="Очистити пошук"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Live Autocomplete Results Dropdown */}
      {isOpen && (
        <div 
          className={`absolute left-0 right-0 top-full mt-1.5 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-2xl z-50 overflow-hidden ${theme.cardTitle} animate-in fade-in zoom-in-95 duration-150 sm:w-[380px] md:w-[420px] max-w-[92vw]`}
        >
          {/* Dropdown Header */}
          <div className="px-3.5 py-2 border-b border-black/5 dark:border-white/5 flex items-center justify-between text-[11px] bg-black/[0.02] dark:bg-white/[0.02]">
            <span className="font-semibold opacity-70 flex items-center gap-1.5">
              <Search className="w-3 h-3 text-[#B88E3E]" />
              {searchQuery.trim() ? (
                <span>Знайдено: <strong>{searchResults.length}</strong> осіб</span>
              ) : (
                <span>Ключові особи у родинному дереві</span>
              )}
            </span>
            <span className="hidden sm:inline text-[10px] opacity-50 font-mono">
              ↑↓ навігація • Enter вибрати
            </span>
          </div>

          {/* Results List */}
          <div ref={listRef} className="max-h-[340px] overflow-y-auto divide-y divide-black/5 dark:divide-white/5">
            {searchResults.length > 0 ? (
              searchResults.map((person, idx) => {
                const details = getPersonDetails(person);
                const isSelected = idx === selectedIndex;
                const isCurrentRoot = person.id === selectedPersonId;
                const isMale = details.gender === 'male' || details.gender === 'M';
                const isFemale = details.gender === 'female' || details.gender === 'F';

                return (
                  <div
                    key={person.id}
                    onClick={() => handleSelectPersonInTree(person.id)}
                    className={`group p-2.5 sm:px-3 sm:py-2.5 flex items-center justify-between gap-2.5 transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-[#B88E3E]/15 dark:bg-[#B88E3E]/25' 
                        : 'hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    {/* Left: Avatar & Bio */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Avatar */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border shadow-xs ${
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
                          {details.occupation && !details.place && (
                            <span className="hidden sm:flex items-center gap-1 truncate">
                              <Briefcase className="w-3 h-3 text-indigo-500 shrink-0" />
                              <span className="truncate max-w-[120px]">{details.occupation}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Quick Action Buttons */}
                    <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100">
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
                  <p className="font-bold text-xs sm:text-sm">Осіб за запитом «{searchQuery}» не знайдено</p>
                  <p className="text-[11px] opacity-70 mt-1">
                    Спробуйте змінити пошукове слово або додати нову особу до родоводу.
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

          {/* Footer action: jump to full persons tab */}
          {searchResults.length > 0 && (
            <div className="p-2 border-t border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('persons');
                  setRodovidView('persons');
                  setIsOpen(false);
                }}
                className="w-full py-1.5 px-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[11px] font-bold text-[#B88E3E] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Відкрити повний реєстр усіх осіб ({persons.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
