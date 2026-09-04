/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  FileText,
  Printer,
  Download,
  Shield,
  Lock,
  Copy,
  Check,
  User,
  Search,
  Settings2,
  Calendar,
  MapPin,
  Sparkles
} from 'lucide-react';
import { GenealogyDatabase, Person } from '../../types/genealogy';
import { getFullName, sortPersonsBySurnameAndBirthDesc } from '../../utils/relationship';
import { useUIStore } from '../../../stores/useUIStore';
import { useAuthStore } from '../../../stores/useAuthStore';
import { getPrivacySafePerson, isPersonLiving, isUserWhitelisted } from '../../utils/privacy';
import { getThemeConfig } from '../../../utils/theme';
import {
  generatePersonTextReport,
  downloadPersonTextReport,
  copyPersonTextReport,
  printPersonReport,
  formatPersonLifespan,
  PersonReportOptions
} from '../../utils/personReportGenerator';

interface ReportsViewProps {
  database: GenealogyDatabase;
  activePersonId: string;
  onSelectPerson: (id: string) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  database,
  activePersonId,
  onSelectPerson
}) => {
  const themePalette = useUIStore((s) => s.themePalette);
  const theme = getThemeConfig(themePalette);
  const isDark = theme.category === 'dark';

  const currentUser = useAuthStore((s) => s.currentUser);
  const whitelist = useAuthStore((s) => s.whitelist);
  const isWhitelisted = useMemo(() => isUserWhitelisted(currentUser, whitelist), [currentUser, whitelist]);

  const [reportType, setReportType] = useState<'ancestors_summary' | 'full_index' | 'person_dossier'>('ancestors_summary');
  const [selectedPersonId, setSelectedPersonId] = useState<string>(activePersonId || (database.persons ? Object.keys(database.persons)[0] : ''));
  const [personSearch, setPersonSearch] = useState('');
  const [dossierViewMode, setDossierViewMode] = useState<'document' | 'raw_text'>('document');
  const [isCopied, setIsCopied] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const [dossierOptions, setDossierOptions] = useState<PersonReportOptions>({
    includeBio: true,
    includeEvents: true,
    includeRelations: true,
    includeExtendedRelations: true,
    includeSources: true,
    includeCustomFields: true,
    maskLiving: false
  });
  
  const persons = useMemo(() => {
    const rawList = Object.values(database.persons || {}) as Person[];
    if (isWhitelisted) {
      return sortPersonsBySurnameAndBirthDesc(rawList);
    }
    const safeList = rawList.map((p) => getPrivacySafePerson(p, false));
    return sortPersonsBySurnameAndBirthDesc(safeList);
  }, [database.persons, isWhitelisted]);

  const rawActivePerson = database.persons[activePersonId] || (database.persons ? Object.values(database.persons)[0] : null);
  const activePerson = rawActivePerson
    ? isWhitelisted
      ? rawActivePerson
      : getPrivacySafePerson(rawActivePerson, false)
    : null;

  // Currently selected person for personal dossier
  const dossierPerson = database.persons[selectedPersonId] || activePerson || (persons[0] as Person);

  const dossierText = useMemo(() => {
    if (!dossierPerson) return '';
    return generatePersonTextReport(dossierPerson, database, dossierOptions);
  }, [dossierPerson, database, dossierOptions]);

  const handleCopyDossier = async () => {
    if (!dossierPerson) return;
    const success = await copyPersonTextReport(dossierPerson, database, dossierOptions);
    if (success) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  const handleDownloadDossierTxt = () => {
    if (!dossierPerson) return;
    downloadPersonTextReport(dossierPerson, database, dossierOptions);
  };

  const handlePrintDossierPdf = () => {
    if (!dossierPerson) return;
    printPersonReport(dossierPerson, database, dossierOptions);
  };

  const handlePrint = () => {
    if (reportType === 'person_dossier') {
      handlePrintDossierPdf();
    } else {
      window.print();
    }
  };

  const handleExportText = () => {
    if (reportType === 'person_dossier') {
      handleDownloadDossierTxt();
      return;
    }

    let reportText = `ГЕНЕАЛОГІЧНИЙ ЗВІТ - РОДОВІД\nДата формування: ${new Date().toLocaleDateString('uk-UA')}\n`;
    if (activePerson) {
      const activeName = !isWhitelisted && isPersonLiving(rawActivePerson) ? '🔒 Скрито (Жива особа)' : getFullName(activePerson);
      reportText += `Головна персона: ${activeName}\n\n`;
    }

    persons.forEach((p, idx) => {
      const isLiving = isPersonLiving(database.persons[p.id]);
      const isMasked = !isWhitelisted && isLiving;
      const displayName = isMasked ? '🔒 Скрито (Жива особа)' : getFullName(p);

      reportText += `${idx + 1}. ${displayName}\n`;
      if (isMasked) {
        reportText += `   Статус: Конфіденційні дані (Жива особа - доступні тільки Whitelist)\n`;
      } else {
        if (p.birthDate || p.birthPlace) reportText += `   Народження: ${p.birthDate || ''} (${p.birthPlace || ''})\n`;
        if (p.deathDate || p.deathPlace) reportText += `   Смерть: ${p.deathDate || ''} (${p.deathPlace || ''})\n`;
        if (p.occupation) reportText += `   Фах / Рід занять: ${p.occupation}\n`;
        if (p.notes) reportText += `   Примітки: ${p.notes}\n`;
      }
      reportText += '\n';
    });

    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `genealogy_report_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered persons for dossier switcher
  const searchFilterResults = useMemo(() => {
    if (!personSearch.trim()) return persons.slice(0, 30);
    const q = personSearch.toLowerCase().trim();
    return persons.filter((p) => {
      const name = getFullName(p).toLowerCase();
      const yr = p.birthYear || p.birthDate || '';
      return name.includes(q) || String(yr).includes(q);
    }).slice(0, 30);
  }, [persons, personSearch]);

  return (
    <div className="h-full w-full overflow-y-auto overflow-x-auto p-4 sm:p-6 select-text">
      <div className={`max-w-5xl mx-auto space-y-6 ${theme.textPrimary}`}>
        {/* Top Header */}
        <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
          <div>
            <h2 className={`text-xl font-bold ${theme.textPrimary} flex items-center gap-2`}>
              <FileText className="w-5 h-5 text-amber-500" />
              <span>Генеалогічні Звіти та Виписки</span>
            </h2>
            <p className={`text-xs ${theme.textMuted} mt-1`}>
              Генерація поколінних розписів, поіменних покажчиків та довідок для друку
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportText}
              className={`px-3.5 py-2 ${theme.surfaceBg} hover:opacity-80 ${theme.textPrimary} rounded-lg text-xs font-medium flex items-center gap-2 border ${theme.borderSubtle} transition-all cursor-pointer`}
            >
              <Download className="w-4 h-4" />
              <span>Завантажити TXT</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Друкувати звіт</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className={`flex flex-wrap items-center gap-2 border-b ${theme.borderSubtle} pb-3`}>
          <button
            onClick={() => setReportType('ancestors_summary')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              reportType === 'ancestors_summary'
                ? 'bg-amber-600 text-white'
                : `${theme.surfaceBg} ${theme.textSecondary} hover:${theme.textPrimary}`
            }`}
          >
            Поколінний розпис
          </button>
          <button
            onClick={() => setReportType('full_index')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              reportType === 'full_index'
                ? 'bg-amber-600 text-white'
                : `${theme.surfaceBg} ${theme.textSecondary} hover:${theme.textPrimary}`
            }`}
          >
            Поіменний покажчик ({persons.length})
          </button>
          <button
            onClick={() => setReportType('person_dossier')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              reportType === 'person_dossier'
                ? 'bg-amber-600 text-white shadow-xs'
                : `${theme.surfaceBg} ${theme.textSecondary} hover:${theme.textPrimary}`
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Персональний звіт про особу (PDF / TXT)</span>
          </button>
        </div>

        {/* Tab 1 & 2: Ancestors Summary & Full Index */}
        {reportType !== 'person_dossier' && (
          <div className={`p-6 sm:p-8 rounded-xl ${theme.cardBg} border ${theme.cardBorder} shadow-sm space-y-6 max-w-4xl mx-auto`}>
            <div className={`text-center border-b ${theme.borderSubtle} pb-6 space-y-2`}>
              <span className="text-[10px] uppercase tracking-widest font-bold text-amber-600">
                Архівний звіт родоводу
              </span>
              <h1 className={`text-xl font-bold font-serif ${theme.textPrimary}`}>
                {reportType === 'ancestors_summary' ? 'Поіменний родовідний розпис родини' : 'Повний поіменний покажчик роду'}
              </h1>
              <p className={`text-xs ${theme.textMuted}`}>
                Досліджувана гілка:{' '}
                <strong className={theme.textPrimary}>
                  {activePerson
                    ? !isWhitelisted && isPersonLiving(rawActivePerson)
                      ? '🔒 Скрито (Жива особа)'
                      : getFullName(activePerson)
                    : 'Всі особи'}
                </strong>{' '}
                | Складено: {new Date().toLocaleDateString('uk-UA')}
              </p>
            </div>

            <div className="space-y-3 text-xs">
              {persons.map((person, index) => {
                const rawP = database.persons[person.id];
                const isLiving = isPersonLiving(rawP);
                const isMasked = !isWhitelisted && isLiving;

                return (
                  <div
                    key={person.id}
                    className={`p-4 rounded-lg border ${theme.borderSubtle} ${theme.surfaceBg} hover:border-amber-500/50 transition-colors`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className={`font-bold text-sm ${theme.textPrimary} flex items-center gap-2`}>
                          <span className="font-mono text-xs text-amber-600 font-bold">№{index + 1}</span>
                          {isMasked ? (
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                              <Lock className="w-3.5 h-3.5" />
                              <span>🔒 Скрито (Жива особа)</span>
                            </span>
                          ) : (
                            <span>{getFullName(person)}</span>
                          )}
                        </div>
                        {isMasked ? (
                          <div className={`text-xs ${theme.textMuted} italic`}>
                            🔒 Дані живої особи захищені з міркувань конфіденційності.
                          </div>
                        ) : (
                          <>
                            <div className={`text-xs ${theme.textMuted} flex flex-wrap gap-x-4 gap-y-1`}>
                              {person.birthDate && <span>Нар.: {person.birthDate} {person.birthPlace ? `(${person.birthPlace})` : ''}</span>}
                              {person.deathDate && <span>Пом.: {person.deathDate} {person.deathPlace ? `(${person.deathPlace})` : ''}</span>}
                              {person.occupation && <span>Фах: {person.occupation}</span>}
                            </div>
                            {person.notes && (
                              <p className={`text-xs ${theme.textSecondary} italic pt-1`}>
                                "{person.notes}"
                              </p>
                            )}
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2 print:hidden">
                        <button
                          onClick={() => {
                            setSelectedPersonId(person.id);
                            setReportType('person_dossier');
                          }}
                          className="text-xs text-amber-600 hover:text-amber-700 dark:hover:text-amber-400 font-semibold cursor-pointer flex items-center gap-1"
                          title="Сформувати персональний звіт у PDF / TXT"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Звіт</span>
                        </button>
                        <span>•</span>
                        <button
                          onClick={() => onSelectPerson(person.id)}
                          className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:underline font-medium cursor-pointer"
                        >
                          Картка →
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: Dedicated Personal Report (Dossier) */}
        {reportType === 'person_dossier' && dossierPerson && (
          <div className="space-y-4 max-w-4xl mx-auto">
            {/* Control Bar: Person Select & Actions */}
            <div className={`p-4 rounded-xl border ${theme.cardBorder} ${theme.cardBg} shadow-xs space-y-4`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                
                {/* Person dropdown selector */}
                <div className="flex-1 min-w-0 max-w-md">
                  <label className="text-[11px] font-bold text-neutral-500 uppercase block mb-1">
                    Обрана особа для генерації звіту:
                  </label>
                  <select
                    value={dossierPerson.id}
                    onChange={(e) => setSelectedPersonId(e.target.value)}
                    className={`w-full text-xs font-semibold px-3 py-2 rounded-lg border ${theme.borderSubtle} bg-black/5 dark:bg-white/5 ${theme.textPrimary} focus:ring-1 focus:ring-amber-500 cursor-pointer`}
                  >
                    {persons.map((p) => (
                      <option key={p.id} value={p.id} className="text-neutral-900 bg-white">
                        {getFullName(p)} {formatPersonLifespan(p)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* View Mode Switcher */}
                <div className="flex items-center rounded-xl bg-black/5 dark:bg-white/10 p-1 text-xs font-semibold shrink-0">
                  <button
                    type="button"
                    onClick={() => setDossierViewMode('document')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      dossierViewMode === 'document'
                        ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs'
                        : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Бланк (A4)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDossierViewMode('raw_text')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      dossierViewMode === 'raw_text'
                        ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs'
                        : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                    }`}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Текст (TXT)</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-black/10 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowOptions(!showOptions)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      showOptions
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400'
                        : `border-black/10 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/5`
                    }`}
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    <span>Параметри секцій</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyDossier}
                    className="px-3.5 py-1.5 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-neutral-700 dark:text-neutral-200 border border-black/10 dark:border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopied ? 'Скопійовано!' : 'Копіювати TXT'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadDossierTxt}
                    className="px-3.5 py-1.5 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-neutral-700 dark:text-neutral-200 border border-black/10 dark:border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-500" />
                    <span>Завантажити TXT</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintDossierPdf}
                    className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Зберегти як PDF / Друк</span>
                  </button>
                </div>
              </div>

              {/* Options Toggle Drawer */}
              {showOptions && (
                <div className="p-3 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                  <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    Секції:
                  </span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dossierOptions.includeEvents}
                      onChange={(e) => setDossierOptions({ ...dossierOptions, includeEvents: e.target.checked })}
                      className="rounded text-amber-600"
                    />
                    <span>Хронологія подій</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dossierOptions.includeRelations}
                      onChange={(e) => setDossierOptions({ ...dossierOptions, includeRelations: e.target.checked })}
                      className="rounded text-amber-600"
                    />
                    <span>Родинні зв'язки</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dossierOptions.includeExtendedRelations}
                      onChange={(e) => setDossierOptions({ ...dossierOptions, includeExtendedRelations: e.target.checked })}
                      className="rounded text-amber-600"
                    />
                    <span>Дідусі, онуки та куми</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dossierOptions.includeBio}
                      onChange={(e) => setDossierOptions({ ...dossierOptions, includeBio: e.target.checked })}
                      className="rounded text-amber-600"
                    />
                    <span>Біографія й нотатки</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dossierOptions.includeSources}
                      onChange={(e) => setDossierOptions({ ...dossierOptions, includeSources: e.target.checked })}
                      className="rounded text-amber-600"
                    />
                    <span>Архівні джерела</span>
                  </label>
                </div>
              )}
            </div>

            {/* Dossier Display */}
            {dossierViewMode === 'document' ? (
              <div className={`p-6 sm:p-10 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-lg space-y-6`}>
                <div className="text-center border-b-2 border-amber-600/40 pb-5 space-y-2">
                  <div className="text-amber-600 text-xs uppercase font-bold tracking-widest">
                    ❖ РОДОВІД ❖ • ПЕРСОНАЛЬНИЙ ЗВІТ ПРО ОСОБУ
                  </div>
                  <h2 className={`text-2xl sm:text-3xl font-bold font-serif ${theme.textPrimary}`}>
                    {getFullName(dossierPerson)}
                  </h2>
                  <p className="text-sm text-amber-600 font-serif italic">
                    {formatPersonLifespan(dossierPerson)}
                  </p>
                </div>

                <div className="p-4 sm:p-6 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 font-mono text-xs text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap leading-relaxed overflow-x-auto shadow-inner">
                  {dossierText}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-neutral-500 px-1">
                  <span>Текстовий формат (UTF-8, розмітка ASCII)</span>
                  <span>Рядків: {dossierText.split('\n').length} | Символів: {dossierText.length}</span>
                </div>
                <textarea
                  readOnly
                  value={dossierText}
                  className="w-full min-h-[500px] p-4 sm:p-6 rounded-2xl bg-white dark:bg-slate-950 border border-neutral-200 dark:border-neutral-800 font-mono text-xs sm:text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed focus:outline-none select-all shadow-inner"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
