/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { X, Search, Check, Unlink, User, Heart, GitFork, Users } from 'lucide-react';
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

  // Selector mode for attaching existing person: 'parent' | 'spouse' | 'child' | null
  const [attachingType, setAttachingType] = useState<'parent' | 'spouse' | 'child' | null>(null);
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
    // Also check mutual reverse link
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
    // Check fatherId/motherId points to target
    persons.forEach((p) => {
      if ((p.fatherId === liveTargetPerson.id || p.motherId === liveTargetPerson.id) && !list.some((item) => item.id === p.id)) {
        list.push(p);
      }
    });
    return list;
  }, [liveTargetPerson, persons]);

  // Candidates for attaching
  const candidatePersons = useMemo(() => {
    if (!attachingType) return [];
    const q = searchQuery.toLowerCase().trim();
    return persons.filter((p) => {
      if (p.id === liveTargetPerson.id) return false;
      // Filter out already linked in this role
      if (attachingType === 'parent' && (p.id === liveTargetPerson.fatherId || p.id === liveTargetPerson.motherId)) return false;
      if (attachingType === 'spouse' && (liveTargetPerson.spouseIds?.includes(p.id) || p.spouseIds?.includes(liveTargetPerson.id))) return false;
      if (attachingType === 'child' && (p.fatherId === liveTargetPerson.id || p.motherId === liveTargetPerson.id || liveTargetPerson.childrenIds?.includes(p.id))) return false;

      if (!q) return true;
      const fullName = getPersonName(p).toLowerCase();
      const birth = String(p.birthYear || p.birthDate || '').toLowerCase();
      return fullName.includes(q) || birth.includes(q);
    });
  }, [attachingType, searchQuery, persons, liveTargetPerson]);

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // Attach existing person
  const handleAttachExisting = (selectedPerson: Person) => {
    if (!attachingType) return;

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
      showFeedback(`Приєднано партнера: ${getPersonName(selectedPerson)}`);
    } else if (attachingType === 'child') {
      const isFemale = liveTargetPerson.gender === 'female' || liveTargetPerson.gender === 'F';
      updatePerson({
        ...liveTargetPerson,
        childrenIds: Array.from(new Set([...(liveTargetPerson.childrenIds || []), selectedPerson.id]))
      });
      if (isFemale) {
        updatePerson({ ...selectedPerson, motherId: liveTargetPerson.id });
      } else {
        updatePerson({ ...selectedPerson, fatherId: liveTargetPerson.id });
      }
      showFeedback(`Приєднано дитину: ${getPersonName(selectedPerson)}`);
    }

    setAttachingType(null);
    setSearchQuery('');
  };

  // Unlink relationships safely
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

  const hasAnyLinkedRelatives =
    Boolean(linkedFather) ||
    Boolean(linkedMother) ||
    linkedSpouses.length > 0 ||
    linkedChildren.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl bg-[#FAF8F5] dark:bg-slate-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl text-neutral-800 dark:text-neutral-100 relative scrollbar-thin my-auto">
        
        {/* Header */}
        <div className="px-6 sm:px-8 pt-6 pb-4 flex items-center justify-between border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white/70 dark:bg-slate-900/90 sticky top-0 z-10 backdrop-blur-md">
          <h2 className="text-xl sm:text-2xl font-bold font-serif text-emerald-950 dark:text-emerald-100 tracking-tight">
            Керування родичами для {targetFullName}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Закрити"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert if any */}
        {feedbackMsg && (
          <div className="mx-6 sm:mx-8 mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        <div className="p-6 sm:p-8 space-y-7">
          {/* SECTION 1: СТВОРИТИ НОВУ КАНОНІЧНУ ОСОБУ */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 block">
              СТВОРИТИ НОВУ КАНОНІЧНУ ОСОБУ
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => onOpenAddModalWithRelation('father', liveTargetPerson.id)}
                className="p-3.5 sm:p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-slate-800/70 hover:border-emerald-600 dark:hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-slate-800 transition-all text-left font-bold text-sm text-emerald-950 dark:text-emerald-200 shadow-2xs hover:shadow-sm cursor-pointer"
              >
                Додати батька
              </button>

              <button
                onClick={() => onOpenAddModalWithRelation('mother', liveTargetPerson.id)}
                className="p-3.5 sm:p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-slate-800/70 hover:border-emerald-600 dark:hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-slate-800 transition-all text-left font-bold text-sm text-emerald-950 dark:text-emerald-200 shadow-2xs hover:shadow-sm cursor-pointer"
              >
                Додати матір
              </button>

              <button
                onClick={() => onOpenAddModalWithRelation('parent', liveTargetPerson.id)}
                className="p-3.5 sm:p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-slate-800/70 hover:border-emerald-600 dark:hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-slate-800 transition-all text-left font-bold text-sm text-emerald-950 dark:text-emerald-200 shadow-2xs hover:shadow-sm cursor-pointer"
              >
                Додати одного з батьків
              </button>

              <button
                onClick={() => onOpenAddModalWithRelation('spouse', liveTargetPerson.id)}
                className="p-3.5 sm:p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-slate-800/70 hover:border-emerald-600 dark:hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-slate-800 transition-all text-left font-bold text-sm text-emerald-950 dark:text-emerald-200 shadow-2xs hover:shadow-sm cursor-pointer"
              >
                Додати партнера
              </button>

              <button
                onClick={() => onOpenAddModalWithRelation('child', liveTargetPerson.id)}
                className="p-3.5 sm:p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-slate-800/70 hover:border-emerald-600 dark:hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-slate-800 transition-all text-left font-bold text-sm text-emerald-950 dark:text-emerald-200 shadow-2xs hover:shadow-sm cursor-pointer"
              >
                Додати дитину
              </button>

              <button
                onClick={() => onOpenAddModalWithRelation('sibling', liveTargetPerson.id)}
                className="p-3.5 sm:p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-slate-800/70 hover:border-emerald-600 dark:hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-slate-800 transition-all text-left font-bold text-sm text-emerald-950 dark:text-emerald-200 shadow-2xs hover:shadow-sm cursor-pointer"
              >
                Додати брата або сестру
              </button>
            </div>
          </div>

          {/* SECTION 2: ПРИЄДНАТИ ОСОБУ, ЯКА ВЖЕ Є У ПРОЄКТІ */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 block">
              ПРИЄДНАТИ ОСОБУ, ЯКА ВЖЕ Є У ПРОЄКТІ
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setAttachingType(attachingType === 'parent' ? null : 'parent');
                  setSearchQuery('');
                }}
                className={`p-3.5 sm:p-4 rounded-xl border ${
                  attachingType === 'parent'
                    ? 'border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50 dark:bg-emerald-950/40'
                    : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-slate-800/70 hover:border-emerald-600 hover:bg-emerald-50/40 dark:hover:bg-slate-800'
                } transition-all text-left font-bold text-sm text-emerald-950 dark:text-emerald-200 shadow-2xs hover:shadow-sm cursor-pointer`}
              >
                Приєднати як одного з батьків
              </button>

              <button
                onClick={() => {
                  setAttachingType(attachingType === 'spouse' ? null : 'spouse');
                  setSearchQuery('');
                }}
                className={`p-3.5 sm:p-4 rounded-xl border ${
                  attachingType === 'spouse'
                    ? 'border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50 dark:bg-emerald-950/40'
                    : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-slate-800/70 hover:border-emerald-600 hover:bg-emerald-50/40 dark:hover:bg-slate-800'
                } transition-all text-left font-bold text-sm text-emerald-950 dark:text-emerald-200 shadow-2xs hover:shadow-sm cursor-pointer`}
              >
                Приєднати як партнера
              </button>

              <button
                onClick={() => {
                  setAttachingType(attachingType === 'child' ? null : 'child');
                  setSearchQuery('');
                }}
                className={`p-3.5 sm:p-4 rounded-xl border ${
                  attachingType === 'child'
                    ? 'border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50 dark:bg-emerald-950/40'
                    : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-slate-800/70 hover:border-emerald-600 hover:bg-emerald-50/40 dark:hover:bg-slate-800'
                } transition-all text-left font-bold text-sm text-emerald-950 dark:text-emerald-200 shadow-2xs hover:shadow-sm cursor-pointer`}
              >
                Приєднати як дитину
              </button>
            </div>

            {/* Inline Person Picker when attachingType is active */}
            {attachingType && (
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-850 border border-emerald-600/40 dark:border-emerald-500/40 shadow-lg space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    Оберіть особу з бази для зв'язку (
                    {attachingType === 'parent' ? 'Батько/Мати' : attachingType === 'spouse' ? 'Партнер' : 'Дитина'}):
                  </span>
                  <button
                    onClick={() => setAttachingType(null)}
                    className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                  >
                    Скасувати
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Пошук особи за ім'ям, прізвищем чи роком народження..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-slate-900 focus:outline-hidden focus:border-emerald-600"
                    autoFocus
                  />
                </div>

                <div className="max-h-52 overflow-y-auto space-y-1.5 scrollbar-thin">
                  {candidatePersons.length === 0 ? (
                    <div className="py-4 text-center text-xs text-neutral-400">
                      Не знайдено відповідних осіб у базі даних
                    </div>
                  ) : (
                    candidatePersons.map((cand) => (
                      <div
                        key={cand.id}
                        onClick={() => handleAttachExisting(cand)}
                        className="p-2.5 rounded-xl border border-neutral-100 dark:border-neutral-800 hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 shrink-0">
                            <User className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-neutral-900 dark:text-neutral-100 truncate">
                              {getPersonName(cand)}
                            </p>
                            <p className="text-[10px] text-neutral-500 truncate">
                              {cand.birthYear ? `нар. ${cand.birthYear}` : ''} {cand.deathYear ? `— пом. ${cand.deathYear}` : ''} {cand.birthPlace ? `(${cand.birthPlace})` : ''}
                            </p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 rounded-lg shrink-0">
                          Обрати
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: ВІДВ'ЯЗАТИ РАНІШЕ ПРИЄДНАНУ ОСОБУ */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 block">
              ВІДВ'ЯЗАТИ РАНІШЕ ПРИЄДНАНУ ОСОБУ
            </span>

            {!hasAnyLinkedRelatives ? (
              <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/40 dark:bg-slate-800/30 text-center text-xs text-neutral-400">
                Немає раніше приєднаних родичів
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* Father */}
                {linkedFather && (
                  <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/90 dark:border-rose-900/50 rounded-xl p-3.5 flex items-center justify-between transition-all">
                    <div>
                      <div className="font-bold text-sm text-rose-950 dark:text-rose-200">
                        Батько: {getPersonName(linkedFather)}
                      </div>
                      <button
                        onClick={handleUnlinkFather}
                        className="text-xs text-rose-800 dark:text-rose-400 font-semibold hover:text-rose-950 dark:hover:text-rose-200 hover:underline cursor-pointer"
                      >
                        Видалити лише зв'язок
                      </button>
                    </div>
                    <button
                      onClick={handleUnlinkFather}
                      className="p-1.5 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg transition-colors"
                      title="Від'єднати"
                    >
                      <Unlink className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Mother */}
                {linkedMother && (
                  <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/90 dark:border-rose-900/50 rounded-xl p-3.5 flex items-center justify-between transition-all">
                    <div>
                      <div className="font-bold text-sm text-rose-950 dark:text-rose-200">
                        Мати: {getPersonName(linkedMother)}
                      </div>
                      <button
                        onClick={handleUnlinkMother}
                        className="text-xs text-rose-800 dark:text-rose-400 font-semibold hover:text-rose-950 dark:hover:text-rose-200 hover:underline cursor-pointer"
                      >
                        Видалити лише зв'язок
                      </button>
                    </div>
                    <button
                      onClick={handleUnlinkMother}
                      className="p-1.5 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg transition-colors"
                      title="Від'єднати"
                    >
                      <Unlink className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Spouses */}
                {linkedSpouses.map((spouse) => (
                  <div
                    key={spouse.id}
                    className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/90 dark:border-rose-900/50 rounded-xl p-3.5 flex items-center justify-between transition-all"
                  >
                    <div>
                      <div className="font-bold text-sm text-rose-950 dark:text-rose-200">
                        Партнер / Подружжя: {getPersonName(spouse)}
                      </div>
                      <button
                        onClick={() => handleUnlinkSpouse(spouse)}
                        className="text-xs text-rose-800 dark:text-rose-400 font-semibold hover:text-rose-950 dark:hover:text-rose-200 hover:underline cursor-pointer"
                      >
                        Видалити лише зв'язок
                      </button>
                    </div>
                    <button
                      onClick={() => handleUnlinkSpouse(spouse)}
                      className="p-1.5 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg transition-colors"
                      title="Від'єднати"
                    >
                      <Unlink className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {/* Children */}
                {linkedChildren.map((child) => (
                  <div
                    key={child.id}
                    className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/90 dark:border-rose-900/50 rounded-xl p-3.5 flex items-center justify-between transition-all"
                  >
                    <div>
                      <div className="font-bold text-sm text-rose-950 dark:text-rose-200">
                        Дитина: {getPersonName(child)}
                      </div>
                      <button
                        onClick={() => handleUnlinkChild(child)}
                        className="text-xs text-rose-800 dark:text-rose-400 font-semibold hover:text-rose-950 dark:hover:text-rose-200 hover:underline cursor-pointer"
                      >
                        Видалити лише зв'язок
                      </button>
                    </div>
                    <button
                      onClick={() => handleUnlinkChild(child)}
                      className="p-1.5 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg transition-colors"
                      title="Від'єднати"
                    >
                      <Unlink className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
