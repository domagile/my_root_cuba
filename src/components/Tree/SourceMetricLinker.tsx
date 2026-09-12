/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ScrollText, BookOpen, Plus, Check, ExternalLink, Link2 } from 'lucide-react';
import { MetricRecord } from '../../types';

interface SourceMetricLinkerProps {
  metricRecords: MetricRecord[];
  linkedMetricId?: string;
  onLinkMetric: (metricId: string) => void;
  sourceCitations: string[];
  onAddCitation: (citation: string) => void;
  onRemoveCitation: (index: number) => void;
  theme: any;
  isDark: boolean;
}

export const SourceMetricLinker: React.FC<SourceMetricLinkerProps> = ({
  metricRecords,
  linkedMetricId,
  onLinkMetric,
  sourceCitations,
  onAddCitation,
  onRemoveCitation,
  theme,
  isDark
}) => {
  const [showManualCitation, setShowManualCitation] = useState(false);
  const [archive, setArchive] = useState('');
  const [fund, setFund] = useState('');
  const [inventory, setInventory] = useState('');
  const [caseNum, setCaseNum] = useState('');
  const [page, setPage] = useState('');
  const [recordType, setRecordType] = useState('Метричний запис про народження');

  const handleAddManualCitation = () => {
    if (!archive && !fund && !caseNum) return;
    const parts = [];
    if (recordType) parts.push(recordType);
    if (archive) parts.push(archive);
    if (fund) parts.push(`Ф. ${fund}`);
    if (inventory) parts.push(`Оп. ${inventory}`);
    if (caseNum) parts.push(`Спр. ${caseNum}`);
    if (page) parts.push(`Арк. ${page}`);

    const citationStr = parts.join(', ');
    onAddCitation(citationStr);

    // Reset inputs
    setArchive('');
    setFund('');
    setInventory('');
    setCaseNum('');
    setPage('');
    setShowManualCitation(false);
  };

  return (
    <div className={`p-4 rounded-xl border ${theme.cardBorder} ${theme.surfaceBg} space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-bold uppercase tracking-wider">
            Першоджерело запису (Метрична книга / Архів)
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowManualCitation(!showManualCitation)}
          className="text-xs text-amber-500 hover:underline cursor-pointer flex items-center gap-1 font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{showManualCitation ? 'Скасувати' : '+ Вказати архівний шифр'}</span>
        </button>
      </div>

      {/* Select from existing metric books in database */}
      {metricRecords.length > 0 && (
        <div className="space-y-1">
          <label className={`block text-[11px] font-medium ${theme.textMuted}`}>
            Швидка прив&apos;язка до метричної книги з бази досліджень:
          </label>
          <select
            value={linkedMetricId || ''}
            onChange={(e) => onLinkMetric(e.target.value)}
            className={`w-full px-3 py-1.5 text-xs rounded-lg border transition-all ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} focus:outline-hidden focus:ring-1 focus:ring-amber-500`}
          >
            <option value="">-- Оберіть метричну книгу або справу --</option>
            {metricRecords.map((m) => (
              <option key={m.id} value={m.id}>
                {m.year ? `${m.year} р. — ` : ''}
                {m.village ? `с. ${m.village} — ` : ''}
                {m.title || `${m.archive} Ф.${m.fund} Оп.${m.inventory} Спр.${m.caseNumber}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Manual citation input */}
      {showManualCitation && (
        <div className={`p-3 rounded-lg border ${theme.borderSubtle} ${theme.cardBg} space-y-2.5`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className={`block text-[10px] font-semibold ${theme.textMuted} mb-0.5`}>Тип документа</label>
              <select
                value={recordType}
                onChange={(e) => setRecordType(e.target.value)}
                className={`w-full px-2 py-1 text-xs rounded border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText}`}
              >
                <option value="Метричний запис про народження">Метрика про народження</option>
                <option value="Метричний запис про вінчання">Метрика про вінчання</option>
                <option value="Метричний запис про смерть">Метрика про смерть</option>
                <option value="Сповідний розпис">Сповідний розпис</option>
                <option value="Ревізька казка">Ревізька казка</option>
                <option value="Архівна довідка">Архівна довідка</option>
              </select>
            </div>
            <div>
              <label className={`block text-[10px] font-semibold ${theme.textMuted} mb-0.5`}>Архів (назва / абревіатура)</label>
              <input
                type="text"
                value={archive}
                onChange={(e) => setArchive(e.target.value)}
                placeholder="напр. ДАЧО, ЦДІАК, ДАКО"
                className={`w-full px-2 py-1 text-xs rounded border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className={`block text-[10px] font-semibold ${theme.textMuted} mb-0.5`}>Фонд</label>
              <input
                type="text"
                value={fund}
                onChange={(e) => setFund(e.target.value)}
                placeholder="напр. 931"
                className={`w-full px-2 py-1 text-xs rounded border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText}`}
              />
            </div>
            <div>
              <label className={`block text-[10px] font-semibold ${theme.textMuted} mb-0.5`}>Опис</label>
              <input
                type="text"
                value={inventory}
                onChange={(e) => setInventory(e.target.value)}
                placeholder="напр. 1"
                className={`w-full px-2 py-1 text-xs rounded border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText}`}
              />
            </div>
            <div>
              <label className={`block text-[10px] font-semibold ${theme.textMuted} mb-0.5`}>Справа</label>
              <input
                type="text"
                value={caseNum}
                onChange={(e) => setCaseNum(e.target.value)}
                placeholder="напр. 245"
                className={`w-full px-2 py-1 text-xs rounded border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText}`}
              />
            </div>
            <div>
              <label className={`block text-[10px] font-semibold ${theme.textMuted} mb-0.5`}>Арк. / №</label>
              <input
                type="text"
                value={page}
                onChange={(e) => setPage(e.target.value)}
                placeholder="напр. 12 зв."
                className={`w-full px-2 py-1 text-xs rounded border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText}`}
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleAddManualCitation}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-neutral-950 text-xs font-bold rounded cursor-pointer transition-colors shadow-xs"
            >
              Додати посилання
            </button>
          </div>
        </div>
      )}

      {/* List of existing source citations */}
      {sourceCitations.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className={`text-[11px] font-semibold ${theme.textMuted}`}>Прикріплені архівні джерела:</div>
          <div className="space-y-1">
            {sourceCitations.map((cite, idx) => (
              <div
                key={idx}
                className={`p-2 rounded-lg text-xs border flex items-center justify-between gap-2 ${theme.cardBg} ${theme.borderSubtle}`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Link2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="truncate">{cite}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveCitation(idx)}
                  className="text-neutral-400 hover:text-rose-500 text-xs px-1 cursor-pointer"
                  title="Видалити посилання"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
