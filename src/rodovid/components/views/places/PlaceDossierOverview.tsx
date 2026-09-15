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
  onSwitchTab: (tab: 'overview' | 'history' | 'sources' | 'notes') => void;
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {hasHistory && (
            <button
              onClick={() => onSwitchTab('history')}
              className={`p-3 rounded-xl ${theme.cardBg} border ${theme.cardBorder} hover:border-amber-500/60 transition-all text-left flex items-start justify-between group shadow-xs cursor-pointer`}
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-500">
                  <BookOpen className="w-3.5 h-3.5 shrink-0" />
                  <span>Історія села/міста</span>
                </div>
                <p className={`text-[11px] ${theme.textMuted} truncate`}>
                  {dossier?.historicalName || dossier?.district || 'Заповнено літопис'}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-amber-500 transition-colors shrink-0 mt-0.5" />
            </button>
          )}

          {sourcesCount > 0 && (
            <button
              onClick={() => onSwitchTab('sources')}
              className={`p-3 rounded-xl ${theme.cardBg} border ${theme.cardBorder} hover:border-amber-500/60 transition-all text-left flex items-start justify-between group shadow-xs cursor-pointer`}
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
                  <ScrollText className="w-3.5 h-3.5 shrink-0" />
                  <span>Метрики та скани ({sourcesCount})</span>
                </div>
                <p className={`text-[11px] ${theme.textMuted} truncate`}>
                  {dossier?.sourceLinks?.[0]?.title || 'Доступні онлайн-джерела'}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-emerald-500 transition-colors shrink-0 mt-0.5" />
            </button>
          )}

          {hasNotes && (
            <button
              onClick={() => onSwitchTab('notes')}
              className={`p-3 rounded-xl ${theme.cardBg} border ${theme.cardBorder} hover:border-amber-500/60 transition-all text-left flex items-start justify-between group shadow-xs cursor-pointer`}
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-500">
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span>Нотатки дослідника</span>
                </div>
                <p className={`text-[11px] ${theme.textMuted} truncate`}>
                  {dossier?.notes ? dossier.notes.slice(0, 40) + '...' : 'Є дослідницькі записи'}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-sky-500 transition-colors shrink-0 mt-0.5" />
            </button>
          )}
        </div>
      )}

      {/* Historical / Geographic Card */}
      <div className={`w-full p-6 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} relative overflow-hidden shadow-xs`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Navigation className="w-5 h-5 text-amber-500" />
              <span className={`font-bold ${theme.textPrimary} text-base`}>{placeName || 'Локація роду'}</span>
            </div>
            <p className={`text-xs ${theme.textMuted}`}>
              {dossier?.district ? `${dossier.district} • ` : ''}Історико-етнографічний та архівний регіон України
            </p>
          </div>

          {placeObj && (
            <div className="flex items-center gap-4 text-xs font-mono">
              <div className={`p-2.5 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} text-center`}>
                <span className={`block text-[10px] ${theme.textMuted} font-sans`}>Народжень</span>
                <strong className="text-emerald-500 text-sm">{placeObj.birthCount}</strong>
              </div>
              <div className={`p-2.5 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} text-center`}>
                <span className={`block text-[10px] ${theme.textMuted} font-sans`}>Шлюбів</span>
                <strong className="text-rose-500 text-sm">{placeObj.marriageCount}</strong>
              </div>
              <div className={`p-2.5 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} text-center`}>
                <span className={`block text-[10px] ${theme.textMuted} font-sans`}>Поховань</span>
                <strong className="text-purple-500 text-sm">{placeObj.deathCount}</strong>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Related Persons Grid */}
      <div className="space-y-3">
        <h4 className={`text-xs font-bold uppercase tracking-wider ${theme.textMuted} flex items-center gap-2`}>
          <User className="w-4 h-4 text-amber-500" />
          <span>Пов'язані особи родоводу ({placeObj?.persons.length || 0})</span>
        </h4>

        {placeObj && placeObj.persons.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {placeObj.persons.map((person) => (
              <div
                key={person.id}
                onClick={() => onSelectPerson(person.id)}
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
                <span className="text-xs text-amber-600 hover:underline shrink-0 ml-3 font-medium">
                  Профіль →
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className={`p-6 text-center ${theme.cardBg} border ${theme.cardBorder} rounded-xl text-xs ${theme.textMuted}`}>
            Оберіть населений пункт зі списку ліворуч
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

                <button
                  onClick={() => onSelectPerson(ev.personId)}
                  className="text-[11px] font-medium text-amber-600 hover:underline cursor-pointer"
                >
                  Перейти
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
