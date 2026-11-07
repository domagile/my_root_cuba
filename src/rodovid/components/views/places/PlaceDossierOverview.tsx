/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Navigation, 
  User, 
  Calendar, 
  Layers, 
  BookOpen, 
  ScrollText, 
  FileText, 
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { Person } from '../../../types/genealogy';
import { getFullName } from '../../../utils/relationship';
import { PlaceDossier } from '../../../../types';
import { ThemeConfig } from '../../../../utils/theme';
import { useUIStore, getPersonUrl, openPersonInNewWindow } from '../../../../stores/useUIStore';
import { renderLinkifiedText, extractLinksFromText } from '../../../../utils/linkUtils';

interface PlaceEventDetail {
  personId: string;
  personName: string;
  type: string;
  date?: string;
  year?: number | string;
  description?: string;
}

interface PlaceInfo {
  birthCount: number;
  deathCount: number;
  marriageCount: number;
  otherCount: number;
  persons: Person[];
  events: PlaceEventDetail[];
}

interface PlaceDossierOverviewProps {
  placeName: string;
  placeObj: PlaceInfo | null;
  dossier: PlaceDossier | undefined;
  onSelectPerson: (id: string) => void;
  onSwitchTab: (tab: 'overview' | 'notepad' | 'history' | 'sources' | 'notes') => void;
  theme: ThemeConfig;
  isDark: boolean;
}

