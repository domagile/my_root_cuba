import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Filter,
  User,
  UserPlus,
  Plus,
  ArrowUpDown,
  BookOpen,
  Calendar,
  MapPin,
  GitFork,
  Compass,
  Edit2,
  Trash2,
  LayoutGrid,
  List,
  Shield,
  Lock,
  Hash,
  Tag,
  X,
  CheckCircle2,
  HelpCircle,
  FileText,
  GitMerge,
  ChevronDown,
  Check
} from 'lucide-react';
import { GenealogyDatabase, Person, Gender } from '../../types/genealogy';
import { getFullName } from '../../utils/relationship';
import { useUIStore } from '../../../stores/useUIStore';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useGenealogyStore } from '../../../stores/useGenealogyStore';
import { isPersonLiving, getPrivacySafePerson, isUserWhitelisted, isUserAdmin } from '../../utils/privacy';
import { getThemeConfig } from '../../../utils/theme';
import { ConfirmDeleteModal } from '../../../components/common/ConfirmDeleteModal';
import { PersonReportModal } from '../../../components/common/PersonReportModal';
import { getTreeHashtagsWithCounts, formatHashtag } from '../../../utils/tagUtils';
import { isPersonMale, isPersonFemale, normalizeGender } from '../../utils/genderUtils';
import { 
  isPersonHypothesis, 
  isPersonConfirmed, 
  MetricSearchStatus, 
  METRIC_SEARCH_STATUS_OPTIONS, 
  getMetricSearchStatus, 
  getMetricStatusConfig 
} from '../../../utils/researchStatusUtils';
import { normalizeUkrainianSurnameGender, areSurnamesEquivalent, formatClanName } from '../../../utils/ukrainianPhonetics';
import { getPersonRodName } from '../../utils/treeLayout';

interface PersonsListViewProps {
  database: GenealogyDatabase;
  isReadOnly?: boolean;
  onSelectPerson: (id: string) => void;
  onEditPerson: (id: string) => void;
  onDeletePerson: (id: string) => void;
  onOpenAddPerson: () => void;
  onChangeRoot: (id: string) => void;
  onOpenKinshipWith: (id: string) => void;
  onUpdatePerson?: (person: Person) => void;
}

