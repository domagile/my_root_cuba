/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BookOpen, Landmark, Save, ExternalLink, Check, History, Sparkles, MapPin } from 'lucide-react';
import { PlaceDossier } from '../../../../types';
import { ThemeConfig } from '../../../../utils/theme';

interface PlaceDossierHistoryProps {
  placeName: string;
  dossier: PlaceDossier | undefined;
  onSave: (updated: PlaceDossier) => void;
  theme: ThemeConfig;
  isDark: boolean;
}

export const PlaceDossierHistory: React.FC<PlaceDossierHistoryProps> = ({
  placeName,
  dossier,
  onSave,
  theme,
  isDark
}) => {
  const [historicalName, setHistoricalName] = useState(dossier?.historicalName || '');
  const [district, setDistrict] = useState(dossier?.district || '');
  const [parishChurch, setParishChurch] = useState(dossier?.parishChurch || '');
  const [historyText, setHistoryText] = useState(dossier?.historyText || '');
  const [savedNotice, setSavedNotice] = useState(false);

  // Sync state when dossier or placeName changes
  useEffect(() => {
    setHistoricalName(dossier?.historicalName || '');
    setDistrict(dossier?.district || '');
    setParishChurch(dossier?.parishChurch || '');
    setHistoryText(dossier?.historyText || '');
  }, [dossier, placeName]);

  const handleSave = () => {
    const updated: PlaceDossier = {
      id: dossier?.id || placeName.trim(),
      placeName: dossier?.placeName || placeName.trim(),
      historicalName: historicalName.trim() || undefined,
      district: district.trim() || undefined,
      parishChurch: parishChurch.trim() || undefined,
      historyText: historyText.trim() || undefined,
      notes: dossier?.notes,
      sourceLinks: dossier?.sourceLinks || [],
      updatedAt: new Date().toISOString()
    };
    onSave(updated);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const wikiSearchUrl = `https://uk.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(placeName)}`;
  const imsuSearchUrl = `https://www.google.com/search?q=${encodeURIComponent('Історія міст і сіл Української РСР ' + placeName)}`;

  return (
    <div className="space-y-6">
      {/* Quick Research Helpers */}
      <div className={`p-4 rounded-xl ${theme.cardBg} border ${theme.cardBorder} flex flex-wrap items-center justify-between gap-3 shadow-xs`}>
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-amber-500 shrink-0" />
          <span className={`text-xs font-semibold ${theme.textPrimary}`}>
            Швидкі довідкові ресурси для «{placeName}»:
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={wikiSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${theme.surfaceBg} border ${theme.borderSubtle} hover:border-amber-500 ${theme.textPrimary} transition-colors`}
          >
            <ExternalLink className="w-3 h-3 text-amber-500" />
            <span>Вікіпедія</span>
          </a>
          <a
            href={imsuSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${theme.surfaceBg} border ${theme.borderSubtle} hover:border-amber-500 ${theme.textPrimary} transition-colors`}
          >
            <ExternalLink className="w-3 h-3 text-amber-500" />
            <span>«Історія міст і сіл УРСР»</span>
          </a>
        </div>
      </div>

      {/* Main Historical Form */}
      <div className={`p-5 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} space-y-4 shadow-xs`}>
        <div className="flex items-center justify-between border-b pb-3 border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <Landmark className="w-4 h-4 text-amber-500" />
            <h4 className={`text-xs font-bold uppercase tracking-wider ${theme.textPrimary}`}>
              Історико-географічне досьє населеного пункту
            </h4>
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
                <span>Зберегти історію</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={`block text-xs font-medium ${theme.textMuted} mb-1.5`}>
              Історичні / альтернативні назви
            </label>
            <input
              type="text"
              value={historicalName}
              onChange={(e) => setHistoricalName(e.target.value)}
              placeholder="напр. Попельня, Popielnia"
              className={`w-full px-3 py-2 rounded-xl text-xs ${theme.surfaceBg} border ${theme.borderSubtle} focus:border-amber-500 focus:outline-hidden ${theme.textPrimary}`}
            />
          </div>

          <div>
            <label className={`block text-xs font-medium ${theme.textMuted} mb-1.5`}>
              Адміністративно-територіальний поділ
            </label>
            <input
              type="text"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="напр. Сквирський повіт, Київська губ."
              className={`w-full px-3 py-2 rounded-xl text-xs ${theme.surfaceBg} border ${theme.borderSubtle} focus:border-amber-500 focus:outline-hidden ${theme.textPrimary}`}
            />
          </div>

          <div>
            <label className={`block text-xs font-medium ${theme.textMuted} mb-1.5`}>
              Храм / церковна парафія
            </label>
            <input
              type="text"
              value={parishChurch}
              onChange={(e) => setParishChurch(e.target.value)}
              placeholder="напр. Церква св. Миколая (православна)"
              className={`w-full px-3 py-2 rounded-xl text-xs ${theme.surfaceBg} border ${theme.borderSubtle} focus:border-amber-500 focus:outline-hidden ${theme.textPrimary}`}
            />
          </div>
        </div>

        <div>
          <label className={`block text-xs font-medium ${theme.textMuted} mb-1.5`}>
            Історія села чи міста (краєзнавчий літопис, поміщики, церкви, важливі роки)
          </label>
          <textarea
            rows={10}
            value={historyText}
            onChange={(e) => setHistoryText(e.target.value)}
            placeholder="Вкажіть першу письмову згадку про населений пункт, володарів маєтків, назви навколишніх хуторів та кутків села, зміни церковних парафій, ревізькі казки яких років відомі..."
            className={`w-full p-3 rounded-xl text-xs leading-relaxed ${theme.surfaceBg} border ${theme.borderSubtle} focus:border-amber-500 focus:outline-hidden ${theme.textPrimary} resize-y`}
          />
        </div>

        {dossier?.updatedAt && (
          <p className={`text-[11px] ${theme.textMuted} flex items-center gap-1.5 pt-1`}>
            <History className="w-3.5 h-3.5" />
            <span>Останнє оновлення досьє: {new Date(dossier.updatedAt).toLocaleString('uk-UA')}</span>
          </p>
        )}
      </div>
    </div>
  );
};
