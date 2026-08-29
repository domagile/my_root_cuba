/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  X,
  User,
  Calendar,
  MapPin,
  Heart,
  GitFork,
  Compass,
  Edit2,
  Trash2,
  Briefcase,
  Award,
  BookOpen,
  Tag,
  Shield,
  UserPlus,
  Unlink,
  Search,
  Check,
  RefreshCw,
  Plus
} from 'lucide-react';
import { GenealogyDatabase, Person } from '../../types/genealogy';
import { getFullName } from '../../utils/relationship';
import { useUIStore } from '../../../stores/useUIStore';
import { useGenealogy } from '../../../context/GenealogyContext';
import { getThemeConfig } from '../../../utils/theme';
import { ConfirmDeleteModal } from '../../../components/common/ConfirmDeleteModal';

interface PersonDetailModalProps {
  database: GenealogyDatabase;
  personId: string | null;
  onClose: () => void;
  onSelectPerson: (id: string) => void;
  onEditPerson: (id: string) => void;
  onDeletePerson: (id: string) => void;
  onChangeRoot: (id: string) => void;
  onOpenKinshipWith: (id: string) => void;
  onOpenRelationManager?: (id: string) => void;
  onAddRelation?: (type: 'father' | 'mother' | 'parent' | 'child' | 'spouse' | 'sibling', targetPersonId: string) => void;
}