export const PersonsListView: React.FC<PersonsListViewProps> = ({
  database,
  isReadOnly = false,
  onSelectPerson,
  onEditPerson,
  onDeletePerson,
  onOpenAddPerson,
  onChangeRoot,
  onOpenKinshipWith,
  onUpdatePerson
}) => {
  const currentUser = useAuthStore((s) => s.currentUser);
  const whitelist = useAuthStore((s) => s.whitelist);
  const updatePersonInStore = useGenealogyStore((s) => s.updatePerson);

  const isWhitelisted = useMemo(() => isUserWhitelisted(currentUser, whitelist), [currentUser, whitelist]);
  const isAdmin = useMemo(() => {
    if (isReadOnly) return false;
    return isUserAdmin(currentUser, whitelist);
  }, [isReadOnly, currentUser, whitelist]);

  const canEdit = useMemo(() => {
    if (isReadOnly) return false;
    if (!currentUser || !isWhitelisted) return false;
    const entry = whitelist.find(
      (w) => w.email.toLowerCase() === currentUser.email.toLowerCase() && w.status === 'active'
    );
    return Boolean(entry && (entry.role === 'admin' || entry.role === 'editor'));
  }, [isReadOnly, currentUser, isWhitelisted, whitelist]);

  const themePalette = useUIStore((s) => s.themePalette);
  const personClanFilter = useUIStore((s) => s.personClanFilter);
  const setPersonClanFilter = useUIStore((s) => s.setPersonClanFilter);
  const theme = getThemeConfig(themePalette);
  const isDark = theme.category === 'dark';

  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState<'ALL' | Gender>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LIVING' | 'DECEASED'>('ALL');
  const [researchStatusFilter, setResearchStatusFilter] = useState<'ALL' | 'CONFIRMED' | 'HYPOTHESIS'>('ALL');
  const [metricSearchStatusFilter, setMetricSearchStatusFilter] = useState<'ALL' | MetricSearchStatus>('ALL');
  const [tagFilter, setTagFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'surname' | 'birth' | 'events' | 'citations' | 'tag' | 'tagCount'>('surname');
  const [sortAsc, setSortAsc] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [personToDelete, setPersonToDelete] = useState<Person | null>(null);
  const [reportPersonId, setReportPersonId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; actionText?: string; onAction?: () => void } | null>(null);
  const [statusMenuPersonId, setStatusMenuPersonId] = useState<string | null>(null);
  const [metricMenuPersonId, setMetricMenuPersonId] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!statusMenuPersonId && !metricMenuPersonId) return;
    const handleClickOutside = () => {
      setStatusMenuPersonId(null);
      setMetricMenuPersonId(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [statusMenuPersonId, metricMenuPersonId]);

  const handleSetMetricSearchStatus = (p: Person, nextStatus: MetricSearchStatus, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!canEdit) return;

    const prevStatus = getMetricSearchStatus(p);
    const updated: Person = {
      ...p,
      metricSearchStatus: nextStatus
    };

    updatePersonInStore(updated);
    onUpdatePerson?.(updated);
    setMetricMenuPersonId(null);

    const cfg = getMetricStatusConfig(nextStatus);
    setToast({
      message: `Статус метрик для «${getFullName(p)}»: ${cfg.label}`,
      actionText: 'Скасувати',
      onAction: () => {
        const reverted: Person = {
          ...p,
          metricSearchStatus: prevStatus
        };
        updatePersonInStore(reverted);
        onUpdatePerson?.(reverted);
      }
    });
  };

  const handleSetResearchStatus = (p: Person, nextStatus: 'confirmed' | 'hypothetical', e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!isAdmin) return;

    const prevIsHypo = isPersonHypothesis(p);
    const prevStatus = p.researchStatus || (prevIsHypo ? 'hypothetical' : 'confirmed');
    const isNextHypo = nextStatus === 'hypothetical';

    const updated: Person = {
      ...p,
      researchStatus: nextStatus,
      isHypothesis: isNextHypo
    };

    updatePersonInStore(updated);
    onUpdatePerson?.(updated);
    setStatusMenuPersonId(null);

    setToast({
      message: `Статус дослідження для «${getFullName(p)}»: ${isNextHypo ? 'Гіпотеза' : 'Підтверджена особа'}`,
      actionText: 'Скасувати',
      onAction: () => {
        const reverted: Person = {
          ...p,
          researchStatus: prevStatus,
          isHypothesis: prevIsHypo
        };
        updatePersonInStore(reverted);
        onUpdatePerson?.(reverted);
      }
    });
  };

  const handleToggleResearchStatus = (p: Person, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isAdmin) return;

    const currentIsHypo = isPersonHypothesis(p);
    const nextStatus = currentIsHypo ? 'confirmed' : 'hypothetical';
    handleSetResearchStatus(p, nextStatus, e);
  };

  // Mobile-friendly filter collapse state
  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim()) count++;
    if (personClanFilter) count++;
    if (tagFilter !== 'ALL') count++;
    if (researchStatusFilter !== 'ALL') count++;
    if (metricSearchStatusFilter !== 'ALL') count++;
    if (genderFilter !== 'ALL') count++;
    if (statusFilter !== 'ALL') count++;
    return count;
  }, [searchTerm, personClanFilter, tagFilter, researchStatusFilter, metricSearchStatusFilter, genderFilter, statusFilter]);

  // Extract all tree hashtags with counts
  const availableHashtags = useMemo(() => {
    return getTreeHashtagsWithCounts(database.persons);
  }, [database.persons]);

  // Available Clans list with counts
  const availableClans = useMemo(() => {
    const clansMap = new Map<string, { id: string; name: string; count: number }>();
    Object.values(database.persons || {}).forEach((p) => {
      const rawRod = getPersonRodName(p);
      if (!rawRod || rawRod === 'Рід') return;
      const canonical = normalizeUkrainianSurnameGender(rawRod) || rawRod;
      const existingKey = Array.from(clansMap.keys()).find(
        (k) => k.toLowerCase() === canonical.toLowerCase() || areSurnamesEquivalent(k, canonical)
      );
      const key = existingKey || canonical;
      const clanName = formatClanName(key);

      if (clansMap.has(key)) {
        clansMap.get(key)!.count += 1;
      } else {
        clansMap.set(key, { id: key, name: clanName, count: 1 });
      }
    });
    return Array.from(clansMap.values()).sort((a, b) => b.count - a.count);
  }, [database.persons]);

  const personsList = useMemo(() => {
    return (Object.values(database.persons) as Person[]).filter((p) => {
      // Search
      const fullName = getFullName(p).toLowerCase();
      const sur = (p.name?.surname || p.lastName || '').toLowerCase();
      const maiden = (p.name?.maidenName || p.maidenName || '').toLowerCase();
      const occu = (p.occupation || '').toLowerCase();
      const place = (p.birthPlace || p.deathPlace || '').toLowerCase();
      const tags = (p.tags || []).join(' ').toLowerCase();
      const q = searchTerm.toLowerCase().trim();
      const qWithoutRod = q.replace(/^рід\s+/i, '').trim();

      const rawRod = getPersonRodName(p);
      const clanFormatted = formatClanName(rawRod).toLowerCase();
      const branch = (p.researchBranch || '').toLowerCase();
      const customClan = (p.clan || '').toLowerCase();

      const searchTag = q.startsWith('#') ? q.slice(1).trim() : q;
      const qTokens = (qWithoutRod || q).split(/\s+/).filter(Boolean);
      const matchesSurnameEquiv =
        (sur && areSurnamesEquivalent(q, sur)) ||
        (sur && areSurnamesEquivalent(qWithoutRod, sur)) ||
        (maiden && areSurnamesEquivalent(q, maiden)) ||
        (maiden && areSurnamesEquivalent(qWithoutRod, maiden)) ||
        qTokens.some((token) => (sur && areSurnamesEquivalent(token, sur)) || (maiden && areSurnamesEquivalent(token, maiden)));

      const matchesClanText =
        clanFormatted.includes(q) ||
        customClan.includes(q) ||
        (qWithoutRod && (clanFormatted.includes(qWithoutRod) || customClan.includes(qWithoutRod) || sur.includes(qWithoutRod) || maiden.includes(qWithoutRod)));

      const matchesSearch =
        !q ||
        fullName.includes(q) ||
        fullName.includes(qWithoutRod) ||
        matchesSurnameEquiv ||
        matchesClanText ||
        branch.includes(q) ||
        occu.includes(q) ||
        place.includes(q) ||
        tags.includes(q) ||
        (searchTag && tags.includes(searchTag));

      // Clan filter
      if (personClanFilter && personClanFilter !== 'ALL') {
        const canonical = normalizeUkrainianSurnameGender(rawRod) || rawRod;
        const matchesClan =
          canonical.toLowerCase() === personClanFilter.toLowerCase() ||
          areSurnamesEquivalent(canonical, personClanFilter);
        if (!matchesClan) return false;
      }

      // Gender filter
      let matchesGender = true;
      if (genderFilter === 'M') {
        matchesGender = isPersonMale(p);
      } else if (genderFilter === 'F') {
        matchesGender = isPersonFemale(p);
      } else if (genderFilter === 'U') {
        matchesGender = !isPersonMale(p) && !isPersonFemale(p);
      }

      // Status filter
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'LIVING' && p.isLiving) ||
        (statusFilter === 'DECEASED' && !p.isLiving);

      // Research status filter (Підтверджена особа / Гіпотеза)
      const matchesResearchStatus =
        researchStatusFilter === 'ALL' ||
        (researchStatusFilter === 'CONFIRMED' && isPersonConfirmed(p)) ||
        (researchStatusFilter === 'HYPOTHESIS' && isPersonHypothesis(p));

      // Metric search status filter (Не шукала / В процесі / Знайдено / Не знайдено / Частково)
      const matchesMetricStatus =
        metricSearchStatusFilter === 'ALL' ||
        getMetricSearchStatus(p) === metricSearchStatusFilter;

      // Tag filter
      const cleanFilterTag = tagFilter !== 'ALL' ? tagFilter.toLowerCase().replace(/^#+/, '') : null;
      const matchesTag =
        !cleanFilterTag ||
        (p.tags || []).some((t) => t.toLowerCase().replace(/^#+/, '') === cleanFilterTag);

      return matchesSearch && matchesGender && matchesStatus && matchesResearchStatus && matchesMetricStatus && matchesTag;
    });
  }, [database.persons, searchTerm, personClanFilter, genderFilter, statusFilter, researchStatusFilter, metricSearchStatusFilter, tagFilter]);

  const sortedPersons = useMemo(() => {
    return [...personsList].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'surname') {
        const surA = (a.name?.surname || a.lastName || a.name?.maidenName || a.maidenName || '').trim();
        const surB = (b.name?.surname || b.lastName || b.name?.maidenName || b.maidenName || '').trim();
        const normA = normalizeUkrainianSurnameGender(surA) || surA;
        const normB = normalizeUkrainianSurnameGender(surB) || surB;
        comparison = normA.localeCompare(normB, 'uk', { sensitivity: 'base' });
        if (comparison === 0) {
          comparison = surA.localeCompare(surB, 'uk', { sensitivity: 'base' });
        }
        if (comparison === 0) {
          const givA = (a.name?.given || a.firstName || '').trim();
          const givB = (b.name?.given || b.firstName || '').trim();
          comparison = givA.localeCompare(givB, 'uk', { sensitivity: 'base' });
        }
      } else if (sortBy === 'birth') {
        const yA = Number(a.birthYear) || 0;
        const yB = Number(b.birthYear) || 0;
        comparison = yA - yB;
      } else if (sortBy === 'events') {
        comparison = (a.events?.length || 0) - (b.events?.length || 0);
      } else if (sortBy === 'citations') {
        comparison = (a.citations?.length || 0) - (b.citations?.length || 0);
      } else if (sortBy === 'tag') {
        const tagA = (a.tags && a.tags.length > 0) ? a.tags[0] : 'яяя';
        const tagB = (b.tags && b.tags.length > 0) ? b.tags[0] : 'яяя';
        comparison = tagA.localeCompare(tagB, 'uk');
      } else if (sortBy === 'tagCount') {
        comparison = (b.tags?.length || 0) - (a.tags?.length || 0);
      }
      return sortAsc ? comparison : -comparison;
    });
  }, [personsList, sortBy, sortAsc]);

  const handleTagBadgeClick = (tag: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const clean = tag.replace(/^#+/, '');
    if (tagFilter.toLowerCase().replace(/^#+/, '') === clean.toLowerCase()) {
      setTagFilter('ALL');
    } else {
      setTagFilter(clean);
    }
  };

  return (
    <div className={`max-w-7xl mx-auto px-4 py-6 space-y-6 ${theme.textPrimary}`}>
      {/* Top Header & Search Bar */}
      <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-xl p-4 shadow-xs space-y-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className={`text-xl font-bold tracking-tight ${theme.textPrimary}`}>Особи бази даних</h1>
            <p className={`text-xs ${theme.textMuted} mt-0.5`}>
              Всього знайдено {sortedPersons.length} з {Object.keys(database.persons).length} записів
            </p>
          </div>
          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={() => useUIStore.getState().setRodovidView('duplicates')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Перевірити дублікати та об'єднати повтори"
            >
              <GitMerge className="w-3.5 h-3.5" />
              <span>Перевірити дублікати</span>
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={onOpenAddPerson}
                id="rodovid-add-person-btn"
                className="px-3.5 py-2 rounded-xl bg-[#B88E3E] hover:bg-[#A37B30] text-white font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md shrink-0 active:scale-95"
                title="Додати особу"
                aria-label="Додати особу"
              >
                <UserPlus className="w-4 h-4 text-white stroke-[2.2]" />
                <span>Додати особу</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile-Only Collapsible Filter Toggle Header */}
        <div className="md:hidden flex items-center justify-between gap-2 pt-2 border-t border-slate-700/40">
          <button
            type="button"
            id="toggle-mobile-rodovid-persons-filters-btn"
            onClick={() => setIsFiltersCollapsed(!isFiltersCollapsed)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-xs"
            title={isFiltersCollapsed ? 'Розгорнути список фільтрів та сортування' : 'Згорнути список фільтрів'}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{isFiltersCollapsed ? 'Розгорнути фільтри' : 'Згорнути фільтри'}</span>
            {activeFiltersCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-bold">
                {activeFiltersCount}
              </span>
            )}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isFiltersCollapsed ? '' : 'rotate-180'}`} />
          </button>

          {/* Compact Quick Search when collapsed on mobile */}
          {isFiltersCollapsed && (
            <div className="relative flex-1 min-w-0">
              <Search className={`w-3.5 h-3.5 ${theme.textMuted} absolute left-2.5 top-1/2 -translate-y-1/2`} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Швидкий пошук..."
                className={`w-full pl-7 pr-3 py-1 ${theme.inputBg} border ${theme.inputBorder} rounded-lg text-xs ${theme.textPrimary} placeholder:text-neutral-400 focus:outline-none focus:border-emerald-500`}
              />
            </div>
          )}
        </div>

        {/* Filters and Search: Compact rows fitting text width */}
        <div className={`flex flex-col gap-2 pt-2 border-t ${theme.borderSubtle} ${isFiltersCollapsed ? 'hidden md:flex' : 'flex'}`}>
          {/* Row 1: Search + Clan + Tag + Research Status + Metric Search Status */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="flex-1 min-w-[200px] relative">
              <Search className={`w-4 h-4 ${theme.textMuted} absolute left-3 top-1/2 -translate-y-1/2`} />
              <input
                type="text"
                placeholder="Пошук за ПІБ, родом, #хештегом..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-9 pr-3 py-2 ${theme.inputBg} border ${theme.inputBorder} rounded-lg text-xs ${theme.textPrimary} placeholder:text-neutral-400 focus:outline-none focus:border-emerald-500`}
              />
            </div>

            {/* Clan / Rod Filter Dropdown */}
            <div className="w-auto shrink-0">
              <select
                value={personClanFilter || 'ALL'}
                onChange={(e) => setPersonClanFilter(e.target.value === 'ALL' ? null : e.target.value)}
                className={`px-2.5 py-2 ${theme.inputBg} border ${
                  personClanFilter ? 'border-amber-500 ring-1 ring-amber-500/20 text-amber-500' : theme.inputBorder
                } rounded-lg text-xs ${theme.textPrimary} focus:outline-none focus:border-amber-500 cursor-pointer`}
              >
                <option value="ALL">Всі роди ({availableClans.length})</option>
                {availableClans.map((clan) => (
                  <option key={clan.id} value={clan.id}>
                    {clan.name} ({clan.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Tag / Hashtag Filter Dropdown */}
            <div className="w-auto shrink-0">
              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className={`px-2.5 py-2 ${theme.inputBg} border ${
                  tagFilter !== 'ALL' ? 'border-emerald-500 ring-1 ring-emerald-500/20' : theme.inputBorder
                } rounded-lg text-xs ${theme.textPrimary} focus:outline-none focus:border-emerald-500 cursor-pointer`}
              >
                <option value="ALL">Всі хештеги ({availableHashtags.length})</option>
                {availableHashtags.map((h) => (
                  <option key={h.tag} value={h.tag}>
                    #{h.tag} ({h.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Research Status Filter */}
            <div className="w-auto shrink-0">
              <select
                value={researchStatusFilter}
                onChange={(e) => setResearchStatusFilter(e.target.value as any)}
                className={`px-2.5 py-2 ${theme.inputBg} border ${
                  researchStatusFilter !== 'ALL' ? 'border-emerald-500 ring-1 ring-emerald-500/20' : theme.inputBorder
                } rounded-lg text-xs ${theme.textPrimary} focus:outline-none focus:border-emerald-500 cursor-pointer`}
              >
                <option value="ALL">Статус: Всі</option>
                <option value="CONFIRMED">Підтверджена</option>
                <option value="HYPOTHESIS">Гіпотеза</option>
              </select>
            </div>

            {/* Metric Search Status Filter */}
            <div className="w-auto shrink-0">
              <select
                value={metricSearchStatusFilter}
                onChange={(e) => setMetricSearchStatusFilter(e.target.value as any)}
                className={`px-2.5 py-2 ${theme.inputBg} border ${
                  metricSearchStatusFilter !== 'ALL' ? 'border-amber-500 ring-1 ring-amber-500/30' : theme.inputBorder
                } rounded-lg text-xs ${theme.textPrimary} focus:outline-none focus:border-amber-500 cursor-pointer`}
                title="Фільтр за статусом пошуку метрик та архівних документів"
              >
                <option value="ALL">📜 Метрики: Всі</option>
                {METRIC_SEARCH_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.icon} {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Gender + Life State + Sort By + Direction + View Mode */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Gender Filter */}
            <div className="w-auto shrink-0">
              <select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value as any)}
                className={`px-2.5 py-2 ${theme.inputBg} border ${theme.inputBorder} rounded-lg text-xs ${theme.textPrimary} focus:outline-none focus:border-emerald-500 cursor-pointer`}
              >
                <option value="ALL">Будь-яка стать</option>
                <option value="M">Чоловіча стать</option>
                <option value="F">Жіноча стать</option>
                <option value="U">Не вказано</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="w-auto shrink-0">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className={`px-2.5 py-2 ${theme.inputBg} border ${theme.inputBorder} rounded-lg text-xs ${theme.textPrimary} focus:outline-none focus:border-emerald-500 cursor-pointer`}
              >
                <option value="ALL">Будь-який стан</option>
                <option value="LIVING">Нині живі</option>
                <option value="DECEASED">Померлі</option>
              </select>
            </div>

            {/* Sort Select */}
            <div className="flex items-center gap-1.5 w-auto shrink-0">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className={`px-2.5 py-2 ${theme.inputBg} border ${theme.inputBorder} rounded-lg text-xs ${theme.textPrimary} focus:outline-none focus:border-emerald-500 cursor-pointer`}
              >
                <option value="surname">За прізвищем</option>
                <option value="tag">За хештегом (А-Я)</option>
                <option value="tagCount">За к-стю тегів</option>
                <option value="birth">За датою нар.</option>
                <option value="events">За подіями</option>
                <option value="citations">За джерелами</option>
              </select>

              <button
                type="button"
                onClick={() => setSortAsc(!sortAsc)}
                className={`p-2 shrink-0 ${theme.inputBg} border ${theme.inputBorder} rounded-lg ${theme.textSecondary} hover:${theme.textPrimary} cursor-pointer transition-colors`}
                title={sortAsc ? 'За зростанням' : 'За спаданням'}
              >
                <ArrowUpDown className="w-4 h-4" />
              </button>
            </div>

            {/* View Mode Toggle (Table / Cards) */}
            <div className="ml-auto flex items-center shrink-0">
              <div className={`flex border ${theme.borderSubtle} rounded-lg overflow-hidden ${theme.surfaceBg} shrink-0`}>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`p-2 cursor-pointer transition-colors ${viewMode === 'table' ? 'bg-emerald-600 text-white' : `${theme.textMuted} hover:${theme.textPrimary}`}`}
                  title="Таблиця"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`p-2 cursor-pointer transition-colors ${viewMode === 'cards' ? 'bg-emerald-600 text-white' : `${theme.textMuted} hover:${theme.textPrimary}`}`}
                  title="Картки"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Hashtags Horizontal Pills Bar */}
        {availableHashtags.length > 0 && (
          <div className={`pt-2.5 border-t ${theme.borderSubtle} flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none`}>
            <span className={`text-[11px] font-semibold ${theme.textMuted} flex items-center gap-1 shrink-0 mr-1`}>
              <Hash className="w-3.5 h-3.5 text-emerald-500" />
              Хештеги:
            </span>

            <button
              type="button"
              onClick={() => setTagFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all shrink-0 cursor-pointer ${
                tagFilter === 'ALL'
                  ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                  : `${theme.surfaceBg} ${theme.textSecondary} hover:${theme.textPrimary} border ${theme.borderSubtle}`
              }`}
            >
              Всі ({database.persons ? Object.keys(database.persons).length : 0})
            </button>

            {availableHashtags.map((h) => {
              const isSelected = tagFilter.toLowerCase().replace(/^#+/, '') === h.tag.toLowerCase().replace(/^#+/, '');
              return (
                <button
                  key={h.tag}
                  type="button"
                  onClick={() => setTagFilter(isSelected ? 'ALL' : h.tag)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                      : `${theme.surfaceBg} ${theme.textSecondary} hover:${theme.textPrimary} border ${theme.borderSubtle}`
                  }`}
                >
                  <span>#{h.tag}</span>
                  <span className={`text-[10px] opacity-75 ${isSelected ? 'text-white' : theme.textMuted}`}>
                    {h.count}
                  </span>
                  {isSelected && <X className="w-3 h-3 ml-0.5" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Content: Table or Cards */}
      {sortedPersons.length === 0 ? (
        <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-xl p-12 text-center`}>
          <User className={`w-12 h-12 ${theme.textMuted} mx-auto mb-3`} />
          <h3 className={`text-base font-semibold ${theme.textPrimary}`}>Осіб не знайдено</h3>
          <p className={`text-xs ${theme.textMuted} max-w-sm mx-auto mt-1 mb-4`}>
            Спробуйте змінити пошуковий запит або скинути фільтри.
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              setPersonClanFilter(null);
              setGenderFilter('ALL');
              setStatusFilter('ALL');
              setResearchStatusFilter('ALL');
              setMetricSearchStatusFilter('ALL');
              setTagFilter('ALL');
            }}
            className={`px-3.5 py-1.5 ${theme.surfaceBg} hover:brightness-110 ${theme.textPrimary} border ${theme.borderSubtle} rounded-lg text-xs font-medium transition-colors cursor-pointer`}
          >
            Скинути фільтри
          </button>
        </div>
      ) : viewMode === 'table' ? (
        <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-xl overflow-hidden shadow-xs`}>
          <div className="overflow-x-auto">
            <table className={`w-full min-w-[680px] text-left text-xs ${theme.textSecondary}`}>
              <thead className={`${theme.surfaceBg} ${theme.textMuted} font-semibold border-b ${theme.borderSubtle} uppercase tracking-wider text-[10px]`}>
                <tr>
                  <th className="py-3 px-4">ПІБ / Особа</th>
                  <th className="py-3 px-4">Стать</th>
                  <th className="py-3 px-4">Роки життя</th>
                  <th className="py-3 px-4">Дослідження</th>
                  <th className="py-3 px-4">Метрики / Пошук</th>
                  <th className="py-3 px-4">Місце народження</th>
                  <th className="py-3 px-4">Професія / Статус</th>
                  <th className="py-3 px-4 text-center">Подій</th>
                  <th className="py-3 px-4 text-center">Джерел</th>
                  <th className="py-3 px-4 text-right">Дії</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${theme.borderSubtle}`}>
                {sortedPersons.map((rawP, pIdx) => {
                  const isLiving = isPersonLiving(rawP);
                  const isMasked = !isWhitelisted && isLiving;
                  const p = isMasked ? getPrivacySafePerson(rawP, false) : rawP;

                  const isMale = isPersonMale(p, database);
                  const isFemale = isPersonFemale(p, database);

                  return (
                    <tr
                      key={`${p.id}_${pIdx}`}
                      onClick={() => onSelectPerson(p.id)}
                      className={`hover:bg-neutral-500/5 cursor-pointer transition-colors`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {isMasked ? (
                            <div
                              className={`w-9 h-9 rounded-lg flex items-center justify-center border ${
                                isDark
                                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              }`}
                              title="Дані захищено"
                            >
                              <Lock className="w-4 h-4" />
                            </div>
                          ) : p.avatarUrl ? (
                            <img
                              src={p.avatarUrl}
                              alt=""
                              className={`w-9 h-9 rounded-lg object-cover border ${theme.borderSubtle}`}
                            />
                          ) : (
                            <div
                              className={`w-9 h-9 rounded-lg flex items-center justify-center border ${
                                isDark
                                  ? isMale
                                    ? 'bg-blue-950/60 border-blue-800 text-blue-300'
                                    : isFemale
                                    ? 'bg-rose-950/60 border-rose-800 text-rose-300'
                                    : 'bg-slate-800 border-slate-700 text-slate-400'
                                  : isMale
                                  ? 'bg-sky-50 border-sky-200 text-sky-700'
                                  : isFemale
                                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                                  : 'bg-neutral-100 border-neutral-300 text-neutral-600'
                              }`}
                            >
                              <User className="w-4 h-4" />
                            </div>
                          )}
                          <div>
                            <div className={`font-semibold ${theme.textPrimary} flex items-center gap-1.5`}>
                              <span>{isMasked ? 'Скрито Скрито' : getFullName(p)}</span>
                              {isMasked && (
                                <span className="text-[10px] px-1.5 py-0.2 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded font-normal flex items-center gap-1">
                                  <Shield className="w-2.5 h-2.5" /> Скрито
                                </span>
                              )}
                              {!isMasked && p.name?.prefix && (
                                <span className={`text-[10px] px-1.5 py-0.2 ${isDark ? 'bg-slate-800 text-amber-300' : 'bg-amber-100 text-amber-800'} rounded font-normal`}>
                                  {p.name.prefix}
                                </span>
                              )}
                            </div>
                            <div className={`text-[10px] ${theme.textMuted} font-mono flex items-center gap-1.5 flex-wrap`}>
                              <span>{isMasked ? '🔒 Конфіденційна жива особа' : `ID: ${p.id}${(p.name?.maidenName || p.maidenName) ? ` • / ${p.name?.maidenName || p.maidenName}` : ''}`}</span>
                              {!isMasked && (() => {
                                const rawRod = getPersonRodName(p);
                                const clanBadge = rawRod && rawRod !== 'Рід' ? formatClanName(rawRod) : null;
                                if (!clanBadge) return null;
                                return (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPersonClanFilter(rawRod);
                                    }}
                                    className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-500/15 hover:bg-amber-500/30 text-amber-500 border border-amber-500/30 transition-colors cursor-pointer font-sans"
                                    title={`Фільтрувати за: ${clanBadge}`}
                                  >
                                    {clanBadge}
                                  </button>
                                );
                              })()}
                              {!isMasked && p.researchBranch && p.researchBranch !== "Без прив'язки" && (
                                <span
                                  className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-0.5"
                                  title={`Гілка дослідження: ${p.researchBranch}`}
                                >
                                  <GitFork className="w-2.5 h-2.5" />
                                  <span>{p.researchBranch}</span>
                                </span>
                              )}
                              {!isMasked && p.tags && p.tags.length > 0 && (
                                <div className="inline-flex items-center gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
                                  {p.tags.map((t, idx) => {
                                    const isCurrent = tagFilter.toLowerCase().replace(/^#+/, '') === t.toLowerCase().replace(/^#+/, '');
                                    return (
                                      <button
                                        key={idx}
                                        type="button"
                                        onClick={(e) => handleTagBadgeClick(t, e)}
                                        className={`px-1.5 py-0.2 rounded text-[9px] font-medium transition-colors cursor-pointer ${
                                          isCurrent
                                            ? 'bg-emerald-600 text-white font-semibold'
                                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                        }`}
                                        title={`Фільтрувати за #${t.replace(/^#+/, '')}`}
                                      >
                                        #{t.replace(/^#+/, '')}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${
                            isDark
                              ? isMale
                                ? 'bg-blue-950 text-blue-300 border border-blue-800/60'
                                : isFemale
                                ? 'bg-rose-950 text-rose-300 border border-rose-800/60'
                                : 'bg-slate-800 text-slate-400'
                              : isMale
                              ? 'bg-sky-50 text-sky-800 border border-sky-200'
                              : isFemale
                              ? 'bg-rose-50 text-rose-800 border border-rose-200'
                              : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                          }`}
                        >
                          {isMale ? 'Чол' : isFemale ? 'Жін' : '—'}
                        </span>
                      </td>

                      <td className={`py-3 px-4 font-mono ${theme.textPrimary}`}>
                        {isMasked ? '🔒 Скрито' : `${p.birthYear || '?'} — ${p.isLiving ? 'живий' : p.deathYear || '?'}`}
                      </td>

                      <td className="py-3 px-4 relative" onClick={(e) => e.stopPropagation()}>
                        {isMasked ? (
                          <span className={theme.textMuted}>—</span>
                        ) : isAdmin ? (
                          <div className="relative inline-flex items-center">
                            <button
                              type="button"
                              onClick={(e) => handleToggleResearchStatus(p, e)}
                              className={`group inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer shadow-xs ${
                                isPersonHypothesis(p)
                                  ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-500 dark:text-amber-400 border-amber-500/40 hover:border-amber-500/80 hover:scale-[1.03] active:scale-95'
                                  : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 hover:border-emerald-500/80 hover:scale-[1.03] active:scale-95'
                              }`}
                              title={`Статус: ${isPersonHypothesis(p) ? 'Гіпотеза' : 'Підтверджена особа'}. Натисніть, щоб змінити на «${isPersonHypothesis(p) ? 'Підтверджена особа' : 'Гіпотеза'}» (доступно адміністратору)`}
                            >
                              {isPersonHypothesis(p) ? (
                                <>
                                  <HelpCircle className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 group-hover:rotate-12 transition-transform shrink-0" />
                                  <span>Гіпотеза</span>
                                  <ArrowUpDown className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100 transition-opacity ml-0.5 text-amber-500 dark:text-amber-400 shrink-0" />
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform shrink-0" />
                                  <span>Підтверджена особа</span>
                                  <ArrowUpDown className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100 transition-opacity ml-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                </>
                              )}
                            </button>

                            {/* Dropdown trigger */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setStatusMenuPersonId(statusMenuPersonId === p.id ? null : p.id);
                              }}
                              className="ml-1 p-1 rounded-full hover:bg-neutral-500/20 text-neutral-400 hover:text-neutral-200 transition-all cursor-pointer"
                              title="Вибрати статус зі списку (тільки для адміна)"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>

                            {/* Dropdown Menu */}
                            {statusMenuPersonId === p.id && (
                              <div
                                className={`absolute left-0 top-full mt-1.5 z-40 min-w-[210px] rounded-xl shadow-2xl border p-1.5 backdrop-blur-md ${
                                  isDark ? 'bg-neutral-900/98 border-neutral-700 text-neutral-200' : 'bg-white/98 border-neutral-200 text-neutral-800 shadow-neutral-300/60'
                                }`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="px-2 py-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider border-b border-neutral-500/20 mb-1">
                                  Змінити статус (Адмін)
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => handleSetResearchStatus(p, 'confirmed', e)}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
                                    !isPersonHypothesis(p)
                                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold'
                                      : 'hover:bg-neutral-500/10 text-neutral-700 dark:text-neutral-300'
                                  }`}
                                >
                                  <span className="flex items-center gap-2">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                    <span>Підтверджена особа</span>
                                  </span>
                                  {!isPersonHypothesis(p) && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => handleSetResearchStatus(p, 'hypothetical', e)}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer mt-0.5 ${
                                    isPersonHypothesis(p)
                                      ? 'bg-amber-500/15 text-amber-500 dark:text-amber-400 font-bold'
                                      : 'hover:bg-neutral-500/10 text-neutral-700 dark:text-neutral-300'
                                  }`}
                                >
                                  <span className="flex items-center gap-2">
                                    <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
                                    <span>Гіпотеза</span>
                                  </span>
                                  {isPersonHypothesis(p) && <Check className="w-3.5 h-3.5 text-amber-500" />}
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Non-admin: static badge */
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold cursor-default select-none ${
                              isPersonHypothesis(p)
                                ? 'bg-amber-500/15 text-amber-500 dark:text-amber-400 border border-amber-500/30'
                                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            }`}
                            title={`Статус дослідження: ${isPersonHypothesis(p) ? 'Гіпотеза' : 'Підтверджена особа'} (зміна доступна лише адміністратору)`}
                          >
                            {isPersonHypothesis(p) ? (
                              <>
                                <HelpCircle className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                                <span>Гіпотеза</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                <span>Підтверджена особа</span>
                              </>
                            )}
                          </span>
                        )}
                      </td>

                      {/* Metric Search Status Column */}
                      <td className="py-3 px-4 relative" onClick={(e) => e.stopPropagation()}>
                        {isMasked ? (
                          <span className={theme.textMuted}>—</span>
                        ) : (() => {
                          const mStatus = getMetricSearchStatus(p);
                          const mCfg = getMetricStatusConfig(mStatus);
                          return (
                            <div className="relative inline-flex items-center">
                              <button
                                type="button"
                                onClick={(e) => {
                                  if (!canEdit) return;
                                  e.stopPropagation();
                                  setMetricMenuPersonId(metricMenuPersonId === p.id ? null : p.id);
                                }}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer shadow-xs ${
                                  isDark ? mCfg.badgeClassDark : mCfg.badgeClass
                                } ${canEdit ? 'hover:scale-[1.03] active:scale-95' : 'cursor-default'}`}
                                title={`Пошук метрик: ${mCfg.label} — ${mCfg.description}${canEdit ? ' (натисніть, щоб змінити)' : ''}`}
                              >
                                <span className={`w-2 h-2 rounded-full ${mCfg.dotClass} shrink-0`} />
                                <span className="truncate max-w-[130px]">{mCfg.shortLabel}</span>
                                {canEdit && (
                                  <ChevronDown className="w-2.5 h-2.5 opacity-60 ml-0.5 shrink-0" />
                                )}
                              </button>

                              {/* Metric Dropdown Menu */}
                              {canEdit && metricMenuPersonId === p.id && (
                                <div
                                  className={`absolute left-0 top-full mt-1.5 z-40 min-w-[240px] rounded-xl shadow-2xl border p-1.5 backdrop-blur-md ${
                                    isDark ? 'bg-neutral-900/98 border-neutral-700 text-neutral-200' : 'bg-white/98 border-neutral-200 text-neutral-800 shadow-neutral-300/60'
                                  }`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="px-2 py-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider border-b border-neutral-500/20 mb-1">
                                    Статус пошуку метрик
                                  </div>
                                  {METRIC_SEARCH_STATUS_OPTIONS.map((opt) => {
                                    const isCurrent = mStatus === opt.id;
                                    return (
                                      <button
                                        key={opt.id}
                                        type="button"
                                        onClick={(e) => handleSetMetricSearchStatus(p, opt.id, e)}
                                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
                                          isCurrent
                                            ? 'bg-amber-500/15 text-amber-500 dark:text-amber-400 font-bold'
                                            : 'hover:bg-neutral-500/10 text-neutral-700 dark:text-neutral-300'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className={`w-2 h-2 rounded-full ${opt.dotClass}`} />
                                          <div>{opt.label}</div>
                                        </div>
                                        {isCurrent && <Check className="w-3.5 h-3.5 text-amber-500 ml-2" />}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      <td className={`py-3 px-4 ${theme.textMuted} max-w-[160px] truncate`}>
                        {isMasked ? '🔒 Скрито' : (p.birthPlace || '—')}
                      </td>

                      <td className={`py-3 px-4 ${theme.textSecondary} max-w-[180px] truncate`}>
                        {isMasked ? '🔒 Скрито' : (p.occupation || '—')}
                      </td>

                      <td className={`py-3 px-4 text-center font-mono ${theme.textMuted}`}>
                        {isMasked ? '—' : (p.events?.length || 0)}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {isMasked ? (
                          <span className={theme.textMuted}>—</span>
                        ) : p.citations && p.citations.length > 0 ? (
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 ${
                            isDark ? 'bg-amber-950/60 text-amber-300 border-amber-800/60' : 'bg-amber-100 text-amber-900 border-amber-300'
                          } border rounded text-[10px] font-mono`}>
                            <BookOpen className="w-3 h-3" />
                            {p.citations.length}
                          </span>
                        ) : (
                          <span className={theme.textMuted}>—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => onChangeRoot(p.id)}
                            className={`p-1.5 ${theme.textMuted} hover:text-emerald-500 hover:bg-neutral-500/10 rounded transition-colors cursor-pointer`}
                            title="Зробити коренем дерева"
                          >
                            <GitFork className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onOpenKinshipWith(p.id)}
                            className={`p-1.5 ${theme.textMuted} hover:text-cyan-500 hover:bg-neutral-500/10 rounded transition-colors cursor-pointer`}
                            title="Розрахувати спорідненість"
                          >
                            <Compass className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setReportPersonId(p.id)}
                            className={`p-1.5 ${theme.textMuted} hover:text-sky-400 hover:bg-neutral-500/10 rounded transition-colors cursor-pointer`}
                            title="Згенерувати короткий звіт (PDF / TXT)"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          {canEdit && !isMasked && (
                            <>
                              <button
                                onClick={() => onEditPerson(p.id)}
                                className={`p-1.5 ${theme.textMuted} hover:text-amber-500 hover:bg-neutral-500/10 rounded transition-colors cursor-pointer`}
                                title="Редагувати"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setPersonToDelete(rawP);
                                }}
                                className={`p-1.5 ${theme.textMuted} hover:text-rose-500 hover:bg-neutral-500/10 rounded transition-colors cursor-pointer`}
                                title="Видалити"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedPersons.map((rawP, pIdx) => {
            const isLiving = isPersonLiving(rawP);
            const isMasked = !isWhitelisted && isLiving;
            const p = isMasked ? getPrivacySafePerson(rawP, false) : rawP;

            const isMale = isPersonMale(p, database);
            const isFemale = isPersonFemale(p, database);

            return (
              <div
                key={`${p.id}_${pIdx}`}
                onClick={() => onSelectPerson(p.id)}
                className={`${theme.cardBg} border ${theme.cardBorder} rounded-xl p-4 hover:border-emerald-500/60 cursor-pointer shadow-xs transition-all flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-start gap-3">
                    {isMasked ? (
                      <div
                        className={`w-14 h-14 rounded-lg flex items-center justify-center border shrink-0 ${
                          isDark
                            ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        }`}
                        title="Дані захищено"
                      >
                        <Lock className="w-6 h-6" />
                      </div>
                    ) : p.avatarUrl ? (
                      <img
                        src={p.avatarUrl}
                        alt=""
                        className={`w-14 h-14 rounded-lg object-cover border ${theme.borderSubtle} shrink-0`}
                      />
                    ) : (
                      <div
                        className={`w-14 h-14 rounded-lg flex items-center justify-center border shrink-0 ${
                          isDark
                            ? isMale
                              ? 'bg-blue-950/60 border-blue-800 text-blue-300'
                              : isFemale
                              ? 'bg-rose-950/60 border-rose-800 text-rose-300'
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                            : isMale
                            ? 'bg-sky-50 border-sky-200 text-sky-700'
                            : isFemale
                            ? 'bg-rose-50 border-rose-200 text-rose-700'
                            : 'bg-neutral-100 border-neutral-300 text-neutral-600'
                        }`}
                      >
                        <User className="w-6 h-6" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className={`font-semibold text-sm ${theme.textPrimary} truncate flex items-center gap-1.5`}>
                        <span>{isMasked ? 'Скрито Скрито' : getFullName(p)}</span>
                        {isMasked && (
                          <span className="text-[10px] px-1.5 py-0.2 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded font-normal flex items-center gap-1">
                            <Shield className="w-2.5 h-2.5" /> Скрито
                          </span>
                        )}
                      </h3>
                      {!isMasked && (p.name?.maidenName || p.maidenName) && (
                        <p className={`text-[11px] ${theme.textMuted} truncate`}>
                          / {p.name?.maidenName || p.maidenName}
                        </p>
                      )}
                      <div className={`flex items-center gap-1.5 text-xs ${theme.textMuted} font-mono mt-1`}>
                        <Calendar className={`w-3.5 h-3.5 ${theme.textMuted}`} />
                        <span>
                          {isMasked ? '🔒 Скрито (Жива особа)' : `${p.birthYear || '?'} — ${p.isLiving ? 'живий' : p.deathYear || '?'}`}
                        </span>
                      </div>

                      {!isMasked && (
                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
                          {(() => {
                            const rawRod = getPersonRodName(p);
                            const clanBadge = rawRod && rawRod !== 'Рід' ? formatClanName(rawRod) : null;
                            if (!clanBadge) return null;
                            return (
                              <button
                                type="button"
                                onClick={() => setPersonClanFilter(rawRod)}
                                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 hover:bg-amber-500/30 text-amber-500 border border-amber-500/30 transition-colors cursor-pointer font-sans"
                                title={`Фільтрувати за: ${clanBadge}`}
                              >
                                {clanBadge}
                              </button>
                            );
                          })()}
                          {p.researchBranch && p.researchBranch !== "Без прив'язки" && (
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-sans"
                              title={`Гілка дослідження: ${p.researchBranch}`}
                            >
                              <GitFork className="w-2.5 h-2.5" />
                              <span>{p.researchBranch}</span>
                            </span>
                          )}
                        </div>
                      )}

                      {!isMasked && (
                        <div className="mt-2 flex items-center gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
                          {isAdmin ? (
                            <button
                              type="button"
                              onClick={(e) => handleToggleResearchStatus(p, e)}
                              className={`group inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer shadow-xs ${
                                isPersonHypothesis(p)
                                  ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-500 dark:text-amber-400 border-amber-500/40 hover:border-amber-500/80 hover:scale-105 active:scale-95'
                                  : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 hover:border-emerald-500/80 hover:scale-105 active:scale-95'
                              }`}
                              title={`Статус: ${isPersonHypothesis(p) ? 'Гіпотеза' : 'Підтверджена особа'}. Натисніть для зміни на «${isPersonHypothesis(p) ? 'Підтверджена особа' : 'Гіпотеза'}» (доступно адміністратору)`}
                            >
                              {isPersonHypothesis(p) ? (
                                <>
                                  <HelpCircle className="w-3 h-3 text-amber-500 dark:text-amber-400 group-hover:rotate-12 transition-transform" />
                                  <span>Гіпотеза</span>
                                  <ArrowUpDown className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100 transition-opacity ml-0.5 text-amber-500 dark:text-amber-400" />
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                                  <span>Підтверджена особа</span>
                                  <ArrowUpDown className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100 transition-opacity ml-0.5 text-emerald-600 dark:text-emerald-400" />
                                </>
                              )}
                            </button>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-default select-none ${
                                isPersonHypothesis(p)
                                  ? 'bg-amber-500/15 text-amber-500 dark:text-amber-400 border border-amber-500/30'
                                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                              }`}
                              title={`Статус дослідження: ${isPersonHypothesis(p) ? 'Гіпотеза' : 'Підтверджена особа'} (зміна доступна лише адміністратору)`}
                            >
                              {isPersonHypothesis(p) ? (
                                <>
                                  <HelpCircle className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                                  <span>Гіпотеза</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  <span>Підтверджена особа</span>
                                </>
                              )}
                            </span>
                          )}

                          {/* Metric Search Status Badge in Card */}
                          {(() => {
                            const mStatus = getMetricSearchStatus(p);
                            const mCfg = getMetricStatusConfig(mStatus);
                            return (
                              <div className="relative inline-flex items-center">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    if (!canEdit) return;
                                    e.stopPropagation();
                                    setMetricMenuPersonId(metricMenuPersonId === p.id ? null : p.id);
                                  }}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer shadow-xs ${
                                    isDark ? mCfg.badgeClassDark : mCfg.badgeClass
                                  } ${canEdit ? 'hover:scale-105 active:scale-95' : 'cursor-default'}`}
                                  title={`Метрики: ${mCfg.label} — ${mCfg.description}${canEdit ? ' (натисніть для зміни)' : ''}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${mCfg.dotClass} shrink-0`} />
                                  <span className="truncate max-w-[110px]">{mCfg.shortLabel}</span>
                                  {canEdit && <ChevronDown className="w-2.5 h-2.5 opacity-60 ml-0.5 shrink-0" />}
                                </button>

                                {canEdit && metricMenuPersonId === p.id && (
                                  <div
                                    className={`absolute left-0 top-full mt-1.5 z-40 min-w-[220px] rounded-xl shadow-2xl border p-1.5 backdrop-blur-md ${
                                      isDark ? 'bg-neutral-900/98 border-neutral-700 text-neutral-200' : 'bg-white/98 border-neutral-200 text-neutral-800 shadow-neutral-300/60'
                                    }`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="px-2 py-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider border-b border-neutral-500/20 mb-1">
                                      Статус пошуку метрик
                                    </div>
                                    {METRIC_SEARCH_STATUS_OPTIONS.map((opt) => {
                                      const isCurrent = mStatus === opt.id;
                                      return (
                                        <button
                                          key={opt.id}
                                          type="button"
                                          onClick={(e) => handleSetMetricSearchStatus(p, opt.id, e)}
                                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
                                            isCurrent
                                              ? 'bg-amber-500/15 text-amber-500 dark:text-amber-400 font-bold'
                                              : 'hover:bg-neutral-500/10 text-neutral-700 dark:text-neutral-300'
                                          }`}
                                        >
                                          <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${opt.dotClass}`} />
                                            <div>{opt.label}</div>
                                          </div>
                                          {isCurrent && <Check className="w-3.5 h-3.5 text-amber-500 ml-2" />}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>

                  {!isMasked && p.occupation && (
                    <p className={`text-xs ${theme.textSecondary} mt-3 line-clamp-2`}>{p.occupation}</p>
                  )}

                  {!isMasked && p.birthPlace && (
                    <div className={`flex items-center gap-1.5 text-[11px] ${theme.textMuted} mt-2`}>
                      <MapPin className={`w-3 h-3 ${theme.textMuted} shrink-0`} />
                      <span className="truncate">{p.birthPlace}</span>
                    </div>
                  )}

                  {isMasked && (
                    <p className={`text-xs ${theme.textMuted} mt-3 italic`}>
                      🔒 Інформація про живу особу прихована згідно з налаштуваннями конфіденційності.
                    </p>
                  )}

                  {!isMasked && p.tags && p.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2.5" onClick={(e) => e.stopPropagation()}>
                      {p.tags.map((t, idx) => {
                        const isCurrent = tagFilter.toLowerCase().replace(/^#+/, '') === t.toLowerCase().replace(/^#+/, '');
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={(e) => handleTagBadgeClick(t, e)}
                            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                              isCurrent
                                ? 'bg-emerald-600 text-white font-semibold'
                                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            }`}
                            title={`Фільтрувати за #${t.replace(/^#+/, '')}`}
                          >
                            #{t.replace(/^#+/, '')}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className={`flex items-center justify-between border-t ${theme.borderSubtle} pt-3 mt-4`}>
                  <span className={`text-[10px] ${theme.textMuted} font-mono`}>{isMasked ? 'ID: ***' : `ID: ${p.id}`}</span>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onChangeRoot(p.id)}
                      className={`p-1.5 ${theme.textMuted} hover:text-emerald-500 hover:bg-neutral-500/10 rounded cursor-pointer`}
                      title="Корінь дерева"
                    >
                      <GitFork className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onOpenKinshipWith(p.id)}
                      className={`p-1.5 ${theme.textMuted} hover:text-cyan-500 hover:bg-neutral-500/10 rounded cursor-pointer`}
                      title="Спорідненість"
                    >
                      <Compass className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setReportPersonId(p.id)}
                      className={`p-1.5 ${theme.textMuted} hover:text-sky-400 hover:bg-neutral-500/10 rounded cursor-pointer`}
                      title="Згенерувати короткий звіт (PDF / TXT)"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                    {canEdit && !isMasked && (
                      <button
                        onClick={() => onEditPerson(p.id)}
                        className={`p-1.5 ${theme.textMuted} hover:text-amber-500 hover:bg-neutral-500/10 rounded cursor-pointer`}
                        title="Редагувати"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Confirm Delete Person Modal */}
      {personToDelete && (
        <ConfirmDeleteModal
          isOpen={!!personToDelete}
          title="Видалення особи"
          itemName={getFullName(personToDelete)}
          itemType="особу"
          message={`Ви дійсно бажаєте видалити особу «${getFullName(personToDelete)}» з родоводу?`}
          onConfirm={() => {
            if (personToDelete) {
              onDeletePerson(personToDelete.id);
              setPersonToDelete(null);
            }
          }}
          onClose={() => setPersonToDelete(null)}
          isPermanent={true}
        />
      )}

      {/* Person Report Modal */}
      {reportPersonId && (
        <PersonReportModal
          personId={reportPersonId}
          database={database}
          onClose={() => setReportPersonId(null)}
          onSelectPerson={(id) => {
            onSelectPerson(id);
            setReportPersonId(null);
          }}
        />
      )}

      {/* Floating Status Update Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-2.5 rounded-xl shadow-2xl border bg-neutral-900/95 border-neutral-700 text-neutral-100 text-xs font-medium backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast.message}</span>
          {toast.onAction && (
            <button
              type="button"
              onClick={() => {
                toast.onAction?.();
                setToast(null);
              }}
              className="ml-2 px-2.5 py-1 rounded bg-[#B88E3E] hover:bg-[#a37c33] text-black text-xs font-bold transition-all cursor-pointer"
            >
              {toast.actionText || 'Скасувати'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setToast(null)}
            className="p-1 text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
            title="Закрити"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
