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
  List
} from 'lucide-react';
import { GenealogyDatabase, Person, Gender } from '../../types/genealogy';
import { getFullName } from '../../utils/relationship';
import { useUIStore } from '../../../stores/useUIStore';
import { getThemeConfig } from '../../../utils/theme';

interface PersonsListViewProps {
  database: GenealogyDatabase;
  onSelectPerson: (id: string) => void;
  onEditPerson: (id: string) => void;
  onDeletePerson: (id: string) => void;
  onOpenAddPerson: () => void;
  onChangeRoot: (id: string) => void;
  onOpenKinshipWith: (id: string) => void;
}

export const PersonsListView: React.FC<PersonsListViewProps> = ({
  database,
  onSelectPerson,
  onEditPerson,
  onDeletePerson,
  onOpenAddPerson,
  onChangeRoot,
  onOpenKinshipWith
}) => {
  const themePalette = useUIStore((s) => s.themePalette);
  const theme = getThemeConfig(themePalette);
  const isDark = theme.category === 'dark';

  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState<'ALL' | Gender>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LIVING' | 'DECEASED'>('ALL');
  const [sortBy, setSortBy] = useState<'surname' | 'birth' | 'events' | 'citations'>('surname');
  const [sortAsc, setSortAsc] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const personsList = useMemo(() => {
    return (Object.values(database.persons) as Person[]).filter((p) => {
      // Search
      const fullName = getFullName(p).toLowerCase();
      const occu = (p.occupation || '').toLowerCase();
      const place = (p.birthPlace || p.deathPlace || '').toLowerCase();
      const tags = (p.tags || []).join(' ').toLowerCase();
      const q = searchTerm.toLowerCase().trim();

      const matchesSearch = !q || fullName.includes(q) || occu.includes(q) || place.includes(q) || tags.includes(q);

      // Gender filter
      const matchesGender = genderFilter === 'ALL' || p.gender === genderFilter;

      // Status filter
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'LIVING' && p.isLiving) ||
        (statusFilter === 'DECEASED' && !p.isLiving);

      return matchesSearch && matchesGender && matchesStatus;
    });
  }, [database.persons, searchTerm, genderFilter, statusFilter]);

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
      }
      return sortAsc ? comparison : -comparison;
    });
  }, [personsList, sortBy, sortAsc]);

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

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenAddPerson}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Додати особу</span>
            </button>
          </div>
        </div>

        {/* Filters and Search row */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t ${theme.borderSubtle}`}>
          {/* Search Input */}
          <div className="lg:col-span-2 relative">
            <Search className={`w-4 h-4 ${theme.textMuted} absolute left-3 top-1/2 -translate-y-1/2`} />
            <input
              type="text"
              placeholder="Пошук за ПІБ, професією, місцем, тегами..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 ${theme.inputBg} border ${theme.inputBorder} rounded-lg text-xs ${theme.textPrimary} placeholder:text-neutral-400 focus:outline-none focus:border-emerald-500`}
            />
          </div>

          {/* Gender Filter */}
          <div>
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value as any)}
              className={`w-full px-3 py-2 ${theme.inputBg} border ${theme.inputBorder} rounded-lg text-xs ${theme.textPrimary} focus:outline-none focus:border-emerald-500 cursor-pointer`}
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
              className={`w-full px-3 py-2 ${theme.inputBg} border ${theme.inputBorder} rounded-lg text-xs ${theme.textPrimary} focus:outline-none focus:border-emerald-500 cursor-pointer`}
            >
              <option value="ALL">Будь-який статус</option>
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
            }}
            className={`px-3.5 py-1.5 ${theme.surfaceBg} hover:brightness-110 ${theme.textPrimary} border ${theme.borderSubtle} rounded-lg text-xs font-medium transition-colors cursor-pointer`}
          >
            Скинути фільтри
          </button>
        </div>
      ) : viewMode === 'table' ? (
        <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-xl overflow-hidden shadow-xs`}>
          <div className="overflow-x-auto">
            <table className={`w-full text-left text-xs ${theme.textSecondary}`}>
              <thead className={`${theme.surfaceBg} ${theme.textMuted} font-semibold border-b ${theme.borderSubtle} uppercase tracking-wider text-[10px]`}>
                <tr>
                  <th className="py-3 px-4">ПІБ / Особа</th>
                  <th className="py-3 px-4">Стать</th>
                  <th className="py-3 px-4">Роки життя</th>
                  <th className="py-3 px-4">Місце народження</th>
                  <th className="py-3 px-4">Професія / Статус</th>
                  <th className="py-3 px-4 text-center">Подій</th>
                  <th className="py-3 px-4 text-center">Джерел</th>
                  <th className="py-3 px-4 text-right">Дії</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${theme.borderSubtle}`}>
                {sortedPersons.map((p) => {
                  const isMale = p.gender === 'M';
                  const isFemale = p.gender === 'F';

                  return (
                    <tr
                      key={p.id}
                      onClick={() => onSelectPerson(p.id)}
                      className={`hover:bg-neutral-500/5 cursor-pointer transition-colors`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {p.avatarUrl ? (
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
                              <span>{getFullName(p)}</span>
                              {p.name?.prefix && (
                                <span className={`text-[10px] px-1.5 py-0.2 ${isDark ? 'bg-slate-800 text-amber-300' : 'bg-amber-100 text-amber-800'} rounded font-normal`}>
                                  {p.name.prefix}
                                </span>
                              )}
                            </div>
                            <div className={`text-[10px] ${theme.textMuted} font-mono`}>
                              ID: {p.id}
                              {(p.name?.maidenName || p.maidenName) && ` • до шлюбу ${p.name?.maidenName || p.maidenName}`}
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
                        {p.birthYear || '?'} — {p.isLiving ? 'живий' : p.deathYear || '?'}
                      </td>

                      <td className={`py-3 px-4 ${theme.textMuted} max-w-[160px] truncate`}>
                        {p.birthPlace || '—'}
                      </td>

                      <td className={`py-3 px-4 ${theme.textSecondary} max-w-[180px] truncate`}>
                        {p.occupation || '—'}
                      </td>

                      <td className={`py-3 px-4 text-center font-mono ${theme.textMuted}`}>
                        {p.events?.length || 0}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {p.citations && p.citations.length > 0 ? (
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
                            onClick={() => onEditPerson(p.id)}
                            className={`p-1.5 ${theme.textMuted} hover:text-amber-500 hover:bg-neutral-500/10 rounded transition-colors cursor-pointer`}
                            title="Редагувати"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onDeletePerson(p.id);
                            }}
                            className={`p-1.5 ${theme.textMuted} hover:text-rose-500 hover:bg-neutral-500/10 rounded transition-colors cursor-pointer`}
                            title="Видалити"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
          {sortedPersons.map((p) => {
            const isMale = p.gender === 'M';
            const isFemale = p.gender === 'F';

            return (
              <div
                key={p.id}
                onClick={() => onSelectPerson(p.id)}
                className={`${theme.cardBg} border ${theme.cardBorder} rounded-xl p-4 hover:border-emerald-500/60 cursor-pointer shadow-xs transition-all flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-start gap-3">
                    {p.avatarUrl ? (
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
                      <h3 className={`font-semibold text-sm ${theme.textPrimary} truncate`}>
                        {getFullName(p)}
                      </h3>
                      {(p.name?.maidenName || p.maidenName) && (
                        <p className={`text-[11px] ${theme.textMuted} truncate`}>
                          до шлюбу {p.name?.maidenName || p.maidenName}
                        </p>
                      )}
                      <div className={`flex items-center gap-1.5 text-xs ${theme.textMuted} font-mono mt-1`}>
                        <Calendar className={`w-3.5 h-3.5 ${theme.textMuted}`} />
                        <span>
                          {p.birthYear || '?'} — {p.isLiving ? 'живий' : p.deathYear || '?'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {p.occupation && (
                    <p className={`text-xs ${theme.textSecondary} mt-3 line-clamp-2`}>{p.occupation}</p>
                  )}

                  {p.birthPlace && (
                    <div className={`flex items-center gap-1.5 text-[11px] ${theme.textMuted} mt-2`}>
                      <MapPin className={`w-3 h-3 ${theme.textMuted} shrink-0`} />
                      <span className="truncate">{p.birthPlace}</span>
                    </div>
                  )}

                  {p.tags && p.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2.5">
                      {p.tags.map((t, idx) => (
                        <span
                          key={idx}
                          className={`px-2 py-0.5 ${theme.surfaceBg} border ${theme.borderSubtle} ${theme.textSecondary} rounded text-[10px]`}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className={`flex items-center justify-between border-t ${theme.borderSubtle} pt-3 mt-4`}>
                  <span className={`text-[10px] ${theme.textMuted} font-mono`}>ID: {p.id}</span>
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
                      onClick={() => onEditPerson(p.id)}
                      className={`p-1.5 ${theme.textMuted} hover:text-amber-500 hover:bg-neutral-500/10 rounded cursor-pointer`}
                      title="Редагувати"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
