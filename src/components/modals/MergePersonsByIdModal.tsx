/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MergePersonsByIdModal - Tool to merge two persons by ID or search
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  GitMerge,
  ArrowLeftRight,
  Search,
  AlertTriangle,
  CheckCircle2,
  User,
  Calendar,
  MapPin,
  Users,
  Sparkles,
  SlidersHorizontal,
  Info,
  Check,
  AlertCircle
} from 'lucide-react';
import { Person, Family, DuplicatePair, MergeFieldSelection } from '../../types';
import { useGenealogy } from '../../context/GenealogyContext';
import { getThemeConfig } from '../../utils/theme';
import { comparePersonPair } from '../../utils/duplicateDetector';
import { executeSmartPersonMerge } from '../../utils/personMerge';
import { SmartMergeModal } from '../../rodovid/components/modals/SmartMergeModal';

export interface MergePersonsByIdModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPersonAId?: string | null;
  initialPersonBId?: string | null;
  onMergeSuccess?: (masterPerson: Person) => void;
}

export const MergePersonsByIdModal: React.FC<MergePersonsByIdModalProps> = ({
  isOpen,
  onClose,
  initialPersonAId,
  initialPersonBId,
  onMergeSuccess
}) => {
  const { persons, setPersons, families, setFamilies, themePalette, setSelectedPersonId } = useGenealogy();
  const theme = getThemeConfig(themePalette);
  const isDark = themePalette.includes('dark');

  const [idA, setIdA] = useState<string>(initialPersonAId || '');
  const [idB, setIdB] = useState<string>(initialPersonBId || '');
  const [searchA, setSearchA] = useState<string>('');
  const [searchB, setSearchB] = useState<string>('');
  const [showSearchDropA, setShowSearchDropA] = useState<boolean>(false);
  const [showSearchDropB, setShowSearchDropB] = useState<boolean>(false);

  const [masterTarget, setMasterTarget] = useState<'A' | 'B'>('A');
  const [isDetailedMergeOpen, setIsDetailedMergeOpen] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (initialPersonAId) setIdA(initialPersonAId);
    if (initialPersonBId) setIdB(initialPersonBId);
  }, [initialPersonAId, initialPersonBId]);

  const personA = useMemo(() => {
    if (!idA.trim()) return null;
    return persons.find((p) => p.id.toLowerCase() === idA.trim().toLowerCase()) || null;
  }, [idA, persons]);

  const personB = useMemo(() => {
    if (!idB.trim()) return null;
    return persons.find((p) => p.id.toLowerCase() === idB.trim().toLowerCase()) || null;
  }, [idB, persons]);

  // Autocomplete candidates for search A
  const candidatesA = useMemo(() => {
    if (!searchA.trim() || searchA.length < 2) return [];
    const q = searchA.toLowerCase().trim();
    return persons
      .filter((p) => {
        if (p.id === idB) return false;
        const name = `${p.name?.surname || p.lastName || ''} ${p.name?.given || p.firstName || ''} ${p.name?.patronymic || p.patronymic || ''} ${p.id}`.toLowerCase();
        return name.includes(q);
      })
      .slice(0, 8);
  }, [searchA, persons, idB]);

  // Autocomplete candidates for search B
  const candidatesB = useMemo(() => {
    if (!searchB.trim() || searchB.length < 2) return [];
    const q = searchB.toLowerCase().trim();
    return persons
      .filter((p) => {
        if (p.id === idA) return false;
        const name = `${p.name?.surname || p.lastName || ''} ${p.name?.given || p.firstName || ''} ${p.name?.patronymic || p.patronymic || ''} ${p.id}`.toLowerCase();
        return name.includes(q);
      })
      .slice(0, 8);
  }, [searchB, persons, idA]);

  // Swap A and B
  const handleSwap = () => {
    const tempId = idA;
    setIdA(idB);
    setIdB(tempId);
    setMasterTarget((prev) => (prev === 'A' ? 'B' : 'A'));
  };

  // Compare pair
  const comparison = useMemo(() => {
    if (!personA || !personB || personA.id === personB.id) return null;
    return comparePersonPair(personA, personB);
  }, [personA, personB]);

  // DuplicatePair object for detailed SmartMergeModal
  const duplicatePairObj: DuplicatePair | null = useMemo(() => {
    if (!personA || !personB || personA.id === personB.id) return null;
    return {
      id: `merge_${personA.id}_${personB.id}`,
      personA,
      personB,
      confidence: comparison ? comparison.confidence : 75,
      confidenceLevel: comparison ? comparison.confidenceLevel : 'high',
      reasons: comparison?.reasons || ['Ручне обʼєднання за ідентифікаторами ID'],
      breakdown: comparison?.breakdown || {
        surnameScore: 50,
        givenNameScore: 50,
        datesScore: 0,
        locationScore: 0,
        relationsScore: 0
      }
    };
  }, [personA, personB, comparison]);

  // Quick merge execute
  const handleQuickMerge = () => {
    if (!personA || !personB) return;
    if (personA.id === personB.id) {
      setStatusMessage({ type: 'error', text: 'Неможливо обʼєднати особу із самою собою' });
      return;
    }

    try {
      const defaultSelection: MergeFieldSelection = {
        given: masterTarget,
        surname: masterTarget,
        patronymic: masterTarget,
        maidenName: masterTarget,
        gender: masterTarget,
        birthDate: personA.birthDate ? 'A' : (personB.birthDate ? 'B' : 'A'),
        birthPlace: personA.birthPlace ? 'A' : (personB.birthPlace ? 'B' : 'A'),
        deathDate: personA.deathDate ? 'A' : (personB.deathDate ? 'B' : 'A'),
        deathPlace: personA.deathPlace ? 'A' : (personB.deathPlace ? 'B' : 'A'),
        isLiving: masterTarget,
        occupation: personA.occupation ? 'A' : (personB.occupation ? 'B' : 'A'),
        estateOrSocialStatus: personA.estateOrSocialStatus ? 'A' : (personB.estateOrSocialStatus ? 'B' : 'A'),
        militaryRank: personA.militaryRank ? 'A' : (personB.militaryRank ? 'B' : 'A'),
        confession: personA.confession ? 'A' : (personB.confession ? 'B' : 'A'),
        avatar: (personA.avatarUrl || personA.avatar) ? 'A' : ((personB.avatarUrl || personB.avatar) ? 'B' : 'A'),
        combineBio: true,
        combineNotes: true,
        combineSources: true,
        combineEvents: true,
        combineRelations: true
      };

      const result = executeSmartPersonMerge(
        personA,
        personB,
        defaultSelection,
        persons,
        families,
        masterTarget
      );

      setPersons(result.updatedPersons);
      if (result.updatedFamilies && Object.keys(result.updatedFamilies).length > 0) {
        setFamilies(result.updatedFamilies);
      }

      setSelectedPersonId(result.masterPerson.id);
      if (onMergeSuccess) {
        onMergeSuccess(result.masterPerson);
      }
      onClose();
    } catch (err: any) {
      console.error('Error during merge:', err);
      setStatusMessage({ type: 'error', text: `Помилка при злитті: ${err.message || 'Невідома помилка'}` });
    }
  };

  const handleDetailedMergeComplete = (
    updatedPersons: Person[],
    updatedFamilies: Record<string, Family>,
    masterName: string
  ) => {
    setPersons(updatedPersons);
    if (updatedFamilies && Object.keys(updatedFamilies).length > 0) {
      setFamilies(updatedFamilies);
    }
    const targetId = masterTarget === 'A' ? personA?.id : personB?.id;
    if (targetId) setSelectedPersonId(targetId);

    setIsDetailedMergeOpen(false);
    onClose();
  };

  if (!isOpen) return null;

  const renderPersonCard = (person: Person | null, label: string, isMaster: boolean) => {
    if (!person) {
      return (
        <div className={`p-4 rounded-2xl border border-dashed ${theme.cardBorder} bg-black/5 dark:bg-white/5 flex flex-col items-center justify-center text-center min-h-[220px]`}>
          <User className="w-10 h-10 text-neutral-400 mb-2 opacity-50" />
          <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            {label} не вибрана
          </p>
          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">
            Введіть точний ID або скористайтеся пошуком за прізвищем/іменем
          </p>
        </div>
      );
    }

    const fullName = `${person.name?.surname || person.lastName || ''} ${person.name?.given || person.firstName || ''} ${person.name?.patronymic || person.patronymic || ''}`.trim() || 'Без імені';
    const father = persons.find((p) => p.id === person.fatherId);
    const mother = persons.find((p) => p.id === person.motherId);
    const spouseCount = (person.spouseIds || []).length;
    const childrenCount = (person.childrenIds || []).length;
    const godparentCount = (person.godparents || []).length;

    return (
      <div className={`p-4 rounded-2xl border transition-all ${isMaster ? 'border-amber-500/60 bg-amber-500/5 ring-1 ring-amber-500/30' : `${theme.cardBorder} ${theme.cardBg}`} flex flex-col justify-between min-h-[220px]`}>
        <div>
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isMaster
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
              }`}>
                {isMaster ? '👑 Основний профіль (зберігається ID)' : 'Буде обʼєднано та видалено'}
              </span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border border-neutral-200 dark:border-neutral-700">
              ID: {person.id}
            </span>
          </div>

          <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${person.gender === 'female' || person.gender === 'F' ? 'bg-rose-500' : 'bg-blue-500'}`} />
            {fullName}
          </h4>

          <div className="mt-2 space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
            {(person.birthDate || person.birthYear || person.birthPlace) && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <span className="truncate">
                  Нар: {person.birthDate || person.birthYear || '—'} {person.birthPlace ? `(${person.birthPlace})` : ''}
                </span>
              </div>
            )}
            {(person.deathDate || person.deathYear || person.deathPlace) && (
              <div className="flex items-center gap-1.5">
                <span className="text-neutral-400 font-bold px-0.5 text-[10px]">✝</span>
                <span className="truncate">
                  См: {person.deathDate || person.deathYear || '—'} {person.deathPlace ? `(${person.deathPlace})` : ''}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5 pt-1 text-[11px] text-neutral-500">
              <Users className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <span>
                {father ? `Батько: ${father.name?.surname || father.lastName || father.firstName || father.id}` : ''}
                {father && mother ? ', ' : ''}
                {mother ? `Мати: ${mother.name?.surname || mother.lastName || mother.firstName || mother.id}` : ''}
                {!father && !mother ? 'Батьки не зазначені' : ''}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[11px] text-neutral-500">
          <span>Подружжя: <strong>{spouseCount}</strong> • Дітей: <strong>{childrenCount}</strong></span>
          {godparentCount > 0 && <span>Хрещених: <strong>{godparentCount}</strong></span>}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
        <div className={`w-full max-w-4xl rounded-2xl md:rounded-3xl ${theme.cardBg} border ${theme.cardBorder} shadow-2xl overflow-hidden flex flex-col max-h-[92vh]`}>
          
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-black/10 dark:border-white/10 flex items-center justify-between bg-black/5 dark:bg-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/30">
                <GitMerge className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Обʼєднання осіб (Merge by ID)
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Злиття двох профілів-дублікатів в одну спільну картку без втрати звʼязків
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-5 overflow-y-auto space-y-5">
            
            {statusMessage && (
              <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 text-rose-800 dark:text-rose-300'
              }`}>
                {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{statusMessage.text}</span>
              </div>
            )}

            {/* Inputs Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
              
              {/* Person A Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                    <span>Перша особа (Особа A):</span>
                  </label>
                  {personA && (
                    <button
                      onClick={() => setIdA('')}
                      className="text-[11px] text-rose-500 hover:underline cursor-pointer"
                    >
                      Очистити
                    </button>
                  )}
                </div>

                <div className="relative">
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={idA}
                        onChange={(e) => {
                          setIdA(e.target.value);
                          setSearchA(e.target.value);
                          setShowSearchDropA(true);
                        }}
                        onFocus={() => setShowSearchDropA(true)}
                        placeholder="Введіть ID (напр. p1) або прізвище..."
                        className={`w-full px-3 py-2 pl-8 text-xs rounded-xl border ${theme.inputBorder} ${theme.inputBg} focus:ring-2 focus:ring-amber-500 outline-none`}
                      />
                      <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  {/* Autocomplete Dropdown A */}
                  {showSearchDropA && candidatesA.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-30 p-1 rounded-xl bg-white dark:bg-slate-850 border border-neutral-200 dark:border-neutral-700 shadow-xl max-h-48 overflow-y-auto">
                      {candidatesA.map((cand) => (
                        <button
                          key={cand.id}
                          onClick={() => {
                            setIdA(cand.id);
                            setShowSearchDropA(false);
                          }}
                          className="w-full text-left p-2 rounded-lg text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-between transition-colors cursor-pointer"
                        >
                          <div>
                            <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                              {cand.name?.surname || cand.lastName || ''} {cand.name?.given || cand.firstName || ''}
                            </span>
                            <span className="text-[10px] text-neutral-500 block">
                              {cand.birthDate || cand.birthYear ? `Нар: ${cand.birthDate || cand.birthYear}` : ''}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono px-1 rounded bg-neutral-100 dark:bg-neutral-700 text-neutral-500">
                            {cand.id}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {renderPersonCard(personA, 'Особа A', masterTarget === 'A')}
              </div>

              {/* Swap Button (Desktop floating between, mobile between rows) */}
              <div className="flex md:flex-col items-center justify-center my-1 md:my-0">
                <button
                  onClick={handleSwap}
                  disabled={!personA && !personB}
                  className="px-3 py-1.5 md:p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-slate-800 hover:bg-neutral-200 dark:hover:bg-slate-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-40 cursor-pointer"
                  title="Поміняти місцями"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  <span className="md:hidden">Поміняти місцями A ⇄ B</span>
                </button>
              </div>

              {/* Person B Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                    <span>Друга особа (Особа B - дублікат):</span>
                  </label>
                  {personB && (
                    <button
                      onClick={() => setIdB('')}
                      className="text-[11px] text-rose-500 hover:underline cursor-pointer"
                    >
                      Очистити
                    </button>
                  )}
                </div>

                <div className="relative">
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={idB}
                        onChange={(e) => {
                          setIdB(e.target.value);
                          setSearchB(e.target.value);
                          setShowSearchDropB(true);
                        }}
                        onFocus={() => setShowSearchDropB(true)}
                        placeholder="Введіть ID (напр. p2) або прізвище дубліката..."
                        className={`w-full px-3 py-2 pl-8 text-xs rounded-xl border ${theme.inputBorder} ${theme.inputBg} focus:ring-2 focus:ring-amber-500 outline-none`}
                      />
                      <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  {/* Autocomplete Dropdown B */}
                  {showSearchDropB && candidatesB.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-30 p-1 rounded-xl bg-white dark:bg-slate-850 border border-neutral-200 dark:border-neutral-700 shadow-xl max-h-48 overflow-y-auto">
                      {candidatesB.map((cand) => (
                        <button
                          key={cand.id}
                          onClick={() => {
                            setIdB(cand.id);
                            setShowSearchDropB(false);
                          }}
                          className="w-full text-left p-2 rounded-lg text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-between transition-colors cursor-pointer"
                        >
                          <div>
                            <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                              {cand.name?.surname || cand.lastName || ''} {cand.name?.given || cand.firstName || ''}
                            </span>
                            <span className="text-[10px] text-neutral-500 block">
                              {cand.birthDate || cand.birthYear ? `Нар: ${cand.birthDate || cand.birthYear}` : ''}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono px-1 rounded bg-neutral-100 dark:bg-neutral-700 text-neutral-500">
                            {cand.id}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {renderPersonCard(personB, 'Особа B', masterTarget === 'B')}
              </div>

            </div>

            {/* Target ID Selector */}
            {personA && personB && (
              <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                    Виберіть, який ID зберегти як основний (Primary ID):
                  </span>
                  {comparison && (
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      comparison.confidence >= 75
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                    }`}>
                      {comparison.confidence}% схожість ({comparison.confidenceLevel === 'very_high' ? 'Дуже висока' : comparison.confidenceLevel === 'high' ? 'Висока' : 'Ймовірна'})
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    masterTarget === 'A'
                      ? 'border-amber-500 bg-amber-500/10 font-bold text-neutral-900 dark:text-neutral-100'
                      : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                  }`}>
                    <input
                      type="radio"
                      name="masterTarget"
                      checked={masterTarget === 'A'}
                      onChange={() => setMasterTarget('A')}
                      className="text-amber-600"
                    />
                    <span>Зберегти ID Особи A: <strong>{personA.id}</strong> ({personA.name?.surname || personA.lastName} {personA.name?.given || personA.firstName})</span>
                  </label>

                  <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    masterTarget === 'B'
                      ? 'border-amber-500 bg-amber-500/10 font-bold text-neutral-900 dark:text-neutral-100'
                      : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                  }`}>
                    <input
                      type="radio"
                      name="masterTarget"
                      checked={masterTarget === 'B'}
                      onChange={() => setMasterTarget('B')}
                      className="text-amber-600"
                    />
                    <span>Зберегти ID Особи B: <strong>{personB.id}</strong> ({personB.name?.surname || personB.lastName} {personB.name?.given || personB.firstName})</span>
                  </label>
                </div>

                {comparison?.reasons && comparison.reasons.length > 0 && (
                  <div className="pt-2 text-[11px] text-neutral-500 space-y-0.5">
                    <span className="font-semibold text-neutral-600 dark:text-neutral-400">Фактори схожості:</span>
                    <ul className="list-disc list-inside space-y-0.5 pl-1">
                      {comparison.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Info notice */}
            <div className="p-3 rounded-xl bg-neutral-100 dark:bg-slate-800/60 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-600 dark:text-neutral-300 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-neutral-900 dark:text-neutral-100">Що відбудеться після обʼєднання:</strong>
                <p className="mt-0.5 text-[11px] leading-relaxed">
                  Всі батьки, подружжя, діти, хрещені батьки, похресники, біографічні нотатки, фотографії та події з обох карток обʼєднаються. Всі інші родичі в дереві, що посилалися на дублікат, автоматично переключаться на збережений ID. Запис-дублікат буде коректно видалено з дерева.
                </p>
              </div>
            </div>

          </div>

          {/* Footer Actions */}
          <div className="px-5 py-3.5 border-t border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-neutral-500">
              {personA && personB && personA.id !== personB.id ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <Check className="w-4 h-4" /> Готово до безпечного злиття
                </span>
              ) : (
                <span>Виберіть дві різні особи для активації обʼєднання</span>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
              >
                Скасувати
              </button>

              {duplicatePairObj && (
                <button
                  type="button"
                  onClick={() => setIsDetailedMergeOpen(true)}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-slate-800 text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Налаштувати кожне поле вручну"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Вибрати поля</span>
                </button>
              )}

              <button
                type="button"
                disabled={!personA || !personB || personA.id === personB.id}
                onClick={handleQuickMerge}
                className="flex-1 sm:flex-none px-5 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <GitMerge className="w-4 h-4" />
                <span>Обʼєднати особи</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Optional Detailed Field Selection SmartMergeModal */}
      {isDetailedMergeOpen && duplicatePairObj && (
        <SmartMergeModal
          pair={duplicatePairObj}
          allPersons={persons}
          allFamilies={families}
          isOpen={isDetailedMergeOpen}
          onClose={() => setIsDetailedMergeOpen(false)}
          onMergeComplete={handleDetailedMergeComplete}
        />
      )}
    </>
  );
};
