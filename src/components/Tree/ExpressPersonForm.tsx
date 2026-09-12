/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import {
  Zap,
  Users,
  Calendar,
  MapPin,
  Maximize2,
  Check,
  PlusCircle,
  Sparkles,
  Heart
} from 'lucide-react';
import { Gender, Person, MetricRecord } from '../../types';
import { SmartHistoricalDateInput } from './SmartHistoricalDateInput';
import { PlaceHierarchyAutocompleteInput } from './PlaceHierarchyAutocompleteInput';
import { SourceMetricLinker } from './SourceMetricLinker';

interface ExpressPersonFormProps {
  firstName: string;
  setFirstName: (val: string) => void;
  lastName: string;
  setLastName: (val: string) => void;
  patronymic: string;
  setPatronymic: (val: string) => void;
  maidenName: string;
  setMaidenName: (val: string) => void;
  gender: Gender;
  onGenderChange: (newGender: Gender) => void;
  isLiving: boolean;
  setIsLiving: (val: boolean) => void;
  birthDate: string;
  setBirthDate: (val: string) => void;
  deathDate: string;
  setDeathDate: (val: string) => void;
  birthPlace: string;
  setBirthPlace: (val: string) => void;
  historicalBirthPlace?: string;
  setHistoricalBirthPlace?: (val: string) => void;
  fatherId: string;
  setFatherId: (val: string) => void;
  motherId: string;
  setMotherId: (val: string) => void;
  availableFathers: Person[];
  availableMothers: Person[];
  onOpenFamilyQuickAdd?: () => void;
  persons: Person[];
  metricRecords: MetricRecord[];
  linkedMetricId?: string;
  onLinkMetric: (id: string) => void;
  sourceCitations: string[];
  onAddCitation: (citation: string) => void;
  onRemoveCitation: (idx: number) => void;
  onSwitchToFull: () => void;
  onSave: () => void;
  onSaveAndAddNext: () => void;
  theme: any;
  isDark: boolean;
}

