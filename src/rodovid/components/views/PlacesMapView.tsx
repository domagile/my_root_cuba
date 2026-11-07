/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
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
  PanelLeftOpen,
  Plus,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { GenealogyDatabase, Person } from '../../types/genealogy';
import { getFullName } from '../../utils/relationship';
import { useUIStore } from '../../../stores/useUIStore';
import { useGenealogyStore } from '../../../stores/useGenealogyStore';
import { useResearchStore } from '../../../stores/useResearchStore';
import { getThemeConfig } from '../../../utils/theme';
import { normalizeUkrainianPlace } from '../../../utils/ukrainianPhonetics';
import { OriginStatsMap } from './OriginStatsMap';
import { PlaceDossierView, DossierTabType } from './places/PlaceDossierView';
import { PlaceDossier } from '../../../types';
import { getGitHubConfig, saveAllPlacesToGitHub } from '../../../services/githubService';

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
  const [activeDossierTab, setActiveDossierTab] = useState<DossierTabType>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAddingPlaceInline, setIsAddingPlaceInline] = useState(false);
  const [newPlaceName, setNewPlaceName] = useState('');
  const [isSyncingAllPlacesGH, setIsSyncingAllPlacesGH] = useState(false);
  const [placesGHSyncStatus, setPlacesGHSyncStatus] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
    url?: string;
  } | null>(null);

  const places = useGenealogyStore((s) => s.places);
  const savePlace = useGenealogyStore((s) => s.savePlace);
  const metricRecords = useResearchStore((s) => s.metricRecords);

  const handleSyncAllPlacesToGitHub = async () => {
    const config = getGitHubConfig();
    if (!config.isConfigured) {
      setPlacesGHSyncStatus({
        type: 'info',
        text: 'GitHub ще не налаштовано. Вкажіть токен та репозиторій у карточці особи (розділ Документи).'
      });
      return;
    }
    setIsSyncingAllPlacesGH(true);
    setPlacesGHSyncStatus(null);
    try {
      const res = await saveAllPlacesToGitHub(places, config);
      if (res.success) {
        setPlacesGHSyncStatus({
          type: 'success',
          text: `Синхронізовано ${res.count} блокнотів населених пунктів у GitHub (${config.owner}/${config.repo} → archive/places/)`,
          url: `https://github.com/${config.owner}/${config.repo}/tree/${config.branch || 'main'}/archive/places`
        });
      } else {
        setPlacesGHSyncStatus({
          type: 'error',
          text: `Помилка синхронізації: ${res.error || 'Невідома помилка'}`
        });
      }
    } catch (err: any) {
      setPlacesGHSyncStatus({
        type: 'error',
        text: `Помилка: ${err.message || String(err)}`
      });
    } finally {
      setIsSyncingAllPlacesGH(false);
    }
  };

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

  const handleCreatePlaceInline = (rawName?: string) => {
    const name = (rawName || newPlaceName).trim();
    if (!name) return;
    const normalized = normalizeUkrainianPlace(name) || name;
    const newDossier: PlaceDossier = {
      id: normalized,
      placeName: name,
      updatedAt: new Date().toISOString()
    };
    savePlace(newDossier);
    setSelectedPlace(normalized);
    setActiveDossierTab('notepad');
    setNewPlaceName('');
    setIsAddingPlaceInline(false);
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

    // 4. Scan explicitly saved PlaceDossiers from useGenealogyStore
    if (places) {
      Object.values(places).forEach((dossier) => {
        if (!dossier || !dossier.placeName) return;
        const normalized = normalizeUkrainianPlace(dossier.placeName) || dossier.placeName.trim();
        if (!normalized || normalized === '-' || normalized === '?') return;
        if (!placesMap[normalized]) {
          placesMap[normalized] = {
            birthCount: 0,
            deathCount: 0,
            marriageCount: 0,
            otherCount: 0,
            persons: [],
            events: []
          };
        }
      });
    }

    return placesMap;
  }, [personsList, database, places]);

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

  const sidebarContainerRef = useRef<HTMLDivElement>(null);
  const sidebarVirtualizer = useVirtualizer({
    count: placeList.length,
    getScrollElement: () => sidebarContainerRef.current,
    estimateSize: () => 105,
    overscan: 4,
  });

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
                <div className="flex flex-col items-center gap-2.5">
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
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsSidebarCollapsed(false);
                      setIsAddingPlaceInline(true);
                    }}
                    title="Додати новий блокнот села чи міста"
                    className="p-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
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
                <button
                  type="button"
                  onClick={() => {
                    setIsSidebarCollapsed(false);
                    setIsAddingPlaceInline(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-600 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Блокнот</span>
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

                {/* Inline Add Village / City Notepad Creator */}
                {isAddingPlaceInline ? (
                  <div className={`p-3 rounded-xl border border-amber-500 ${isDark ? 'bg-amber-950/40' : 'bg-amber-50'} space-y-2`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        <span>Новий блокнот села / міста</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => { setIsAddingPlaceInline(false); setNewPlaceName(''); }}
                        className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 text-xs p-1 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Введіть назву села або міста..."
                      value={newPlaceName}
                      onChange={(e) => setNewPlaceName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreatePlaceInline();
                        if (e.key === 'Escape') { setIsAddingPlaceInline(false); setNewPlaceName(''); }
                      }}
                      autoFocus
                      className={`w-full px-3 py-2 text-xs rounded-lg ${theme.surfaceBg} border ${theme.borderSubtle} focus:border-amber-500 focus:outline-hidden ${theme.textPrimary}`}
                    />
                    <div className="flex items-center justify-end gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => { setIsAddingPlaceInline(false); setNewPlaceName(''); }}
                        className={`px-2.5 py-1 text-xs rounded-lg ${theme.surfaceBg} border ${theme.borderSubtle} ${theme.textMuted} cursor-pointer`}
                      >
                        Скасувати
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCreatePlaceInline()}
                        disabled={!newPlaceName.trim()}
                        className="px-3 py-1 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50 cursor-pointer shadow-xs"
                      >
                        Створити блокнот
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsAddingPlaceInline(true)}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>+ Додати село / місто</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSyncAllPlacesToGitHub}
                        disabled={isSyncingAllPlacesGH}
                        className={`p-2 rounded-xl border transition-colors cursor-pointer flex items-center justify-center ${
                          isDark
                            ? 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-amber-400'
                            : 'bg-white hover:bg-neutral-50 border-neutral-300 text-amber-600'
                        }`}
                        title="Синхронізувати всі блокноти сіл/міст у GitHub (archive/places/)"
                      >
                        {isSyncingAllPlacesGH ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <UploadCloud className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  )}

                  {/* GitHub Places Sync Banner */}
                  {placesGHSyncStatus && (
                    <div
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                        placesGHSyncStatus.type === 'success'
                          ? isDark
                            ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                            : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                          : placesGHSyncStatus.type === 'error'
                          ? isDark
                            ? 'bg-rose-950/60 border-rose-800 text-rose-200'
                            : 'bg-rose-50 border-rose-300 text-rose-900'
                          : isDark
                          ? 'bg-amber-950/60 border-amber-800 text-amber-200'
                          : 'bg-amber-50 border-amber-300 text-amber-900'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {placesGHSyncStatus.type === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                        )}
                        <span className="truncate">{placesGHSyncStatus.text}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPlacesGHSyncStatus(null)}
                        className="text-neutral-400 hover:text-neutral-600 dark:hover:text-white cursor-pointer p-0.5 shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  )}

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

        <div ref={sidebarContainerRef} className="flex-1 overflow-y-auto p-3">
          {placeList.length === 0 ? (
            <div className={`p-8 text-center ${theme.textMuted} text-xs space-y-3`}>
              <MapPin className="w-8 h-8 mx-auto opacity-40 text-amber-500 mb-1" />
              <p className="font-semibold text-sm">Локацій не знайдено</p>
              <p className="text-[11px]">
                {searchQuery 
                  ? 'Спробуйте змінити пошуковий запит або фільтр'
                  : 'Додайте місто чи село до картотеки або вкажіть його у картці особи'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsSidebarCollapsed(false);
                  setIsAddingPlaceInline(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer mt-1"
              >
                <Plus className="w-4 h-4" />
                <span>+ Додати село чи місто (блокнот)</span>
              </button>
            </div>
          ) : (
            <div
              style={{
                height: `${sidebarVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {sidebarVirtualizer.getVirtualItems().map((vItem) => {
                const item = placeList[vItem.index];
                if (!item) return null;

                const isSelected = activePlaceName === item.place;
                const itemDossier = getPlaceDossier(item.place);
                const hasHistory = !!(itemDossier?.historyText || itemDossier?.historicalName || itemDossier?.district || itemDossier?.parishChurch);
                const sourcesCount = itemDossier?.sourceLinks?.length || 0;
                const hasNotes = !!itemDossier?.notes;

                return (
                  <div
                    key={item.place}
                    data-index={vItem.index}
                    ref={sidebarVirtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${vItem.start}px)`,
                    }}
                    className="pb-2"
                  >
                    <div
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
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar virtualization footer */}
        <div className={`px-3 py-1.5 border-t ${theme.borderSubtle} text-[10px] font-mono text-neutral-400 flex items-center justify-between`}>
          <span>Локацій: {placeList.length}</span>
          <span className="text-amber-500 font-semibold">DOM: {sidebarVirtualizer.getVirtualItems().length} у пам'яті (60 FPS)</span>
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
        onOpenAddPlace={() => {
          setIsSidebarCollapsed(false);
          setIsAddingPlaceInline(true);
        }}
      />
    </div>
  )}
</div>
);
};
