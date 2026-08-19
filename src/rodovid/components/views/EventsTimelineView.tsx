import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Search,
  Filter,
  MapPin,
  BookOpen,
  User,
  ShieldAlert,
  GraduationCap,
  Heart,
  Plane,
  Cross
} from 'lucide-react';
import { GenealogyDatabase, LifeEvent, EventType, Person, Family } from '../../types/genealogy';
import { getFullName } from '../../utils/relationship';

interface EventsTimelineViewProps {
  database: GenealogyDatabase;
  onSelectPerson: (id: string) => void;
}

interface FlattenedEvent {
  event: LifeEvent;
  person?: Person;
  familyId?: string;
  sourceContext: 'person' | 'family';
}

export const EventsTimelineView: React.FC<EventsTimelineViewProps> = ({
  database,
  onSelectPerson
}) => {
  const [selectedType, setSelectedType] = useState<'ALL' | EventType>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Collect all events from persons, families, and global events
  const allEvents = useMemo(() => {
    const list: FlattenedEvent[] = [];

    // From Persons
    (Object.values(database.persons || {}) as Person[]).forEach((p) => {
      const explicitEvents = p.events || [];
      let hasBirth = false;
      let hasDeath = false;

      explicitEvents.forEach((ev) => {
        if (ev.type === 'Birth' || ev.type === 'baptism') hasBirth = true;
        if (ev.type === 'Death' || ev.type === 'burial') hasDeath = true;
        list.push({
          event: ev,
          person: p,
          sourceContext: 'person'
        });
      });

      // Auto-extract birth if not in explicit events
      const bYearNum = typeof p.birthYear === 'number' ? p.birthYear : (p.birthDate ? parseInt(String(p.birthDate).match(/\b(1[5-9]\d\d|20\d\d)\b/)?.[1] || '0', 10) : 0);
      if (!hasBirth && bYearNum > 0) {
        list.push({
          event: {
            id: `birth_${p.id}`,
            personId: p.id,
            type: 'Birth',
            date: p.birthDate || `${bYearNum} р.`,
            year: bYearNum,
            placeName: p.birthPlace,
            description: `Народження особи ${getFullName(p)}`
          },
          person: p,
          sourceContext: 'person'
        });
      }

      // Auto-extract death if not in explicit events
      const dYearNum = typeof p.deathYear === 'number' ? p.deathYear : (p.deathDate ? parseInt(String(p.deathDate).match(/\b(1[5-9]\d\d|20\d\d)\b/)?.[1] || '0', 10) : 0);
      if (!hasDeath && dYearNum > 0) {
        list.push({
          event: {
            id: `death_${p.id}`,
            personId: p.id,
            type: 'Death',
            date: p.deathDate || `${dYearNum} р.`,
            year: dYearNum,
            placeName: p.deathPlace,
            description: `Смерть особи ${getFullName(p)}`
          },
          person: p,
          sourceContext: 'person'
        });
      }
    });

    // From Families
    (Object.values(database.families || {}) as Family[]).forEach((f) => {
      const explicitEvents = f.events || [];
      let hasMarriage = false;
      explicitEvents.forEach((ev) => {
        if (ev.type === 'Marriage') hasMarriage = true;
        list.push({
          event: ev,
          familyId: f.id,
          sourceContext: 'family'
        });
      });

      const mYearNum = typeof f.marriageYear === 'number' ? f.marriageYear : (f.marriageDate ? parseInt(String(f.marriageDate).match(/\b(1[5-9]\d\d|20\d\d)\b/)?.[1] || '0', 10) : 0);
      if (!hasMarriage && mYearNum > 0) {
        const husb = f.husbandId ? database.persons[f.husbandId] : undefined;
        const wife = f.wifeId ? database.persons[f.wifeId] : undefined;
        list.push({
          event: {
            id: `marriage_${f.id}`,
            familyId: f.id,
            type: 'Marriage',
            date: f.marriageDate || `${mYearNum} р.`,
            year: mYearNum,
            placeName: f.marriagePlace,
            description: `Шлюб: ${husb ? getFullName(husb) : ''} та ${wife ? getFullName(wife) : ''}`
          },
          person: husb || wife,
          familyId: f.id,
          sourceContext: 'family'
        });
      }
    });

    // From global database events
    (Object.values(database.events || {}) as LifeEvent[]).forEach((ev) => {
      const person = ev.personId ? database.persons[ev.personId] : undefined;
      list.push({
        event: ev,
        person,
        familyId: ev.familyId,
        sourceContext: ev.familyId ? 'family' : 'person'
      });
    });

    // Sort by year or date string
    return list.sort((a, b) => {
      const yrA = a.event.year || 0;
      const yrB = b.event.year || 0;
      return yrA - yrB;
    });
  }, [database]);

  const filteredEvents = useMemo(() => {
    return allEvents.filter(({ event, person }) => {
      const matchesType = selectedType === 'ALL' || event.type === selectedType;
      const q = searchTerm.toLowerCase().trim();
      const pName = person ? getFullName(person).toLowerCase() : '';
      const desc = (event.description || '').toLowerCase();
      const place = (event.placeName || '').toLowerCase();

      const matchesSearch = !q || pName.includes(q) || desc.includes(q) || place.includes(q);

      return matchesType && matchesSearch;
    });
  }, [allEvents, selectedType, searchTerm]);

  function getEventIcon(type: string) {
    const t = (type || '').toLowerCase();
    switch (t) {
      case 'birth':
      case 'baptism':
        return <User className="w-4 h-4 text-emerald-400" />;
      case 'marriage':
        return <Heart className="w-4 h-4 text-rose-400" />;
      case 'death':
      case 'burial':
        return <Cross className="w-4 h-4 text-slate-400" />;
      case 'military':
      case 'award':
        return <ShieldAlert className="w-4 h-4 text-amber-400" />;
      case 'education':
        return <GraduationCap className="w-4 h-4 text-indigo-400" />;
      case 'emigration':
      case 'immigration':
        return <Plane className="w-4 h-4 text-sky-400" />;
      default:
        return <Calendar className="w-4 h-4 text-slate-300" />;
    }
  }

  function getEventTypeNameUk(type: string): string {
    const map: Record<string, string> = {
      birth: 'Народження',
      death: 'Смерть',
      marriage: 'Одруження',
      divorce: 'Розлучення',
      baptism: 'Хрещення',
      burial: 'Поховання',
      emigration: 'Еміграція',
      immigration: 'Імміграція',
      military: 'Військова служба',
      education: 'Навчання / Освіта',
      occupation: 'Служба / Професія',
      census: 'Перепис / Ревізія',
      residence: 'Проживання',
      award: 'Нагородження',
      custom: 'Особлива подія'
    };
    return map[(type || '').toLowerCase()] || type;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Хронологічна стрічка подій
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Всього {filteredEvents.length} подій у хронологічному порядку
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Пошук за особою, місцем, описом..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">Усі типи подій</option>
              <option value="Birth">Народження</option>
              <option value="Marriage">Шлюби</option>
              <option value="Military">Військова служба</option>
              <option value="Education">Освіта</option>
              <option value="Emigration">Еміграція</option>
              <option value="Death">Смерті</option>
            </select>
          </div>
        </div>
      </div>

      {/* Timeline Stream */}
      {filteredEvents.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
          <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-200">Подій не знайдено</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            Спробуйте змінити параметри пошуку або фільтр подій.
          </p>
        </div>
      ) : (
        <div className="relative border-l-2 border-slate-800 ml-4 md:ml-28 space-y-6 py-4">
          {filteredEvents.map(({ event, person, familyId }, index) => {
            return (
              <div key={event.id || index} className="relative pl-6 group">
                {/* Timeline node bullet */}
                <div className="absolute -left-[17px] top-1.5 w-8 h-8 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center shadow group-hover:border-emerald-500 transition-colors">
                  {getEventIcon(event.type)}
                </div>

                {/* Event Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm hover:border-slate-700 transition-all">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-400 font-mono bg-emerald-950/60 px-2.5 py-0.5 rounded border border-emerald-800/60">
                        {event.date || (event.year ? `${event.year} р.` : 'Дата невідома')}
                      </span>
                      <span className="text-xs font-semibold text-slate-200">
                        {getEventTypeNameUk(event.type)}
                      </span>
                    </div>

                    {person && (
                      <button
                        onClick={() => onSelectPerson(person.id)}
                        className="text-xs font-medium text-slate-300 hover:text-emerald-400 flex items-center gap-1.5 transition-colors"
                      >
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        <span>{getFullName(person)}</span>
                      </button>
                    )}
                  </div>

                  {event.description && (
                    <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">
                      {event.description}
                    </p>
                  )}

                  {event.placeName && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{event.placeName}</span>
                    </div>
                  )}

                  {/* Archival Citations */}
                  {event.citations && event.citations.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1.5">
                      <span className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                        <BookOpen className="w-3 h-3 text-amber-500" />
                        Архівні посилання ({event.citations.length}):
                      </span>
                      {event.citations.map((c, cIdx) => {
                        const source = database.sources[c.sourceId];
                        return (
                          <div
                            key={cIdx}
                            className="bg-slate-950 p-2 rounded text-[11px] text-slate-300 border border-slate-800"
                          >
                            <div className="font-medium text-amber-300">
                              {source?.title || 'Архівне джерело'}
                            </div>
                            {source?.archiveReference && (
                              <div className="text-slate-400 text-[10px] font-mono mt-0.5">
                                {source.archiveReference}
                              </div>
                            )}
                            {c.page && (
                              <div className="text-slate-400 text-[10px] mt-0.5">
                                Аркуш/сторінка: {c.page}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