export const PlaceDossierOverview: React.FC<PlaceDossierOverviewProps> = ({
  placeName,
  placeObj,
  dossier,
  onSelectPerson,
  onSwitchTab,
  theme,
  isDark
}) => {
  const hasHistory = !!(dossier?.historyText || dossier?.historicalName || dossier?.district || dossier?.parishChurch);
  const sourcesCount = dossier?.sourceLinks?.length || 0;
  const hasNotes = !!dossier?.notes;

  return (
    <div className="space-y-6">
      {/* Dossier Highlights / Quick jump cards if data exists */}
      {(hasHistory || sourcesCount > 0 || hasNotes) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => onSwitchTab('notepad')}
            className={`p-3.5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} hover:border-amber-500/60 transition-all text-left flex items-start justify-between group shadow-xs cursor-pointer`}
          >
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-500">
                <FileText className="w-4 h-4 shrink-0" />
                <span>Блокнот села (Вільний формат)</span>
              </div>
              <p className={`text-[11px] ${theme.textMuted} truncate`}>
                {dossier?.notes || dossier?.historyText ? (dossier.notes || dossier.historyText || '').slice(0, 60) + '...' : 'Натисніть, щоб записати інформацію про село'}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-amber-500 transition-colors shrink-0 mt-0.5" />
          </button>

          {sourcesCount > 0 && (
            <button
              onClick={() => onSwitchTab('sources')}
              className={`p-3.5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} hover:border-amber-500/60 transition-all text-left flex items-start justify-between group shadow-xs cursor-pointer`}
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
                  <ScrollText className="w-4 h-4 shrink-0" />
                  <span>Метрики та скани ({sourcesCount})</span>
                </div>
                <p className={`text-[11px] ${theme.textMuted} truncate`}>
                  {dossier?.sourceLinks?.[0]?.title || 'Доступні онлайн-джерела'}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-emerald-500 transition-colors shrink-0 mt-0.5" />
            </button>
          )}
        </div>
      )}

      {/* Callout if notepad is empty */}
      {!dossier?.notes && !dossier?.historyText && (
        <div className={`p-4 rounded-2xl ${theme.cardBg} border-2 border-dashed border-amber-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs`}>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-amber-500 font-semibold text-xs">
              <FileText className="w-4 h-4" />
              <span>Блокнот цього населеного пункту порожній</span>
            </div>
            <p className={`text-xs ${theme.textMuted}`}>
              Записуйте сюди будь-яку інформацію про це село у вільному форматі: історію, приписні церкви, ревізії, поміщиків чи спогади родини.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onSwitchTab('notepad')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-xs transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>✍️ Відкрити блокнот села</span>
            </button>
          </div>
        </div>
      )}

      {/* Village Free-Form Notepad Card / Overview */}
      {(dossier?.notes || dossier?.historyText) && (
        <div className={`w-full p-5 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} space-y-3 shadow-xs`}>
          <div className="flex items-center justify-between border-b pb-3 border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-500" />
              <h4 className={`text-xs font-bold uppercase tracking-wider ${theme.textPrimary}`}>
                Блокнот села «{placeName}» (Вільний формат)
              </h4>
            </div>
            <button
              type="button"
              onClick={() => onSwitchTab('notepad')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-xs transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Редагувати в блокноті →</span>
            </button>
          </div>
          <div className={`p-4 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle}`}>
            <div className={`text-xs md:text-sm leading-relaxed ${theme.textPrimary} font-sans line-clamp-8`}>
              {renderLinkifiedText(dossier.notes || dossier.historyText || '', isDark)}
            </div>
            {extractLinksFromText(dossier.notes || dossier.historyText || '').length > 0 && (
              <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800 flex flex-wrap gap-2">
                {extractLinksFromText(dossier.notes || dossier.historyText || '').map((l, i) => (
                  <a
                    key={i}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 hover:border-blue-500 hover:opacity-90 transition-all"
                  >
                    <span>{l.title}</span>
                    <ExternalLink className="w-3 h-3 opacity-70" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Related Persons Grid */}
      <div className="space-y-3">
        <h4 className={`text-xs font-bold uppercase tracking-wider ${theme.textMuted} flex items-center gap-2`}>
          <User className="w-4 h-4 text-amber-500" />
          <span>Пов'язані особи родоводу ({placeObj?.persons.length || 0})</span>
        </h4>

        {placeObj && placeObj.persons.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {placeObj.persons.map((person, pIdx) => (
              <div
                key={`${person.id}_${pIdx}`}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.button === 1) {
                    openPersonInNewWindow(person.id);
                    return;
                  }
                  onSelectPerson(person.id);
                }}
                onAuxClick={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    openPersonInNewWindow(person.id);
                  }
                }}
                className={`p-4 rounded-xl ${theme.cardBg} border ${theme.cardBorder} hover:border-amber-500/60 transition-all cursor-pointer flex items-center justify-between shadow-xs`}
              >
                <div className="space-y-1 min-w-0">
                  <div className={`font-semibold text-xs ${theme.textPrimary} truncate`}>
                    {getFullName(person)}
                  </div>
                  <div className={`flex items-center gap-2 text-[11px] ${theme.textMuted}`}>
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {person.birthYear ? `нар. ${person.birthYear}` : ''}{' '}
                      {person.deathYear ? `— пом. ${person.deathYear}` : ''}
                    </span>
                  </div>
                  {person.occupation && (
                    <div className={`text-[10px] ${theme.textMuted} truncate`}>
                      Фах: {person.occupation}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="text-xs text-amber-600 hover:underline font-medium">
                    Профіль →
                  </span>
                  <a
                    href={getPersonUrl(person.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1 rounded text-neutral-400 hover:text-blue-500 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                    title="Відкрити особу у новій вкладці браузера"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={`p-6 text-center ${theme.cardBg} border ${theme.cardBorder} rounded-xl text-xs ${theme.textMuted} space-y-1.5`}>
            <p className="font-medium text-neutral-700 dark:text-neutral-300">
              У дереві поки що не знайдено осіб, пов'язаних із «{placeName}»
            </p>
            <p className="text-[11px]">
              Населений пункт збережено в картотеці локацій. Ви можете вказати його як місце народження, шлюбу чи смерті в картці предка.
            </p>
          </div>
        )}
      </div>

      {/* Timeline of events in this place */}
      {placeObj && placeObj.events.length > 0 && (
        <div className="space-y-3 pt-2">
          <h4 className={`text-xs font-bold uppercase tracking-wider ${theme.textMuted} flex items-center gap-2`}>
            <Layers className="w-4 h-4 text-amber-500" />
            <span>Архівний літопис локації ({placeObj.events.length})</span>
          </h4>

          <div className="space-y-2">
            {placeObj.events.map((ev, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-xl ${theme.cardBg} border ${theme.cardBorder} flex items-center justify-between text-xs`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className={`font-mono font-semibold text-[11px] ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                      {ev.date || (ev.year ? `${ev.year} р.` : 'Дата не вказана')}
                    </span>
                    <span className={`font-medium ${theme.textPrimary}`}>
                      {ev.personName}
                    </span>
                  </div>
                  <p className={`text-[11px] ${theme.textMuted}`}>
                    {ev.description || ev.type}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onSelectPerson(ev.personId)}
                    className="text-[11px] font-medium text-amber-600 hover:underline cursor-pointer"
                  >
                    Перейти
                  </button>
                  <a
                    href={getPersonUrl(ev.personId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1 rounded text-neutral-400 hover:text-blue-500 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                    title="Відкрити особу у новій вкладці браузера"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
