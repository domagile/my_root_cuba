/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { FileText, Printer, Download, Shield, Lock } from 'lucide-react';
import { GenealogyDatabase, Person } from '../../types/genealogy';
import { getFullName, sortPersonsBySurnameAndBirthDesc } from '../../utils/relationship';
import { useUIStore } from '../../../stores/useUIStore';
import { useAuthStore } from '../../../stores/useAuthStore';
import { getPrivacySafePerson, isPersonLiving, isUserWhitelisted } from '../../utils/privacy';
import { getThemeConfig } from '../../../utils/theme';

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

  const [reportType, setReportType] = useState<'ancestors_summary' | 'full_index' | 'vital_records'>('ancestors_summary');
  
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

  const handlePrint = () => {
    window.print();
  };

  const handleExportText = () => {
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
        <div className={`flex items-center gap-2 border-b ${theme.borderSubtle} pb-3`}>
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
        </div>

        {/* Report Canvas */}
        <div className={`p-6 sm:p-8 rounded-xl ${theme.cardBg} border ${theme.cardBorder} shadow-sm space-y-6 max-w-4xl mx-auto`}>
          <div className={`text-center border-b ${theme.borderSubtle} pb-6 space-y-2`}>
            <span className="text-[10px] uppercase tracking-widest font-bold text-amber-600">
              Архівний звіт родоводу
            </span>
            <h1 className={`text-xl font-bold font-serif ${theme.textPrimary}`}>
              Поіменний родовідний розпис родини
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
                    <button
                      onClick={() => onSelectPerson(person.id)}
                      className="text-xs text-amber-600 hover:underline font-medium print:hidden cursor-pointer shrink-0 ml-2"
                    >
                      Перейти →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
