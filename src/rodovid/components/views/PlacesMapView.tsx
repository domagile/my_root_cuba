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
  Map as MapIcon
} from 'lucide-react';
import { GenealogyDatabase, Person } from '../../types/genealogy';
import { getFullName } from '../../utils/relationship';
import { useUIStore } from '../../../stores/useUIStore';
import { getThemeConfig } from '../../../utils/theme';
import { normalizeUkrainianPlace } from '../../../utils/ukrainianPhonetics';

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
    <div className={`flex-1 flex flex-col md:flex-row h-full overflow-hidden ${theme.textPrimary}`}>
      {/* Left panel: Places search & list */}
      <div className={`w-full md:w-96 border-b md:border-b-0 md:border-r ${theme.cardBorder} flex flex-col h-1/2 md:h-full ${theme.cardBg}`}>
        <div className={`p-4 border-b ${theme.borderSubtle} space-y-3`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-500">
              <Compass className="w-5 h-5" />
              <h2 className={`font-bold text-xs tracking-wide uppercase ${theme.textPrimary}`}>Географія Роду</h2>
            </div>
            <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-neutral-200 text-neutral-700'}`}>
              {placeList.length} локацій
            </span>
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
            return (
              <button
                key={item.place}
                onClick={() => setSelectedPlace(item.place)}
                className={`w-full text-left p-3 rounded-xl transition-all border cursor-pointer ${
                  isSelected
                    ? isDark
                      ? 'bg-amber-950/40 border-amber-500 text-white shadow-xs'
                      : 'bg-amber-50 border-amber-500 text-neutral-900 shadow-xs'
                    : `${theme.surfaceBg} ${theme.borderSubtle} hover:border-neutral-400 ${theme.textSecondary}`
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className={`w-4 h-4 shrink-0 ${isSelected ? 'text-amber-500' : theme.textMuted}`} />
                    <span className="font-semibold text-xs truncate">{item.place}</span>
                  </div>
                  <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full shrink-0 ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-neutral-200 text-neutral-700'}`}>
                    {item.total}
                  </span>
                </div>
                <div className={`flex flex-wrap items-center gap-2.5 text-[11px] ${theme.textMuted} mt-2 pl-6`}>
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
              </button>
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

      {/* Right panel: Details & Related Persons */}
      <div className={`flex-1 flex flex-col h-1/2 md:h-full overflow-hidden ${theme.containerBg}`}>
        <div className={`p-5 border-b ${theme.borderSubtle} flex flex-wrap items-center justify-between gap-3 ${theme.cardBg}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${isDark ? 'bg-amber-950/40 text-amber-400 border border-amber-800/60' : 'bg-amber-100 text-amber-800 border border-amber-300'} flex items-center justify-center`}>
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`font-bold text-base ${theme.textPrimary}`}>{activePlaceName || 'Оберіть населений пункт'}</h3>
              <p className={`text-xs ${theme.textMuted}`}>
                {activePlaceObj 
                  ? `Зафіксовано ${activePlaceObj.persons.length} родичів та ${activePlaceObj.events.length} генеалогічних подій`
                  : 'Немає даних'}
              </p>
            </div>
          </div>

          {activePlaceName && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activePlaceName + ', Ukraine')}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${theme.surfaceBg} border ${theme.borderSubtle} hover:border-amber-500 ${theme.textPrimary} transition-colors`}
            >
              <ExternalLink className="w-3.5 h-3.5 text-amber-500" />
              <span>Знайти на Google Картах</span>
            </a>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Historical / Geographic Card */}
          <div className={`w-full p-6 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} relative overflow-hidden shadow-xs`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-amber-500" />
                  <span className={`font-bold ${theme.textPrimary} text-base`}>{activePlaceName || 'Локація роду'}</span>
                </div>
                <p className={`text-xs ${theme.textMuted}`}>
                  Історико-етнографічний та архівний регіон України
                </p>
              </div>

              {activePlaceObj && (
                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className={`p-2.5 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} text-center`}>
                    <span className={`block text-[10px] ${theme.textMuted} font-sans`}>Народжень</span>
                    <strong className="text-emerald-500 text-sm">{activePlaceObj.birthCount}</strong>
                  </div>
                  <div className={`p-2.5 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} text-center`}>
                    <span className={`block text-[10px] ${theme.textMuted} font-sans`}>Шлюбів</span>
                    <strong className="text-rose-500 text-sm">{activePlaceObj.marriageCount}</strong>
                  </div>
                  <div className={`p-2.5 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} text-center`}>
                    <span className={`block text-[10px] ${theme.textMuted} font-sans`}>Поховань</span>
                    <strong className="text-purple-500 text-sm">{activePlaceObj.deathCount}</strong>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Related Persons Grid */}
          <div className="space-y-3">
            <h4 className={`text-xs font-bold uppercase tracking-wider ${theme.textMuted} flex items-center gap-2`}>
              <User className="w-4 h-4 text-amber-500" />
              <span>Пов'язані особи родоводу ({activePlaceObj?.persons.length || 0})</span>
            </h4>

            {activePlaceObj && activePlaceObj.persons.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activePlaceObj.persons.map((person) => (
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
          {activePlaceObj && activePlaceObj.events.length > 0 && (
            <div className="space-y-3 pt-2">
              <h4 className={`text-xs font-bold uppercase tracking-wider ${theme.textMuted} flex items-center gap-2`}>
                <Layers className="w-4 h-4 text-amber-500" />
                <span>Архівний літопис локації ({activePlaceObj.events.length})</span>
              </h4>

              <div className="space-y-2">
                {activePlaceObj.events.map((ev, idx) => (
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
                      className={`text-[11px] font-medium text-amber-600 hover:underline cursor-pointer`}
                    >
                      Перейти
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
