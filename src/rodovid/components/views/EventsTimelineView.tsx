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
import { useUIStore } from '../../../stores/useUIStore';
import { getThemeConfig } from '../../../utils/theme';

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
  const themePalette = useUIStore((s) => s.themePalette);
  const theme = getThemeConfig(themePalette);
  const isDark = theme.category === 'dark';

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
    <div className={`max-w-4xl mx-auto px-4 py-6 space-y-6 ${theme.textPrimary}`}>
      {/* Header */}
      <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-xl p-4 shadow-xs space-y-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className={`text-xl font-bold tracking-tight ${theme.textPrimary}`}>
              Хронологічна стрічка подій
            </h1>
            <p className={`text-xs ${theme.textMuted} mt-0.5`}>
              Всього {filteredEvents.length} подій у хронологічному порядку
            </p>
          </div>
        </div>

        <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t ${theme.borderSubtle}`}>
          <div className="sm:col-span-2 relative">
            <Search className={`w-4 h-4 ${theme.textMuted} absolute left-3 top-1/2 -translate-y-1/2`} />
            <input
              type="text"
              placeholder="Пошук за особою, місцем, описом..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 ${theme.inputBg} border ${theme.inputBorder} rounded-lg text-xs ${theme.textPrimary} placeholder:text-neutral-400 focus:outline-none focus:border-emerald-500`}
            />
          </div>

          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as any)}
              className={`w-full px-3 py-2 ${theme.inputBg} border ${theme.inputBorder} rounded-lg text-xs ${theme.textPrimary} focus:outline-none focus:border-emerald-500 cursor-pointer`}
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
        <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-xl p-12 text-center`}>
          <Calendar className={`w-12 h-12 ${theme.textMuted} mx-auto mb-3`} />
          <h3 className={`text-base font-semibold ${theme.textPrimary}`}>Подій не знайдено</h3>
          <p className={`text-xs ${theme.textMuted} max-w-sm mx-auto mt-1`}>
            Спробуйте змінити параметри пошуку або фільтр подій.
          </p>
        </div>
      ) : (
        <div className={`relative border-l-2 ${theme.borderSubtle} ml-4 md:ml-28 space-y-6 py-4`}>
          {filteredEvents.map(({ event, person, familyId }, index) => {
            return (
              <div key={event.id || index} className="relative pl-6 group">
                {/* Timeline node bullet */}
                <div className={`absolute -left-[17px] top-1.5 w-8 h-8 rounded-full ${theme.cardBg} border-2 ${theme.cardBorder} flex items-center justify-center shadow-xs group-hover:border-emerald-500 transition-colors`}>
                  {getEventIcon(event.type)}
                </div>

                {/* Event Card */}
                <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-xl p-4 shadow-xs hover:border-emerald-500/60 transition-all`}>
                  <div className={`flex flex-wrap items-center justify-between gap-2 border-b ${theme.borderSubtle} pb-2.5`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold font-mono px-2.5 py-0.5 rounded border ${
                        isDark ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60' : 'text-emerald-800 bg-emerald-100 border-emerald-300'
                      }`}>
                        {event.date || (event.year ? `${event.year} р.` : 'Дата невідома')}
                      </span>
                      <span className={`text-xs font-semibold ${theme.textPrimary}`}>
                        {getEventTypeNameUk(event.type)}
                      </span>
                    </div>

                    {person && (
                      <button
                        onClick={() => onSelectPerson(person.id)}
                        className={`text-xs font-medium ${theme.textSecondary} hover:text-emerald-500 flex items-center gap-1.5 transition-colors cursor-pointer`}
                      >
                        <User className={`w-3.5 h-3.5 ${theme.textMuted}`} />
                        <span>{getFullName(person)}</span>
                      </button>
                    )}
                  </div>

                  {event.description && (
                    <p className={`text-xs ${theme.textSecondary} mt-2.5 leading-relaxed`}>
                      {event.description}
                    </p>
                  )}

                  {event.placeName && (
                    <div className={`flex items-center gap-1.5 text-xs ${theme.textMuted} mt-2`}>
                      <MapPin className={`w-3.5 h-3.5 ${theme.textMuted} shrink-0`} />
                      <span>{event.placeName}</span>
                    </div>
                  )}

                  {/* Archival Citations */}
                  {event.citations && event.citations.length > 0 && (
                    <div className={`mt-3 pt-2.5 border-t ${theme.borderSubtle} space-y-1.5`}>
                      <span className={`text-[10px] ${theme.textMuted} uppercase font-semibold flex items-center gap-1`}>
                        <BookOpen className="w-3 h-3 text-amber-500" />
                        Архівні посилання ({event.citations.length}):
                      </span>
                      {event.citations.map((c, cIdx) => {
                        const source = database.sources[c.sourceId];
                        return (
                          <div
                            key={cIdx}
                            className={`${theme.surfaceBg} p-2 rounded text-[11px] ${theme.textSecondary} border ${theme.borderSubtle}`}
                          >
                            <div className={`font-medium ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
                              {source?.title || 'Архівне джерело'}
                            </div>
                            {source?.archiveReference && (
                              <div className={`${theme.textMuted} text-[10px] font-mono mt-0.5`}>
                                {source.archiveReference}
                              </div>
                            )}
                            {c.page && (
                              <div className={`${theme.textMuted} text-[10px] mt-0.5`}>
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
