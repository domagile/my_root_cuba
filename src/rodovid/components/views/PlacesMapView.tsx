/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { MapPin, Search, User, Navigation, Compass, Building, Calendar } from 'lucide-react';
import { GenealogyDatabase, Person } from '../../types/genealogy';
import { getFullName } from '../../utils/relationship';

interface PlacesMapViewProps {
  database: GenealogyDatabase;
  onSelectPerson: (id: string) => void;
}

interface PlaceInfo {
  birthCount: number;
  deathCount: number;
  persons: Person[];
}

export const PlacesMapView: React.FC<PlacesMapViewProps> = ({ database, onSelectPerson }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);

  const personsList = useMemo(() => {
    return Object.values(database.persons || {}) as Person[];
  }, [database]);

  // Group persons and events by place
  const placeData = useMemo<Record<string, PlaceInfo>>(() => {
    const placesMap: Record<string, PlaceInfo> = {};

    personsList.forEach((person) => {
      if (person.birthPlace) {
        const p = person.birthPlace.trim();
        if (!placesMap[p]) placesMap[p] = { birthCount: 0, deathCount: 0, persons: [] };
        placesMap[p].birthCount += 1;
        if (!placesMap[p].persons.some((x) => x.id === person.id)) {
          placesMap[p].persons.push(person);
        }
      }
      if (person.deathPlace) {
        const p = person.deathPlace.trim();
        if (!placesMap[p]) placesMap[p] = { birthCount: 0, deathCount: 0, persons: [] };
        placesMap[p].deathCount += 1;
        if (!placesMap[p].persons.some((x) => x.id === person.id)) {
          placesMap[p].persons.push(person);
        }
      }
    });

    return placesMap;
  }, [personsList]);

  const placeList = useMemo(() => {
    return (Object.entries(placeData) as [string, PlaceInfo][])
      .map(([place, info]) => ({
        place,
        birthCount: info.birthCount,
        deathCount: info.deathCount,
        persons: info.persons,
        total: info.birthCount + info.deathCount
      }))
      .filter((p) => p.place.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => b.total - a.total);
  }, [placeData, searchQuery]);

  const activePlaceObj = selectedPlace ? placeData[selectedPlace] : (placeList[0] ? placeData[placeList[0].place] : null);
  const activePlaceName = selectedPlace || (placeList[0]?.place || '');

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-slate-900 text-slate-100">
      {/* Left panel: Places search & list */}
      <div className="w-full md:w-96 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col h-1/2 md:h-full bg-slate-900/50 backdrop-blur-xs">
        <div className="p-4 border-b border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-[#B88E3E]">
            <Compass className="w-5 h-5" />
            <h2 className="font-bold text-sm tracking-wide uppercase text-slate-200">Географія Роду</h2>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Пошук населеного пункту..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-800/80 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-400 focus:outline-none focus:border-[#B88E3E]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {placeList.map((item) => {
            const isSelected = activePlaceName === item.place;
            return (
              <button
                key={item.place}
                onClick={() => setSelectedPlace(item.place)}
                className={`w-full text-left p-3 rounded-xl transition-all border ${
                  isSelected
                    ? 'bg-[#B88E3E]/20 border-[#B88E3E] text-white shadow-md'
                    : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <MapPin className={`w-4 h-4 shrink-0 ${isSelected ? 'text-[#B88E3E]' : 'text-slate-400'}`} />
                    <span className="font-semibold text-sm line-clamp-1">{item.place}</span>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-300">
                    {item.total}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-2 pl-6">
                  <span>Народжень: <strong className="text-slate-200">{item.birthCount}</strong></span>
                  <span>Поховань: <strong className="text-slate-200">{item.deathCount}</strong></span>
                </div>
              </button>
            );
          })}

          {placeList.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-sm">
              Локацій не знайдено
            </div>
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col h-1/2 md:h-full overflow-hidden bg-slate-950">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#B88E3E]/20 text-[#B88E3E] flex items-center justify-center border border-[#B88E3E]/30">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">{activePlaceName || 'Оберіть населений пункт'}</h3>
              <p className="text-xs text-slate-400">
                {activePlaceObj ? `Зафіксовано ${activePlaceObj.persons.length} родичів у цій локації` : 'Немає даних'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="w-full h-48 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border border-slate-800 relative overflow-hidden flex flex-col items-center justify-center text-center p-6 shadow-inner">
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#B88E3E_1px,transparent_1px)] [background-size:16px_16px]" />
            <Navigation className="w-10 h-10 text-[#B88E3E] mb-2" />
            <span className="font-bold text-slate-200 text-sm">{activePlaceName}</span>
            <span className="text-xs text-slate-400 mt-1">Український історико-архівний регіон</span>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <User className="w-4 h-4 text-[#B88E3E]" />
              <span>Пов'язані особи родоводу ({activePlaceObj?.persons.length || 0})</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activePlaceObj?.persons.map((person) => (
                <div
                  key={person.id}
                  onClick={() => onSelectPerson(person.id)}
                  className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-[#B88E3E]/60 transition-all cursor-pointer flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="font-semibold text-sm text-slate-200">
                      {getFullName(person)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{person.birthYear ? `нар. ${person.birthYear}` : ''} {person.deathYear ? `— пом. ${person.deathYear}` : ''}</span>
                    </div>
                  </div>
                  <span className="text-xs text-[#B88E3E] hover:underline">
                    Профіль →
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
