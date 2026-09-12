/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Calendar, RefreshCw, Sparkles } from 'lucide-react';
import { parseHistoricalDate, HistoricalDateParseResult } from '../../utils/historicalDateParser';

interface SmartHistoricalDateInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  theme: any;
  isDark: boolean;
  onYearExtracted?: (year: number) => void;
}

export const SmartHistoricalDateInput: React.FC<SmartHistoricalDateInputProps> = ({
  id,
  label,
  value,
  onChange,
  placeholder = 'напр. близько 1845, 12.10.1888 ст.ст., 1914',
  theme,
  isDark,
  onYearExtracted
}) => {
  const parsed: HistoricalDateParseResult | null = useMemo(() => {
    return parseHistoricalDate(value);
  }, [value]);

  const handleApplyConverted = () => {
    if (parsed?.convertedDate) {
      onChange(parsed.convertedDate.formattedText);
      if (parsed.convertedDate.year && onYearExtracted) {
        onYearExtracted(parsed.convertedDate.year);
      }
    }
  };

  const handleApplyModifier = (prefix: string) => {
    const clean = value.replace(/^(бл\.?|близько|до|після|між)\s+/i, '').trim();
    const newVal = prefix ? `${prefix} ${clean}` : clean;
    onChange(newVal);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className={`block text-xs font-semibold ${theme.textPrimary}`}>
          {label}
        </label>
        {parsed?.year && (
          <span className="text-[11px] font-mono font-bold text-amber-500 bg-amber-500/10 px-2 py-0.2 rounded border border-amber-500/20">
            Рік: {parsed.year}
          </span>
        )}
      </div>

      <div className="relative">
        <input
          type="text"
          id={id}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            const p = parseHistoricalDate(e.target.value);
            if (p?.year && onYearExtracted) {
              onYearExtracted(p.year);
            }
          }}
          placeholder={placeholder}
          className={`w-full px-3 py-2 text-sm rounded-lg border transition-all ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} focus:outline-hidden focus:ring-1 focus:ring-amber-500`}
        />
      </div>

      {/* Natural Language Parsing Preview & Quick Modifiers */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleApplyModifier('близько')}
            className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
              parsed?.modifier === 'ABT'
                ? 'bg-amber-500 text-neutral-950 font-bold border-amber-500'
                : `${theme.surfaceBg} ${theme.borderSubtle} hover:border-amber-500/50`
            }`}
            title="Позначити дату як приблизну"
          >
            Близько
          </button>
          <button
            type="button"
            onClick={() => handleApplyModifier('до')}
            className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
              parsed?.modifier === 'BEF'
                ? 'bg-amber-500 text-neutral-950 font-bold border-amber-500'
                : `${theme.surfaceBg} ${theme.borderSubtle} hover:border-amber-500/50`
            }`}
            title="Позначити дату як «до певного року»"
          >
            До
          </button>
          <button
            type="button"
            onClick={() => handleApplyModifier('після')}
            className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
              parsed?.modifier === 'AFT'
                ? 'bg-amber-500 text-neutral-950 font-bold border-amber-500'
                : `${theme.surfaceBg} ${theme.borderSubtle} hover:border-amber-500/50`
            }`}
            title="Позначити дату як «після певного року»"
          >
            Після
          </button>
        </div>

        {/* Julian / Gregorian Conversion Pill */}
        {parsed?.convertedDate && (
          <button
            type="button"
            onClick={handleApplyConverted}
            className={`text-[10px] px-2 py-0.5 rounded-full border transition-all flex items-center gap-1 cursor-pointer font-medium ${
              isDark
                ? 'bg-sky-950/40 text-sky-300 border-sky-500/40 hover:bg-sky-900/50'
                : 'bg-sky-50 text-sky-800 border-sky-300 hover:bg-sky-100'
            }`}
            title="Клікніть, щоб конвертувати стиль дати"
          >
            <RefreshCw className="w-2.5 h-2.5 shrink-0" />
            <span>
              {parsed.convertedDate.targetStyle === 'gregorian'
                ? `→ новий стиль (+${parsed.convertedDate.offsetDays} дн.): ${parsed.convertedDate.formattedText}`
                : `→ старий стиль (${parsed.convertedDate.offsetDays} дн.): ${parsed.convertedDate.formattedText}`}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
