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
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Top Header & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Особи бази даних</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Всього знайдено {sortedPersons.length} з {Object.keys(database.persons).length} записів
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenAddPerson}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Додати особу</span>
            </button>
          </div>
        </div>

        {/* Filters and Search row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-800">
          {/* Search Input */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Пошук за ПІБ, професією, місцем, тегами..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Gender Filter */}
          <div>
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
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
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
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
                className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="surname">За прізвищем</option>
                <option value="birth">За датою нар.</option>
                <option value="events">За подіями</option>
                <option value="citations">За джерелами</option>
              </select>
            </div>

            <button
              onClick={() => setSortAsc(!sortAsc)}
              className="p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 hover:text-white"
              title={sortAsc ? 'За зростанням' : 'За спаданням'}
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>

            <div className="flex border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 ${viewMode === 'table' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                title="Таблиця"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`p-2 ${viewMode === 'cards' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
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
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
          <User className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-200">Осіб не знайдено</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            Спробуйте змінити пошуковий запит або скинути фільтри.
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              setGenderFilter('ALL');
              setStatusFilter('ALL');
            }}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
          >
            Скинути фільтри
          </button>
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
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
              <tbody className="divide-y divide-slate-800/60">
                {sortedPersons.map((p) => {
                  const isMale = p.gender === 'M';
                  const isFemale = p.gender === 'F';

                  return (
                    <tr
                      key={p.id}
                      onClick={() => onSelectPerson(p.id)}
                      className="hover:bg-slate-800/60 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {p.avatarUrl ? (
                            <img
                              src={p.avatarUrl}
                              alt=""
                              className="w-9 h-9 rounded-lg object-cover border border-slate-700"
                            />
                          ) : (
                            <div
                              className={`w-9 h-9 rounded-lg flex items-center justify-center border ${
                                isMale
                                  ? 'bg-blue-950/60 border-blue-800 text-blue-300'
                                  : isFemale
                                  ? 'bg-rose-950/60 border-rose-800 text-rose-300'
                                  : 'bg-slate-800 border-slate-700 text-slate-400'
                              }`}
                            >
                              <User className="w-4 h-4" />
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                              <span>{getFullName(p)}</span>
                              {p.name?.prefix && (
                                <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-amber-300 rounded font-normal">
                                  {p.name.prefix}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              ID: {p.id}
                              {(p.name?.maidenName || p.maidenName) && ` • до шлюбу ${p.name?.maidenName || p.maidenName}`}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${
                            isMale
                              ? 'bg-blue-950 text-blue-300 border border-blue-800/60'
                              : isFemale
                              ? 'bg-rose-950 text-rose-300 border border-rose-800/60'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {isMale ? 'Чол' : isFemale ? 'Жін' : '—'}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-200">
                        {p.birthYear || '?'} — {p.isLiving ? 'живий' : p.deathYear || '?'}
                      </td>

                      <td className="py-3 px-4 text-slate-400 max-w-[160px] truncate">
                        {p.birthPlace || '—'}
                      </td>

                      <td className="py-3 px-4 text-slate-300 max-w-[180px] truncate">
                        {p.occupation || '—'}
                      </td>

                      <td className="py-3 px-4 text-center font-mono text-slate-400">
                        {p.events?.length || 0}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {p.citations && p.citations.length > 0 ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-950/60 text-amber-300 border border-amber-800/60 rounded text-[10px] font-mono">
                            <BookOpen className="w-3 h-3" />
                            {p.citations.length}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => onChangeRoot(p.id)}
                            className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors"
                            title="Зробити коренем дерева"
                          >
                            <GitFork className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onOpenKinshipWith(p.id)}
                            className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded transition-colors"
                            title="Розрахувати спорідненість"
                          >
                            <Compass className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onEditPerson(p.id)}
                            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition-colors"
                            title="Редагувати"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onDeletePerson(p.id);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
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
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 cursor-pointer shadow-sm transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start gap-3">
                    {p.avatarUrl ? (
                      <img
                        src={p.avatarUrl}
                        alt=""
                        className="w-14 h-14 rounded-lg object-cover border border-slate-700 shrink-0"
                      />
                    ) : (
                      <div
                        className={`w-14 h-14 rounded-lg flex items-center justify-center border shrink-0 ${
                          isMale
                            ? 'bg-blue-950/60 border-blue-800 text-blue-300'
                            : isFemale
                            ? 'bg-rose-950/60 border-rose-800 text-rose-300'
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        <User className="w-6 h-6" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm text-slate-100 truncate">
                        {getFullName(p)}
                      </h3>
                      {(p.name?.maidenName || p.maidenName) && (
                        <p className="text-[11px] text-slate-400 truncate">
                          до шлюбу {p.name?.maidenName || p.maidenName}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono mt-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>
                          {p.birthYear || '?'} — {p.isLiving ? 'живий' : p.deathYear || '?'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {p.occupation && (
                    <p className="text-xs text-slate-300 mt-3 line-clamp-2">{p.occupation}</p>
                  )}

                  {p.birthPlace && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-2">
                      <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="truncate">{p.birthPlace}</span>
                    </div>
                  )}

                  {p.tags && p.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2.5">
                      {p.tags.map((t, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-300 rounded text-[10px]"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 mt-4">
                  <span className="text-[10px] text-slate-500 font-mono">ID: {p.id}</span>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onChangeRoot(p.id)}
                      className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded"
                      title="Корінь дерева"
                    >
                      <GitFork className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onOpenKinshipWith(p.id)}
                      className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded"
                      title="Спорідненість"
                    >
                      <Compass className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onEditPerson(p.id)}
                      className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded"
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
