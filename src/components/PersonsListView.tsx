import React, { useState, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { 
  Users, 
  Search, 
  Plus, 
  Download, 
  Trash2, 
  List, 
  LayoutGrid, 
  GitFork, 
  Scan, 
  Edit3, 
  CheckCircle2, 
  CheckSquare,
  HelpCircle, 
  MapPin, 
  X,
  Crown,
  Upload,
  RotateCcw,
  AlertTriangle,
  Trash,
  Hash,
  Tag,
  Sparkles
} from 'lucide-react';
import { useGenealogy } from '../context/GenealogyContext';
import { Person } from '../types';
import { getThemeConfig } from '../utils/theme';
import { findRelationshipPath, getSummaryRelationTitle } from './Tree/RelationshipPathModal';
import { getTreeHashtagsWithCounts } from '../utils/tagUtils';
import { isPersonMale, isPersonFemale } from '../utils/genderUtils';
import { isPersonHypothesis, isPersonConfirmed } from '../utils/researchStatusUtils';

interface PersonsListViewProps {
  onInspectPerson?: (id: string) => void;
  onEditPerson?: (person: Person) => void;
  onOpenAddPerson?: () => void;
}

export const PersonsListView: React.FC<PersonsListViewProps> = ({
  onInspectPerson,
  onEditPerson,
  onOpenAddPerson,
}) => {
  const { 
    persons, 
    trashPersons,
    updatePerson,
    deletePerson, 
    deletePersons,
    restorePerson,
    restorePersons,
    permanentlyDeletePerson,
    permanentlyDeletePersons,
    emptyTrash,
    setSelectedPersonId, 
    selectedPersonId, 
    setActiveTab, 
    setTreeMode, 
    themePalette,
    exportJsonData,
    exportGedcomData,
    getPersonById
  } = useGenealogy();

  const theme = getThemeConfig(themePalette);

  // Active Sub-tab pill: 'all' | 'confirmed' | 'hypothesis' | 'trash'
  const [tabFilter, setTabFilter] = useState<'all' | 'confirmed' | 'hypothesis' | 'trash'>('all');

  // Filter Bar state
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');
  const [lifeStateFilter, setLifeStateFilter] = useState<'all' | 'alive' | 'deceased'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'hypothesis' | 'archived'>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');

  // Toolbar & Display Options
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [sortOption, setSortOption] = useState<'central' | 'name' | 'birthDate' | 'recent' | 'tag' | 'tagCount'>('central');

  // Selection state for batch actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Hashtags list
  const availableHashtags = useMemo(() => {
    return getTreeHashtagsWithCounts(persons);
  }, [persons]);

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; actionText?: string; onAction?: () => void } | null>(null);

  // Modal confirm state
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
  } | null>(null);

  // Central person reference
  const centralPerson = useMemo(() => {
    return (selectedPersonId && getPersonById(selectedPersonId)) || persons[0];
  }, [selectedPersonId, getPersonById, persons]);

  // Counts for top sub-tabs
  const counts = useMemo(() => {
    let confirmed = 0;
    let hypothesis = 0;

    persons.forEach((p) => {
      if (isPersonHypothesis(p)) {
        hypothesis++;
      } else {
        confirmed++;
      }
    });

    return { all: persons.length, confirmed, hypothesis, trash: trashPersons.length };
  }, [persons, trashPersons]);

  // Compute key relationship map relative to central person
  const relationshipMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!centralPerson) return map;

    persons.forEach((p) => {
      if (p.id === centralPerson.id) {
        map.set(p.id, 'Центральна особа 👑');
      } else {
        const path = findRelationshipPath(p.id, centralPerson.id, persons);
        if (path) {
          const title = getSummaryRelationTitle(path);
          map.set(p.id, title);
        } else {
          map.set(p.id, 'Далекий родич / без прямого зв’язку');
        }
      }
    });

    return map;
  }, [persons, centralPerson]);

  // Source list depending on tab
  const sourceList = useMemo(() => {
    return tabFilter === 'trash' ? trashPersons : persons;
  }, [tabFilter, trashPersons, persons]);

  // Filtered Persons List
  const filteredPersons = useMemo(() => {
    return sourceList.filter((p) => {
      // Sub-tab Pill Filter for non-trash
      if (tabFilter === 'confirmed') {
        if (isPersonHypothesis(p)) return false;
      }
      if (tabFilter === 'hypothesis') {
        if (!isPersonHypothesis(p)) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fullName = `${p.lastName || ''} ${p.firstName || ''} ${p.patronymic || ''} ${p.maidenName || ''}`.toLowerCase();
        const places = `${p.birthPlace || ''} ${p.deathPlace || ''}`.toLowerCase();
        const notes = (p.notes || '').toLowerCase();
        const occupation = (p.occupation || '').toLowerCase();
        const tags = (p.tags || []).join(' ').toLowerCase();
        const searchTag = q.startsWith('#') ? q.slice(1).trim() : q;

        if (
          !fullName.includes(q) &&
          !places.includes(q) &&
          !notes.includes(q) &&
          !occupation.includes(q) &&
          !tags.includes(q) &&
          (!searchTag || !tags.includes(searchTag))
        ) {
          return false;
        }
      }

      // Hashtag Filter
      if (tagFilter !== 'all') {
        const cleanTag = tagFilter.toLowerCase().replace(/^#+/, '');
        const personTags = (p.tags || []).map((t) => t.toLowerCase().replace(/^#+/, ''));
        if (!personTags.includes(cleanTag)) {
          return false;
        }
      }

      // Gender filter
      if (genderFilter === 'male' && !isPersonMale(p, persons)) return false;
      if (genderFilter === 'female' && !isPersonFemale(p, persons)) return false;

      // Life state filter
      if (lifeStateFilter === 'alive' && p.deathDate) return false;
      if (lifeStateFilter === 'deceased' && !p.deathDate) return false;

      // Status filter
      if (statusFilter === 'confirmed' && isPersonHypothesis(p)) return false;
      if (statusFilter === 'hypothesis' && !isPersonHypothesis(p)) return false;

      return true;
    });
  }, [sourceList, tabFilter, searchQuery, tagFilter, genderFilter, lifeStateFilter, statusFilter]);

  // Sorted Persons
  const sortedPersons = useMemo(() => {
    const list = [...filteredPersons];
    if (sortOption === 'central' && centralPerson) {
      list.sort((a, b) => {
        if (a.id === centralPerson.id) return -1;
        if (b.id === centralPerson.id) return 1;
        return (a.lastName || '').localeCompare(b.lastName || '', 'uk');
      });
    } else if (sortOption === 'name') {
      list.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || '', 'uk'));
    } else if (sortOption === 'birthDate') {
      list.sort((a, b) => (a.birthDate || '9999').localeCompare(b.birthDate || '9999'));
    } else if (sortOption === 'tag') {
      list.sort((a, b) => {
        const tagA = (a.tags && a.tags.length > 0) ? a.tags[0] : 'яяя';
        const tagB = (b.tags && b.tags.length > 0) ? b.tags[0] : 'яяя';
        return tagA.localeCompare(tagB, 'uk');
      });
    } else if (sortOption === 'tagCount') {
      list.sort((a, b) => (b.tags?.length || 0) - (a.tags?.length || 0));
    } else if (sortOption === 'recent') {
      list.reverse();
    }
    return list;
  }, [filteredPersons, sortOption, centralPerson]);

  // Virtualization for large lists / archives
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: sortedPersons.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 58,
    overscan: 10,
  });

  // Select all logic
  const isAllSelected = useMemo(() => {
    if (sortedPersons.length === 0) return false;
    return sortedPersons.every((p) => selectedIds.has(p.id));
  }, [sortedPersons, selectedIds]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      const next = new Set<string>();
      sortedPersons.forEach((p) => next.add(p.id));
      setSelectedIds(next);
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Reset all filters
  const resetFilters = () => {
    setSearchQuery('');
    setGenderFilter('all');
    setLifeStateFilter('all');
    setStatusFilter('all');
    setTagFilter('all');
    setTabFilter('all');
  };

  // Soft delete actions
  const handleDeleteSingle = (p: Person) => {
    setConfirmModal({
      title: 'Видалення особи у кошик',
      message: `Ви дійсно бажаєте перемістити особу «${p.firstName} ${p.lastName}» у кошик?`,
      confirmText: 'Перемістити у кошик',
      onConfirm: () => {
        deletePerson(p.id);
        setToast({
          message: `Особу «${p.firstName} ${p.lastName}» переміщено у кошик.`,
          actionText: 'Скасувати',
          onAction: () => restorePerson(p.id)
        });
      }
    });
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    const ids: string[] = Array.from(selectedIds);
    setConfirmModal({
      title: 'Видалення вибраних осіб у кошик',
      message: `Ви дійсно бажаєте перемістити обраних осіб (${ids.length}) у кошик?`,
      confirmText: 'Перемістити у кошик',
      onConfirm: () => {
        deletePersons(ids);
        setSelectedIds(new Set<string>());
        setToast({
          message: `Вибраних осіб (${ids.length}) переміщено у кошик.`,
          actionText: 'Відновити',
          onAction: () => restorePersons(ids)
        });
      }
    });
  };

  // Trash actions
  const handleRestoreSingle = (p: Person) => {
    restorePerson(p.id);
    setToast({ message: `Особу «${p.firstName} ${p.lastName}» відновлено з кошика.` });
  };

  const handleRestoreBatch = () => {
    if (selectedIds.size === 0) return;
    const ids: string[] = Array.from(selectedIds);
    restorePersons(ids);
    setSelectedIds(new Set<string>());
    setToast({ message: `Відновлено осіб (${ids.length}) з кошика.` });
  };

  const handlePermanentDeleteSingle = (p: Person) => {
    setConfirmModal({
      title: 'Остаточне видалення',
      message: `Ви дійсно бажаєте безповоротно видалити особу «${p.firstName} ${p.lastName}» з бази даних?`,
      confirmText: 'Видалити назавжди',
      onConfirm: () => {
        permanentlyDeletePerson(p.id);
        setToast({ message: `Особу «${p.firstName} ${p.lastName}» видалено остаточно.` });
      }
    });
  };

  const handlePermanentDeleteBatch = () => {
    if (selectedIds.size === 0) return;
    const ids: string[] = Array.from(selectedIds);
    setConfirmModal({
      title: 'Остаточне видалення вибраних',
      message: `Ви дійсно бажаєте остаточно видалити обраних осіб (${ids.length})? Цю дію неможливо скасувати.`,
      confirmText: 'Видалити назавжди',
      onConfirm: () => {
        permanentlyDeletePersons(ids);
        setSelectedIds(new Set<string>());
        setToast({ message: `Видалено осіб (${ids.length}) остаточно.` });
      }
    });
  };

  const handleEmptyTrash = () => {
    if (trashPersons.length === 0) return;
    setConfirmModal({
      title: 'Очищення кошика',
      message: `Ви дійсно бажаєте повністю очистити кошик (${trashPersons.length} осіб)? Усі ці записи будуть видалені безповоротно.`,
      confirmText: 'Очистити кошик',
      onConfirm: () => {
        emptyTrash();
        setSelectedIds(new Set());
        setToast({ message: 'Кошик повністю очищено.' });
      }
    });
  };

  // Format years display
  const formatDates = (p: Person) => {
    const getYear = (v?: string) => (v ? v.slice(0, 4) : '');
    const b = getYear(p.birthDate);
    const d = getYear(p.deathDate);
    if (b && d) return `${b} — ${d}`;
    if (b) return `нар. ${b}`;
    if (d) return `пом. ${d}`;
    return 'дати не вказані';
  };

  // Toggle research status for a single person
  const handleToggleResearchStatus = (p: Person) => {
    const currentIsHypo = isPersonHypothesis(p);
    const nextStatus = currentIsHypo ? 'confirmed' : 'hypothetical';
    updatePerson({
      ...p,
      researchStatus: nextStatus,
      isHypothesis: !currentIsHypo,
    });
    setToast({
      message: `Статус дослідження для ${p.lastName || ''} ${p.firstName || ''}: ${!currentIsHypo ? 'Гіпотеза' : 'Підтверджена особа'}`
    });
  };

  // Batch set research status
  const handleBatchSetResearchStatus = (status: 'confirmed' | 'hypothetical') => {
    const isHypo = status === 'hypothetical';
    let count = 0;
    selectedIds.forEach((id) => {
      const p = persons.find((item) => item.id === id);
      if (p) {
        updatePerson({
          ...p,
          researchStatus: status,
          isHypothesis: isHypo,
        });
        count++;
      }
    });
    setToast({
      message: `Статус дослідження змінено для ${count} осіб: ${isHypo ? 'Гіпотеза' : 'Підтверджена особа'}`
    });
  };

  return (
    <div className={`flex-1 p-4 md:p-6 ${theme.appBg} overflow-y-auto overflow-x-auto space-y-4 transition-colors duration-300 relative`}>
      {/* 1. TOP HEADER & ACTION BUTTONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#2A2A2A]">
        <div>
          <h2 className={`text-xl font-bold ${theme.cardTitle} flex items-center gap-2.5`}>
            <Users className="w-6 h-6 text-[#B88E3E]" />
            <span>Фігуранти справи</span>
          </h2>
          <p className={`text-xs ${theme.cardSubtext} mt-0.5`}>
            Люди проєкту, життєві факти, джерела та родинні зв'язки.
          </p>
        </div>

        {/* Top Right Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={exportJsonData}
            className="px-3 py-1.5 rounded-lg bg-[#262626] hover:bg-[#333333] border border-[#404040] text-xs font-semibold text-[#E5E5E5] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-[#B88E3E]" />
            <span>Імпорт даних</span>
          </button>

          <button
            onClick={exportGedcomData}
            className="px-3 py-1.5 rounded-lg bg-[#262626] hover:bg-[#333333] border border-[#404040] text-xs font-semibold text-[#E5E5E5] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Upload className="w-3.5 h-3.5 text-[#B88E3E]" />
            <span>Імпорт GEDCOM</span>
          </button>

          <button
            onClick={onOpenAddPerson}
            className="px-3.5 py-1.5 rounded-lg bg-[#B88E3E] hover:bg-[#A37B30] text-[#0F0F0F] font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Додати особу</span>
          </button>
        </div>
      </div>

      {/* 2. COMPACT FILTER & SUB-TABS BAR */}
      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-3 shadow-md space-y-2.5">
        {/* Top row: Sub-tabs Pills & Search Input */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Sub-tabs Pills */}
          <div className="flex items-center gap-1 bg-[#121212] border border-[#333333] p-1 rounded-lg shrink-0 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setTabFilter('all')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                tabFilter === 'all'
                  ? 'bg-[#B88E3E] text-[#0F0F0F] shadow-xs'
                  : 'text-[#A3A3A3] hover:text-[#E5E5E5]'
              }`}
            >
              <span>Усі особи</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                tabFilter === 'all' ? 'bg-[#0F0F0F]/20 text-[#0F0F0F]' : 'bg-[#262626] text-[#8C8C8C]'
              }`}>
                {counts.all}
              </span>
            </button>

            <button
              onClick={() => setTabFilter('confirmed')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                tabFilter === 'confirmed'
                  ? 'bg-[#B88E3E] text-[#0F0F0F] shadow-xs'
                  : 'text-[#A3A3A3] hover:text-[#E5E5E5]'
              }`}
            >
              <span>Підтверджені</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                tabFilter === 'confirmed' ? 'bg-[#0F0F0F]/20 text-[#0F0F0F]' : 'bg-[#262626] text-[#8C8C8C]'
              }`}>
                {counts.confirmed}
              </span>
            </button>

            <button
              onClick={() => setTabFilter('hypothesis')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                tabFilter === 'hypothesis'
                  ? 'bg-[#B88E3E] text-[#0F0F0F] shadow-xs'
                  : 'text-[#A3A3A3] hover:text-[#E5E5E5]'
              }`}
            >
              <span>Гіпотези</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                tabFilter === 'hypothesis' ? 'bg-[#0F0F0F]/20 text-[#0F0F0F]' : 'bg-[#262626] text-[#8C8C8C]'
              }`}>
                {counts.hypothesis}
              </span>
            </button>

            {/* Trash Sub-tab */}
            <button
              onClick={() => setTabFilter('trash')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                tabFilter === 'trash'
                  ? 'bg-rose-900/80 text-rose-100 border border-rose-700/60 shadow-xs'
                  : 'text-[#A3A3A3] hover:text-rose-300'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Кошик</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                tabFilter === 'trash' ? 'bg-rose-950 text-rose-200' : 'bg-[#262626] text-[#8C8C8C]'
              }`}>
                {counts.trash}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#8C8C8C] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Пошук (ім'я, прізвище, місто, нотатки)..."
              className="w-full pl-9 pr-3 py-1.5 bg-[#121212] border border-[#333333] rounded-lg text-xs text-[#E5E5E5] placeholder-[#666666] focus:outline-none focus:border-[#B88E3E] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8C8C8C] hover:text-[#E5E5E5]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Bottom row: Filter Selects */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 border-t border-[#262626]">
          {/* Tag Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-[#8C8C8C] uppercase">Хештег:</span>
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className={`flex-1 px-2 py-1 bg-[#121212] border ${
                tagFilter !== 'all' ? 'border-[#B88E3E] text-[#B88E3E]' : 'border-[#333333] text-[#E5E5E5]'
              } rounded-md text-xs focus:outline-none focus:border-[#B88E3E] cursor-pointer`}
            >
              <option value="all">Усі хештеги ({availableHashtags.length})</option>
              {availableHashtags.map((h) => (
                <option key={h.tag} value={h.tag}>
                  #{h.tag} ({h.count})
                </option>
              ))}
            </select>
          </div>

          {/* Gender Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-[#8C8C8C] uppercase">Стать:</span>
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value as any)}
              className="flex-1 px-2 py-1 bg-[#121212] border border-[#333333] rounded-md text-xs text-[#E5E5E5] focus:outline-none focus:border-[#B88E3E] cursor-pointer"
            >
              <option value="all">Усі</option>
              <option value="male">Чоловіки</option>
              <option value="female">Жінки</option>
            </select>
          </div>

          {/* Life State Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-[#8C8C8C] uppercase">Стан:</span>
            <select
              value={lifeStateFilter}
              onChange={(e) => setLifeStateFilter(e.target.value as any)}
              className="flex-1 px-2 py-1 bg-[#121212] border border-[#333333] rounded-md text-xs text-[#E5E5E5] focus:outline-none focus:border-[#B88E3E] cursor-pointer"
            >
              <option value="all">Усі</option>
              <option value="alive">Живі</option>
              <option value="deceased">Померлі</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-[#8C8C8C] uppercase whitespace-nowrap">Статус дослідження:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="flex-1 px-2 py-1 bg-[#121212] border border-[#333333] rounded-md text-xs text-[#E5E5E5] focus:outline-none focus:border-[#B88E3E] cursor-pointer"
            >
              <option value="all">Усі статуси</option>
              <option value="confirmed">Підтверджена особа</option>
              <option value="hypothesis">Гіпотеза</option>
            </select>
          </div>

          {/* RESET BUTTON */}
          <div className="flex justify-end">
            {(searchQuery || tagFilter !== 'all' || genderFilter !== 'all' || lifeStateFilter !== 'all' || statusFilter !== 'all' || tabFilter !== 'all') ? (
              <button
                onClick={resetFilters}
                className="text-xs font-semibold text-[#B88E3E] hover:text-[#E5E5E5] transition-colors flex items-center gap-1 cursor-pointer px-2.5 py-1 bg-[#262626] hover:bg-[#333333] rounded-md border border-[#333333]"
              >
                <X className="w-3.5 h-3.5" />
                <span>Скинути</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Quick Hashtags Horizontal Pills Bar */}
        {availableHashtags.length > 0 && (
          <div className="pt-2 border-t border-[#262626] flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs scrollbar-none">
            <span className="text-[11px] font-bold text-[#8C8C8C] flex items-center gap-1 shrink-0 mr-1">
              <Hash className="w-3.5 h-3.5 text-[#B88E3E]" />
              Хештеги:
            </span>

            <button
              type="button"
              onClick={() => setTagFilter('all')}
              className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium transition-all shrink-0 cursor-pointer ${
                tagFilter === 'all'
                  ? 'bg-[#B88E3E] text-[#0F0F0F] font-bold shadow-xs'
                  : 'bg-[#1E1E1E] text-[#A3A3A3] hover:text-[#E5E5E5] border border-[#333333]'
              }`}
            >
              Всі ({persons.length})
            </button>

            {availableHashtags.map((h) => {
              const isSelected = tagFilter.toLowerCase().replace(/^#+/, '') === h.tag.toLowerCase().replace(/^#+/, '');
              return (
                <button
                  key={h.tag}
                  type="button"
                  onClick={() => setTagFilter(isSelected ? 'all' : h.tag)}
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-[#B88E3E] text-[#0F0F0F] font-bold shadow-xs'
                      : 'bg-[#1E1E1E] text-[#A3A3A3] hover:text-[#E5E5E5] border border-[#333333]'
                  }`}
                >
                  <span>#{h.tag}</span>
                  <span className={`text-[10px] ${isSelected ? 'text-[#0F0F0F]/80' : 'text-[#8C8C8C]'}`}>
                    {h.count}
                  </span>
                  {isSelected && <X className="w-3 h-3 ml-0.5" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. TOOLBAR & DISPLAY OPTIONS */}
      <div className="p-2.5 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] flex flex-col md:flex-row items-center justify-between gap-2.5 shadow-sm">
        {/* Left: Select Mode Toggle, Select Page, Export, Delete/Restore Selected */}
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <button
            onClick={() => {
              const next = !isSelectionMode;
              setIsSelectionMode(next);
              if (!next) {
                setSelectedIds(new Set());
              }
            }}
            className={`px-3 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              isSelectionMode
                ? 'bg-[#B88E3E] text-[#0F0F0F] border-[#B88E3E] font-bold shadow-xs'
                : 'bg-[#262626] hover:bg-[#333333] border-[#404040] text-[#E5E5E5]'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>{isSelectionMode ? 'Скасувати вибір' : 'Вибрати'}</span>
          </button>

          {isSelectionMode && (
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#8C8C8C] hover:text-[#E5E5E5] tracking-wider uppercase select-none">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={toggleSelectAll}
                className="rounded border-[#404040] bg-[#121212] text-[#B88E3E] focus:ring-0 w-4 h-4 cursor-pointer"
              />
              <span>ВИБРАТИ СТОРІНКУ</span>
            </label>
          )}

          {tabFilter !== 'trash' ? (
            <>
              <button
                onClick={exportJsonData}
                className="px-3 py-1 rounded-lg bg-[#262626] hover:bg-[#333333] border border-[#404040] text-xs font-semibold text-[#E5E5E5] transition-all cursor-pointer"
              >
                Експорт
              </button>

              {isSelectionMode && selectedIds.size > 0 && (
                <>
                  <button
                    onClick={() => handleBatchSetResearchStatus('confirmed')}
                    className="px-3 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 text-xs font-bold text-emerald-200 transition-all cursor-pointer flex items-center gap-1.5"
                    title="Встановити статус 'Підтверджена особа' для вибраних"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Підтверджена особа ({selectedIds.size})</span>
                  </button>

                  <button
                    onClick={() => handleBatchSetResearchStatus('hypothetical')}
                    className="px-3 py-1 rounded-lg bg-amber-950/80 hover:bg-amber-900 border border-amber-700/60 text-xs font-bold text-amber-200 transition-all cursor-pointer flex items-center gap-1.5"
                    title="Встановити статус 'Гіпотеза' для вибраних"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Гіпотеза ({selectedIds.size})</span>
                  </button>

                  <button
                    onClick={handleBatchDelete}
                    className="px-3 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-xs font-bold text-rose-200 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Видалити вибраних ({selectedIds.size})</span>
                  </button>
                </>
              )}
            </>
          ) : (
            /* TRASH TOOLBAR BUTTONS */
            <div className="flex items-center gap-2 flex-wrap">
              {isSelectionMode && selectedIds.size > 0 && (
                <>
                  <button
                    onClick={handleRestoreBatch}
                    className="px-3 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 text-xs font-bold text-emerald-200 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Відновити вибраних ({selectedIds.size})</span>
                  </button>

                  <button
                    onClick={handlePermanentDeleteBatch}
                    className="px-3 py-1 rounded-lg bg-rose-950/90 hover:bg-rose-900 border border-rose-700 text-xs font-bold text-rose-100 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash className="w-3.5 h-3.5" />
                    <span>Видалити назавжди ({selectedIds.size})</span>
                  </button>
                </>
              )}

              {trashPersons.length > 0 && (
                <button
                  onClick={handleEmptyTrash}
                  className="px-3 py-1 rounded-lg bg-rose-900/40 hover:bg-rose-900/80 border border-rose-700/50 text-xs font-bold text-rose-200 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Очистити кошик</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: View Mode & Sorting */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          {/* View Mode Toggle */}
          <div className="p-1 rounded-lg bg-[#121212] border border-[#333333] flex items-center gap-1">
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'table'
                  ? 'bg-[#B88E3E] text-[#0F0F0F] shadow-xs'
                  : 'text-[#8C8C8C] hover:text-[#E5E5E5]'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Список</span>
            </button>

            <button
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'grid'
                  ? 'bg-[#B88E3E] text-[#0F0F0F] shadow-xs'
                  : 'text-[#8C8C8C] hover:text-[#E5E5E5]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Плитка</span>
            </button>
          </div>

          {/* Sort Selector */}
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as any)}
            className="px-2.5 py-1 rounded-lg bg-[#121212] border border-[#333333] text-xs font-semibold text-[#E5E5E5] focus:outline-none focus:border-[#B88E3E] transition-colors cursor-pointer"
          >
            <option value="central">Від центральної особи</option>
            <option value="name">За прізвищем (А-Я)</option>
            <option value="tag">За хештегом (А-Я)</option>
            <option value="tagCount">За к-стю тегів</option>
            <option value="birthDate">За датою народження</option>
            <option value="recent">Нещодавно додані</option>
          </select>
        </div>
      </div>

      {/* 4. DATA CONTENT (TABLE OR GRID) */}
      {sortedPersons.length === 0 ? (
        <div className="p-10 text-center rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] text-[#8C8C8C]">
          {tabFilter === 'trash' ? (
            <>
              <Trash2 className="w-10 h-10 mx-auto mb-3 text-rose-500 opacity-60" />
              <h4 className="text-sm font-bold text-[#E5E5E5]">Кошик порожній</h4>
              <p className="text-xs mt-1">Видалені особи з'являтимуться тут, і їх можна буде відновити в один клік.</p>
            </>
          ) : (
            <>
              <Users className="w-10 h-10 mx-auto mb-3 text-[#B88E3E] opacity-60" />
              <h4 className="text-sm font-bold text-[#E5E5E5]">Осіб за заданими фільтрами не знайдено</h4>
              <p className="text-xs mt-1">Спробуйте змінити пошуковий запит або скинути фільтри.</p>
              <button
                onClick={resetFilters}
                className="mt-4 px-4 py-2 rounded-lg bg-[#B88E3E] hover:bg-[#a37c33] text-[#0F0F0F] text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-2"
              >
                Скинути фільтри
              </button>
            </>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] overflow-hidden shadow-sm">
          <div ref={tableContainerRef} className="overflow-x-auto max-h-[calc(100vh-270px)] overflow-y-auto">
            <table className="w-full min-w-[900px] text-left text-xs text-[#E5E5E5] relative border-collapse">
              <thead className="bg-[#121212] text-[#B88E3E] uppercase tracking-wider font-bold text-[10px] border-b border-[#2A2A2A] sticky top-0 z-10">
                <tr>
                  <th className="p-3 w-10 text-center bg-[#121212]">
                    {isSelectionMode ? (
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        className="rounded border-[#404040] bg-[#121212] text-[#B88E3E] focus:ring-0 w-4 h-4 cursor-pointer"
                        title="Вибрати всіх"
                      />
                    ) : (
                      '#'
                    )}
                  </th>
                  <th className="p-3 bg-[#121212]">ОСОБА</th>
                  <th className="p-3 bg-[#121212]">РОКИ ЖИТТЯ</th>
                  <th className="p-3 bg-[#121212]">СТАТУС ДОСЛІДЖЕННЯ</th>
                  <th className="p-3 bg-[#121212]">КЛЮЧОВИЙ ЗВ'ЯЗОК</th>
                  <th className="p-3 bg-[#121212]">МІСЦЯ</th>
                  <th className="p-3 text-right bg-[#121212]">ДІЇ</th>
                </tr>
              </thead>
              <tbody>
                {/* Virtual top spacer */}
                {rowVirtualizer.getVirtualItems().length > 0 && rowVirtualizer.getVirtualItems()[0].start > 0 && (
                  <tr>
                    <td colSpan={7} style={{ height: `${rowVirtualizer.getVirtualItems()[0].start}px` }} />
                  </tr>
                )}
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const idx = virtualRow.index;
                  const p = sortedPersons[idx];
                  if (!p) return null;
                  const isChecked = selectedIds.has(p.id);
                  const feminine = isPersonFemale(p, persons);
                  const initials = `${p.lastName?.[0] || ''}${p.firstName?.[0] || ''}`.toUpperCase();
                  const isCentral = centralPerson && p.id === centralPerson.id;
                  const relTitle = relationshipMap.get(p.id) || 'Родич';
                  const isHypo = isPersonHypothesis(p);

                  return (
                    <tr
                      key={p.id}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      onClick={() => onInspectPerson?.(p.id)}
                      className={`hover:bg-[#262626] transition-colors cursor-pointer border-b border-[#262626] ${
                        isCentral ? 'bg-[#B88E3E]/10 border-l-2 border-l-[#B88E3E]' : isChecked ? 'bg-[#222222]' : ''
                      }`}
                    >
                      {/* Checkbox / Index */}
                      <td className="p-3 text-center" onClick={(e) => isSelectionMode && e.stopPropagation()}>
                        {isSelectionMode ? (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectOne(p.id)}
                            className="rounded border-[#404040] bg-[#121212] text-[#B88E3E] focus:ring-0 w-4 h-4 cursor-pointer"
                          />
                        ) : (
                          <span className="font-mono text-[11px] text-[#8C8C8C]">{idx + 1}</span>
                        )}
                      </td>

                      {/* Person Details */}
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <span
                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 text-xs font-bold shadow-xs ${
                              feminine
                                ? 'border-[#A54968] bg-[#2B1925] text-[#FFB2C4]'
                                : 'border-[#3B82F6] bg-[#1E293B] text-[#93C5FD]'
                            }`}
                          >
                            {p.photoUrl ? (
                              <img src={p.photoUrl} alt="" className="h-full w-full rounded-full object-cover" />
                            ) : (
                              initials
                            )}
                          </span>

                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[#E5E5E5] text-xs">
                                {p.lastName} {p.firstName} {p.patronymic || ''}
                              </span>
                              {isCentral && (
                                <span title="Центральна особа">
                                  <Crown className="w-3.5 h-3.5 text-[#B88E3E] shrink-0" />
                                </span>
                              )}
                            </div>

                            {p.maidenName && (
                              <p className="text-[10px] text-[#B88E3E] italic">({p.maidenName})</p>
                            )}

                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              <span className="text-[9px] font-mono text-[#8C8C8C] truncate max-w-[100px]">
                                {p.id}
                              </span>
                              {p.tags && p.tags.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
                                  {p.tags.map((t, tIdx) => {
                                    const cleanT = t.replace(/^#+/, '');
                                    const isSel = tagFilter.toLowerCase().replace(/^#+/, '') === cleanT.toLowerCase();
                                    return (
                                      <button
                                        key={tIdx}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setTagFilter(isSel ? 'all' : cleanT);
                                        }}
                                        className={`px-1.5 py-0.2 rounded text-[9px] font-medium transition-colors cursor-pointer ${
                                          isSel
                                            ? 'bg-[#B88E3E] text-[#0F0F0F] font-bold'
                                            : 'bg-[#B88E3E]/10 hover:bg-[#B88E3E]/25 text-[#B88E3E] border border-[#B88E3E]/30'
                                        }`}
                                        title={`Фільтрувати за #${cleanT}`}
                                      >
                                        #{cleanT}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Years */}
                      <td className="p-3 font-mono text-[11px] text-[#E5E5E5]">
                        {formatDates(p)}
                      </td>

                      {/* Research Status */}
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        {tabFilter !== 'trash' ? (
                          <button
                            type="button"
                            onClick={() => handleToggleResearchStatus(p)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer border shadow-xs ${
                              isHypo
                                ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/40 hover:scale-105'
                                : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/40 hover:scale-105'
                            }`}
                            title={`Статус дослідження: ${isHypo ? 'Гіпотеза' : 'Підтверджена особа'}. Натисніть, щоб змінити`}
                          >
                            {isHypo ? (
                              <>
                                <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                                <span>Гіпотеза</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Підтверджена особа</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1.5 border ${
                              isHypo
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            {isHypo ? (
                              <>
                                <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                                <span>Гіпотеза</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Підтверджена особа</span>
                              </>
                            )}
                          </span>
                        )}
                      </td>

                      {/* Relationship to Central Person */}
                      <td className="p-3 font-bold text-[#B88E3E]">
                        <div className="flex items-center gap-1.5">
                          <GitFork className="w-3.5 h-3.5 text-[#B88E3E] shrink-0" />
                          <span>{relTitle}</span>
                        </div>
                      </td>

                      {/* Places */}
                      <td className="p-3 text-[#A3A3A3] truncate max-w-[160px]">
                        {p.birthPlace || '—'}
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {tabFilter !== 'trash' ? (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedPersonId(p.id);
                                  setTreeMode('hourglass');
                                  setActiveTab('tree');
                                }}
                                className="px-2 py-1 rounded-md bg-[#262626] hover:bg-[#B88E3E] text-[#B88E3E] hover:text-[#0F0F0F] border border-[#404040] text-[10px] font-bold transition-all cursor-pointer"
                                title="Показати в дереві"
                              >
                                В дерево
                              </button>

                              <button
                                onClick={() => onInspectPerson?.(p.id)}
                                className="p-1 rounded-md text-[#A3A3A3] hover:text-[#E5E5E5] hover:bg-[#333333] transition-colors cursor-pointer"
                                title="Профіль"
                              >
                                <Scan className="w-3.5 h-3.5" />
                              </button>

                              {onEditPerson && (
                                <button
                                  onClick={() => onEditPerson(p)}
                                  className="p-1 rounded-md text-[#A3A3A3] hover:text-[#E5E5E5] hover:bg-[#333333] transition-colors cursor-pointer"
                                  title="Редагувати"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <button
                                onClick={() => handleDeleteSingle(p)}
                                className="p-1 rounded-md text-[#A3A3A3] hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                                title="Видалити в кошик"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            /* TRASH ROW ACTIONS */
                            <>
                              <button
                                onClick={() => handleRestoreSingle(p)}
                                className="px-2 py-1 rounded-md bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-200 text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                                title="Відновити з кошика"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Відновити</span>
                              </button>

                              <button
                                onClick={() => handlePermanentDeleteSingle(p)}
                                className="p-1 rounded-md text-rose-400 hover:text-rose-200 hover:bg-rose-900/60 transition-colors cursor-pointer"
                                title="Видалити назавжди"
                              >
                                <Trash className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {/* Virtual bottom spacer */}
                {rowVirtualizer.getVirtualItems().length > 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        height: `${Math.max(
                          0,
                          rowVirtualizer.getTotalSize() -
                            rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end
                        )}px`
                      }}
                    />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* GRID VIEW ("Плитка") */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {sortedPersons.map((p) => {
            const isChecked = selectedIds.has(p.id);
            const feminine = isPersonFemale(p, persons);
            const initials = `${p.lastName?.[0] || ''}${p.firstName?.[0] || ''}`.toUpperCase();
            const isCentral = centralPerson && p.id === centralPerson.id;
            const relTitle = relationshipMap.get(p.id) || 'Родич';
            const isHypo = isPersonHypothesis(p);

            return (
              <div
                key={p.id}
                onClick={() => onInspectPerson?.(p.id)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 relative ${
                  isCentral
                    ? 'bg-[#222222] border-[#B88E3E] shadow-md ring-1 ring-[#B88E3E]/30'
                    : isChecked
                    ? 'bg-[#222222] border-[#404040]'
                    : 'bg-[#1A1A1A] border-[#2A2A2A] hover:border-[#B88E3E]'
                }`}
              >
                {/* Top Row: Checkbox (if selection mode) & Status Badge */}
                <div className={`flex items-center ${isSelectionMode ? 'justify-between' : 'justify-end'}`} onClick={(e) => isSelectionMode && e.stopPropagation()}>
                  {isSelectionMode && (
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelectOne(p.id)}
                      className="rounded border-[#404040] bg-[#121212] text-[#B88E3E] focus:ring-0 w-4 h-4 cursor-pointer"
                    />
                  )}

                  {tabFilter !== 'trash' ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleResearchStatus(p);
                      }}
                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1 transition-all cursor-pointer border ${
                        isHypo
                          ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/40 hover:scale-105'
                          : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/40 hover:scale-105'
                      }`}
                      title={`Статус дослідження: ${isHypo ? 'Гіпотеза' : 'Підтверджена особа'}. Натисніть для зміни`}
                    >
                      {isHypo ? (
                        <>
                          <HelpCircle className="w-3 h-3 text-amber-400" />
                          <span>Гіпотеза</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Підтверджена особа</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1 border ${
                        isHypo
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      {isHypo ? (
                        <>
                          <HelpCircle className="w-3 h-3 text-amber-400" />
                          <span>Гіпотеза</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Підтверджена особа</span>
                        </>
                      )}
                    </span>
                  )}
                </div>

                {/* Avatar & Main Info */}
                <div className="flex items-start gap-2.5">
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 text-xs font-bold shadow-xs ${
                      feminine
                        ? 'border-[#A54968] bg-[#2B1925] text-[#FFB2C4]'
                        : 'border-[#3B82F6] bg-[#1E293B] text-[#93C5FD]'
                    }`}
                  >
                    {p.photoUrl ? (
                      <img src={p.photoUrl} alt="" className="h-full w-full rounded-full object-cover" />
                    ) : (
                      initials
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-xs text-[#E5E5E5] truncate leading-snug">
                      {p.lastName} {p.firstName}
                    </h4>
                    {p.patronymic && (
                      <p className="text-[11px] text-[#A3A3A3] truncate">{p.patronymic}</p>
                    )}
                    {p.maidenName && (
                      <p className="text-[10px] text-[#B88E3E] italic truncate">({p.maidenName})</p>
                    )}
                    <span className="text-[9px] font-mono text-[#8C8C8C] block truncate mt-0.5">
                      {p.id}
                    </span>
                  </div>
                </div>

                {/* Dates & Relationship */}
                <div className="space-y-1 pt-1.5 border-t border-[#2A2A2A] text-xs">
                  <div className="flex items-center justify-between text-[#A3A3A3]">
                    <span className="text-[10px] uppercase font-bold text-[#8C8C8C]">Роки:</span>
                    <span className="font-mono text-[#E5E5E5]">{formatDates(p)}</span>
                  </div>

                  <div className="flex items-center justify-between text-[#B88E3E] font-bold">
                    <span className="text-[10px] uppercase text-[#8C8C8C]">Зв’язок:</span>
                    <span className="truncate max-w-[140px]">{relTitle}</span>
                  </div>

                  {p.birthPlace && (
                    <div className="flex items-center gap-1 text-[11px] text-[#A3A3A3] truncate pt-0.5">
                      <MapPin className="w-3 h-3 text-[#B88E3E] shrink-0" />
                      <span className="truncate">{p.birthPlace}</span>
                    </div>
                  )}

                  {p.tags && p.tags.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap pt-1" onClick={(e) => e.stopPropagation()}>
                      {p.tags.map((t, tIdx) => {
                        const cleanT = t.replace(/^#+/, '');
                        const isSel = tagFilter.toLowerCase().replace(/^#+/, '') === cleanT.toLowerCase();
                        return (
                          <button
                            key={tIdx}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTagFilter(isSel ? 'all' : cleanT);
                            }}
                            className={`px-1.5 py-0.2 rounded text-[9px] font-medium transition-colors cursor-pointer ${
                              isSel
                                ? 'bg-[#B88E3E] text-[#0F0F0F] font-bold'
                                : 'bg-[#B88E3E]/10 hover:bg-[#B88E3E]/25 text-[#B88E3E] border border-[#B88E3E]/30'
                            }`}
                            title={`Фільтрувати за #${cleanT}`}
                          >
                            #{cleanT}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Action Buttons Footer */}
                <div className="pt-2 border-t border-[#2A2A2A] flex items-center justify-between gap-1" onClick={(e) => e.stopPropagation()}>
                  {tabFilter !== 'trash' ? (
                    <>
                      <button
                        onClick={() => {
                          setSelectedPersonId(p.id);
                          setTreeMode('hourglass');
                          setActiveTab('tree');
                        }}
                        className="flex-1 py-1 px-2 rounded-md bg-[#262626] hover:bg-[#B88E3E] text-[#B88E3E] hover:text-[#0F0F0F] border border-[#404040] text-[10px] font-bold transition-all text-center cursor-pointer"
                      >
                        Показати в дереві
                      </button>

                      <button
                        onClick={() => onInspectPerson?.(p.id)}
                        className="p-1 rounded-md text-[#A3A3A3] hover:text-[#E5E5E5] hover:bg-[#333333] transition-colors cursor-pointer"
                        title="Профіль"
                      >
                        <Scan className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteSingle(p)}
                        className="p-1 rounded-md text-[#A3A3A3] hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                        title="Видалити"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleRestoreSingle(p)}
                        className="flex-1 py-1 px-2 rounded-md bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-200 text-[10px] font-bold transition-all text-center cursor-pointer flex items-center justify-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Відновити</span>
                      </button>

                      <button
                        onClick={() => handlePermanentDeleteSingle(p)}
                        className="p-1 rounded-md text-rose-400 hover:text-rose-200 hover:bg-rose-900/60 transition-colors cursor-pointer"
                        title="Видалити назавжди"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1E1E1E] border border-[#383838] text-[#E5E5E5] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-slideUp">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-medium">{toast.message}</span>
          {toast.onAction && (
            <button
              onClick={() => {
                toast.onAction?.();
                setToast(null);
              }}
              className="px-2.5 py-1 rounded bg-[#B88E3E] hover:bg-[#a37c33] text-[#0F0F0F] text-xs font-bold transition-all cursor-pointer"
            >
              {toast.actionText || 'Скасувати'}
            </button>
          )}
          <button onClick={() => setToast(null)} className="p-1 text-[#8C8C8C] hover:text-[#E5E5E5] cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#1A1A1A] border border-[#333333] rounded-2xl p-6 max-w-md w-full shadow-2xl text-[#E5E5E5] space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0 text-amber-400" />
              <h3 className="text-base font-bold text-[#E5E5E5]">{confirmModal.title}</h3>
            </div>
            <p className="text-xs text-[#A3A3A3] leading-relaxed">{confirmModal.message}</p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-lg bg-[#262626] hover:bg-[#333333] text-xs font-semibold text-[#E5E5E5] cursor-pointer"
              >
                Скасувати
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className="px-4 py-2 rounded-lg bg-rose-700 hover:bg-rose-800 text-xs font-bold text-white cursor-pointer"
              >
                {confirmModal.confirmText || 'Підтвердити'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
