/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { FileText, Printer, Download } from 'lucide-react';
import { GenealogyDatabase, Person } from '../../types/genealogy';
import { getFullName } from '../../utils/relationship';

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
  const [reportType, setReportType] = useState<'ancestors_summary' | 'full_index' | 'vital_records'>('ancestors_summary');
  
  const persons = useMemo(() => {
    return Object.values(database.persons || {}) as Person[];
  }, [database]);

  const activePerson = database.persons[activePersonId] || persons[0];

  const handlePrint = () => {
    window.print();
  };

  const handleExportText = () => {
    let reportText = `ГЕНЕАЛОГІЧНИЙ ЗВІТ - РОДОВІД\nДата формування: ${new Date().toLocaleDateString('uk-UA')}\n`;
    if (activePerson) {
      reportText += `Головна персона: ${getFullName(activePerson)}\n\n`;
    }

    persons.forEach((p, idx) => {
      reportText += `${idx + 1}. ${getFullName(p)}\n`;
      if (p.birthDate || p.birthPlace) reportText += `   Народження: ${p.birthDate || ''} (${p.birthPlace || ''})\n`;
      if (p.deathDate || p.deathPlace) reportText += `   Смерть: ${p.deathDate || ''} (${p.deathPlace || ''})\n`;
      if (p.occupation) reportText += `   Фах / Рід занять: ${p.occupation}\n`;
      if (p.notes) reportText += `   Примітки: ${p.notes}\n`;
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
    <div className="flex-1 overflow-y-auto p-6 bg-slate-900 text-slate-100 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <FileText className="w-6 h-6 text-[#B88E3E]" />
            <span>Генеалогічні Звіти та Виписки</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Генерація поколінних розписів, поіменних покажчиків та довідок для друку
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportText}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium flex items-center gap-2 border border-slate-700 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Завантажити TXT</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-[#B88E3E] hover:bg-[#A37B30] text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Друкувати звіт</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setReportType('ancestors_summary')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            reportType === 'ancestors_summary'
              ? 'bg-[#B88E3E] text-white'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          Поколінний розпис
        </button>
        <button
          onClick={() => setReportType('full_index')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            reportType === 'full_index'
              ? 'bg-[#B88E3E] text-white'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          Поіменний покажчик ({persons.length})
        </button>
      </div>

      {/* Report Canvas */}
      <div className="p-8 rounded-2xl bg-white text-neutral-900 shadow-2xl space-y-6 max-w-4xl mx-auto font-serif">
        <div className="text-center border-b border-neutral-300 pb-6 space-y-2">
          <span className="text-[11px] uppercase tracking-widest font-sans font-bold text-[#8E6C28]">
            Архівний звіт родоводу
          </span>
          <h1 className="text-2xl font-bold font-serif text-neutral-900">
            Поіменний родовідний розпис родини
          </h1>
          <p className="text-xs text-neutral-600 font-sans">
            Досліджувана гілка: <strong>{activePerson ? getFullName(activePerson) : 'Всі особи'}</strong> | Складено: {new Date().toLocaleDateString('uk-UA')}
          </p>
        </div>

        <div className="space-y-4 font-sans text-sm">
          {persons.map((person, index) => (
            <div
              key={person.id}
              className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 hover:bg-neutral-100 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="font-bold text-base text-neutral-900 flex items-center gap-2">
                    <span className="font-mono text-xs text-[#B88E3E] font-bold">№{index + 1}</span>
                    <span>{getFullName(person)}</span>
                  </div>
                  <div className="text-xs text-neutral-600 flex flex-wrap gap-x-4 gap-y-1">
                    {person.birthDate && <span>Нар.: {person.birthDate} {person.birthPlace ? `(${person.birthPlace})` : ''}</span>}
                    {person.deathDate && <span>Пом.: {person.deathDate} {person.deathPlace ? `(${person.deathPlace})` : ''}</span>}
                    {person.occupation && <span>Фах: {person.occupation}</span>}
                  </div>
                  {person.notes && (
                    <p className="text-xs text-neutral-700 italic pt-1">
                      "{person.notes}"
                    </p>
                  )}
                </div>
                <button
                  onClick={() => onSelectPerson(person.id)}
                  className="text-xs text-[#8E6C28] hover:underline font-medium print:hidden"
                >
                  Перейти →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