export const PersonDetailModal: React.FC<PersonDetailModalProps> = ({
  database,
  personId,
  onClose,
  onSelectPerson,
  onEditPerson,
  onDeletePerson,
  onChangeRoot,
  onOpenKinshipWith,
  onOpenRelationManager,
  onAddRelation
}) => {
  const themePalette = useUIStore((s) => s.themePalette);
  const theme = getThemeConfig(themePalette);
  const isDark = theme.category === 'dark';
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = React.useState(false);
  const [parentPicker, setParentPicker] = useState<{ isOpen: boolean; type: 'father' | 'mother' } | null>(null);
  const [parentSearchQuery, setParentSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');

  const { updatePerson, persons } = useGenealogy();

  if (!personId) return null;
  const person = database.persons[personId];
  if (!person) return null;

  const isMale = person.gender === 'male' || person.gender === 'M';
  const isFemale = person.gender === 'female' || person.gender === 'F';

  // Parents
  const parentFamily = person.parentFamilyId ? database.families[person.parentFamilyId] : null;
  const father = parentFamily?.husbandId
    ? database.persons[parentFamily.husbandId]
    : person.fatherId
    ? database.persons[person.fatherId]
    : null;
  const mother = parentFamily?.wifeId
    ? database.persons[parentFamily.wifeId]
    : person.motherId
    ? database.persons[person.motherId]
    : null;

  // Spouses & Families
  const spouseFamilyIds = person.spouseFamilyIds || [];
  const spouseFamilies = spouseFamilyIds
    .map((id) => database.families[id])
    .filter(Boolean);

  const estate = person.estateOrSocialStatus || person.estate || person.socialStatus;

  // Handle parent linking
  const handleLinkParent = (parentType: 'father' | 'mother', selectedParentId: string) => {
    const selectedParent = database.persons[selectedParentId];
    if (!selectedParent) return;

    if (parentType === 'father') {
      updatePerson({
        ...person,
        fatherId: selectedParentId
      });
      updatePerson({
        ...selectedParent,
        childrenIds: Array.from(new Set([...(selectedParent.childrenIds || []), person.id]))
      });
    } else {
      updatePerson({
        ...person,
        motherId: selectedParentId
      });
      updatePerson({
        ...selectedParent,
        childrenIds: Array.from(new Set([...(selectedParent.childrenIds || []), person.id]))
      });
    }
    setParentPicker(null);
    setParentSearchQuery('');
  };

  // Handle parent unlinking
  const handleUnlinkParent = (parentType: 'father' | 'mother') => {
    if (parentType === 'father') {
      const formerId = person.fatherId || parentFamily?.husbandId;
      updatePerson({
        ...person,
        fatherId: undefined
      });
      if (formerId && database.persons[formerId]) {
        const former = database.persons[formerId];
        updatePerson({
          ...former,
          childrenIds: (former.childrenIds || []).filter((cid) => cid !== person.id)
        });
      }
    } else {
      const formerId = person.motherId || parentFamily?.wifeId;
      updatePerson({
        ...person,
        motherId: undefined
      });
      if (formerId && database.persons[formerId]) {
        const former = database.persons[formerId];
        updatePerson({
          ...former,
          childrenIds: (former.childrenIds || []).filter((cid) => cid !== person.id)
        });
      }
    }
  };

  // Filter candidates for parent picker
  const filteredCandidates = useMemo(() => {
    if (!parentPicker?.isOpen) return [];
    const targetType = parentPicker.type;
    const q = parentSearchQuery.toLowerCase().trim();

    return Object.values(database.persons).filter((p) => {
      if (p.id === person.id) return false;
      // Filter by type or active gender tab
      const isCandidateMale = p.gender === 'male' || p.gender === 'M';
      const isCandidateFemale = p.gender === 'female' || p.gender === 'F';

      if (genderFilter === 'male' && !isCandidateMale) return false;
      if (genderFilter === 'female' && !isCandidateFemale) return false;
      if (genderFilter === 'all') {
        if (targetType === 'father' && isCandidateFemale) return false;
        if (targetType === 'mother' && isCandidateMale) return false;
      }

      if (!q) return true;

      const fullName = getFullName(p).toLowerCase();
      const idMatch = p.id.toLowerCase().includes(q);
      const birthMatch = p.birthYear?.toString().includes(q) || p.birthDate?.toLowerCase().includes(q);
      const placeMatch = p.birthPlace?.toLowerCase().includes(q) || p.deathPlace?.toLowerCase().includes(q);

      return fullName.includes(q) || idMatch || Boolean(birthMatch) || Boolean(placeMatch);
    });
  }, [parentPicker, parentSearchQuery, genderFilter, database.persons, person.id]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150`}>
        {/* Header Profile */}
        <div className={`p-6 ${theme.surfaceBg} border-b ${theme.borderSubtle} flex items-start justify-between`}>
          <div className="flex items-center gap-4">
            {person.avatarUrl || person.avatar || person.photoUrl ? (
              <img
                src={person.avatarUrl || person.avatar || person.photoUrl}
                alt={getFullName(person)}
                className={`w-16 h-16 rounded-xl object-cover border ${theme.borderSubtle} shadow-md`}
              />
            ) : (
              <div
                className={`w-16 h-16 rounded-xl flex items-center justify-center border ${
                  isMale
                    ? isDark ? 'bg-blue-950/60 border-blue-800 text-blue-300' : 'bg-blue-100 border-blue-300 text-blue-700'
                    : isFemale
                    ? isDark ? 'bg-rose-950/60 border-rose-800 text-rose-300' : 'bg-rose-100 border-rose-300 text-rose-700'
                    : isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-neutral-200 border-neutral-300 text-neutral-600'
                }`}
              >
                <User className="w-8 h-8" />
              </div>
            )}

            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 ${isDark ? 'bg-slate-800 text-emerald-400' : 'bg-neutral-200 text-emerald-800'} rounded`}>
                  {person.id}
                </span>
                {person.name?.prefix && (
                  <span className={`text-[10px] font-serif px-2 py-0.5 ${isDark ? 'bg-amber-950/60 text-amber-300 border border-amber-800/60' : 'bg-amber-100 text-amber-800 border border-amber-300'} rounded`}>
                    {person.name.prefix}
                  </span>
                )}
                {estate && (
                  <span className={`text-[10px] px-2 py-0.5 ${isDark ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-neutral-100 text-neutral-700 border border-neutral-300'} rounded`}>
                    {estate}
                  </span>
                )}
                {person.confession && (
                  <span className={`text-[10px] px-2 py-0.5 ${isDark ? 'bg-indigo-950/60 text-indigo-300 border border-indigo-800/60' : 'bg-indigo-100 text-indigo-800 border border-indigo-300'} rounded`}>
                    {person.confession}
                  </span>
                )}
              </div>
              <h2 className={`text-xl font-bold ${theme.textPrimary} mt-1`}>{getFullName(person)}</h2>
              {(person.name?.maidenName || person.maidenName) && (
                <p className={`text-xs ${theme.textMuted}`}>
                  Дівоче прізвище: {person.name?.maidenName || person.maidenName}
                </p>
              )}
              <div className={`flex items-center gap-2 text-xs ${theme.textSecondary} font-mono mt-1`}>
                <Calendar className={`w-3.5 h-3.5 ${theme.textMuted}`} />
                <span>
                  {person.birthDate || person.birthYear || '?'} —{' '}
                  {person.isLiving ? 'донині' : person.deathDate || person.deathYear || '?'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 ${theme.textMuted} hover:${theme.textPrimary} ${theme.cardBgHover} rounded-lg transition-colors cursor-pointer`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Toolbar */}
        <div className={`px-6 py-3 ${theme.cardBg} border-b ${theme.borderSubtle} flex flex-wrap items-center justify-between gap-2 text-xs`}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onChangeRoot(person.id);
                onClose();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 ${theme.surfaceBg} hover:opacity-80 ${theme.textPrimary} border ${theme.borderSubtle} rounded-lg transition-colors cursor-pointer`}
            >
              <GitFork className="w-3.5 h-3.5 text-emerald-500" />
              <span>Зробити коренем дерева</span>
            </button>
            <button
              onClick={() => {
                onOpenKinshipWith(person.id);
                onClose();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 ${theme.surfaceBg} hover:opacity-80 ${theme.textPrimary} border ${theme.borderSubtle} rounded-lg transition-colors cursor-pointer`}
            >
              <Compass className="w-3.5 h-3.5 text-sky-500" />
              <span>Розрахувати спорідненість</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onEditPerson(person.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 ${theme.surfaceBg} hover:opacity-80 text-amber-600 border ${theme.borderSubtle} rounded-lg transition-colors cursor-pointer font-medium`}
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Редагувати</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsConfirmDeleteOpen(true);
              }}
              className={`p-1.5 ${theme.textMuted} hover:text-rose-500 rounded-lg transition-colors cursor-pointer`}
              title="Видалити особу"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className={`p-6 space-y-6 max-h-[60vh] overflow-y-auto ${theme.textPrimary}`}>
          {/* Status & Attributes */}
          {(person.occupation || person.militaryRank || estate || person.confession) && (
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 ${theme.surfaceBg} rounded-xl border ${theme.borderSubtle} text-xs`}>
              {person.occupation && (
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div>
                    <span className={`${theme.textMuted} block text-[10px]`}>Рід занять / Фах:</span>
                    <span className={`font-medium ${theme.textPrimary}`}>{person.occupation}</span>
                  </div>
                </div>
              )}
              {estate && (
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-sky-500 shrink-0" />
                  <div>
                    <span className={`${theme.textMuted} block text-[10px]`}>Стан / Соціальний статус:</span>
                    <span className={`font-medium ${theme.textPrimary}`}>{estate}</span>
                  </div>
                </div>
              )}
              {person.militaryRank && (
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-500 shrink-0" />
                  <div>
                    <span className={`${theme.textMuted} block text-[10px]`}>Військовий чин / Звання:</span>
                    <span className={`font-medium ${theme.textPrimary}`}>{person.militaryRank}</span>
                  </div>
                </div>
              )}
              {person.confession && (
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-500 shrink-0" />
                  <div>
                    <span className={`${theme.textMuted} block text-[10px]`}>Віросповідання / Конфесія:</span>
                    <span className={`font-medium ${theme.textPrimary}`}>{person.confession}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Custom Fields */}
          {person.customFields && (
            Array.isArray(person.customFields) ? (
              person.customFields.length > 0 && (
                <div className="space-y-1.5">
                  <span className={`text-xs font-semibold ${theme.textMuted} uppercase tracking-wider block`}>
                    Додаткові відомості:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {person.customFields.map((cf, idx) => (
                      <div key={idx} className={`p-2.5 ${theme.surfaceBg} rounded-lg border ${theme.borderSubtle} text-xs`}>
                        <span className={`${theme.textMuted} text-[10px] block`}>{cf.label || cf.key || 'Поле'}:</span>
                        <span className={`font-medium ${theme.textPrimary}`}>{cf.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ) : (
              Object.keys(person.customFields).length > 0 && (
                <div className="space-y-1.5">
                  <span className={`text-xs font-semibold ${theme.textMuted} uppercase tracking-wider block`}>
                    Додаткові відомості:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.entries(person.customFields).map(([k, v], idx) => (
                      <div key={idx} className={`p-2.5 ${theme.surfaceBg} rounded-lg border ${theme.borderSubtle} text-xs`}>
                        <span className={`${theme.textMuted} text-[10px] block`}>{k}:</span>
                        <span className={`font-medium ${theme.textPrimary}`}>{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )
          )}

          {/* Tags */}
          {person.tags && person.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Tag className={`w-3.5 h-3.5 ${theme.textMuted} mr-1`} />
              {person.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className={`text-[11px] px-2.5 py-0.5 ${theme.surfaceBg} ${theme.textSecondary} rounded-full border ${theme.borderSubtle}`}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Biography */}
          {person.bio && (
            <div className="space-y-1.5">
              <span className={`text-xs font-semibold ${theme.textMuted} uppercase tracking-wider block`}>
                Життєпис / Біографічна довідка:
              </span>
              <p className={`text-xs ${theme.textPrimary} ${theme.surfaceBg} p-3.5 rounded-xl border ${theme.borderSubtle} leading-relaxed`}>
                {person.bio}
              </p>
            </div>
          )}

          {/* Parents Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold ${theme.textMuted} uppercase tracking-wider block`}>
                Батьки:
              </span>
              {onOpenRelationManager && (
                <button
                  type="button"
                  onClick={() => onOpenRelationManager(person.id)}
                  className={`text-[11px] font-medium px-2 py-0.5 rounded flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer`}
                  title="Відкрити повний менеджер родинних зв'язків"
                >
                  <UserPlus className="w-3 h-3" />
                  <span>Керувати зв'язками</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Father Card */}
              <div
                className={`p-3 rounded-xl border text-xs transition-all relative group ${
                  father
                    ? `${theme.surfaceBg} ${isDark ? 'border-blue-900/40 hover:border-blue-700' : 'border-blue-200 hover:border-blue-400 shadow-xs'}`
                    : `${theme.surfaceBg} border-dashed ${isDark ? 'border-slate-700' : 'border-neutral-300'}`
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[11px] ${isDark ? 'text-blue-400' : 'text-blue-700'} font-bold flex items-center gap-1`}>
                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                    Батько
                  </span>

                  {father ? (
                    <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditPerson(father.id);
                        }}
                        className={`p-1 rounded hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 transition-colors cursor-pointer`}
                        title="Редагувати дані батька"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setParentPicker({ isOpen: true, type: 'father' });
                          setGenderFilter('male');
                        }}
                        className={`p-1 rounded hover:bg-sky-500/10 text-sky-600 dark:text-sky-400 transition-colors cursor-pointer`}
                        title="Змінити батька (обрати іншого)"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Від'єднати батька «${getFullName(father)}»?`)) {
                            handleUnlinkParent('father');
                          }
                        }}
                        className={`p-1 rounded hover:bg-rose-500/10 text-rose-500 transition-colors cursor-pointer`}
                        title="Від'єднати батька"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : null}
                </div>

                {father ? (
                  <div
                    onClick={() => onSelectPerson(father.id)}
                    className="cursor-pointer group/link hover:opacity-90 transition-opacity"
                  >
                    <div className={`font-bold ${theme.textPrimary} text-[13px] leading-tight group-hover/link:text-blue-500 transition-colors truncate`}>
                      {getFullName(father)}
                    </div>
                    <div className={`text-[11px] ${theme.textMuted} font-mono mt-0.5`}>
                      {father.birthYear || father.birthDate || '?'} — {father.deathYear || father.deathDate || (father.isLiving ? 'донині' : '?')}
                    </div>
                    {father.occupation && (
                      <div className={`text-[10px] ${theme.textSecondary} truncate mt-0.5 italic`}>
                        {father.occupation}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 py-0.5">
                    <div className={`text-[11px] ${theme.textMuted} italic`}>
                      Батько не вказаний
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setParentPicker({ isOpen: true, type: 'father' });
                          setGenderFilter('male');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                      >
                        <Search className="w-3 h-3" />
                        <span>Обрати з бази</span>
                      </button>
                      {onAddRelation && (
                        <button
                          type="button"
                          onClick={() => {
                            onAddRelation('father', person.id);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Створити</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Mother Card */}
              <div
                className={`p-3 rounded-xl border text-xs transition-all relative group ${
                  mother
                    ? `${theme.surfaceBg} ${isDark ? 'border-rose-900/40 hover:border-rose-700' : 'border-rose-200 hover:border-rose-400'}`
                    : `${theme.surfaceBg} border-dashed ${isDark ? 'border-slate-700' : 'border-neutral-300'}`
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[11px] ${isDark ? 'text-rose-400' : 'text-rose-700'} font-bold flex items-center gap-1`}>
                    <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                    Мати
                  </span>

                  {mother ? (
                    <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditPerson(mother.id);
                        }}
                        className={`p-1 rounded hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 transition-colors cursor-pointer`}
                        title="Редагувати дані матері"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setParentPicker({ isOpen: true, type: 'mother' });
                          setGenderFilter('female');
                        }}
                        className={`p-1 rounded hover:bg-sky-500/10 text-sky-600 dark:text-sky-400 transition-colors cursor-pointer`}
                        title="Змінити матір (обрати іншу)"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Від'єднати матір «${getFullName(mother)}»?`)) {
                            handleUnlinkParent('mother');
                          }
                        }}
                        className={`p-1 rounded hover:bg-rose-500/10 text-rose-500 transition-colors cursor-pointer`}
                        title="Від'єднати матір"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : null}
                </div>

                {mother ? (
                  <div
                    onClick={() => onSelectPerson(mother.id)}
                    className="cursor-pointer group/link hover:opacity-90 transition-opacity"
                  >
                    <div className={`font-bold ${theme.textPrimary} text-[13px] leading-tight group-hover/link:text-rose-500 transition-colors truncate`}>
                      {getFullName(mother)}
                    </div>
                    <div className={`text-[11px] ${theme.textMuted} font-mono mt-0.5`}>
                      {mother.birthYear || mother.birthDate || '?'} — {mother.deathYear || mother.deathDate || (mother.isLiving ? 'донині' : '?')}
                    </div>
                    {(mother.name?.maidenName || mother.maidenName) && (
                      <div className={`text-[10px] ${theme.textSecondary} truncate mt-0.5`}>
                        Дівоче: {mother.name?.maidenName || mother.maidenName}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 py-0.5">
                    <div className={`text-[11px] ${theme.textMuted} italic`}>
                      Мати не вказана
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setParentPicker({ isOpen: true, type: 'mother' });
                          setGenderFilter('female');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                      >
                        <Search className="w-3 h-3" />
                        <span>Обрати з бази</span>
                      </button>
                      {onAddRelation && (
                        <button
                          type="button"
                          onClick={() => {
                            onAddRelation('mother', person.id);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Створити</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Spouses and Children */}
          {spouseFamilies.length > 0 && (
            <div className="space-y-3">
              <span className={`text-xs font-semibold ${theme.textMuted} uppercase tracking-wider block`}>
                Сім'ї та діти:
              </span>

              {spouseFamilies.map((fam) => {
                const spouseId = fam.husbandId === person.id ? fam.wifeId : fam.husbandId;
                const spouse = spouseId ? database.persons[spouseId] : null;

                return (
                  <div
                    key={fam.id}
                    className={`p-3.5 ${theme.surfaceBg} rounded-xl border ${theme.borderSubtle} space-y-3`}
                  >
                    <div className={`flex items-center justify-between text-xs border-b ${theme.borderSubtle} pb-2`}>
                      <div className="flex items-center gap-2">
                        <Heart className="w-3.5 h-3.5 text-rose-500" />
                        <span className={theme.textMuted}>Чоловік / Дружина:</span>
                        {spouse ? (
                          <button
                            onClick={() => onSelectPerson(spouse.id)}
                            className={`font-semibold ${theme.textPrimary} hover:text-emerald-500 cursor-pointer`}
                          >
                            {getFullName(spouse)}
                          </button>
                        ) : (
                          <span className={`italic ${theme.textMuted}`}>Не вказано</span>
                        )}
                      </div>

                      {fam.marriageDate && (
                        <span className={`text-[11px] ${theme.textMuted} font-mono`}>
                          Шлюб: {fam.marriageDate}
                        </span>
                      )}
                    </div>

                    {/* Children */}
                    <div>
                      <span className={`text-[11px] ${theme.textMuted} block mb-1.5`}>
                        Діти ({fam.children?.length || 0}):
                      </span>
                      {(!fam.children || fam.children.length === 0) ? (
                        <span className={`text-[11px] ${theme.textMuted} italic`}>Дітей немає</span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {fam.children.map((c) => {
                            const child = database.persons[c.personId];
                            if (!child) return null;
                            return (
                              <button
                                key={child.id}
                                onClick={() => onSelectPerson(child.id)}
                                className={`px-2.5 py-1 ${theme.cardBg} border ${theme.cardBorder} hover:border-emerald-500 rounded text-xs ${theme.textPrimary} transition-colors cursor-pointer`}
                              >
                                {getFullName(child)}{' '}
                                {child.birthYear && (
                                  <span className={`text-[10px] ${theme.textMuted} font-mono`}>
                                    ({child.birthYear})
                                  </span>
                                )}
                              </button>
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

          {/* Life events */}
          {person.events && person.events.length > 0 && (
            <div className="space-y-2">
              <span className={`text-xs font-semibold ${theme.textMuted} uppercase tracking-wider block`}>
                Події життя ({person.events.length}):
              </span>
              <div className="space-y-2">
                {person.events.map((ev, idx) => (
                  <div
                    key={idx}
                    className={`p-3 ${theme.surfaceBg} rounded-lg border ${theme.borderSubtle} text-xs space-y-1`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-emerald-600 font-mono">
                        {ev.date || (ev.year ? `${ev.year} р.` : 'Дата не вказана')}
                      </span>
                      <span className={`font-medium ${theme.textPrimary}`}>{ev.type}</span>
                    </div>
                    {ev.description && <p className={theme.textSecondary}>{ev.description}</p>}
                    {ev.placeName && (
                      <div className={`flex items-center gap-1 text-[11px] ${theme.textMuted}`}>
                        <MapPin className="w-3 h-3" />
                        <span>{ev.placeName}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {person.notes && (
            <div className="space-y-2">
              <span className={`text-xs font-semibold ${theme.textMuted} uppercase tracking-wider block`}>
                Архівні примітки та джерела:
              </span>
              <div className={`p-3 ${theme.surfaceBg} rounded-lg border ${theme.borderSubtle} text-xs ${theme.textSecondary} leading-relaxed`}>
                {typeof person.notes === 'string'
                  ? person.notes
                  : Array.isArray(person.notes)
                  ? (person.notes as any[]).join('\n')
                  : JSON.stringify(person.notes)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Parent Picker Dialog */}
      {parentPicker?.isOpen && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]`}>
            {/* Modal Header */}
            <div className={`p-4 border-b ${theme.borderSubtle} flex items-center justify-between ${isDark ? 'bg-slate-900/90' : 'bg-neutral-50'}`}>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${parentPicker.type === 'father' ? 'bg-blue-500/10 text-blue-500' : 'bg-rose-500/10 text-rose-500'}`}>
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className={`text-sm font-bold ${theme.textPrimary}`}>
                    {parentPicker.type === 'father' ? 'Вибрати батька' : 'Вибрати матір'}
                  </h3>
                  <p className={`text-[11px] ${theme.textMuted}`}>
                    Для: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{getFullName(person)}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setParentPicker(null);
                  setParentSearchQuery('');
                }}
                className={`p-1.5 rounded-lg ${theme.textMuted} hover:${theme.textPrimary} hover:bg-neutral-200 dark:hover:bg-slate-800 transition-colors`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search and Filters */}
            <div className={`p-3 border-b ${theme.borderSubtle} space-y-2`}>
              <div className="relative">
                <Search className={`w-4 h-4 absolute left-3 top-2.5 ${theme.textMuted}`} />
                <input
                  type="text"
                  value={parentSearchQuery}
                  onChange={(e) => setParentSearchQuery(e.target.value)}
                  placeholder="Пошук за прізвищем, ім'ям, роком чи ID..."
                  autoFocus
                  className={`w-full pl-9 pr-8 py-2 rounded-xl text-xs border ${theme.borderSubtle} ${theme.surfaceBg} ${theme.textPrimary} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                />
                {parentSearchQuery && (
                  <button
                    onClick={() => setParentSearchQuery('')}
                    className={`absolute right-2.5 top-2.5 text-xs ${theme.textMuted} hover:${theme.textPrimary}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-[11px]">
                <span className={`${theme.textMuted} text-[10px] uppercase font-semibold mr-1`}>Фільтр:</span>
                <button
                  type="button"
                  onClick={() => setGenderFilter(parentPicker.type === 'father' ? 'male' : 'female')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                    genderFilter !== 'all'
                      ? 'bg-emerald-600 text-white'
                      : `${theme.surfaceBg} ${theme.textSecondary} border ${theme.borderSubtle}`
                  }`}
                >
                  {parentPicker.type === 'father' ? 'Лише чоловіки' : 'Лише жінки'}
                </button>
                <button
                  type="button"
                  onClick={() => setGenderFilter('all')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                    genderFilter === 'all'
                      ? 'bg-emerald-600 text-white'
                      : `${theme.surfaceBg} ${theme.textSecondary} border ${theme.borderSubtle}`
                  }`}
                >
                  Всі особи
                </button>
              </div>
            </div>

            {/* Candidates List */}
            <div className="p-3 overflow-y-auto flex-1 divide-y divide-neutral-200 dark:divide-slate-800/60 space-y-1">
              {filteredCandidates.length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <User className={`w-8 h-8 mx-auto ${theme.textMuted} opacity-40`} />
                  <div className={`text-xs ${theme.textMuted}`}>
                    {parentSearchQuery
                      ? 'Не знайдено жодної особи за цим запитом'
                      : 'Немає доступних кандидатів'}
                  </div>
                  {onAddRelation && (
                    <button
                      type="button"
                      onClick={() => {
                        const t = parentPicker.type;
                        setParentPicker(null);
                        onAddRelation(t, person.id);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Створити {parentPicker.type === 'father' ? 'нового батька' : 'нову матір'}</span>
                    </button>
                  )}
                </div>
              ) : (
                filteredCandidates.map((candidate) => {
                  const isCandMale = candidate.gender === 'male' || candidate.gender === 'M';
                  return (
                    <div
                      key={candidate.id}
                      className={`p-2.5 rounded-xl hover:${theme.surfaceBg} flex items-center justify-between gap-3 transition-colors cursor-pointer border border-transparent hover:${theme.borderSubtle}`}
                      onClick={() => handleLinkParent(parentPicker.type, candidate.id)}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                            isCandMale
                              ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                              : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                          }`}
                        >
                          {isCandMale ? 'Ч' : 'Ж'}
                        </div>
                        <div className="min-w-0">
                          <div className={`text-xs font-bold ${theme.textPrimary} truncate`}>
                            {getFullName(candidate)}
                          </div>
                          <div className={`text-[10px] ${theme.textMuted} font-mono flex items-center gap-1.5`}>
                            <span>
                              {candidate.birthYear || candidate.birthDate || '?'} — {candidate.deathYear || candidate.deathDate || (candidate.isLiving ? 'живий(а)' : '?')}
                            </span>
                            <span className="opacity-50">•</span>
                            <span className="opacity-75">{candidate.id}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLinkParent(parentPicker.type, candidate.id);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold flex items-center gap-1 shrink-0 transition-colors shadow-xs cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                        <span>Обрати</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className={`p-3 border-t ${theme.borderSubtle} flex items-center justify-between ${isDark ? 'bg-slate-900/60' : 'bg-neutral-50'}`}>
              {onAddRelation ? (
                <button
                  type="button"
                  onClick={() => {
                    const t = parentPicker.type;
                    setParentPicker(null);
                    onAddRelation(t, person.id);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-600/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Створити нову особу</span>
                </button>
              ) : <div />}

              <button
                type="button"
                onClick={() => {
                  setParentPicker(null);
                  setParentSearchQuery('');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${theme.textSecondary} hover:${theme.textPrimary} hover:bg-neutral-200 dark:hover:bg-slate-800 transition-colors cursor-pointer`}
              >
                Скасувати
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {isConfirmDeleteOpen && person && (
        <ConfirmDeleteModal
          isOpen={isConfirmDeleteOpen}
          title="Видалення особи"
          itemName={getFullName(person)}
          itemType="особу"
          message={`Ви дійсно бажаєте видалити особу «${getFullName(person)}» з родоводу?`}
          onConfirm={() => {
            onDeletePerson(person.id);
            setIsConfirmDeleteOpen(false);
            onClose();
          }}
          onClose={() => setIsConfirmDeleteOpen(false)}
          isPermanent={true}
        />
      )}
    </div>
  );
};
