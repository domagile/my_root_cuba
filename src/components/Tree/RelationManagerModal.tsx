/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  Check, 
  Unlink, 
  User, 
  Heart, 
  GitFork, 
  Users, 
  UserPlus, 
  Link2, 
  Baby, 
  ShieldAlert,
  ChevronRight
} from 'lucide-react';
import { useGenealogy } from '../../context/GenealogyContext';
import { getThemeConfig } from '../../utils/theme';
import { Person } from '../../types';

interface RelationManagerModalProps {
  targetPerson: Person;
  onClose: () => void;
  onOpenAddModalWithRelation: (
    type: 'father' | 'mother' | 'parent' | 'child' | 'spouse' | 'sibling',
    targetPersonId: string
  ) => void;
}

export const RelationManagerModal: React.FC<RelationManagerModalProps> = ({
  targetPerson,
  onClose,
  onOpenAddModalWithRelation
}) => {
  const { persons, updatePerson, themePalette } = useGenealogy();
  const theme = getThemeConfig(themePalette);

  // Tab navigation: 'create' | 'attach' | 'existing'
  const [activeTab, setActiveTab] = useState<'create' | 'attach' | 'existing'>('create');
  // Selector mode for attaching existing person: 'parent' | 'spouse' | 'child' | 'sibling'
  const [attachingType, setAttachingType] = useState<'parent' | 'spouse' | 'child' | 'sibling'>('parent');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Fresh target person from state to reflect live changes
  const liveTargetPerson = useMemo(() => {
    return persons.find((p) => p.id === targetPerson.id) || targetPerson;
  }, [persons, targetPerson]);

  const targetFullName = useMemo(() => {
    const p = liveTargetPerson;
    const surname = p.name?.surname || p.lastName || '';
    const given = p.name?.given || p.firstName || '';
    const patronymic = p.name?.patronymic || p.patronymic || '';
    return [surname, given, patronymic].filter(Boolean).join(' ') || 'Особа';
  }, [liveTargetPerson]);

  const getPersonName = (p?: Person) => {
    if (!p) return 'Невідомо';
    const surname = p.name?.surname || p.lastName || '';
    const given = p.name?.given || p.firstName || '';
    const patronymic = p.name?.patronymic || p.patronymic || '';
    return [surname, given, patronymic].filter(Boolean).join(' ') || 'Без імені';
  };

  // Find linked relatives
  const linkedFather = useMemo(() => {
    return liveTargetPerson.fatherId ? persons.find((p) => p.id === liveTargetPerson.fatherId) : null;
  }, [liveTargetPerson.fatherId, persons]);

  const linkedMother = useMemo(() => {
    return liveTargetPerson.motherId ? persons.find((p) => p.id === liveTargetPerson.motherId) : null;
  }, [liveTargetPerson.motherId, persons]);

  const linkedSpouses = useMemo(() => {
    const list: Person[] = [];
    const directIds = liveTargetPerson.spouseIds || [];
    directIds.forEach((id) => {
      const p = persons.find((item) => item.id === id);
      if (p && !list.some((item) => item.id === p.id)) list.push(p);
    });
    persons.forEach((p) => {
      if (p.spouseIds?.includes(liveTargetPerson.id) && !list.some((item) => item.id === p.id)) {
        list.push(p);
      }
    });
    return list;
  }, [liveTargetPerson, persons]);

  const linkedChildren = useMemo(() => {
    const list: Person[] = [];
    const directIds = liveTargetPerson.childrenIds || [];
    directIds.forEach((id) => {
      const p = persons.find((item) => item.id === id);
      if (p && !list.some((item) => item.id === p.id)) list.push(p);
    });
    persons.forEach((p) => {
      if ((p.fatherId === liveTargetPerson.id || p.motherId === liveTargetPerson.id) && !list.some((item) => item.id === p.id)) {
        list.push(p);
      }
    });
    return list;
  }, [liveTargetPerson, persons]);

  const totalLinkedCount = (linkedFather ? 1 : 0) + (linkedMother ? 1 : 0) + linkedSpouses.length + linkedChildren.length;

  // Candidates for attaching
  const candidatePersons = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return persons.filter((p) => {
      if (p.id === liveTargetPerson.id) return false;
      // Filter out already linked relatives
      if (p.id === liveTargetPerson.fatherId || p.id === liveTargetPerson.motherId) return false;
      if (liveTargetPerson.spouseIds?.includes(p.id) || p.spouseIds?.includes(liveTargetPerson.id)) return false;
      if (liveTargetPerson.childrenIds?.includes(p.id) || p.fatherId === liveTargetPerson.id || p.motherId === liveTargetPerson.id) return false;

      if (!q) return true;
      const fullName = `${p.name?.surname || p.lastName || ''} ${p.name?.given || p.firstName || ''} ${p.name?.patronymic || p.patronymic || ''}`.toLowerCase();
      const birth = (p.birthYear || p.birthDate || '').toString().toLowerCase();
      const place = (p.birthPlace || '').toLowerCase();
      return fullName.includes(q) || birth.includes(q) || place.includes(q);
    }).slice(0, 15);
  }, [liveTargetPerson, persons, searchQuery]);

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const handleAttachExisting = (selectedPerson: Person) => {
    if (attachingType === 'parent') {
      const isFemale = selectedPerson.gender === 'female' || selectedPerson.gender === 'F';
      if (isFemale) {
        updatePerson({ ...liveTargetPerson, motherId: selectedPerson.id });
        updatePerson({
          ...selectedPerson,
          childrenIds: Array.from(new Set([...(selectedPerson.childrenIds || []), liveTargetPerson.id]))
        });
        showFeedback(`Приєднано матір: ${getPersonName(selectedPerson)}`);
      } else {
        updatePerson({ ...liveTargetPerson, fatherId: selectedPerson.id });
        updatePerson({
          ...selectedPerson,
          childrenIds: Array.from(new Set([...(selectedPerson.childrenIds || []), liveTargetPerson.id]))
        });
        showFeedback(`Приєднано батька: ${getPersonName(selectedPerson)}`);
      }
    } else if (attachingType === 'spouse') {
      updatePerson({
        ...liveTargetPerson,
        spouseIds: Array.from(new Set([...(liveTargetPerson.spouseIds || []), selectedPerson.id]))
      });
      updatePerson({
        ...selectedPerson,
        spouseIds: Array.from(new Set([...(selectedPerson.spouseIds || []), liveTargetPerson.id]))
      });
      showFeedback(`Приєднано партнера/подружжя: ${getPersonName(selectedPerson)}`);
    } else if (attachingType === 'child') {
      const isFemale = liveTargetPerson.gender === 'female' || liveTargetPerson.gender === 'F';
      const updatedSelected = { ...selectedPerson };
      if (isFemale) {
        updatedSelected.motherId = liveTargetPerson.id;
      } else {
        updatedSelected.fatherId = liveTargetPerson.id;
      }
      updatePerson(updatedSelected);
      updatePerson({
        ...liveTargetPerson,
        childrenIds: Array.from(new Set([...(liveTargetPerson.childrenIds || []), selectedPerson.id]))
      });
      showFeedback(`Приєднано дитину: ${getPersonName(selectedPerson)}`);
    } else if (attachingType === 'sibling') {
      const updatedTarget = { ...liveTargetPerson };
      const updatedSelected = { ...selectedPerson };
      if (selectedPerson.fatherId && !liveTargetPerson.fatherId) {
        updatedTarget.fatherId = selectedPerson.fatherId;
      }
      if (selectedPerson.motherId && !liveTargetPerson.motherId) {
        updatedTarget.motherId = selectedPerson.motherId;
      }
      if (liveTargetPerson.fatherId && !selectedPerson.fatherId) {
        updatedSelected.fatherId = liveTargetPerson.fatherId;
      }
      if (liveTargetPerson.motherId && !selectedPerson.motherId) {
        updatedSelected.motherId = liveTargetPerson.motherId;
      }
      updatePerson(updatedTarget);
      updatePerson(updatedSelected);
      showFeedback(`Приєднано спільних батьків для брата/сестри`);
    }
  };

  const handleUnlinkFather = () => {
    if (!linkedFather) return;
    updatePerson({ ...liveTargetPerson, fatherId: undefined });
    updatePerson({
      ...linkedFather,
      childrenIds: (linkedFather.childrenIds || []).filter((id) => id !== liveTargetPerson.id)
    });
    showFeedback(`Від'єднано зв'язок з батьком: ${getPersonName(linkedFather)}`);
  };

  const handleUnlinkMother = () => {
    if (!linkedMother) return;
    updatePerson({ ...liveTargetPerson, motherId: undefined });
    updatePerson({
      ...linkedMother,
      childrenIds: (linkedMother.childrenIds || []).filter((id) => id !== liveTargetPerson.id)
    });
    showFeedback(`Від'єднано зв'язок з матір'ю: ${getPersonName(linkedMother)}`);
  };

  const handleUnlinkSpouse = (spouse: Person) => {
    updatePerson({
      ...liveTargetPerson,
      spouseIds: (liveTargetPerson.spouseIds || []).filter((id) => id !== spouse.id)
    });
    updatePerson({
      ...spouse,
      spouseIds: (spouse.spouseIds || []).filter((id) => id !== liveTargetPerson.id)
    });
    showFeedback(`Від'єднано зв'язок з партнером: ${getPersonName(spouse)}`);
  };

  const handleUnlinkChild = (child: Person) => {
    updatePerson({
      ...liveTargetPerson,
      childrenIds: (liveTargetPerson.childrenIds || []).filter((id) => id !== child.id)
    });
    const updatedChild = { ...child };
    if (updatedChild.fatherId === liveTargetPerson.id) updatedChild.fatherId = undefined;
    if (updatedChild.motherId === liveTargetPerson.id) updatedChild.motherId = undefined;
    updatePerson(updatedChild);
    showFeedback(`Від'єднано зв'язок з дитиною: ${getPersonName(child)}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="w-full max-w-lg max-h-[88vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl text-neutral-800 dark:text-neutral-100 overflow-hidden my-auto transition-all">
        
        {/* Compact Header */}
        <div className="px-4 sm:px-5 py-3.5 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-slate-900/90 shrink-0">
          <div className="min-w-0 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#B88E3E]/20 text-[#B88E3E] flex items-center justify-center shrink-0 border border-[#B88E3E]/30">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">
                Додати родича: <span className="text-[#B88E3E] font-semibold">{targetFullName}</span>
              </h2>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                Керування родинними зв'язками та лініями
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shrink-0 ml-2"
            title="Закрити"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback Alert if any */}
        {feedbackMsg && (
          <div className="mx-4 mt-3 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/60 rounded-lg text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2 animate-in fade-in shrink-0">
            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">{feedbackMsg}</span>
          </div>
        )}

        {/* Sleek Segmented Tab Switcher */}
        <div className="px-4 pt-3 pb-2 shrink-0">
          <div className="grid grid-cols-3 gap-1 p-1 bg-neutral-100 dark:bg-slate-800/80 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab('create')}
              className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 truncate ${
                activeTab === 'create'
                  ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Створити</span>
            </button>

            <button
              onClick={() => setActiveTab('attach')}
              className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 truncate ${
                activeTab === 'attach'
                  ? 'bg-white dark:bg-slate-700 text-[#B88E3E] shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              <Link2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Приєднати</span>
            </button>

            <button
              onClick={() => setActiveTab('existing')}
              className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 truncate ${
                activeTab === 'existing'
                  ? 'bg-white dark:bg-slate-700 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Зв'язки ({totalLinkedCount})</span>
            </button>
          </div>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
          
          {/* TAB 1: СТВОРИТИ НОВОГО РОДИЧА */}
          {activeTab === 'create' && (
            <div className="space-y-2.5">
              <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1">
                Оберіть кого створити:
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onOpenAddModalWithRelation('father', liveTargetPerson.id)}
                  className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/60 dark:bg-slate-800/60 hover:border-emerald-600 dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-slate-800 transition-all text-left group cursor-pointer shadow-2xs"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="font-bold text-xs text-neutral-900 dark:text-neutral-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                      Батько
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                    {linkedFather ? `Зараз: ${getPersonName(linkedFather)}` : '+ Додати батька'}
                  </p>
                </button>

                <button
                  onClick={() => onOpenAddModalWithRelation('mother', liveTargetPerson.id)}
                  className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/60 dark:bg-slate-800/60 hover:border-emerald-600 dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-slate-800 transition-all text-left group cursor-pointer shadow-2xs"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span className="font-bold text-xs text-neutral-900 dark:text-neutral-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                      Мати
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                    {linkedMother ? `Зараз: ${getPersonName(linkedMother)}` : '+ Додати матір'}
                  </p>
                </button>

                <button
                  onClick={() => onOpenAddModalWithRelation('spouse', liveTargetPerson.id)}
                  className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/60 dark:bg-slate-800/60 hover:border-emerald-600 dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-slate-800 transition-all text-left group cursor-pointer shadow-2xs"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <Heart className="w-3 h-3 text-pink-500 shrink-0" />
                    <span className="font-bold text-xs text-neutral-900 dark:text-neutral-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                      Партнер / Подружжя
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                    {linkedSpouses.length > 0 ? `${linkedSpouses.length} у списку` : '+ Чоловік / Дружина'}
                  </p>
                </button>

                <button
                  onClick={() => onOpenAddModalWithRelation('child', liveTargetPerson.id)}
                  className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/60 dark:bg-slate-800/60 hover:border-emerald-600 dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-slate-800 transition-all text-left group cursor-pointer shadow-2xs"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <Baby className="w-3 h-3 text-amber-500 shrink-0" />
                    <span className="font-bold text-xs text-neutral-900 dark:text-neutral-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                      Дитина
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                    {linkedChildren.length > 0 ? `${linkedChildren.length} дітей` : '+ Син / Дочка'}
                  </p>
                </button>

                <button
                  onClick={() => onOpenAddModalWithRelation('sibling', liveTargetPerson.id)}
                  className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/60 dark:bg-slate-800/60 hover:border-emerald-600 dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-slate-800 transition-all text-left group cursor-pointer shadow-2xs"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <Users className="w-3 h-3 text-indigo-500 shrink-0" />
                    <span className="font-bold text-xs text-neutral-900 dark:text-neutral-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                      Брат / Сестра
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                    + Рідний брат або сестра
                  </p>
                </button>

                <button
                  onClick={() => onOpenAddModalWithRelation('parent', liveTargetPerson.id)}
                  className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/60 dark:bg-slate-800/60 hover:border-emerald-600 dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-slate-800 transition-all text-left group cursor-pointer shadow-2xs"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <GitFork className="w-3 h-3 text-emerald-500 shrink-0" />
                    <span className="font-bold text-xs text-neutral-900 dark:text-neutral-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                      Один із батьків
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                    + Без уточнення статі
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: ПРИЄДНАТИ ІСНУЮЧУ ОСОБУ З БАЗИ */}
          {activeTab === 'attach' && (
            <div className="space-y-3">
              {/* Type pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold text-neutral-400 mr-1">Роль:</span>
                {[
                  { id: 'parent', label: 'Батько / Мати' },
                  { id: 'spouse', label: 'Партнер' },
                  { id: 'child', label: 'Дитина' },
                  { id: 'sibling', label: 'Брат/Сестра' }
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setAttachingType(type.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      attachingType === type.id
                        ? 'bg-[#B88E3E] text-white shadow-xs'
                        : 'bg-neutral-100 dark:bg-slate-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>

              {/* Search input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Пошук особи за ім'ям, роком..."
                  className="w-full pl-8.5 pr-3 py-1.5 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-slate-900 focus:outline-hidden focus:border-[#B88E3E]"
                  autoFocus
                />
              </div>

              {/* Compact candidate list */}
              <div className="max-h-56 overflow-y-auto space-y-1.5 scrollbar-thin pr-1">
                {candidatePersons.length === 0 ? (
                  <div className="py-6 text-center text-xs text-neutral-400">
                    Не знайдено відповідних осіб у базі
                  </div>
                ) : (
                  candidatePersons.map((cand) => (
                    <div
                      key={cand.id}
                      onClick={() => handleAttachExisting(cand)}
                      className="p-2 rounded-xl border border-neutral-100 dark:border-neutral-800 hover:border-[#B88E3E] hover:bg-amber-50/40 dark:hover:bg-slate-800/80 flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-md bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 shrink-0 text-[10px] font-bold">
                          {cand.gender === 'female' || cand.gender === 'F' ? 'Ж' : 'Ч'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 truncate">
                            {getPersonName(cand)}
                          </p>
                          <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                            {cand.birthYear ? `нар. ${cand.birthYear}` : ''} {cand.birthPlace ? `• ${cand.birthPlace}` : ''}
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-[#B88E3E]/15 text-[#B88E3E] hover:bg-[#B88E3E] hover:text-white rounded-md shrink-0 transition-colors">
                        Приєднати
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: НАЯВНІ ЗВ'ЯЗКИ ТА ВІД'ЄДНАННЯ */}
          {activeTab === 'existing' && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1">
                Поточні зв'язки особи:
              </div>

              {totalLinkedCount === 0 ? (
                <div className="py-6 text-center text-xs text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
                  Зв'язків ще не встановлено
                </div>
              ) : (
                <div className="space-y-1.5">
                  {linkedFather && (
                    <div className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-slate-800/40 flex items-center justify-between">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 block">Батько:</span>
                        <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate block">
                          {getPersonName(linkedFather)}
                        </span>
                      </div>
                      <button
                        onClick={handleUnlinkFather}
                        className="px-2 py-1 text-[10px] font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg flex items-center gap-1 transition-colors"
                        title="Від'єднати"
                      >
                        <Unlink className="w-3 h-3" />
                        <span>Від'єднати</span>
                      </button>
                    </div>
                  )}

                  {linkedMother && (
                    <div className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-slate-800/40 flex items-center justify-between">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 block">Мати:</span>
                        <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate block">
                          {getPersonName(linkedMother)}
                        </span>
                      </div>
                      <button
                        onClick={handleUnlinkMother}
                        className="px-2 py-1 text-[10px] font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg flex items-center gap-1 transition-colors"
                        title="Від'єднати"
                      >
                        <Unlink className="w-3 h-3" />
                        <span>Від'єднати</span>
                      </button>
                    </div>
                  )}

                  {linkedSpouses.map((sp) => (
                    <div key={sp.id} className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-slate-800/40 flex items-center justify-between">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-pink-600 dark:text-pink-400 block">Партнер / Подружжя:</span>
                        <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate block">
                          {getPersonName(sp)}
                        </span>
                      </div>
                      <button
                        onClick={() => handleUnlinkSpouse(sp)}
                        className="px-2 py-1 text-[10px] font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg flex items-center gap-1 transition-colors"
                        title="Від'єднати"
                      >
                        <Unlink className="w-3 h-3" />
                        <span>Від'єднати</span>
                      </button>
                    </div>
                  ))}

                  {linkedChildren.map((ch) => (
                    <div key={ch.id} className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-slate-800/40 flex items-center justify-between">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 block">Дитина:</span>
                        <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate block">
                          {getPersonName(ch)}
                        </span>
                      </div>
                      <button
                        onClick={() => handleUnlinkChild(ch)}
                        className="px-2 py-1 text-[10px] font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg flex items-center gap-1 transition-colors"
                        title="Від'єднати"
                      >
                        <Unlink className="w-3 h-3" />
                        <span>Від'єднати</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-slate-900/90 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
          >
            Закрити
          </button>
        </div>

      </div>
    </div>
  );
};
