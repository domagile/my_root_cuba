import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  User,
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
  FileText
} from 'lucide-react';
import { GenealogyDatabase, Person, Gender } from '../../types/genealogy';
import { getFullName } from '../../utils/relationship';
import { useUIStore } from '../../../stores/useUIStore';
import { useAuthStore } from '../../../stores/useAuthStore';
import { isPersonLiving, getPrivacySafePerson, isUserWhitelisted } from '../../utils/privacy';
import { getThemeConfig } from '../../../utils/theme';
import { ConfirmDeleteModal } from '../../../components/common/ConfirmDeleteModal';
import { PersonReportModal } from '../../../components/common/PersonReportModal';
import { getTreeHashtagsWithCounts, formatHashtag } from '../../../utils/tagUtils';
import { isPersonMale, isPersonFemale, normalizeGender } from '../../utils/genderUtils';
import { isPersonHypothesis, isPersonConfirmed } from '../../../utils/researchStatusUtils';

interface PersonsListViewProps {
  database: GenealogyDatabase;
  isReadOnly?: boolean;
  onSelectPerson: (id: string) => void;
  onEditPerson: (id: string) => void;
  onDeletePerson: (id: string) => void;
  onOpenAddPerson: () => void;
  onChangeRoot: (id: string) => void;
  onOpenKinshipWith: (id: string) => void;
}

