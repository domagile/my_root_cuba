/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { FileText, Save, Check, History, Sparkles, Bookmark, StickyNote } from 'lucide-react';
import { PlaceDossier } from '../../../../types';
import { ThemeConfig } from '../../../../utils/theme';

interface PlaceDossierNotesProps {
  placeName: string;
  dossier: PlaceDossier | undefined;
  onSave: (updated: PlaceDossier) => void;
  theme: ThemeConfig;
  isDark: boolean;
}

export const PlaceDossierNotes: React.FC<PlaceDossierNotesProps> = ({
  placeName,
  dossier,
  onSave,
  theme,
  isDark
}) => {
  const [notes, setNotes] = useState(dossier?.notes || '');
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    setNotes(dossier?.notes || '');
  }, [dossier, placeName]);

  const handleSave = () => {
    const updated: PlaceDossier = {
      id: dossier?.id || placeName.trim(),
      placeName: dossier?.placeName || placeName.trim(),
      historicalName: dossier?.historicalName,
      district: dossier?.district,
      parishChurch: dossier?.parishChurch,
      historyText: dossier?.historyText,
      notes: notes.trim() || undefined,
      sourceLinks: dossier?.sourceLinks || [],
      updatedAt: new Date().toISOString()
    };
    onSave(updated);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleAppendTemplate = (templateText: string) => {
    setNotes((prev) => (prev ? prev + '\n\n' + templateText : templateText));
  };

  return (
    <div className="space-y-6">
      {/* Quick Prompts Bar */}
      <div className={`p-4 rounded-xl ${theme.cardBg} border ${theme.cardBorder} flex flex-wrap items-center justify-between gap-3 shadow-xs`}>
        <div className="flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-amber-500 shrink-0" />
          <span className={`text-xs font-semibold ${theme.textPrimary}`}>
            Шаблони для польових та архівних нотаток:
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleAppendTemplate('📌 Прізвища роду в цьому селі:\n- \n- ')}
            className={`text-xs px-2.5 py-1 rounded-lg ${theme.surfaceBg} border ${theme.borderSubtle} hover:border-amber-500 ${theme.textPrimary} transition-colors`}
          >
            + Прізвища
          </button>
          <button
            type="button"
            onClick={() => handleAppendTemplate('📋 Перевірені ревізії та сповідки:\n[ ] 1795 р. — \n[ ] 1811 р. — \n[ ] 1816 р. — \n[ ] 1834 р. — \n[ ] 1850 р. — \n[ ] 1858 р. — ')}
            className={`text-xs px-2.5 py-1 rounded-lg ${theme.surfaceBg} border ${theme.borderSubtle} hover:border-amber-500 ${theme.textPrimary} transition-colors`}
          >
            + Чекліст ревізій
          </button>
          <button
            type="button"
            onClick={() => handleAppendTemplate('🪦 Кладовище та поховання:\n- Локація старого кладовища:\n- Знайдені пам\'ятники:\n')}
            className={`text-xs px-2.5 py-1 rounded-lg ${theme.surfaceBg} border ${theme.borderSubtle} hover:border-amber-500 ${theme.textPrimary} transition-colors`}
          >
            + Кладовище
          </button>
        </div>
      </div>

      {/* Main Notes Card */}
      <div className={`p-5 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} space-y-4 shadow-xs`}>
        <div className="flex items-center justify-between border-b pb-3 border-neutral-200 dark:border-neutral-800">
          <div>
            <h4 className={`text-xs font-bold uppercase tracking-wider ${theme.textPrimary} flex items-center gap-2`}>
              <FileText className="w-4 h-4 text-amber-500" />
              <span>Особисті нотатки дослідника щодо «{placeName}»</span>
            </h4>
            <p className={`text-[11px] ${theme.textMuted} mt-0.5`}>
              Фіксуйте контакти місцевих краєзнавців, гіпотези, плани пошуку та неопубліковані свідчення
            </p>
          </div>

          <button
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-xs transition-colors cursor-pointer"
          >
            {savedNotice ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>Збережено!</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Зберегти нотатки</span>
              </>
            )}
          </button>
        </div>

        <div>
          <textarea
            rows={12}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Запишіть свої спостереження щодо цього села чи міста: особливості написання прізвищ у місцевих метриках, розмови зі старожилами, адреси збережених хат предків, плани роботи в обласному архіві..."
            className={`w-full p-4 rounded-xl text-xs leading-relaxed font-sans ${theme.surfaceBg} border ${theme.borderSubtle} focus:border-amber-500 focus:outline-hidden ${theme.textPrimary} resize-y`}
          />
        </div>

        {dossier?.updatedAt && (
          <p className={`text-[11px] ${theme.textMuted} flex items-center gap-1.5 pt-1`}>
            <History className="w-3.5 h-3.5" />
            <span>Останнє редагування: {new Date(dossier.updatedAt).toLocaleString('uk-UA')}</span>
          </p>
        )}
      </div>
    </div>
  );
};
