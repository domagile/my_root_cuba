/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  X,
  FileText,
  Printer,
  Download,
  Copy,
  Check,
  User,
  Search,
  Settings2,
  Calendar,
  MapPin,
  Heart,
  Users,
  Eye,
  Sparkles,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { Person, GenealogyDatabase } from '../../types';
import { getFullName } from '../../rodovid/utils/relationship';
import {
  generatePersonTextReport,
  downloadPersonTextReport,
  copyPersonTextReport,
  printPersonReport,
  formatPersonLifespan,
  PersonReportOptions
} from '../../rodovid/utils/personReportGenerator';
import { useUIStore } from '../../stores/useUIStore';
import { getThemeConfig } from '../../utils/theme';

export interface PersonReportModalProps {
  personId: string | null;
  database: GenealogyDatabase;
  onClose: () => void;
  onSelectPerson?: (id: string) => void;
}

export const PersonReportModal: React.FC<PersonReportModalProps> = ({
  personId,
  database,
  onClose,
  onSelectPerson
}) => {
  const themePalette = useUIStore((s) => s.themePalette);
  const theme = getThemeConfig(themePalette);
  const isDark = theme.category === 'dark';

  const [activePersonId, setActivePersonId] = useState<string>(personId || (database.persons ? Object.keys(database.persons)[0] : ''));
  const [viewMode, setViewMode] = useState<'document' | 'raw_text'>('document');
  const [isCopied, setIsCopied] = useState(false);
  const [personSearch, setPersonSearch] = useState('');
  const [showPersonPicker, setShowPersonPicker] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const [options, setOptions] = useState<PersonReportOptions>({
    includeBio: true,
    includeEvents: true,
    includeRelations: true,
    includeExtendedRelations: true,
    includeSources: true,
    includeCustomFields: true,
    maskLiving: false
  });

  const person = database.persons[activePersonId];

  // Search filter for person selector
  const searchResults = useMemo(() => {
    if (!personSearch.trim()) return [];
    const query = personSearch.toLowerCase().trim();
    return Object.values(database.persons || {})
      .filter((p) => {
        const name = getFullName(p).toLowerCase();
        const year = p.birthYear || p.birthDate || '';
        return name.includes(query) || String(year).includes(query);
      })
      .slice(0, 8);
  }, [database.persons, personSearch]);

  const reportText = useMemo(() => {
    if (!person) return '';
    return generatePersonTextReport(person, database, options);
  }, [person, database, options]);

  const handleCopy = async () => {
    if (!person) return;
    const success = await copyPersonTextReport(person, database, options);
    if (success) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  const handleDownloadTxt = () => {
    if (!person) return;
    downloadPersonTextReport(person, database, options);
  };

  const handlePrintPdf = () => {
    if (!person) return;
    printPersonReport(person, database, options);
  };

  if (!person) return null;

  const fullName = getFullName(person);
  const lifespan = formatPersonLifespan(person);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xs overflow-hidden animate-in fade-in duration-200">
      <div className={`w-full max-w-5xl h-[92vh] flex flex-col rounded-2xl md:rounded-3xl ${theme.cardBg} border ${theme.cardBorder} shadow-2xl overflow-hidden transition-all`}>
        
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 flex items-center justify-between border-b border-black/10 dark:border-white/10 shrink-0 bg-black/5 dark:bg-white/5 gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30 shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className={`text-sm sm:text-base font-bold ${theme.textPrimary} truncate`}>
                  Генеалогічний звіт про особу
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 shrink-0">
                  PDF / TXT
                </span>
              </div>
              <p className={`text-[11px] sm:text-xs ${theme.textMuted} truncate`}>
                Складання архівної довідки з датами, подіями та родинними зв'язками для друку та копіювання
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowOptions(!showOptions)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                showOptions
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400'
                  : `border-black/10 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/5`
              }`}
              title="Налаштування секцій звіту"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Параметри</span>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-neutral-700 dark:text-neutral-200 border border-black/10 dark:border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Скопіювати весь звіт у буфер обміну"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-neutral-500" />}
              <span>{isCopied ? 'Скопійовано!' : 'Копіювати TXT'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadTxt}
              className="px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-neutral-700 dark:text-neutral-200 border border-black/10 dark:border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Завантажити звіт у форматі .txt (UTF-8)"
            >
              <Download className="w-3.5 h-3.5 text-sky-500" />
              <span className="hidden sm:inline">Завантажити TXT</span>
            </button>

            <button
              type="button"
              onClick={handlePrintPdf}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              title="Зберегти як PDF через діалог друку браузера"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Зберегти як PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="Закрити вікно"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Options Drawer (Collapsible) */}
        {showOptions && (
          <div className="px-4 sm:px-6 py-3 border-b border-black/10 dark:border-white/10 bg-amber-500/[0.04] dark:bg-amber-500/[0.08] flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
            <span className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Включити до звіту:
            </span>
            <label className="flex items-center gap-1.5 cursor-pointer text-neutral-700 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={options.includeEvents}
                onChange={(e) => setOptions({ ...options, includeEvents: e.target.checked })}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              <span>Хронологію подій</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-neutral-700 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={options.includeRelations}
                onChange={(e) => setOptions({ ...options, includeRelations: e.target.checked })}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              <span>Родинні зв'язки</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-neutral-700 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={options.includeExtendedRelations}
                onChange={(e) => setOptions({ ...options, includeExtendedRelations: e.target.checked })}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              <span>Дідусів, онуків та кумів</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-neutral-700 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={options.includeBio}
                onChange={(e) => setOptions({ ...options, includeBio: e.target.checked })}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              <span>Біографію та нотатки</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-neutral-700 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={options.includeSources}
                onChange={(e) => setOptions({ ...options, includeSources: e.target.checked })}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              <span>Архівні джерела</span>
            </label>
          </div>
        )}

        {/* Sub-bar: Active Person Pill & View Switcher */}
        <div className="px-4 sm:px-6 py-2.5 border-b border-black/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 bg-black/[0.01] dark:bg-white/[0.01]">
          {/* Person selector trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowPersonPicker(!showPersonPicker)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${theme.borderSubtle} hover:border-amber-500/50 bg-white dark:bg-slate-900 text-xs font-semibold transition-all cursor-pointer`}
            >
              <User className="w-3.5 h-3.5 text-amber-600" />
              <span className={`font-bold ${theme.textPrimary}`}>{fullName}</span>
              <span className="text-amber-600/80 font-normal">{lifespan}</span>
              <span className="text-[10px] text-neutral-400 pl-1">▼ Змінити особу</span>
            </button>

            {/* Dropdown for picking another person */}
            {showPersonPicker && (
              <div className="absolute top-full left-0 mt-1.5 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-black/15 dark:border-white/15 shadow-2xl p-2.5 z-50 space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={personSearch}
                    onChange={(e) => setPersonSearch(e.target.value)}
                    placeholder="Пошук за прізвищем, ім'ям або роком..."
                    className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border ${theme.borderSubtle} bg-black/5 dark:bg-white/5 ${theme.textPrimary} focus:outline-none focus:ring-1 focus:ring-amber-500`}
                    autoFocus
                  />
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1">
                  {searchResults.length > 0 ? (
                    searchResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setActivePersonId(p.id);
                          setShowPersonPicker(false);
                          setPersonSearch('');
                          if (onSelectPerson) onSelectPerson(p.id);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between hover:bg-amber-500/10 transition-colors ${
                          p.id === activePersonId ? 'bg-amber-500/15 font-bold text-amber-700 dark:text-amber-300' : theme.textPrimary
                        }`}
                      >
                        <span className="truncate">{getFullName(p)}</span>
                        <span className="text-[11px] text-neutral-400 shrink-0 ml-2">{formatPersonLifespan(p)}</span>
                      </button>
                    ))
                  ) : personSearch ? (
                    <div className="p-3 text-center text-xs text-neutral-400">Нічого не знайдено</div>
                  ) : (
                    <div className="p-2 text-[11px] text-neutral-400">
                      Введіть літери прізвища або імені для пошуку іншої особи в дереві
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* View Mode Toggle: Document / Raw text */}
          <div className="flex items-center rounded-xl bg-black/5 dark:bg-white/10 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('document')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'document'
                  ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Бланк довідки (A4)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('raw_text')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'raw_text'
                  ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Простий текст (TXT)</span>
            </button>
          </div>
        </div>

        {/* Report Content Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 bg-neutral-100 dark:bg-neutral-950 flex justify-center">
          {viewMode === 'document' ? (
            /* Document Page (A4 Look) */
            <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-10 shadow-lg text-neutral-800 dark:text-neutral-200 space-y-6 font-serif">
              
              {/* Document Crest & Header */}
              <div className="text-center border-b-2 border-amber-600/40 pb-5 space-y-2">
                <div className="text-amber-600 dark:text-amber-400 text-xs tracking-widest uppercase font-sans font-bold flex items-center justify-center gap-2">
                  <span>❖ РОДОВІД ❖</span>
                  <span>•</span>
                  <span>АРХІВНИЙ ДОСЛІДНИЦЬКИЙ ЦЕНТР</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white font-serif">
                  {fullName}
                </h1>
                {lifespan && (
                  <p className="text-sm sm:text-base text-amber-700 dark:text-amber-400 italic font-sans">
                    {lifespan}
                  </p>
                )}

                {/* Metadata Pills */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2 font-sans text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-slate-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-slate-700">
                    Стать: {person.gender === 'female' || person.gender === 'F' ? 'Жіноча' : 'Чоловіча'}
                  </span>
                  {person.maidenName && (
                    <span className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                      Дівоче: {person.maidenName}
                    </span>
                  )}
                  {person.researchBranch && person.researchBranch !== "Без прив'язки" && (
                    <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                      Гілка: {person.researchBranch}
                    </span>
                  )}
                  {person.occupation && (
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                      {person.occupation}
                    </span>
                  )}
                </div>
              </div>

              {/* Lifecycle Section */}
              <div className="space-y-3 font-sans">
                <h3 className="text-xs uppercase tracking-wider font-bold text-amber-700 dark:text-amber-400 border-b border-neutral-200 dark:border-neutral-800 pb-1 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-600" />
                  <span>Життєвий цикл та ключові дати</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-slate-800/60 border border-neutral-200 dark:border-neutral-700/60 space-y-1">
                    <span className="text-[11px] font-bold text-neutral-500 uppercase">Народження</span>
                    <div className="font-semibold text-neutral-900 dark:text-white">
                      {person.birthDate || person.birthYear || 'Дата невідома'}
                    </div>
                    {person.birthPlace && (
                      <div className="text-neutral-600 dark:text-neutral-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-amber-600 shrink-0" />
                        <span>{person.birthPlace}</span>
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-slate-800/60 border border-neutral-200 dark:border-neutral-700/60 space-y-1">
                    <span className="text-[11px] font-bold text-neutral-500 uppercase">Смерть та поховання</span>
                    <div className="font-semibold text-neutral-900 dark:text-white">
                      {person.deathDate || person.deathYear || (person.isLiving ? 'Жива особа' : 'Дата не зафіксована')}
                    </div>
                    {person.deathPlace && (
                      <div className="text-neutral-600 dark:text-neutral-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-amber-600 shrink-0" />
                        <span>{person.deathPlace}</span>
                      </div>
                    )}
                    {person.deathReason && (
                      <div className="text-[11px] text-rose-600 dark:text-rose-400">
                        Причина: {person.deathReason}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Full Formatted Report Text Block */}
              <div className="space-y-2 font-mono text-xs">
                <div className="p-4 sm:p-6 rounded-xl bg-neutral-50 dark:bg-slate-950/70 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap leading-relaxed shadow-inner overflow-x-auto">
                  {reportText}
                </div>
              </div>

              {/* Official Seal / Signature block */}
              <div className="pt-6 border-t border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-500 font-sans gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-600 flex items-center justify-center font-serif text-xs font-bold border border-amber-500/40">
                    Р
                  </div>
                  <span>Сформовано автоматично з електронного архіву «Родовід»</span>
                </div>
                <div>{new Date().toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
              </div>
            </div>
          ) : (
            /* Raw Monospace Text View */
            <div className="w-full max-w-4xl flex flex-col space-y-3">
              <div className="flex items-center justify-between text-xs text-neutral-500 px-1">
                <span>Формат: Простий текст (UTF-8, Unicode dividers)</span>
                <span>Символів: {reportText.length} | Рядків: {reportText.split('\n').length}</span>
              </div>
              <textarea
                readOnly
                value={reportText}
                className="w-full flex-1 min-h-[500px] p-4 sm:p-6 rounded-2xl bg-white dark:bg-slate-950 border border-neutral-200 dark:border-neutral-800 font-mono text-xs sm:text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed focus:outline-none select-all shadow-inner"
              />
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-4 sm:px-6 py-2.5 border-t border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Готово для використання поза платформою (документи Word, месенджери, архівні довідки, друк)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="text-amber-600 dark:text-amber-400 hover:underline cursor-pointer font-semibold"
            >
              Скопіювати в буфер
            </button>
            <span>•</span>
            <button
              onClick={handleDownloadTxt}
              className="text-amber-600 dark:text-amber-400 hover:underline cursor-pointer font-semibold"
            >
              Завантажити .txt
            </button>
            <span>•</span>
            <button
              onClick={handlePrintPdf}
              className="text-amber-600 dark:text-amber-400 hover:underline cursor-pointer font-semibold"
            >
              PDF / Друк
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
