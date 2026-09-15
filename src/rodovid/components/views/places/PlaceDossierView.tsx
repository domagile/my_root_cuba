/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Building, 
  ExternalLink, 
  Compass, 
  BookOpen, 
  ScrollText, 
  FileText,
  MapPin,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { Person } from '../../../types/genealogy';
import { PlaceDossier } from '../../../../types';
import { ThemeConfig } from '../../../../utils/theme';
import { PlaceDossierOverview } from './PlaceDossierOverview';
import { PlaceDossierHistory } from './PlaceDossierHistory';
import { PlaceDossierSources } from './PlaceDossierSources';
import { PlaceDossierNotes } from './PlaceDossierNotes';

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

interface PlaceDossierViewProps {
  placeName: string;
  placeObj: PlaceInfo | null;
  dossier: PlaceDossier | undefined;
  onSaveDossier: (dossier: PlaceDossier) => void;
  onSelectPerson: (id: string) => void;
  theme: ThemeConfig;
  isDark: boolean;
  activeDossierTab: 'overview' | 'history' | 'sources' | 'notes';
  setActiveDossierTab: (tab: 'overview' | 'history' | 'sources' | 'notes') => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  placesCount?: number;
}

export const PlaceDossierView: React.FC<PlaceDossierViewProps> = ({
  placeName,
  placeObj,
  dossier,
  onSaveDossier,
  onSelectPerson,
  theme,
  isDark,
  activeDossierTab,
  setActiveDossierTab,
  isSidebarCollapsed,
  onToggleSidebar,
  placesCount
}) => {
  if (!placeName) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center p-8 ${theme.containerBg} ${theme.textMuted} relative`}>
        {isSidebarCollapsed && onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            title="Розгорнути список локацій «Географія Роду»"
            className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-xs transition-colors cursor-pointer"
          >
            <PanelLeftOpen className="w-4 h-4" />
            <span>Показати список локацій</span>
          </button>
        )}
        <div className="text-center space-y-2 max-w-xs">
          <MapPin className="w-10 h-10 mx-auto opacity-30 text-amber-500" />
          <p className="font-semibold text-sm">Оберіть населений пункт</p>
          <p className="text-xs">Виберіть село чи місто зі списку ліворуч, щоб переглянути родовід та вести краєзнавче досьє.</p>
        </div>
      </div>
    );
  }

  const hasHistory = !!(dossier?.historyText || dossier?.historicalName || dossier?.district || dossier?.parishChurch);
  const sourcesCount = dossier?.sourceLinks?.length || 0;
  const hasNotes = !!dossier?.notes;

  const tabs: { id: 'overview' | 'history' | 'sources' | 'notes'; label: string; icon: React.ReactNode; badge?: string | number }[] = [
    {
      id: 'overview',
      label: 'Огляд та родовід',
      icon: <Compass className="w-4 h-4" />,
      badge: placeObj?.persons.length ? placeObj.persons.length : undefined
    },
    {
      id: 'history',
      label: 'Історія села/міста',
      icon: <BookOpen className="w-4 h-4" />,
      badge: hasHistory ? '✓' : undefined
    },
    {
      id: 'sources',
      label: 'Онлайн-метрики та архіви',
      icon: <ScrollText className="w-4 h-4" />,
      badge: sourcesCount > 0 ? sourcesCount : undefined
    },
    {
      id: 'notes',
      label: 'Дослідницькі нотатки',
      icon: <FileText className="w-4 h-4" />,
      badge: hasNotes ? '✓' : undefined
    }
  ];

  return (
    <div className={`flex-1 flex flex-col h-full overflow-hidden ${theme.containerBg}`}>
      {/* Location Header */}
      <div className={`p-4 md:p-5 border-b ${theme.borderSubtle} ${theme.cardBg}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            {isSidebarCollapsed && onToggleSidebar && (
              <button
                type="button"
                onClick={onToggleSidebar}
                title="Розгорнути список населених пунктів «Географія Роду»"
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold ${
                  isDark 
                    ? 'bg-amber-950/70 text-amber-300 border border-amber-700/80 hover:bg-amber-900/60' 
                    : 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                } transition-colors cursor-pointer shadow-xs shrink-0`}
              >
                <PanelLeftOpen className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="font-semibold">Локації</span>
                {placesCount !== undefined && (
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
                    {placesCount}
                  </span>
                )}
              </button>
            )}

            <div className={`w-10 h-10 rounded-xl ${isDark ? 'bg-amber-950/40 text-amber-400 border border-amber-800/60' : 'bg-amber-100 text-amber-800 border border-amber-300'} flex items-center justify-center shrink-0`}>
              <Building className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`font-bold text-base ${theme.textPrimary}`}>{placeName}</h3>
                {dossier?.historicalName && (
                  <span className={`text-xs font-normal ${theme.textMuted}`}>
                    ({dossier.historicalName})
                  </span>
                )}
              </div>
              <p className={`text-xs ${theme.textMuted}`}>
                {placeObj 
                  ? `Зафіксовано ${placeObj.persons.length} родичів та ${placeObj.events.length} генеалогічних подій`
                  : 'Населений пункт родоводу'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isSidebarCollapsed && onToggleSidebar && (
              <button
                type="button"
                onClick={onToggleSidebar}
                title="Згорнути «Географія Роду» для максимального простору вкладок"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${theme.surfaceBg} border ${theme.borderSubtle} hover:border-amber-500 ${theme.textPrimary} transition-colors cursor-pointer`}
              >
                <PanelLeftClose className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden sm:inline">Згорнути локації</span>
              </button>
            )}

            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName + ', Ukraine')}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${theme.surfaceBg} border ${theme.borderSubtle} hover:border-amber-500 ${theme.textPrimary} transition-colors`}
            >
              <ExternalLink className="w-3.5 h-3.5 text-amber-500" />
              <span>Google Карти</span>
            </a>
          </div>
        </div>

        {/* Dossier Tabs Navigation */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          {tabs.map((tab) => {
            const isActive = activeDossierTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveDossierTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-amber-600 text-white shadow-xs'
                    : `${theme.surfaceBg} ${theme.textSecondary} hover:${theme.textPrimary} border ${theme.borderSubtle}`
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${
                      isActive
                        ? 'bg-amber-700 text-amber-100'
                        : isDark
                        ? 'bg-neutral-800 text-amber-400'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {activeDossierTab === 'overview' && (
          <PlaceDossierOverview
            placeName={placeName}
            placeObj={placeObj}
            dossier={dossier}
            onSelectPerson={onSelectPerson}
            onSwitchTab={setActiveDossierTab}
            theme={theme}
            isDark={isDark}
          />
        )}

        {activeDossierTab === 'history' && (
          <PlaceDossierHistory
            placeName={placeName}
            dossier={dossier}
            onSave={onSaveDossier}
            theme={theme}
            isDark={isDark}
          />
        )}

        {activeDossierTab === 'sources' && (
          <PlaceDossierSources
            placeName={placeName}
            dossier={dossier}
            onSave={onSaveDossier}
            theme={theme}
            isDark={isDark}
          />
        )}

        {activeDossierTab === 'notes' && (
          <PlaceDossierNotes
            placeName={placeName}
            dossier={dossier}
            onSave={onSaveDossier}
            theme={theme}
            isDark={isDark}
          />
        )}
      </div>
    </div>
  );
};
