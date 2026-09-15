/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  MapPin, 
  Search, 
  User, 
  Navigation, 
  Compass, 
  Building, 
  Calendar, 
  ExternalLink,
  Heart,
  Cross,
  Sparkles,
  Layers,
  Map as MapIcon,
  BarChart3,
  BookOpen,
  ScrollText,
  FileText,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { GenealogyDatabase, Person } from '../../types/genealogy';
import { getFullName } from '../../utils/relationship';
import { useUIStore } from '../../../stores/useUIStore';
import { useGenealogyStore } from '../../../stores/useGenealogyStore';
import { useResearchStore } from '../../../stores/useResearchStore';
import { getThemeConfig } from '../../../utils/theme';
import { normalizeUkrainianPlace } from '../../../utils/ukrainianPhonetics';
import { OriginStatsMap } from './OriginStatsMap';
import { PlaceDossierView } from './places/PlaceDossierView';
import { PlaceDossier } from '../../../types';

interface PlacesMapViewProps {
  database: GenealogyDatabase;
  onSelectPerson: (id: string) => void;
}

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

export const PlacesMapView: React.FC<PlacesMapViewProps> = ({ database, onSelectPerson }) => {
  const themePalette = useUIStore((s) => s.themePalette);
  const theme = getThemeConfig(themePalette);
  const isDark = theme.category === 'dark';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
  const [eventTypeFilter, setEventTypeFilter] = useState<'all' | 'birth' | 'marriage' | 'death'>('all');
  const [placesViewSubmode, setPlacesViewSubmode] = useState<'map_catalog' | 'origin_stats'>('map_catalog');
  const [activeDossierTab, setActiveDossierTab] = useState<'overview' | 'history' | 'sources' | 'notes'>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const places = useGenealogyStore((s) => s.places);
  const savePlace = useGenealogyStore((s) => s.savePlace);
  const metricRecords = useResearchStore((s) => s.metricRecords);

  const getPlaceDossier = (placeName: string): PlaceDossier | undefined => {
    if (!placeName || !places) return undefined;
    const trimmed = placeName.trim();
    if (places[trimmed]) return places[trimmed];
    const normalized = normalizeUkrainianPlace(trimmed);
    if (places[normalized]) return places[normalized];
    return Object.values(places).find(
      (p) => p && (p.placeName?.trim().toLowerCase() === trimmed.toLowerCase() || p.id === trimmed || p.id === normalized)
    );
  };

  const handleSaveDossier = (updated: PlaceDossier) => {
    savePlace(updated);
  };

  const personsList = useMemo(() => {
    return Object.values(database.persons || {}) as Person[];
  }, [database]);

  // Group persons and events by place
  const placeData = useMemo<Record<string, PlaceInfo>>(() => {
    const placesMap: Record<string, PlaceInfo> = {};

    const registerPlace = (
      placeRaw: string | undefined | null, 
      person: Person, 
      type: 'birth' | 'death' | 'marriage' | 'event',
      date?: string,
      year?: number | string,
      description?: string
    ) => {
      if (!placeRaw || typeof placeRaw !== 'string') return;
      const normalizedPlace = normalizeUkrainianPlace(placeRaw);
      if (!normalizedPlace || normalizedPlace === '-' || normalizedPlace === '?') return;
      const p = normalizedPlace;

      if (!placesMap[p]) {
        placesMap[p] = { 
          birthCount: 0, 
          deathCount: 0, 
          marriageCount: 0, 
          otherCount: 0, 
          persons: [], 
          events: [] 
        };
      }

      if (type === 'birth') placesMap[p].birthCount += 1;
      else if (type === 'death') placesMap[p].deathCount += 1;
      else if (type === 'marriage') placesMap[p].marriageCount += 1;
      else placesMap[p].otherCount += 1;

      if (!placesMap[p].persons.some((x) => x.id === person.id)) {
        placesMap[p].persons.push(person);
      }

      placesMap[p].events.push({
        personId: person.id,
        personName: getFullName(person),
        type,
        date,
        year,
        description
      });
    };

    // 1. Scan Persons
    personsList.forEach((person) => {
      if (person.birthPlace) {
        registerPlace(person.birthPlace, person, 'birth', person.birthDate, person.birthYear, 'Місце народження');
      }
      if (person.deathPlace) {
        registerPlace(person.deathPlace, person, 'death', person.deathDate, person.deathYear, 'Місце поховання/смерті');
      }
      if (Array.isArray(person.events)) {
        person.events.forEach((ev) => {
          const loc = ev.placeName || ev.place || ev.location;
          if (loc) {
            registerPlace(loc, person, 'event', ev.date, ev.year, ev.description || ev.type || 'Подія');
          }
        });
      }
    });

    // 2. Scan Families (Marriage places)
    if (database.families) {
      Object.values(database.families).forEach((fam) => {
        if (fam.marriagePlace) {
          const husband = fam.husbandId ? database.persons[fam.husbandId] : null;
          const wife = fam.wifeId ? database.persons[fam.wifeId] : null;
          if (husband) {
            registerPlace(fam.marriagePlace, husband, 'marriage', fam.marriageDate, fam.marriageYear, 'Шлюб');
          }
          if (wife) {
            registerPlace(fam.marriagePlace, wife, 'marriage', fam.marriageDate, fam.marriageYear, 'Шлюб');
          }
        }
      });
    }

    // 3. Scan Global Database Events
    if (database.events) {
      Object.values(database.events).forEach((ev) => {
        const loc = ev.placeName || ev.place;
        if (loc && ev.personId && database.persons[ev.personId]) {
          const person = database.persons[ev.personId];
          const isKnown = placesMap[loc.trim()]?.events.some(
            (e) => e.personId === person.id && e.date === ev.date && e.description === ev.description
          );
          if (!isKnown) {
            registerPlace(loc, person, 'event', ev.date, ev.year, ev.description || ev.title || 'Подія');
          }
        }
      });
    }

    return placesMap;
  }, [personsList, database]);

  const placeList = useMemo(() => {
    return (Object.entries(placeData) as [string, PlaceInfo][])
      .map(([place, info]) => ({
        place,
        birthCount: info.birthCount,
        deathCount: info.deathCount,
        marriageCount: info.marriageCount,
        otherCount: info.otherCount,
        persons: info.persons,
        events: info.events,
        total: info.birthCount + info.deathCount + info.marriageCount + info.otherCount
      }))
      .filter((p) => {
        const matchesSearch = p.place.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesSearch) return false;
        if (eventTypeFilter === 'birth') return p.birthCount > 0;
        if (eventTypeFilter === 'death') return p.deathCount > 0;
        if (eventTypeFilter === 'marriage') return p.marriageCount > 0;
        return true;
      })
      .sort((a, b) => b.total - a.total);
  }, [placeData, searchQuery, eventTypeFilter]);

  const activePlaceName = selectedPlace && placeData[selectedPlace] 
    ? selectedPlace 
    : (placeList[0]?.place || '');

  const activePlaceObj = activePlaceName ? placeData[activePlaceName] : null;

  return (
    <div className={`flex-1 flex flex-col h-full overflow-hidden ${theme.textPrimary}`}>
      {/* Top Header Submode Switcher */}
      <div className={`px-4 py-2.5 border-b ${theme.cardBorder} flex flex-wrap items-center justify-between gap-3 ${isDark ? 'bg-[#15191e]' : 'bg-neutral-50'} shrink-0`}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPlacesViewSubmode('map_catalog')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              placesViewSubmode === 'map_catalog'
                ? isDark
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                  : 'bg-amber-100 text-amber-900 border border-amber-300 shadow-xs'
                : `${theme.surfaceBg} ${theme.textMuted} border ${theme.borderSubtle} hover:${theme.textPrimary}`
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-amber-500" />
            <span>Каталог локацій та Google Карти</span>
          </button>

          <button
            type="button"
            onClick={() => setPlacesViewSubmode('origin_stats')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              placesViewSubmode === 'origin_stats'
                ? isDark
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                  : 'bg-amber-100 text-amber-900 border border-amber-300 shadow-xs'
                : `${theme.surfaceBg} ${theme.textMuted} border ${theme.borderSubtle} hover:${theme.textPrimary}`
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-amber-500" />
            <span>Статистична карта походження та діаграми</span>
          </button>
        </div>
      </div>

      {placesViewSubmode === 'origin_stats' ? (
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <OriginStatsMap
            database={database}
            metricRecordsList={metricRecords}
            onSelectPerson={onSelectPerson}
          />
        </div>
      ) : (
        <div className={`flex-1 flex flex-col md:flex-row h-full overflow-hidden ${theme.textPrimary}`}>
          {/* Left panel: Places search & list (Collapsible) */}
          {isSidebarCollapsed ? (
            <>
              {/* Desktop compact collapsed rail */}
              <div
                onClick={() => setIsSidebarCollapsed(false)}
                title="Розгорнути список локацій «Географія Роду»"
                className={`hidden md:flex flex-col items-center py-4 px-1.5 w-12 shrink-0 border-r ${theme.cardBorder} ${theme.cardBg} cursor-pointer hover:bg-amber-500/5 transition-all select-none justify-between`}
              >
                <div className="flex flex-col items-center gap-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsSidebarCollapsed(false);
                    }}
                    title="Розгорнути список локацій «Географія Роду»"
                    className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 transition-colors cursor-pointer"
                  >
                    <PanelLeftOpen className="w-4 h-4" />
                  </button>
                  <Compass className="w-4 h-4 text-amber-500 opacity-80" />
                </div>

                <div className="flex flex-col items-center gap-2 [writing-mode:vertical-lr] rotate-180 text-xs font-semibold tracking-wider uppercase text-neutral-400 hover:text-amber-500 transition-colors">
                  <span>Географія Роду</span>
                </div>

                <div className="flex flex-col items-center">
                  <span 
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${isDark ? 'bg-neutral-800 text-amber-400 border border-neutral-700' : 'bg-amber-100 text-amber-800 border border-amber-300'} font-semibold`} 
                    title={`${placeList.length} локацій`}
                  >
                    {placeList.length}
                  </span>
                </div>
              </div>

              {/* Mobile compact collapsed strip */}
              <div className={`md:hidden flex items-center justify-between p-2.5 border-b ${theme.borderSubtle} ${theme.cardBg}`}>
                <button
                  type="button"
                  onClick={() => setIsSidebarCollapsed(false)}
                  className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400 cursor-pointer"
                >
                  <PanelLeftOpen className="w-4 h-4" />
                  <span>Показати список локацій ({placeList.length})</span>
                </button>
              </div>
            </>
          ) : (
            <div className={`w-full md:w-96 border-b md:border-b-0 md:border-r ${theme.cardBorder} flex flex-col h-1/2 md:h-full ${theme.cardBg} transition-all`}>
              <div className={`p-4 border-b ${theme.borderSubtle} space-y-3`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-amber-500 min-w-0">
                    <Compass className="w-5 h-5 shrink-0" />
                    <h2 className={`font-bold text-xs tracking-wide uppercase truncate ${theme.textPrimary}`}>Географія Роду</h2>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-neutral-200 text-neutral-700'}`}>
                      {placeList.length} локацій
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsSidebarCollapsed(true)}
                      title="Згорнути панель «Географія Роду» (більше простору для вкладок)"
                      aria-label="Згорнути список локацій"
                      className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${theme.surfaceBg} ${theme.borderSubtle} hover:border-amber-500 text-neutral-500 hover:text-amber-600 dark:hover:text-amber-400`}
                    >
                      <PanelLeftClose className="w-4 h-4" />
                    </button>
                  </div>
                </div>

          <div className="relative">
            <Search className={`w-4 h-4 absolute left-3 top-3 ${theme.textMuted}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Пошук населеного пункту чи повіту..."
              className={`w-full pl-9 pr-4 py-2 text-xs ${theme.inputBg} border ${theme.inputBorder} rounded-lg ${theme.textPrimary} placeholder:text-neutral-400 focus:outline-none focus:border-amber-500`}
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
            <button
              onClick={() => setEventTypeFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                eventTypeFilter === 'all'
                  ? 'bg-amber-600 text-white font-medium shadow-xs'
                  : `${theme.surfaceBg} ${theme.textSecondary} border ${theme.borderSubtle} hover:border-amber-500`
              }`}
            >
              Всі події
            </button>
            <button
              onClick={() => setEventTypeFilter('birth')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                eventTypeFilter === 'birth'
                  ? 'bg-emerald-600 text-white font-medium shadow-xs'
                  : `${theme.surfaceBg} ${theme.textSecondary} border ${theme.borderSubtle} hover:border-emerald-500`
              }`}
            >
              Народження
            </button>
            <button
              onClick={() => setEventTypeFilter('marriage')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                eventTypeFilter === 'marriage'
                  ? 'bg-rose-600 text-white font-medium shadow-xs'
                  : `${theme.surfaceBg} ${theme.textSecondary} border ${theme.borderSubtle} hover:border-rose-500`
              }`}
            >
              Шлюби
            </button>
            <button
              onClick={() => setEventTypeFilter('death')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                eventTypeFilter === 'death'
                  ? 'bg-purple-600 text-white font-medium shadow-xs'
                  : `${theme.surfaceBg} ${theme.textSecondary} border ${theme.borderSubtle} hover:border-purple-500`
              }`}
            >
              Поховання
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {placeList.map((item) => {
            const isSelected = activePlaceName === item.place;
            const itemDossier = getPlaceDossier(item.place);
            const hasHistory = !!(itemDossier?.historyText || itemDossier?.historicalName || itemDossier?.district || itemDossier?.parishChurch);
            const sourcesCount = itemDossier?.sourceLinks?.length || 0;
            const hasNotes = !!itemDossier?.notes;

            return (
              <div
                key={item.place}
                className={`w-full p-3 rounded-xl transition-all border ${
                  isSelected
                    ? isDark
                      ? 'bg-amber-950/40 border-amber-500 text-white shadow-xs'
                      : 'bg-amber-50 border-amber-500 text-neutral-900 shadow-xs'
                    : `${theme.surfaceBg} ${theme.borderSubtle} hover:border-neutral-400 ${theme.textSecondary}`
                }`}
              >
                <div 
                  onClick={() => setSelectedPlace(item.place)}
                  className="flex items-start justify-between gap-2 cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className={`w-4 h-4 shrink-0 ${isSelected ? 'text-amber-500' : theme.textMuted}`} />
                    <span className="font-semibold text-xs truncate">{item.place}</span>
                  </div>
                  <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full shrink-0 ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-neutral-200 text-neutral-700'}`}>
                    {item.total}
                  </span>
                </div>

                <div 
                  onClick={() => setSelectedPlace(item.place)}
                  className={`flex flex-wrap items-center gap-2.5 text-[11px] ${theme.textMuted} mt-2 pl-6 cursor-pointer`}
                >
                  {item.birthCount > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      нар.: <strong className={theme.textPrimary}>{item.birthCount}</strong>
                    </span>
                  )}
                  {item.marriageCount > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                      шлюб: <strong className={theme.textPrimary}>{item.marriageCount}</strong>
                    </span>
                  )}
                  {item.deathCount > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                      пом.: <strong className={theme.textPrimary}>{item.deathCount}</strong>
                    </span>
                  )}
                </div>

                {/* Dossier Indicator Badges */}
                {(hasHistory || sourcesCount > 0 || hasNotes) && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2 pl-6 pt-1.5 border-t border-dashed border-neutral-200 dark:border-neutral-800/80">
                    {hasHistory && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPlace(item.place);
                          setActiveDossierTab('history');
                        }}
                        title="Відкрити історію населеного пункту"
                        className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${isDark ? 'bg-amber-950/60 text-amber-300 border border-amber-800/60' : 'bg-amber-100 text-amber-900 border border-amber-300'} hover:opacity-80 transition-opacity cursor-pointer`}
                      >
                        <BookOpen className="w-3 h-3" />
                        <span>Історія</span>
                      </button>
                    )}

                    {sourcesCount > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPlace(item.place);
                          setActiveDossierTab('sources');
                        }}
                        title="Відкрити збережені метрики та архіви"
                        className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${isDark ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60' : 'bg-emerald-100 text-emerald-900 border border-emerald-300'} hover:opacity-80 transition-opacity cursor-pointer`}
                      >
                        <ScrollText className="w-3 h-3" />
                        <span>Метрики ({sourcesCount})</span>
                      </button>
                    )}

                    {hasNotes && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPlace(item.place);
                          setActiveDossierTab('notes');
                        }}
                        title="Відкрити нотатки дослідника"
                        className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${isDark ? 'bg-sky-950/60 text-sky-300 border border-sky-800/60' : 'bg-sky-100 text-sky-900 border border-sky-300'} hover:opacity-80 transition-opacity cursor-pointer`}
                      >
                        <FileText className="w-3 h-3" />
                        <span>Нотатки</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {placeList.length === 0 && (
            <div className={`p-8 text-center ${theme.textMuted} text-xs space-y-2`}>
              <MapPin className="w-8 h-8 mx-auto opacity-40 text-amber-500 mb-1" />
              <p className="font-medium">Локацій не знайдено</p>
              <p className="text-[11px]">
                {searchQuery 
                  ? 'Спробуйте змінити пошуковий запит або фільтр'
                  : 'Додайте місця народження, шлюбу чи подій у картках осіб'}
              </p>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Right panel: Place Dossier & Pedigree View */}
      <PlaceDossierView
        placeName={activePlaceName}
        placeObj={activePlaceObj}
        dossier={activePlaceName ? getPlaceDossier(activePlaceName) : undefined}
        onSaveDossier={handleSaveDossier}
        onSelectPerson={onSelectPerson}
        theme={theme}
        isDark={isDark}
        activeDossierTab={activeDossierTab}
        setActiveDossierTab={setActiveDossierTab}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
        placesCount={placeList.length}
      />
    </div>
  )}
</div>
);
};
