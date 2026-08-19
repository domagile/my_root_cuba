import React, { useState, useMemo } from 'react';
import {
  HeartHandshake,
  Plus,
  Search,
  Users,
  Calendar,
  MapPin,
  Edit2,
  Trash2,
  GitFork
} from 'lucide-react';
import { GenealogyDatabase, Family } from '../../types/genealogy';
import { getFullName } from '../../utils/relationship';

interface FamiliesListViewProps {
  database: GenealogyDatabase;
  onSelectPerson: (id: string) => void;
  onEditFamily: (id: string) => void;
  onDeleteFamily: (id: string) => void;
  onOpenAddFamily: () => void;
  onChangeRoot: (id: string) => void;
}

export const FamiliesListView: React.FC<FamiliesListViewProps> = ({
  database,
  onSelectPerson,
  onEditFamily,
  onDeleteFamily,
  onOpenAddFamily,
  onChangeRoot
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const familiesList = useMemo(() => {
    return (Object.values(database.families) as Family[]).filter((f) => {
      const husband = f.husbandId ? database.persons[f.husbandId] : null;
      const wife = f.wifeId ? database.persons[f.wifeId] : null;
      const husbName = getFullName(husband || undefined).toLowerCase();
      const wifeName = getFullName(wife || undefined).toLowerCase();
      const place = (f.marriagePlace || '').toLowerCase();
      const q = searchTerm.toLowerCase().trim();

      return !q || husbName.includes(q) || wifeName.includes(q) || place.includes(q);
    });
  }, [database.families, database.persons, searchTerm]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Сімейні союзи</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Всього {familiesList.length} сімей у базі даних
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Пошук за подружжям або місцем..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            onClick={onOpenAddFamily}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Додати союз</span>
          </button>
        </div>
      </div>

      {/* Families Grid */}
      {familiesList.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
          <HeartHandshake className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-200">Сімейних союзів не знайдено</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            Додайте перший союз між особами для формування родових гілок.
          </p>
          <button
            onClick={onOpenAddFamily}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium"
          >
            Створити сім'ю
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {familiesList.map((fam) => {
            const husband = fam.husbandId ? database.persons[fam.husbandId] : null;
            const wife = fam.wifeId ? database.persons[fam.wifeId] : null;

            return (
              <div
                key={fam.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 bg-slate-800 text-emerald-400 rounded">
                      {fam.id}
                    </span>
                    <span className="text-xs text-slate-400">
                      {fam.relationshipType === 'Married' ? 'Зареєстрований шлюб' : 'Союз'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onEditFamily(fam.id)}
                      className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition-colors"
                      title="Редагувати сім'ю"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Видалити цю сім\'ю з бази даних?')) {
                          onDeleteFamily(fam.id);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                      title="Видалити сім'ю"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Spouses Cards */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Husband */}
                  <div
                    onClick={() => husband && onSelectPerson(husband.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      husband
                        ? 'bg-slate-950 border-blue-900/40 hover:border-blue-700'
                        : 'bg-slate-950/50 border-dashed border-slate-800 text-slate-500'
                    }`}
                  >
                    <span className="text-[10px] text-blue-400 uppercase font-semibold block mb-1">
                      Чоловік / Батько
                    </span>
                    {husband ? (
                      <div>
                        <h4 className="font-semibold text-xs text-slate-200 truncate">
                          {getFullName(husband)}
                        </h4>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {husband.birthYear || '?'} —{' '}
                          {husband.isLiving ? 'теп. час' : husband.deathYear || '?'}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs italic">Не вказано</span>
                    )}
                  </div>

                  {/* Wife */}
                  <div
                    onClick={() => wife && onSelectPerson(wife.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      wife
                        ? 'bg-slate-950 border-rose-900/40 hover:border-rose-700'
                        : 'bg-slate-950/50 border-dashed border-slate-800 text-slate-500'
                    }`}
                  >
                    <span className="text-[10px] text-rose-400 uppercase font-semibold block mb-1">
                      Дружина / Мати
                    </span>
                    {wife ? (
                      <div>
                        <h4 className="font-semibold text-xs text-slate-200 truncate">
                          {getFullName(wife)}
                        </h4>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {wife.birthYear || '?'} —{' '}
                          {wife.isLiving ? 'теп. час' : wife.deathYear || '?'}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs italic">Не вказано</span>
                    )}
                  </div>
                </div>

                {/* Marriage details */}
                {(fam.marriageDate || fam.marriagePlace) && (
                  <div className="flex items-center gap-4 text-xs text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                    {fam.marriageDate && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Шлюб: {fam.marriageDate}</span>
                      </div>
                    )}
                    {fam.marriagePlace && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="truncate">{fam.marriagePlace}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Children List */}
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span className="font-medium flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      Діти ({fam.children.length}):
                    </span>
                  </div>

                  {fam.children.length === 0 ? (
                    <p className="text-[11px] text-slate-500 italic">Дітей не додано</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {fam.children.map((childObj) => {
                        const child = database.persons[childObj.personId];
                        if (!child) return null;
                        return (
                          <div
                            key={child.id}
                            onClick={() => onSelectPerson(child.id)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg hover:border-emerald-600 cursor-pointer text-xs transition-colors"
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                child.gender === 'M' ? 'bg-blue-400' : 'bg-rose-400'
                              }`}
                            />
                            <span className="text-slate-200 font-medium">{getFullName(child)}</span>
                            {child.birthYear && (
                              <span className="text-[10px] text-slate-500 font-mono">
                                ({child.birthYear})
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