export const PersonsListView: React.FC<PersonsListViewProps> = ({
  database,
  isReadOnly = false,
  onSelectPerson,
  onEditPerson,
  onDeletePerson,
  onOpenAddPerson,
  onChangeRoot,
  onOpenKinshipWith
}) => {
  const currentUser = useAuthStore((s) => s.currentUser);
  const whitelist = useAuthStore((s) => s.whitelist);
  const isWhitelisted = useMemo(() => isUserWhitelisted(currentUser, whitelist), [currentUser, whitelist]);

  const canEdit = useMemo(() => {
    if (isReadOnly) return false;
    if (!currentUser || !isWhitelisted) return false;
    const entry = whitelist.find(
      (w) => w.email.toLowerCase() === currentUser.email.toLowerCase() && w.status === 'active'
    );
    return Boolean(entry && (entry.role === 'admin' || entry.role === 'editor'));
  }, [isReadOnly, currentUser, isWhitelisted, whitelist]);

  const themePalette = useUIStore((s) => s.themePalette);
  const theme = getThemeConfig(themePalette);
  const isDark = theme.category === 'dark';

  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState<'ALL' | Gender>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LIVING' | 'DECEASED'>('ALL');
  const [researchStatusFilter, setResearchStatusFilter] = useState<'ALL' | 'CONFIRMED' | 'HYPOTHESIS'>('ALL');
  const [tagFilter, setTagFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'surname' | 'birth' | 'events' | 'citations' | 'tag' | 'tagCount'>('surname');
  const [sortAsc, setSortAsc] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [personToDelete, setPersonToDelete] = useState<Person | null>(null);
  const [reportPersonId, setReportPersonId] = useState<string | null>(null);

  // Extract all tree hashtags with counts
  const availableHashtags = useMemo(() => {
    return getTreeHashtagsWithCounts(database.persons);
  }, [database.persons]);

  const personsList = useMemo(() => {
    return (Object.values(database.persons) as Person[]).filter((p) => {
      // Search
      const fullName = getFullName(p).toLowerCase();
      const occu = (p.occupation || '').toLowerCase();
      const place = (p.birthPlace || p.deathPlace || '').toLowerCase();
      const tags = (p.tags || []).join(' ').toLowerCase();
      const q = searchTerm.toLowerCase().trim();

      const searchTag = q.startsWith('#') ? q.slice(1).trim() : q;
      const matchesSearch =
        !q ||
        fullName.includes(q) ||
        occu.includes(q) ||
        place.includes(q) ||
        tags.includes(q) ||
        (searchTag && tags.includes(searchTag));

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

      // Tag filter
      const cleanFilterTag = tagFilter !== 'ALL' ? tagFilter.toLowerCase().replace(/^#+/, '') : null;
      const matchesTag =
        !cleanFilterTag ||
        (p.tags || []).some((t) => t.toLowerCase().replace(/^#+/, '') === cleanFilterTag);

      return matchesSearch && matchesGender && matchesStatus && matchesResearchStatus && matchesTag;
    });
  }, [database.persons, searchTerm, genderFilter, statusFilter, researchStatusFilter, tagFilter]);

  const sortedPersons = useMemo(() => {
    return [...personsList].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'surname') {
        const nameA = `${a.name?.surname || a.lastName || ''} ${a.name?.given || a.firstName || ''}`;
        const nameB = `${b.name?.surname || b.lastName || ''} ${b.name?.given || b.firstName || ''}`;
        comparison = nameA.localeCompare(nameB, 'uk');
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
        </div>

        {/* Filters and Search row */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2.5 pt-2 border-t ${theme.borderSubtle}`}>
          {/* Search Input */}
          <div className="lg:col-span-2 relative">
            <Search className={`w-4 h-4 ${theme.textMuted} absolute left-3 top-1/2 -translate-y-1/2`} />
            <input
              type="text"
              placeholder="Пошук за ПІБ, #хештегом, місцем..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 ${theme.inputBg} border ${theme.inputBorder} rounded-lg text-xs ${theme.textPrimary} placeholder:text-neutral-400 focus:outline-none focus:border-emerald-500`}
            />
          </div>

          {/* Tag / Hashtag Filter Dropdown */}
          <div>
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className={`w-full px-2.5 py-2 ${theme.inputBg} border ${
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
          <div>
            <select
              value={researchStatusFilter}
              onChange={(e) => setResearchStatusFilter(e.target.value as any)}
              className={`w-full px-2.5 py-2 ${theme.inputBg} border ${
                researchStatusFilter !== 'ALL' ? 'border-emerald-500 ring-1 ring-emerald-500/20' : theme.inputBorder
              } rounded-lg text-xs ${theme.textPrimary} focus:outline-none focus:border-emerald-500 cursor-pointer`}
            >
              <option value="ALL">Статус: Всі</option>
              <option value="CONFIRMED">Підтверджена особа</option>
              <option value="HYPOTHESIS">Гіпотеза</option>
            </select>
          </div>

          {/* Gender Filter */}
          <div>
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value as any)}
              className={`w-full px-2.5 py-2 ${theme.inputBg} border ${theme.inputBorder} rounded-lg text-xs ${theme.textPrimary} focus:outline-none focus:border-emerald-500 cursor-pointer`}
            >
              <option value="ALL">Будь-яка стать</option>
              <option value="M">Чоловіча стать</option>
              <option value="F">Жіноча стать</option>
              <option value="U">Не вказано</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className={`w-full px-2.5 py-2 ${theme.inputBg} border ${theme.inputBorder} rounded-lg text-xs ${theme.textPrimary} focus:outline-none focus:border-emerald-500 cursor-pointer`}
            >
              <option value="ALL">Будь-який стан</option>
              <option value="LIVING">Нині живі</option>
              <option value="DECEASED">Померлі</option>
            </select>
          </div>

          {/* Layout and Sort Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className={`w-full px-2.5 py-2 ${theme.inputBg} border ${theme.inputBorder} rounded-lg text-xs ${theme.textPrimary} focus:outline-none focus:border-emerald-500 cursor-pointer`}
              >
                <option value="surname">За прізвищем</option>
                <option value="tag">За хештегом (А-Я)</option>
                <option value="tagCount">За к-стю тегів</option>
                <option value="birth">За датою нар.</option>
                <option value="events">За подіями</option>
                <option value="citations">За джерелами</option>
              </select>
            </div>

            <button
              onClick={() => setSortAsc(!sortAsc)}
              className={`p-2 ${theme.inputBg} border ${theme.inputBorder} rounded-lg ${theme.textSecondary} hover:${theme.textPrimary} cursor-pointer`}
              title={sortAsc ? 'За зростанням' : 'За спаданням'}
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>

            <div className={`flex border ${theme.borderSubtle} rounded-lg overflow-hidden ${theme.surfaceBg}`}>
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 cursor-pointer ${viewMode === 'table' ? 'bg-emerald-600 text-white' : `${theme.textMuted} hover:${theme.textPrimary}`}`}
                title="Таблиця"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`p-2 cursor-pointer ${viewMode === 'cards' ? 'bg-emerald-600 text-white' : `${theme.textMuted} hover:${theme.textPrimary}`}`}
                title="Картки"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
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
              setGenderFilter('ALL');
              setStatusFilter('ALL');
              setResearchStatusFilter('ALL');
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
            <table className={`w-full min-w-[900px] text-left text-xs ${theme.textSecondary}`}>
              <thead className={`${theme.surfaceBg} ${theme.textMuted} font-semibold border-b ${theme.borderSubtle} uppercase tracking-wider text-[10px]`}>
                <tr>
                  <th className="py-3 px-4">ПІБ / Особа</th>
                  <th className="py-3 px-4">Стать</th>
                  <th className="py-3 px-4">Роки життя</th>
                  <th className="py-3 px-4">Статус дослідження</th>
                  <th className="py-3 px-4">Місце народження</th>
                  <th className="py-3 px-4">Професія / Статус</th>
                  <th className="py-3 px-4 text-center">Подій</th>
                  <th className="py-3 px-4 text-center">Джерел</th>
                  <th className="py-3 px-4 text-right">Дії</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${theme.borderSubtle}`}>
                {sortedPersons.map((rawP) => {
                  const isLiving = isPersonLiving(rawP);
                  const isMasked = !isWhitelisted && isLiving;
                  const p = isMasked ? getPrivacySafePerson(rawP, false) : rawP;

                  const isMale = isPersonMale(p, database);
                  const isFemale = isPersonFemale(p, database);

                  return (
                    <tr
                      key={p.id}
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

                      <td className="py-3 px-4">
                        {isMasked ? (
                          <span className={theme.textMuted}>—</span>
                        ) : isPersonHypothesis(p) ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            <HelpCircle className="w-3 h-3" />
                            <span>Гіпотеза</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Підтверджена особа</span>
                          </span>
                        )}
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
          {sortedPersons.map((rawP) => {
            const isLiving = isPersonLiving(rawP);
            const isMasked = !isWhitelisted && isLiving;
            const p = isMasked ? getPrivacySafePerson(rawP, false) : rawP;

            const isMale = isPersonMale(p, database);
            const isFemale = isPersonFemale(p, database);

            return (
              <div
                key={p.id}
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
                        <div className="mt-2 flex items-center gap-1.5">
                          {isPersonHypothesis(p) ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              <HelpCircle className="w-3 h-3" />
                              <span>Гіпотеза</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Підтверджена особа</span>
                            </span>
                          )}
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
    </div>
  );
};
