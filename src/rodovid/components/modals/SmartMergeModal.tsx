/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Interactive Smart Merge Modal
 */

import React, { useState } from 'react';
import {
  X,
  GitMerge,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  User,
  Calendar,
  MapPin,
  Briefcase,
  BookOpen,
  Heart,
  Users,
  Sparkles,
  Info
} from 'lucide-react';
import { Person, DuplicatePair, MergeFieldSelection, Family } from '../../../types';
import { executeSmartPersonMerge } from '../../../utils/personMerge';

interface SmartMergeModalProps {
  pair: DuplicatePair;
  allPersons: Person[];
  allFamilies: Record<string, Family>;
  isOpen: boolean;
  onClose: () => void;
  onMergeComplete: (updatedPersons: Person[], updatedFamilies: Record<string, Family>, masterName: string) => void;
}

export const SmartMergeModal: React.FC<SmartMergeModalProps> = ({
  pair,
  allPersons,
  allFamilies,
  isOpen,
  onClose,
  onMergeComplete
}) => {
  const { personA, personB, confidence, confidenceLevel, reasons } = pair;

  // Master target: which ID remains primary
  const [masterTarget, setMasterTarget] = useState<'A' | 'B'>('A');

  // Field selections
  const [selection, setSelection] = useState<MergeFieldSelection>({
    given: 'A',
    surname: 'A',
    patronymic: 'A',
    maidenName: 'A',
    gender: 'A',
    birthDate: personA.birthDate ? 'A' : (personB.birthDate ? 'B' : 'A'),
    birthPlace: personA.birthPlace ? 'A' : (personB.birthPlace ? 'B' : 'A'),
    deathDate: personA.deathDate ? 'A' : (personB.deathDate ? 'B' : 'A'),
    deathPlace: personA.deathPlace ? 'A' : (personB.deathPlace ? 'B' : 'A'),
    isLiving: 'A',
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
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const nameA = `${personA.name?.surname || personA.lastName || ''} ${personA.name?.given || personA.firstName || ''}`.trim() || personA.id;
  const nameB = `${personB.name?.surname || personB.lastName || ''} ${personB.name?.given || personB.firstName || ''}`.trim() || personB.id;

  const fatherA = allPersons.find(p => p.id === personA.fatherId);
  const fatherB = allPersons.find(p => p.id === personB.fatherId);
  const fatherNameA = fatherA ? `${fatherA.name?.surname || fatherA.lastName || ''} ${fatherA.name?.given || fatherA.firstName || ''}`.trim() : (personA.fatherId || null);
  const fatherNameB = fatherB ? `${fatherB.name?.surname || fatherB.lastName || ''} ${fatherB.name?.given || fatherB.firstName || ''}`.trim() : (personB.fatherId || null);

  const motherA = allPersons.find(p => p.id === personA.motherId);
  const motherB = allPersons.find(p => p.id === personB.motherId);
  const motherNameA = motherA ? `${motherA.name?.surname || motherA.lastName || ''} ${motherA.name?.given || motherA.firstName || ''}`.trim() : (personA.motherId || null);
  const motherNameB = motherB ? `${motherB.name?.surname || motherB.lastName || ''} ${motherB.name?.given || motherB.firstName || ''}`.trim() : (personB.motherId || null);

  const criteria = pair.criteria;

  const handleExecuteMerge = () => {
    setIsSubmitting(true);
    try {
      const result = executeSmartPersonMerge(
        personA,
        personB,
        selection,
        allPersons,
        allFamilies,
        masterTarget
      );

      const chosenMasterName = masterTarget === 'A' ? nameA : nameB;
      onMergeComplete(result.updatedPersons, result.updatedFamilies, chosenMasterName);
      onClose();
    } catch (err) {
      console.error('Merge error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const setFieldChoice = (field: keyof MergeFieldSelection, val: any) => {
    setSelection(prev => ({ ...prev, [field]: val }));
  };

  // Helper row component
  const FieldRow: React.FC<{
    label: string;
    fieldKey: keyof MergeFieldSelection;
    valA: string | undefined | null;
    valB: string | undefined | null;
    icon?: React.FC<{ className?: string }>;
  }> = ({ label, fieldKey, valA, valB, icon: Icon }) => {
    const choice = selection[fieldKey];
    const displayA = valA || '—';
    const displayB = valB || '—';

    return (
      <div className="grid grid-cols-12 items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-neutral-800/40 transition-colors border-b border-neutral-800/50">
        <div className="col-span-3 flex items-center gap-2 text-xs font-medium text-neutral-400">
          {Icon && <Icon className="w-3.5 h-3.5 text-[#B88E3E] shrink-0" />}
          <span>{label}</span>
        </div>

        {/* Option A */}
        <div 
          onClick={() => setFieldChoice(fieldKey, 'A')}
          className={`col-span-4 p-2 rounded-lg cursor-pointer transition-all border text-xs flex items-center justify-between ${
            choice === 'A'
              ? 'bg-[#B88E3E]/15 border-[#B88E3E] text-white shadow-xs'
              : 'bg-neutral-900/60 border-neutral-800 text-neutral-300 hover:border-neutral-700'
          }`}
        >
          <span className="truncate">{displayA}</span>
          {choice === 'A' && <CheckCircle2 className="w-3.5 h-3.5 text-[#B88E3E] shrink-0 ml-1.5" />}
        </div>

        {/* Arrow indicator */}
        <div className="col-span-1 flex justify-center text-neutral-600">
          <ArrowRight className="w-3.5 h-3.5" />
        </div>

        {/* Option B */}
        <div 
          onClick={() => setFieldChoice(fieldKey, 'B')}
          className={`col-span-4 p-2 rounded-lg cursor-pointer transition-all border text-xs flex items-center justify-between ${
            choice === 'B'
              ? 'bg-[#B88E3E]/15 border-[#B88E3E] text-white shadow-xs'
              : 'bg-neutral-900/60 border-neutral-800 text-neutral-300 hover:border-neutral-700'
          }`}
        >
          <span className="truncate">{displayB}</span>
          {choice === 'B' && <CheckCircle2 className="w-3.5 h-3.5 text-[#B88E3E] shrink-0 ml-1.5" />}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#1e1e1e] border border-neutral-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#B88E3E]/20 border border-[#B88E3E]/40 flex items-center justify-center text-[#B88E3E] shadow-xs">
              <GitMerge className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-bold text-white leading-tight">
                  Майстер розумного злиття персон
                </h2>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${
                  confidence >= 85
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : confidence >= 70
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                }`}>
                  {confidence}% збіг
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Виберіть, які дані зберегти, та обʼєднайте родинні звʼязки, джерела й події в одну основну картку.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Reasons Banner */}
        {reasons && reasons.length > 0 && (
          <div className="px-5 py-2.5 bg-[#B88E3E]/10 border-b border-[#B88E3E]/20 flex items-center gap-2 text-xs text-[#d1b06c] shrink-0">
            <Sparkles className="w-4 h-4 shrink-0 text-[#B88E3E]" />
            <span className="font-semibold">Критерії виявлення:</span>
            <span className="truncate">{reasons.join(' • ')}</span>
          </div>
        )}

        {/* 3 Core Verification Pillars Badges */}
        {criteria && (
          <div className="px-4 py-2.5 bg-neutral-950/60 border-b border-neutral-800 grid grid-cols-1 md:grid-cols-3 gap-2 shrink-0">
            {/* 1. PIB */}
            <div className="p-2 rounded-lg bg-neutral-900/90 border border-neutral-800 flex items-center gap-2">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                criteria.pibMatch === 'exact'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                ПІБ {criteria.pibScore}%
              </span>
              <span className="text-xs text-neutral-300 truncate" title={criteria.pibDetails}>
                {criteria.pibDetails}
              </span>
            </div>

            {/* 2. Birth Date */}
            <div className="p-2 rounded-lg bg-neutral-900/90 border border-neutral-800 flex items-center gap-2">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                criteria.birthMatch === 'exact'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : criteria.birthMatch === 'close'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
              }`}>
                Народження
              </span>
              <span className="text-xs text-neutral-300 truncate" title={criteria.birthDetails}>
                {criteria.birthDetails}
              </span>
            </div>

            {/* 3. Parents */}
            <div className="p-2 rounded-lg bg-neutral-900/90 border border-neutral-800 flex items-center gap-2">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                criteria.parentsMatch === 'both'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : criteria.parentsMatch === 'father' || criteria.parentsMatch === 'mother' || criteria.parentsMatch === 'patronymic'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
              }`}>
                Батьки
              </span>
              <span className="text-xs text-neutral-300 truncate" title={criteria.parentsDetails}>
                {criteria.parentsDetails}
              </span>
            </div>
          </div>
        )}

        {/* Master Selector Bar */}
        <div className="p-4 bg-neutral-900/60 border-b border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-neutral-300 font-medium">
            Виберіть цільову картку, яка залишиться в базі:
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => setMasterTarget('A')}
              className={`flex-1 md:flex-initial px-4 py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                masterTarget === 'A'
                  ? 'bg-[#B88E3E] text-neutral-950 border-[#B88E3E] shadow-sm'
                  : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:border-neutral-600'
              }`}
            >
              Основна: {nameA} (ID: {personA.id})
            </button>
            <button
              onClick={() => setMasterTarget('B')}
              className={`flex-1 md:flex-initial px-4 py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                masterTarget === 'B'
                  ? 'bg-[#B88E3E] text-neutral-950 border-[#B88E3E] shadow-sm'
                  : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:border-neutral-600'
              }`}
            >
              Основна: {nameB} (ID: {personB.id})
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4">
          
          {/* Side by side field comparison table */}
          <div className="bg-neutral-900/80 rounded-xl border border-neutral-800 p-2">
            <div className="grid grid-cols-12 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-800 mb-1">
              <div className="col-span-3">Поле</div>
              <div className="col-span-4 text-emerald-400 flex items-center gap-1.5">
                <User className="w-3 h-3" />
                <span>Запис 1 ({personA.id})</span>
              </div>
              <div className="col-span-1 text-center">Вибір</div>
              <div className="col-span-4 text-amber-400 flex items-center gap-1.5">
                <User className="w-3 h-3" />
                <span>Запис 2 ({personB.id})</span>
              </div>
            </div>

            <FieldRow
              label="Прізвище"
              fieldKey="surname"
              valA={personA.name?.surname || personA.lastName}
              valB={personB.name?.surname || personB.lastName}
            />
            <FieldRow
              label="Імʼя"
              fieldKey="given"
              valA={personA.name?.given || personA.firstName}
              valB={personB.name?.given || personB.firstName}
            />
            <FieldRow
              label="По батькові"
              fieldKey="patronymic"
              valA={personA.name?.patronymic || personA.patronymic}
              valB={personB.name?.patronymic || personB.patronymic}
            />
            <FieldRow
              label="Дівоче прізвище"
              fieldKey="maidenName"
              valA={personA.name?.maidenName || personA.maidenName}
              valB={personB.name?.maidenName || personB.maidenName}
            />
            <FieldRow
              label="Дата / Рік народження"
              fieldKey="birthDate"
              valA={personA.birthDate || (personA.birthYear ? String(personA.birthYear) : null)}
              valB={personB.birthDate || (personB.birthYear ? String(personB.birthYear) : null)}
              icon={Calendar}
            />
            <FieldRow
              label="Місце народження"
              fieldKey="birthPlace"
              valA={personA.birthPlace}
              valB={personB.birthPlace}
              icon={MapPin}
            />
            <FieldRow
              label="Дата / Рік смерті"
              fieldKey="deathDate"
              valA={personA.deathDate || (personA.deathYear ? String(personA.deathYear) : null)}
              valB={personB.deathDate || (personB.deathYear ? String(personB.deathYear) : null)}
              icon={Calendar}
            />
            <FieldRow
              label="Місце смерті"
              fieldKey="deathPlace"
              valA={personA.deathPlace}
              valB={personB.deathPlace}
              icon={MapPin}
            />
            <FieldRow
              label="Професія / Заняття"
              fieldKey="occupation"
              valA={personA.occupation}
              valB={personB.occupation}
              icon={Briefcase}
            />
            <FieldRow
              label="Стан / Статус"
              fieldKey="estateOrSocialStatus"
              valA={personA.estateOrSocialStatus || personA.estate}
              valB={personB.estateOrSocialStatus || personB.estate}
            />
            <FieldRow
              label="Військовий чин"
              fieldKey="militaryRank"
              valA={personA.militaryRank}
              valB={personB.militaryRank}
            />
            <FieldRow
              label="Віросповідання"
              fieldKey="confession"
              valA={personA.confession}
              valB={personB.confession}
            />
            {(fatherNameA || fatherNameB) && (
              <FieldRow
                label="Батько"
                fieldKey="father"
                valA={fatherNameA}
                valB={fatherNameB}
                icon={Users}
              />
            )}
            {(motherNameA || motherNameB) && (
              <FieldRow
                label="Мати"
                fieldKey="mother"
                valA={motherNameA}
                valB={motherNameB}
                icon={Users}
              />
            )}
          </div>

          {/* Aggregation & Combination Toggles */}
          <div className="bg-neutral-900/80 rounded-xl border border-neutral-800 p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Правила обʼєднання повʼязаних даних
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-neutral-950/60 border border-neutral-800 cursor-pointer hover:border-neutral-700">
                <input
                  type="checkbox"
                  checked={selection.combineRelations}
                  onChange={(e) => setSelection(prev => ({ ...prev, combineRelations: e.target.checked }))}
                  className="mt-0.5 rounded border-neutral-700 text-[#B88E3E] focus:ring-[#B88E3E]"
                />
                <div className="text-xs">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#B88E3E]" />
                    Родинні звʼязки (Батьки, Подружжя, Діти)
                  </span>
                  <p className="text-neutral-400 text-[11px] mt-0.5">
                    Перенести всіх дітей та подружжя від дубліката до основної персони без повторів.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-neutral-950/60 border border-neutral-800 cursor-pointer hover:border-neutral-700">
                <input
                  type="checkbox"
                  checked={selection.combineSources}
                  onChange={(e) => setSelection(prev => ({ ...prev, combineSources: e.target.checked }))}
                  className="mt-0.5 rounded border-neutral-700 text-[#B88E3E] focus:ring-[#B88E3E]"
                />
                <div className="text-xs">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-[#B88E3E]" />
                    Архівні джерела та цитати
                  </span>
                  <p className="text-neutral-400 text-[11px] mt-0.5">
                    Обʼєднати всі цитати та посилання на архівні справи обох персон.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-neutral-950/60 border border-neutral-800 cursor-pointer hover:border-neutral-700">
                <input
                  type="checkbox"
                  checked={selection.combineEvents}
                  onChange={(e) => setSelection(prev => ({ ...prev, combineEvents: e.target.checked }))}
                  className="mt-0.5 rounded border-neutral-700 text-[#B88E3E] focus:ring-[#B88E3E]"
                />
                <div className="text-xs">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#B88E3E]" />
                    Події життя та таймлайн
                  </span>
                  <p className="text-neutral-400 text-[11px] mt-0.5">
                    Зберегти всі унікальні життєві факти та дати в хроніку.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-neutral-950/60 border border-neutral-800 cursor-pointer hover:border-neutral-700">
                <input
                  type="checkbox"
                  checked={selection.combineNotes}
                  onChange={(e) => setSelection(prev => ({ ...prev, combineNotes: e.target.checked }))}
                  className="mt-0.5 rounded border-neutral-700 text-[#B88E3E] focus:ring-[#B88E3E]"
                />
                <div className="text-xs">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-[#B88E3E]" />
                    Життєпис та дослідницькі примітки
                  </span>
                  <p className="text-neutral-400 text-[11px] mt-0.5">
                    Обʼєднати текстові нотатки та біографії обох записів.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Warning banner */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Увага:</span> Картка дубліката (ID: {masterTarget === 'A' ? personB.id : personA.id}) буде остаточно видалена після перенесення всіх родинних звʼязків та архівних матеріалів до основної картки (ID: {masterTarget === 'A' ? personA.id : personB.id}).
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 md:p-5 border-t border-neutral-800 bg-neutral-900/90 flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            Скасувати
          </button>

          <button
            onClick={handleExecuteMerge}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#B88E3E] hover:bg-[#a37c33] text-neutral-950 transition-all flex items-center gap-2 shadow-lg shadow-[#B88E3E]/20 cursor-pointer disabled:opacity-50"
          >
            <GitMerge className="w-4 h-4" />
            <span>Виконати злиття та оновити дерево</span>
          </button>
        </div>

      </div>
    </div>
  );
};
