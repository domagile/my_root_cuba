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
  GitFork,
  Lock
} from 'lucide-react';
import { GenealogyDatabase, Family } from '../../types/genealogy';
import { getFullName } from '../../utils/relationship';
import { useUIStore } from '../../../stores/useUIStore';
import { useAuthStore } from '../../../stores/useAuthStore';
import { getPrivacySafePerson, isPersonLiving, isUserWhitelisted } from '../../utils/privacy';
import { getThemeConfig } from '../../../utils/theme';
import { ConfirmDeleteModal } from '../../../components/common/ConfirmDeleteModal';

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
  const currentUser = useAuthStore((s) => s.currentUser);
  const whitelist = useAuthStore((s) => s.whitelist);
  const isWhitelisted = useMemo(() => isUserWhitelisted(currentUser, whitelist), [currentUser, whitelist]);

  const themePalette = useUIStore((s) => s.themePalette);
  const theme = getThemeConfig(themePalette);
  const isDark = theme.category === 'dark';

  const [searchTerm, setSearchTerm] = useState('');
  const [familyToDelete, setFamilyToDelete] = useState<{ id: string; label: string } | null>(null);

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
    <div className={`max-w-7xl mx-auto px-4 py-6 space-y-6 ${theme.textPrimary}`}>
      {/* Header */}
      <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
        <div>
          <h1 className={`text-xl font-bold tracking-tight ${theme.textPrimary}`}>Сімейні союзи</h1>
          <p className={`text-xs ${theme.textMuted} mt-0.5`}>
            Всього {familiesList.length} сімей у базі даних
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative min-w-[240px]">
            <Search className={`w-4 h-4 ${theme.textMuted} absolute left-3 top-1/2 -translate-y-1/2`} />
            <input
              type="text"
              placeholder="Пошук за подружжям або місцем..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-9 pr-3 py-1.5 ${theme.inputBg} border ${theme.inputBorder} rounded-lg text-xs ${theme.textPrimary} placeholder:text-neutral-400 focus:outline-none focus:border-emerald-500`}
            />
          </div>

          <button
            onClick={onOpenAddFamily}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Додати союз</span>
          </button>
        </div>
      </div>

      {/* Families Grid */}
      {familiesList.length === 0 ? (
        <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-xl p-12 text-center`}>
          <HeartHandshake className={`w-12 h-12 ${theme.textMuted} mx-auto mb-3`} />
          <h3 className={`text-base font-semibold ${theme.textPrimary}`}>Сімейних союзів не знайдено</h3>
          <p className={`text-xs ${theme.textMuted} max-w-sm mx-auto mt-1 mb-4`}>
            Додайте перший союз між особами для формування родових гілок.
          </p>
          <button
            onClick={onOpenAddFamily}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium cursor-pointer"
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
                className={`${theme.cardBg} border ${theme.cardBorder} rounded-xl p-5 shadow-xs space-y-4 hover:border-emerald-500/60 transition-colors`}
              >
                <div className={`flex items-center justify-between border-b ${theme.borderSubtle} pb-3`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono font-semibold px-2 py-0.5 ${isDark ? 'bg-slate-800 text-emerald-400' : 'bg-emerald-100 text-emerald-800'} rounded`}>
                      {fam.id}
                    </span>
                    <span className={`text-xs ${theme.textMuted}`}>
                      {fam.relationshipType === 'Married' ? 'Зареєстрований шлюб' : 'Союз'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onEditFamily(fam.id)}
                      className={`p-1.5 ${theme.textMuted} hover:text-amber-500 hover:bg-neutral-500/10 rounded transition-colors cursor-pointer`}
                      title="Редагувати сім'ю"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const husbName = getFullName(husband || undefined);
                        const wifeName = getFullName(wife || undefined);
                        const label = husbName && wifeName ? `${husbName} та ${wifeName}` : husbName || wifeName || fam.id;
                        setFamilyToDelete({ id: fam.id, label });
                      }}
                      className={`p-1.5 ${theme.textMuted} hover:text-rose-500 hover:bg-neutral-500/10 rounded transition-colors cursor-pointer`}
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
                        ? isDark
                          ? 'bg-slate-950 border-blue-900/40 hover:border-blue-700'
                          : 'bg-sky-50/70 border-sky-200 hover:border-sky-400'
                        : isDark
                        ? 'bg-slate-950/50 border-dashed border-slate-800 text-slate-500'
                        : 'bg-neutral-100/50 border-dashed border-neutral-300 text-neutral-400'
                    }`}
                  >
                    <span className={`text-[10px] ${isDark ? 'text-blue-400' : 'text-sky-700'} uppercase font-semibold block mb-1`}>
                      Чоловік / Батько
                    </span>
                    {husband ? (
                      (() => {
                        const isLiving = isPersonLiving(husband);
                        const isMasked = !isWhitelisted && isLiving;
                        return (
                          <div>
                            <h4 className={`font-semibold text-xs ${theme.textPrimary} truncate`}>
                              {isMasked ? '🔒 Скрито (Жива особа)' : getFullName(husband)}
                            </h4>
                            <p className={`text-[10px] ${theme.textMuted} font-mono mt-0.5`}>
                              {isMasked
                                ? '🔒 Конфіденційно'
                                : `${husband.birthYear || '?'} — ${husband.isLiving ? 'теп. час' : husband.deathYear || '?'}`}
                            </p>
                          </div>
                        );
                      })()
                    ) : (
                      <span className="text-xs italic">Не вказано</span>
                    )}
                  </div>

                  {/* Wife */}
                  <div
                    onClick={() => wife && onSelectPerson(wife.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      wife
                        ? isDark
                          ? 'bg-slate-950 border-rose-900/40 hover:border-rose-700'
                          : 'bg-rose-50/70 border-rose-200 hover:border-rose-400'
                        : isDark
                        ? 'bg-slate-950/50 border-dashed border-slate-800 text-slate-500'
                        : 'bg-neutral-100/50 border-dashed border-neutral-300 text-neutral-400'
                    }`}
                  >
                    <span className={`text-[10px] ${isDark ? 'text-rose-400' : 'text-rose-700'} uppercase font-semibold block mb-1`}>
                      Дружина / Мати
                    </span>
                    {wife ? (
                      (() => {
                        const isLiving = isPersonLiving(wife);
                        const isMasked = !isWhitelisted && isLiving;
                        return (
                          <div>
                            <h4 className={`font-semibold text-xs ${theme.textPrimary} truncate`}>
                              {isMasked ? '🔒 Скрито (Жива особа)' : getFullName(wife)}
                            </h4>
                            <p className={`text-[10px] ${theme.textMuted} font-mono mt-0.5`}>
                              {isMasked
                                ? '🔒 Конфіденційно'
                                : `${wife.birthYear || '?'} — ${wife.isLiving ? 'теп. час' : wife.deathYear || '?'}`}
                            </p>
                          </div>
                        );
                      })()
                    ) : (
                      <span className="text-xs italic">Не вказано</span>
                    )}
                  </div>
                </div>

                {/* Marriage details */}
                {(fam.marriageDate || fam.marriagePlace) && (
                  <div className={`flex items-center gap-4 text-xs ${theme.textSecondary} ${theme.surfaceBg} p-2.5 rounded-lg border ${theme.borderSubtle}`}>
                    {fam.marriageDate && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Шлюб: {fam.marriageDate}</span>
                      </div>
                    )}
                    {fam.marriagePlace && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="truncate">{fam.marriagePlace}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Children List */}
                <div>
                  <div className={`flex items-center justify-between text-xs ${theme.textMuted} mb-2`}>
                    <span className="font-medium flex items-center gap-1">
                      <Users className={`w-3.5 h-3.5 ${theme.textMuted}`} />
                      Діти ({fam.children.length}):
                    </span>
                  </div>

                  {fam.children.length === 0 ? (
                    <p className={`text-[11px] ${theme.textMuted} italic`}>Дітей не додано</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {fam.children.map((childObj) => {
                        const child = database.persons[childObj.personId];
                        if (!child) return null;
                        const isLiving = isPersonLiving(child);
                        const isMasked = !isWhitelisted && isLiving;

                        return (
                          <div
                            key={child.id}
                            onClick={() => onSelectPerson(child.id)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 ${theme.surfaceBg} border ${theme.borderSubtle} rounded-lg hover:border-emerald-600 cursor-pointer text-xs transition-colors`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                child.gender === 'M' ? 'bg-sky-500' : 'bg-rose-500'
                              }`}
                            />
                            <span className={`${theme.textPrimary} font-medium`}>
                              {isMasked ? '🔒 Скрито (Жива особа)' : getFullName(child)}
                            </span>
                            {!isMasked && child.birthYear && (
                              <span className={`text-[10px] ${theme.textMuted} font-mono`}>
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
      {/* Confirm Delete Family Modal */}
      {familyToDelete && (
        <ConfirmDeleteModal
          isOpen={!!familyToDelete}
          title="Видалення сімейного союзу"
          itemName={familyToDelete.label}
          itemType="сімейний союз"
          message={`Ви дійсно бажаєте видалити сімейний союз «${familyToDelete.label}» (${familyToDelete.id})?`}
          onConfirm={() => {
            if (familyToDelete) {
              onDeleteFamily(familyToDelete.id);
              setFamilyToDelete(null);
            }
          }}
          onClose={() => setFamilyToDelete(null)}
          isPermanent={true}
        />
      )}
    </div>
  );
};