export const ExpressPersonForm: React.FC<ExpressPersonFormProps> = ({
  firstName,
  setFirstName,
  lastName,
  setLastName,
  patronymic,
  setPatronymic,
  maidenName,
  setMaidenName,
  gender,
  onGenderChange,
  isLiving,
  setIsLiving,
  birthDate,
  setBirthDate,
  deathDate,
  setDeathDate,
  birthPlace,
  setBirthPlace,
  historicalBirthPlace,
  setHistoricalBirthPlace,
  fatherId,
  setFatherId,
  motherId,
  setMotherId,
  availableFathers,
  availableMothers,
  onOpenFamilyQuickAdd,
  persons,
  metricRecords,
  linkedMetricId,
  onLinkMetric,
  sourceCitations,
  onAddCitation,
  onRemoveCitation,
  onSwitchToFull,
  onSave,
  onSaveAndAddNext,
  theme,
  isDark
}) => {
  // Calculate completion percentage for key fields
  const completionPct = useMemo(() => {
    let score = 0;
    const maxScore = 6;
    if (firstName.trim()) score += 1;
    if (lastName.trim()) score += 1;
    if (gender) score += 1;
    if (birthDate.trim()) score += 1;
    if (birthPlace.trim()) score += 1;
    if (!isLiving ? deathDate.trim() : true) score += 1;
    return Math.round((score / maxScore) * 100);
  }, [firstName, lastName, gender, birthDate, birthPlace, isLiving, deathDate]);

  return (
    <div className="space-y-5">
      {/* Express Mode Top Banner */}
      <div className={`p-4 rounded-xl border ${isDark ? 'bg-amber-950/20 border-amber-500/30' : 'bg-amber-50 border-amber-200'} flex flex-wrap items-center justify-between gap-3 shadow-xs`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-800'}`}>
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs">Режим «Швидкий запис» (Експрес)</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-extrabold uppercase">
                Ревізії та метрики
              </span>
            </div>
            <p className={`text-[11px] ${theme.textMuted} pt-0.5`}>
              Лише головні реквізити для швидкого введення ревізьких казок та метричних записів без зайвих клацань.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onSwitchToFull}
          className="px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors border-amber-500/40 hover:bg-amber-500/10 text-amber-500"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>Розгорнути повну картку</span>
        </button>
      </div>

      {/* Main Express Fields Grid */}
      <div className={`p-5 rounded-2xl border ${theme.cardBorder} ${theme.cardBg} space-y-4 shadow-sm`}>
        {/* Name row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={`block text-xs font-semibold ${theme.textPrimary} mb-1`}>
              Прізвище <span className="text-amber-500">*</span>
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="напр. Чуб"
              className={`w-full px-3 py-2 text-sm rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} focus:outline-hidden focus:ring-1 focus:ring-amber-500`}
            />
          </div>

          <div>
            <label className={`block text-xs font-semibold ${theme.textPrimary} mb-1`}>
              Ім&apos;я <span className="text-amber-500">*</span>
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="напр. Іван"
              className={`w-full px-3 py-2 text-sm rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} focus:outline-hidden focus:ring-1 focus:ring-amber-500`}
            />
          </div>

          <div>
            <label className={`block text-xs font-semibold ${theme.textPrimary} mb-1`}>
              По батькові
            </label>
            <input
              type="text"
              value={patronymic}
              onChange={(e) => setPatronymic(e.target.value)}
              placeholder="напр. Васильович"
              className={`w-full px-3 py-2 text-sm rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} focus:outline-hidden focus:ring-1 focus:ring-amber-500`}
            />
          </div>
        </div>

        {/* Gender & Living Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div>
            <label className={`block text-xs font-semibold ${theme.textPrimary} mb-1.5`}>
              Стать
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onGenderChange('male')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  gender === 'male'
                    ? 'bg-sky-500/15 text-sky-400 border-sky-500 shadow-xs'
                    : `${theme.surfaceBg} ${theme.borderSubtle} hover:border-neutral-500`
                }`}
              >
                <span>👨 Чоловік</span>
              </button>

              <button
                type="button"
                onClick={() => onGenderChange('female')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  gender === 'female'
                    ? 'bg-rose-500/15 text-rose-400 border-rose-500 shadow-xs'
                    : `${theme.surfaceBg} ${theme.borderSubtle} hover:border-neutral-500`
                }`}
              >
                <span>👩 Жінка</span>
              </button>
            </div>
          </div>

          <div>
            <label className={`block text-xs font-semibold ${theme.textPrimary} mb-1.5`}>
              Статус життя
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsLiving(true)}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  isLiving
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500 shadow-xs'
                    : `${theme.surfaceBg} ${theme.borderSubtle} hover:border-neutral-500`
                }`}
              >
                <span>🌿 Нині живий</span>
              </button>

              <button
                type="button"
                onClick={() => setIsLiving(false)}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  !isLiving
                    ? 'bg-neutral-500/20 text-neutral-300 border-neutral-400 shadow-xs'
                    : `${theme.surfaceBg} ${theme.borderSubtle} hover:border-neutral-500`
                }`}
              >
                <span>🕊️ Упокоївся</span>
              </button>
            </div>
          </div>
        </div>

        {/* Maiden Name (if female) */}
        {gender === 'female' && (
          <div>
            <label className={`block text-xs font-semibold ${theme.textPrimary} mb-1`}>
              Дівоче прізвище (до одруження)
            </label>
            <input
              type="text"
              value={maidenName}
              onChange={(e) => setMaidenName(e.target.value)}
              placeholder="напр. Бондаренко"
              className={`w-full px-3 py-2 text-sm rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} focus:outline-hidden focus:ring-1 focus:ring-amber-500`}
            />
          </div>
        )}

        {/* Dates row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <SmartHistoricalDateInput
            id="express_birth_date"
            label="Дата / Рік народження"
            value={birthDate}
            onChange={setBirthDate}
            placeholder="напр. близько 1845, 12.10.1888 ст.ст."
            theme={theme}
            isDark={isDark}
          />

          {!isLiving && (
            <SmartHistoricalDateInput
              id="express_death_date"
              label="Дата / Рік смерті"
              value={deathDate}
              onChange={setDeathDate}
              placeholder="напр. 1914 або після 1897"
              theme={theme}
              isDark={isDark}
            />
          )}
        </div>

        {/* Primary Place (Settlement) */}
        <div className="pt-1">
          <PlaceHierarchyAutocompleteInput
            id="express_birth_place"
            label="Населений пункт (Село / Місто / Повіт)"
            value={birthPlace}
            onChange={setBirthPlace}
            historicalValue={historicalBirthPlace}
            onHistoricalChange={setHistoricalBirthPlace}
            persons={persons}
            metricRecords={metricRecords}
            placeholder="напр. с. Мошни, Черкаський повіт"
            theme={theme}
            isDark={isDark}
          />
        </div>

        {/* Family connections: Parents */}
        <div className={`p-4 rounded-xl border ${theme.borderSubtle} ${theme.surfaceBg} space-y-3`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Батьки (Родинне гніздо)
              </span>
            </div>
            {onOpenFamilyQuickAdd && (
              <button
                type="button"
                onClick={onOpenFamilyQuickAdd}
                className="text-xs text-amber-500 hover:underline cursor-pointer flex items-center gap-1 font-medium"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ Створити обох батьків разом</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={`block text-[11px] font-semibold ${theme.textMuted} mb-1`}>Батько</label>
              <select
                value={fatherId}
                onChange={(e) => setFatherId(e.target.value)}
                className={`w-full px-2.5 py-1.5 text-xs rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText}`}
              >
                <option value="">-- Без батька / Невідомо --</option>
                {availableFathers.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name?.given || f.firstName} {f.name?.surname || f.lastName} {f.birthYear ? `(${f.birthYear} р.)` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block text-[11px] font-semibold ${theme.textMuted} mb-1`}>Мати</label>
              <select
                value={motherId}
                onChange={(e) => setMotherId(e.target.value)}
                className={`w-full px-2.5 py-1.5 text-xs rounded-lg border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText}`}
              >
                <option value="">-- Без матері / Невідомо --</option>
                {availableMothers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name?.given || m.firstName} {m.name?.surname || m.lastName} {m.birthYear ? `(${m.birthYear} р.)` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Archival source & metric linker */}
        <SourceMetricLinker
          metricRecords={metricRecords}
          linkedMetricId={linkedMetricId}
          onLinkMetric={onLinkMetric}
          sourceCitations={sourceCitations}
          onAddCitation={onAddCitation}
          onRemoveCitation={onRemoveCitation}
          theme={theme}
          isDark={isDark}
        />
      </div>

      {/* Express Bottom Action Bar */}
      <div className={`p-4 rounded-2xl border ${theme.cardBorder} ${theme.surfaceBg} flex flex-wrap items-center justify-between gap-3 shadow-md`}>
        {/* Progress Bar */}
        <div className="flex items-center gap-3">
          <div className="w-28 bg-neutral-200 dark:bg-neutral-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${completionPct}%` }}
            />
          </div>
          <span className={`text-xs font-mono font-semibold ${theme.textMuted}`}>
            {completionPct}% заповнено
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSaveAndAddNext}
            className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              isDark
                ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700'
                : 'bg-white hover:bg-neutral-100 text-neutral-800 border-neutral-300'
            }`}
            title="Зберегти поточну особу та підготувати форму для наступної (Ctrl+Shift+Enter)"
          >
            <PlusCircle className="w-4 h-4 text-amber-500" />
            <span>Зберегти і додати наступну</span>
            <span className="text-[10px] opacity-60 font-mono hidden sm:inline">Ctrl+Shift+↵</span>
          </button>

          <button
            type="button"
            onClick={onSave}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-neutral-950 text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            title="Зберегти особу (Ctrl+Enter)"
          >
            <Check className="w-4 h-4" />
            <span>Зберегти особу</span>
            <span className="text-[10px] opacity-70 font-mono hidden sm:inline">Ctrl+↵</span>
          </button>
        </div>
      </div>
    </div>
  );
};
