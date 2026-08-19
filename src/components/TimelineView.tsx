import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Clock, 
  User, 
  Users, 
  Heart, 
  Search, 
  Filter, 
  GitFork, 
  Download, 
  MapPin, 
  FileText, 
  ChevronRight, 
  Sparkles,
  BarChart2,
  Activity,
  Layers,
  Info,
  ExternalLink,
  Crown,
  Baby,
  Skull,
  FileCheck,
  Check,
  Shield,
  Award,
  BookOpen,
  GraduationCap,
  Plane,
  Table,
  Send
} from 'lucide-react';
import { useGenealogy } from '../context/GenealogyContext';
import { Person, MetricRecord, GenealogyDocument, YearMatrixEntry, ArchiveRequest } from '../types';
import { getThemeConfig } from '../utils/theme';

export interface TimelineEvent {
  id: string;
  year: number;
  fullDate?: string;
  type: 'birth' | 'marriage' | 'death' | 'metric' | 'document' | 'matrix' | 'request' | 'military' | 'other';
  categoryLabel?: string;
  title: string;
  description?: string;
  location?: string;
  personId?: string;
  personName?: string;
  secondaryPersonId?: string;
  secondaryPersonName?: string;
  gender?: 'male' | 'female' | 'other' | 'M' | 'F' | 'U';
  photoUrl?: string;
  ageAtEvent?: number;
  archiveRef?: string;
  recordType?: string;
  sourceContext?: string;
}

interface TimelineViewProps {
  onInspectPerson?: (id: string) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({ onInspectPerson }) => {
  const { 
    persons, 
    metricRecords, 
    documents,
    matrixEntries,
    requests,
    selectedPersonId, 
    setSelectedPersonId, 
    setActiveTab, 
    setTreeMode, 
    themePalette 
  } = useGenealogy();

  const theme = getThemeConfig(themePalette);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPersonId, setFilterPersonId] = useState<string>(selectedPersonId || 'all');
  const [eventTypeFilter, setEventTypeFilter] = useState<
    'all' | 'birth' | 'marriage' | 'death' | 'metric' | 'document' | 'matrix' | 'military'
  >('all');
  const [selectedCentury, setSelectedCentury] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'timeline' | 'table' | 'decades' | 'lifespans'>('timeline');

  // Helper to safely parse year
  const parseYear = (dateStr?: string | number): number | null => {
    if (!dateStr) return null;
    if (typeof dateStr === 'number') return dateStr;
    const match = String(dateStr).match(/\b(1[5-9]\d\d|20\d\d)\b/);
    if (match) return parseInt(match[1], 10);
    return null;
  };

  // Helper to calculate age given birth date string and target year/date
  const calculateAge = (birthDateStr?: string | number, targetYear?: number): number | undefined => {
    const birthYear = parseYear(birthDateStr);
    if (birthYear && targetYear && targetYear >= birthYear) {
      return targetYear - birthYear;
    }
    return undefined;
  };

  // Extract and MERGE all timeline events from persons, metric records, documents, matrix entries, and requests
  const allEvents = useMemo(() => {
    const events: TimelineEvent[] = [];

    // 1. Birth Events from Persons
    persons.forEach((p) => {
      const bYear = parseYear(p.birthDate || (p as any).birthYear);
      if (bYear) {
        events.push({
          id: `birth_${p.id}`,
          year: bYear,
          fullDate: p.birthDate || `${bYear} р.`,
          type: 'birth',
          categoryLabel: 'Народження',
          title: `Народження: ${p.lastName} ${p.firstName} ${p.patronymic || ''}`.trim(),
          description: p.notes || p.bio || `Народження особи родоводу`,
          location: p.birthPlace,
          personId: p.id,
          personName: `${p.lastName} ${p.firstName} ${p.patronymic || ''}`.trim(),
          gender: p.gender,
          photoUrl: p.photoUrl || p.avatarUrl || (p as any).avatar,
          ageAtEvent: 0,
          sourceContext: 'Особи'
        });
      }

      // 2. Death Events from Persons
      const dYear = parseYear(p.deathDate || (p as any).deathYear);
      if (dYear) {
        const age = calculateAge(p.birthDate || (p as any).birthYear, dYear);
        events.push({
          id: `death_${p.id}`,
          year: dYear,
          fullDate: p.deathDate || `${dYear} р.`,
          type: 'death',
          categoryLabel: 'Смерть',
          title: `Смерть: ${p.lastName} ${p.firstName} ${p.patronymic || ''}`.trim(),
          description: p.deathPlace ? `Спочив(ла) у м./с. ${p.deathPlace}` : `Зафіксовано дату смерті`,
          location: p.deathPlace,
          personId: p.id,
          personName: `${p.lastName} ${p.firstName} ${p.patronymic || ''}`.trim(),
          gender: p.gender,
          photoUrl: p.photoUrl || p.avatarUrl || (p as any).avatar,
          ageAtEvent: age,
          sourceContext: 'Особи'
        });
      }

      // 3. Life Events attached to Person (Baptism, Military, Education, etc.)
      if (Array.isArray(p.events)) {
        p.events.forEach((ev: any, idx: number) => {
          const evYear = parseYear(ev.date || ev.year);
          if (evYear) {
            const age = calculateAge(p.birthDate || (p as any).birthYear, evYear);
            const isMil = ['military', 'award', 'service', 'rank'].includes((ev.type || '').toLowerCase());
            events.push({
              id: `ev_${p.id}_${ev.id || idx}`,
              year: evYear,
              fullDate: ev.date || `${evYear} р.`,
              type: isMil ? 'military' : 'other',
              categoryLabel: ev.type || 'Життєва подія',
              title: `${ev.type || 'Подія'}: ${p.lastName} ${p.firstName}`,
              description: ev.description || ev.notes || '',
              location: ev.place || ev.placeName,
              personId: p.id,
              personName: `${p.lastName} ${p.firstName}`,
              gender: p.gender,
              photoUrl: p.photoUrl || p.avatarUrl,
              ageAtEvent: age,
              sourceContext: 'Життєві події'
            });
          }
        });
      }

      // 4. Custom fields date events
      if (Array.isArray(p.customFields)) {
        p.customFields.forEach((cf: any, idx: number) => {
          if (cf && cf.value) {
            const cfYear = parseYear(cf.value);
            if (cfYear) {
              const age = calculateAge(p.birthDate || (p as any).birthYear, cfYear);
              events.push({
                id: `cf_${p.id}_${cf.id || idx}`,
                year: cfYear,
                fullDate: cf.value,
                type: 'other',
                categoryLabel: cf.label || 'Атрибут',
                title: `${cf.label || 'Подія'}: ${p.lastName || ''} ${p.firstName || ''}`,
                description: `Відомості з профілю особи`,
                personId: p.id,
                personName: `${p.lastName || ''} ${p.firstName || ''}`,
                gender: p.gender,
                photoUrl: p.photoUrl || p.avatarUrl,
                ageAtEvent: age,
                sourceContext: 'Профіль'
              });
            }
          }
        });
      }
    });

    // 5. Marriage events from couples
    const processedCouples = new Set<string>();
    persons.forEach((p) => {
      if (Array.isArray(p.spouseIds) && p.spouseIds.length > 0) {
        p.spouseIds.forEach((sId) => {
          const coupleKey = [p.id, sId].sort().join('_');
          if (!processedCouples.has(coupleKey)) {
            processedCouples.add(coupleKey);
            const spouse = persons.find((sp) => sp.id === sId);
            if (spouse) {
              let estYear: number | null = null;
              
              if (Array.isArray(p.childrenIds) && p.childrenIds.length > 0) {
                const childBirthYears = p.childrenIds
                  .map((cId) => persons.find((cp) => cp.id === cId))
                  .map((cp) => parseYear(cp?.birthDate || (cp as any)?.birthYear))
                  .filter((y): y is number => y !== null);

                if (childBirthYears.length > 0) {
                  const minChildYear = Math.min(...childBirthYears);
                  estYear = minChildYear - 1;
                }
              }

              if (!estYear) {
                const pBirth = parseYear(p.birthDate || (p as any).birthYear);
                const sBirth = parseYear(spouse.birthDate || (spouse as any).birthYear);
                if (pBirth && sBirth) {
                  estYear = Math.max(pBirth, sBirth) + 22;
                }
              }

              if (estYear) {
                const ageP = calculateAge(p.birthDate || (p as any).birthYear, estYear);
                const ageS = calculateAge(spouse.birthDate || (spouse as any).birthYear, estYear);
                
                events.push({
                  id: `marriage_${coupleKey}`,
                  year: estYear,
                  fullDate: `Близько ${estYear} р.`,
                  type: 'marriage',
                  categoryLabel: 'Шлюб',
                  title: `Шлюб: ${p.lastName} ${p.firstName} та ${spouse.lastName} ${spouse.firstName}`,
                  description: `Родинний союз. ${ageP ? `${p.firstName} (${ageP} р.)` : ''} ${ageS ? `${spouse.firstName} (${ageS} р.)` : ''}`,
                  personId: p.id,
                  personName: `${p.lastName} ${p.firstName}`,
                  secondaryPersonId: spouse.id,
                  secondaryPersonName: `${spouse.lastName} ${spouse.firstName}`,
                  photoUrl: p.photoUrl || p.avatarUrl,
                  ageAtEvent: ageP,
                  sourceContext: 'Родина'
                });
              }
            }
          }
        });
      }
    });

    // 6. Metric Records (Метричні книги)
    (metricRecords || []).forEach((mr) => {
      const mYear = mr.year || parseYear(mr.date || '');
      if (mYear) {
        let typeMap: 'birth' | 'marriage' | 'death' | 'metric' = 'metric';
        let catLabel = 'Метричний запис';
        if (mr.recordType === 'birth') {
          typeMap = 'birth';
          catLabel = 'Метрика: Народження';
        } else if (mr.recordType === 'marriage') {
          typeMap = 'marriage';
          catLabel = 'Метрика: Шлюб';
        } else if (mr.recordType === 'death') {
          typeMap = 'death';
          catLabel = 'Метрика: Смерть';
        }

        const firstLinked = (mr.indexedPersons || []).find((ip) => (ip as any).linkedPersonId);
        const linkedPersonId = (firstLinked as any)?.linkedPersonId;
        const linkedPerson = linkedPersonId ? persons.find((p) => p.id === linkedPersonId) : undefined;

        events.push({
          id: `metric_${mr.id}`,
          year: mYear,
          fullDate: mr.date || `${mYear} р.`,
          type: typeMap,
          categoryLabel: catLabel,
          title: `Метрика: ${mr.title}`,
          description: `Архів: ${mr.archive} (Ф. ${mr.fund}, Оп. ${mr.inventory}, Спр. ${mr.caseNumber}). ${mr.transcription ? `Витяг: ${mr.transcription.slice(0, 120)}...` : ''}`,
          location: mr.archive,
          archiveRef: `Ф. ${mr.fund}, Оп. ${mr.inventory}, Спр. ${mr.caseNumber}`,
          personId: linkedPerson?.id,
          personName: linkedPerson ? `${linkedPerson.lastName} ${linkedPerson.firstName}` : (firstLinked as any)?.personName || (firstLinked as any)?.name,
          photoUrl: linkedPerson?.photoUrl || linkedPerson?.avatarUrl,
          recordType: mr.recordType,
          sourceContext: 'Метричні книги'
        });
      }
    });

    // 7. Documents & Evidence (Речові докази)
    (documents || []).forEach((doc: GenealogyDocument) => {
      const dYear = parseYear(doc.year) || parseYear(doc.yearFrom) || parseYear(doc.date);
      if (dYear) {
        const primaryPersonId = Array.isArray(doc.linkedPersonIds) && doc.linkedPersonIds.length > 0
          ? doc.linkedPersonIds[0]
          : undefined;
        const linkedPerson = primaryPersonId ? persons.find((p) => p.id === primaryPersonId) : undefined;

        events.push({
          id: `doc_${doc.id}`,
          year: dYear,
          fullDate: doc.date || `${dYear} р.`,
          type: 'document',
          categoryLabel: 'Речовий доказ',
          title: `Документ: ${doc.title || doc.researchTitle || 'Архівний документ'}`,
          description: doc.summary || doc.notes || `Архівний шифр: ${doc.archiveRef || doc.archive || 'Не вказано'}`,
          location: doc.archive || doc.location || doc.settlement,
          archiveRef: doc.archiveRef,
          personId: linkedPerson?.id,
          personName: linkedPerson ? `${linkedPerson.lastName} ${linkedPerson.firstName}` : undefined,
          photoUrl: linkedPerson?.photoUrl || linkedPerson?.avatarUrl,
          sourceContext: 'Речові докази'
        });
      }
    });

    // 8. Year Matrix Entries (Літопис подій)
    (matrixEntries || []).forEach((me: YearMatrixEntry) => {
      const mYear = parseYear(me.year);
      if (mYear) {
        events.push({
          id: `matrix_${me.id || mYear}`,
          year: mYear,
          fullDate: `${mYear} р.`,
          type: 'matrix',
          categoryLabel: 'Літопис',
          title: `Хроніка: ${me.researchTitle || me.docType || 'Літописний запис'}`,
          description: `${me.notes || ''} ${me.archiveRef ? `[Шифр: ${me.archiveRef}]` : ''}`.trim(),
          location: me.location || me.village,
          archiveRef: me.archiveRef || me.archiveCode,
          sourceContext: 'Літопис подій'
        });
      }
    });

    // 9. Archive Requests (Запити)
    (requests || []).forEach((req: ArchiveRequest) => {
      const rYear = parseYear(req.sentDate || req.dateSent);
      if (rYear) {
        events.push({
          id: `req_${req.id}`,
          year: rYear,
          fullDate: req.sentDate || req.dateSent || `${rYear} р.`,
          type: 'request',
          categoryLabel: 'Запит до архіву',
          title: `Запит: ${req.title || req.requestSubject || 'Архівний запит'}`,
          description: `Архів: ${req.archiveName || 'Не вказано'}. Статус: ${req.status || 'Надіслано'}.`,
          location: req.archiveName,
          personName: req.targetPersonOrFamily,
          sourceContext: 'Запити'
        });
      }
    });

    // Sort chronologically ascending by year
    return events.sort((a, b) => a.year - b.year);
  }, [persons, metricRecords, documents, matrixEntries, requests]);

  // Unique centuries present
  const availableCenturies = useMemo(() => {
    const setC = new Set<string>();
    allEvents.forEach((ev) => {
      const centuryNum = Math.floor(ev.year / 100) + 1;
      setC.add(`${centuryNum}`);
    });
    return Array.from(setC).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  }, [allEvents]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return allEvents.filter((ev) => {
      // Single person filter
      if (filterPersonId !== 'all') {
        if (ev.personId !== filterPersonId && ev.secondaryPersonId !== filterPersonId) {
          return false;
        }
      }

      // Event type filter
      if (eventTypeFilter !== 'all') {
        if (eventTypeFilter === 'metric' && ev.type !== 'metric' && !ev.id.startsWith('metric_')) return false;
        if (eventTypeFilter === 'document' && ev.type !== 'document') return false;
        if (eventTypeFilter === 'matrix' && ev.type !== 'matrix') return false;
        if (eventTypeFilter === 'military' && ev.type !== 'military') return false;
        if (['birth', 'marriage', 'death'].includes(eventTypeFilter) && ev.type !== eventTypeFilter) return false;
      }

      // Century filter
      if (selectedCentury !== 'all') {
        const centuryNum = Math.floor(ev.year / 100) + 1;
        if (`${centuryNum}` !== selectedCentury) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = ev.title.toLowerCase().includes(q);
        const matchesPerson = (ev.personName || '').toLowerCase().includes(q);
        const matchesLocation = (ev.location || '').toLowerCase().includes(q);
        const matchesDesc = (ev.description || '').toLowerCase().includes(q);
        const matchesYear = ev.year.toString().includes(q);

        if (!matchesTitle && !matchesPerson && !matchesLocation && !matchesDesc && !matchesYear) {
          return false;
        }
      }

      return true;
    });
  }, [allEvents, filterPersonId, eventTypeFilter, selectedCentury, searchQuery]);

  // Timeline year range metrics
  const minYear = allEvents.length > 0 ? allEvents[0].year : 1800;
  const maxYear = allEvents.length > 0 ? allEvents[allEvents.length - 1].year : new Date().getFullYear();

  // Selected person object for header detail
  const activeSelectedPerson = useMemo(() => {
    if (filterPersonId === 'all') return null;
    return persons.find((p) => p.id === filterPersonId) || null;
  }, [persons, filterPersonId]);

  // Group events by decades for Decades View Mode
  const decadeGroups = useMemo(() => {
    const groups: { [key: string]: TimelineEvent[] } = {};
    filteredEvents.forEach((ev) => {
      const decadeStart = Math.floor(ev.year / 10) * 10;
      const key = `${decadeStart}-ті роки (${decadeStart}–${decadeStart + 9})`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(ev);
    });
    return groups;
  }, [filteredEvents]);

  // Badge visual config for event types
  const getEventBadge = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'birth':
        return {
          bg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
          icon: Baby,
          label: 'Народження'
        };
      case 'marriage':
        return {
          bg: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
          icon: Heart,
          label: 'Шлюб'
        };
      case 'death':
        return {
          bg: 'bg-rose-500/15 border-rose-500/30 text-rose-300',
          icon: Skull,
          label: 'Смерть'
        };
      case 'metric':
        return {
          bg: 'bg-purple-500/15 border-purple-500/30 text-purple-300',
          icon: FileCheck,
          label: 'Метрика'
        };
      case 'document':
        return {
          bg: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300',
          icon: FileText,
          label: 'Доказ'
        };
      case 'matrix':
        return {
          bg: 'bg-[#B88E3E]/20 border-[#B88E3E]/40 text-[#B88E3E]',
          icon: Calendar,
          label: 'Літопис'
        };
      case 'request':
        return {
          bg: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300',
          icon: Send,
          label: 'Запит'
        };
      case 'military':
        return {
          bg: 'bg-orange-500/15 border-orange-500/30 text-orange-300',
          icon: Shield,
          label: 'Військова подія'
        };
      default:
        return {
          bg: 'bg-blue-500/15 border-blue-500/30 text-blue-300',
          icon: Activity,
          label: 'Подія'
        };
    }
  };

  return (
    <div className={`flex-1 p-4 md:p-6 ${theme.appBg} overflow-y-auto space-y-4 transition-colors duration-300 relative`}>
      {/* 1. TOP HEADER & METRICS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-[#2A2A2A]">
        <div>
          <h2 className={`text-xl font-bold ${theme.cardTitle} flex items-center gap-2.5`}>
            <Clock className="w-6 h-6 text-[#B88E3E]" />
            <span>Хроніка (Часова шкала подій)</span>
          </h2>
          <p className={`text-xs ${theme.cardSubtext} mt-0.5`}>
            Повний уніфікований літопис: народження, шлюби, смерті, метрики, речові докази та архівні розвідки.
          </p>
        </div>

        {/* Selected Person Indicator / Reset */}
        {activeSelectedPerson && (
          <div className="bg-[#1A1A1A] border border-[#B88E3E]/40 px-3 py-1.5 rounded-xl flex items-center gap-2.5 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-[#B88E3E]">Фільтр особи:</span>
            <span className="text-xs font-bold text-[#E5E5E5]">
              {activeSelectedPerson.lastName} {activeSelectedPerson.firstName}
            </span>
            <button
              onClick={() => setFilterPersonId('all')}
              className="text-xs text-[#8C8C8C] hover:text-[#E5E5E5] underline cursor-pointer"
            >
              Скинути
            </button>
          </div>
        )}
      </div>

      {/* 2. STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-3 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#B88E3E]/15 border border-[#B88E3E]/30 text-[#B88E3E] grid place-items-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#8C8C8C] block">Діапазон</span>
            <span className="text-sm font-bold text-[#E5E5E5] font-mono">{minYear} — {maxYear}</span>
          </div>
        </div>

        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-3 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 grid place-items-center shrink-0">
            <Baby className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#8C8C8C] block">Народження</span>
            <span className="text-sm font-bold text-[#E5E5E5] font-mono">
              {allEvents.filter((e) => e.type === 'birth').length}
            </span>
          </div>
        </div>

        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-3 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 grid place-items-center shrink-0">
            <Heart className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#8C8C8C] block">Шлюби</span>
            <span className="text-sm font-bold text-[#E5E5E5] font-mono">
              {allEvents.filter((e) => e.type === 'marriage').length}
            </span>
          </div>
        </div>

        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-3 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-400 grid place-items-center shrink-0">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#8C8C8C] block">Метрики</span>
            <span className="text-sm font-bold text-[#E5E5E5] font-mono">
              {allEvents.filter((e) => e.type === 'metric').length}
            </span>
          </div>
        </div>

        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-3 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 grid place-items-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#8C8C8C] block">Докази & Літопис</span>
            <span className="text-sm font-bold text-[#E5E5E5] font-mono">
              {allEvents.filter((e) => e.type === 'document' || e.type === 'matrix').length}
            </span>
          </div>
        </div>
      </div>

      {/* 3. CONTROL FILTER BAR */}
      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-3 shadow-md space-y-3">
        {/* Top Filter Controls */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#8C8C8C] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Пошук за роком, особою, містом, архівом чи текстом..."
              className="w-full pl-9 pr-3 py-1.5 bg-[#121212] border border-[#333333] rounded-lg text-xs text-[#E5E5E5] placeholder-[#666666] focus:outline-none focus:border-[#B88E3E] transition-all"
            />
          </div>

          {/* Select Person Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-[#8C8C8C] uppercase whitespace-nowrap">Особа:</span>
            <select
              value={filterPersonId}
              onChange={(e) => setFilterPersonId(e.target.value)}
              className="px-2.5 py-1.5 bg-[#121212] border border-[#333333] rounded-lg text-xs font-semibold text-[#E5E5E5] focus:outline-none focus:border-[#B88E3E] cursor-pointer max-w-[220px]"
            >
              <option value="all">Усі особи ({persons.length})</option>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.lastName} {p.firstName} {p.birthDate ? `(${String(p.birthDate).slice(0, 4)})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* View Modes Toggle */}
          <div className="p-1 rounded-lg bg-[#121212] border border-[#333333] flex items-center gap-1 self-end lg:self-auto overflow-x-auto">
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                viewMode === 'timeline'
                  ? 'bg-[#B88E3E] text-[#0F0F0F] shadow-xs'
                  : 'text-[#8C8C8C] hover:text-[#E5E5E5]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Стрічка</span>
            </button>

            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                viewMode === 'table'
                  ? 'bg-[#B88E3E] text-[#0F0F0F] shadow-xs'
                  : 'text-[#8C8C8C] hover:text-[#E5E5E5]'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Таблиця-літопис</span>
            </button>

            <button
              onClick={() => setViewMode('decades')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                viewMode === 'decades'
                  ? 'bg-[#B88E3E] text-[#0F0F0F] shadow-xs'
                  : 'text-[#8C8C8C] hover:text-[#E5E5E5]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>За десятиліттями</span>
            </button>

            <button
              onClick={() => setViewMode('lifespans')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                viewMode === 'lifespans'
                  ? 'bg-[#B88E3E] text-[#0F0F0F] shadow-xs'
                  : 'text-[#8C8C8C] hover:text-[#E5E5E5]'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Смуги життя</span>
            </button>
          </div>
        </div>

        {/* Sub-filters: Event Types & Century Fast Jump */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#262626]">
          {/* Event Type Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => setEventTypeFilter('all')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                eventTypeFilter === 'all'
                  ? 'bg-[#B88E3E] text-[#0F0F0F]'
                  : 'bg-[#121212] text-[#8C8C8C] hover:text-[#E5E5E5] border border-[#262626]'
              }`}
            >
              Усі події ({allEvents.length})
            </button>

            <button
              onClick={() => setEventTypeFilter('birth')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                eventTypeFilter === 'birth'
                  ? 'bg-emerald-500 text-[#0F0F0F]'
                  : 'bg-[#121212] text-[#8C8C8C] hover:text-emerald-300 border border-[#262626]'
              }`}
            >
              <Baby className="w-3 h-3" />
              <span>Народження</span>
            </button>

            <button
              onClick={() => setEventTypeFilter('marriage')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                eventTypeFilter === 'marriage'
                  ? 'bg-amber-500 text-[#0F0F0F]'
                  : 'bg-[#121212] text-[#8C8C8C] hover:text-amber-300 border border-[#262626]'
              }`}
            >
              <Heart className="w-3 h-3" />
              <span>Шлюби</span>
            </button>

            <button
              onClick={() => setEventTypeFilter('death')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                eventTypeFilter === 'death'
                  ? 'bg-rose-500 text-white'
                  : 'bg-[#121212] text-[#8C8C8C] hover:text-rose-300 border border-[#262626]'
              }`}
            >
              <Skull className="w-3 h-3" />
              <span>Смерті</span>
            </button>

            <button
              onClick={() => setEventTypeFilter('metric')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                eventTypeFilter === 'metric'
                  ? 'bg-purple-500 text-white'
                  : 'bg-[#121212] text-[#8C8C8C] hover:text-purple-300 border border-[#262626]'
              }`}
            >
              <FileCheck className="w-3 h-3" />
              <span>Метрики</span>
            </button>

            <button
              onClick={() => setEventTypeFilter('document')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                eventTypeFilter === 'document'
                  ? 'bg-cyan-500 text-[#0F0F0F]'
                  : 'bg-[#121212] text-[#8C8C8C] hover:text-cyan-300 border border-[#262626]'
              }`}
            >
              <FileText className="w-3 h-3" />
              <span>Речові докази</span>
            </button>

            <button
              onClick={() => setEventTypeFilter('matrix')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                eventTypeFilter === 'matrix'
                  ? 'bg-[#B88E3E] text-[#0F0F0F]'
                  : 'bg-[#121212] text-[#8C8C8C] hover:text-[#B88E3E] border border-[#262626]'
              }`}
            >
              <Calendar className="w-3 h-3" />
              <span>Літопис</span>
            </button>
          </div>

          {/* Century Selection Buttons */}
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-[#8C8C8C] font-bold mr-1">Століття:</span>
            <button
              onClick={() => setSelectedCentury('all')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                selectedCentury === 'all' ? 'bg-[#B88E3E] text-[#0F0F0F]' : 'text-[#8C8C8C] hover:text-[#E5E5E5]'
              }`}
            >
              Усі
            </button>
            {availableCenturies.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedCentury(c)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                  selectedCentury === c ? 'bg-[#B88E3E] text-[#0F0F0F]' : 'text-[#8C8C8C] hover:text-[#E5E5E5]'
                }`}
              >
                {c} ст.
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. MAIN CONTENT AREA */}
      {filteredEvents.length === 0 ? (
        <div className="p-10 text-center rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] text-[#8C8C8C]">
          <Clock className="w-10 h-10 mx-auto mb-3 text-[#B88E3E] opacity-60" />
          <h4 className="text-sm font-bold text-[#E5E5E5]">За обраними фільтрами подій не знайдено</h4>
          <p className="text-xs mt-1">Спробуйте змінити пошуковий запит або скинути фільтри.</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setFilterPersonId('all');
              setEventTypeFilter('all');
              setSelectedCentury('all');
            }}
            className="mt-4 px-4 py-2 rounded-lg bg-[#B88E3E] text-[#0F0F0F] text-xs font-bold transition-all cursor-pointer"
          >
            Скинути фільтри
          </button>
        </div>
      ) : viewMode === 'timeline' ? (
        /* MODE 1: VERTICAL CHRONOLOGICAL TIMELINE */
        <div className="relative pl-6 md:pl-10 space-y-6 before:absolute before:left-3 md:before:left-5 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-[#B88E3E] before:via-[#333333] before:to-transparent">
          {filteredEvents.map((ev) => {
            const badge = getEventBadge(ev.type);
            const Icon = badge.icon;
            const isTargetPerson = activeSelectedPerson && ev.personId === activeSelectedPerson.id;

            return (
              <div key={ev.id} className="relative group">
                {/* Node marker on central line */}
                <div
                  className={`absolute -left-6 md:-left-10 top-3.5 w-6 h-6 rounded-full border-2 grid place-items-center z-10 transition-transform group-hover:scale-110 shadow-md ${
                    isTargetPerson
                      ? 'bg-[#B88E3E] border-white text-[#0F0F0F] ring-4 ring-[#B88E3E]/30'
                      : `${badge.bg} border-[#1A1A1A]`
                  }`}
                >
                  <Icon className="w-3 h-3" />
                </div>

                {/* Event Card */}
                <div
                  className={`p-4 rounded-xl border transition-all shadow-sm ${
                    isTargetPerson
                      ? 'bg-[#222222] border-[#B88E3E]/70 ring-1 ring-[#B88E3E]/30'
                      : 'bg-[#1A1A1A] border-[#2A2A2A] hover:border-[#404040]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#262626] pb-2.5">
                    {/* Event Title & Year */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-sm font-extrabold text-[#B88E3E] bg-[#121212] px-2.5 py-0.5 rounded-md border border-[#262626]">
                        {ev.fullDate || `${ev.year} р.`}
                      </span>

                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold flex items-center gap-1 ${badge.bg}`}>
                        <Icon className="w-3 h-3" />
                        <span>{ev.categoryLabel || badge.label}</span>
                      </span>

                      {ev.sourceContext && (
                        <span className="text-[10px] text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded-md">
                          {ev.sourceContext}
                        </span>
                      )}

                      {ev.ageAtEvent !== undefined && ev.type !== 'birth' && (
                        <span className="text-[10px] font-bold text-[#A3A3A3] bg-[#262626] px-2 py-0.5 rounded-md">
                          Вік: {ev.ageAtEvent} років
                        </span>
                      )}
                    </div>

                    {/* Person Link / Avatar Header */}
                    {ev.personName && (
                      <div className="flex items-center gap-2">
                        {ev.photoUrl ? (
                          <img src={ev.photoUrl} alt="" className="w-5 h-5 rounded-full object-cover border border-[#404040]" />
                        ) : (
                          <User className="w-4 h-4 text-[#B88E3E]" />
                        )}
                        <button
                          onClick={() => ev.personId && onInspectPerson?.(ev.personId)}
                          className="text-xs font-bold text-[#E5E5E5] hover:text-[#B88E3E] transition-colors cursor-pointer underline decoration-dotted"
                        >
                          {ev.personName}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="mt-2.5 space-y-1.5">
                    <h3 className="text-sm font-bold text-[#E5E5E5] flex items-center gap-2">
                      <span>{ev.title}</span>
                    </h3>

                    {ev.description && (
                      <p className="text-xs text-[#A3A3A3] leading-relaxed">
                        {ev.description}
                      </p>
                    )}

                    {/* Footer Details: Location, Archive Ref */}
                    <div className="flex items-center gap-4 pt-1 text-[11px] text-[#8C8C8C] flex-wrap">
                      {ev.location && (
                        <span className="flex items-center gap-1 text-[#A3A3A3]">
                          <MapPin className="w-3.5 h-3.5 text-[#B88E3E]" />
                          <span>{ev.location}</span>
                        </span>
                      )}

                      {ev.archiveRef && (
                        <span className="flex items-center gap-1 font-mono text-[#B88E3E]">
                          <FileText className="w-3.5 h-3.5" />
                          <span>{ev.archiveRef}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Footer */}
                  <div className="mt-3 pt-2 border-t border-[#262626] flex items-center justify-end gap-2">
                    {ev.personId && (
                      <button
                        onClick={() => {
                          setSelectedPersonId(ev.personId!);
                          setTreeMode('hourglass');
                          setActiveTab('tree');
                        }}
                        className="px-2.5 py-1 rounded-md bg-[#262626] hover:bg-[#B88E3E] text-[#B88E3E] hover:text-[#0F0F0F] text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                      >
                        <GitFork className="w-3 h-3" />
                        <span>Показати в дереві</span>
                      </button>
                    )}

                    {ev.personId && (
                      <button
                        onClick={() => onInspectPerson?.(ev.personId!)}
                        className="px-2.5 py-1 rounded-md bg-[#262626] hover:bg-[#333333] text-[#E5E5E5] text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                      >
                        <User className="w-3 h-3 text-[#B88E3E]" />
                        <span>Профіль особи</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === 'table' ? (
        /* MODE 2: CHRONICLE TABLE */
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl overflow-hidden shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#121212] text-[#8C8C8C] uppercase font-bold text-[10px] tracking-wider border-b border-[#2A2A2A]">
                <tr>
                  <th className="px-4 py-3">Рік / Дата</th>
                  <th className="px-4 py-3">Тип події</th>
                  <th className="px-4 py-3">Назва & Опис</th>
                  <th className="px-4 py-3">Особа</th>
                  <th className="px-4 py-3">Локація / Архів</th>
                  <th className="px-4 py-3 text-right">Дії</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262626] text-neutral-200">
                {filteredEvents.map((ev) => {
                  const badge = getEventBadge(ev.type);
                  return (
                    <tr key={ev.id} className="hover:bg-[#222222] transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-[#B88E3E] whitespace-nowrap">
                        {ev.fullDate || `${ev.year} р.`}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${badge.bg}`}>
                          {ev.categoryLabel || badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-md">
                        <div className="font-semibold text-white">{ev.title}</div>
                        {ev.description && (
                          <div className="text-[11px] text-neutral-400 line-clamp-1">{ev.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {ev.personName ? (
                          <button
                            onClick={() => ev.personId && onInspectPerson?.(ev.personId)}
                            className="font-medium text-emerald-400 hover:underline cursor-pointer"
                          >
                            {ev.personName}
                          </button>
                        ) : (
                          <span className="text-neutral-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-neutral-400 max-w-xs truncate">
                        {ev.location || ev.archiveRef || '—'}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {ev.personId && (
                          <button
                            onClick={() => onInspectPerson?.(ev.personId!)}
                            className="p-1.5 text-neutral-400 hover:text-white rounded bg-neutral-800 hover:bg-neutral-700 cursor-pointer"
                            title="Відкрити особу"
                          >
                            <User className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : viewMode === 'decades' ? (
        /* MODE 3: DECADES ACCORDION / GROUPED CARDS */
        <div className="space-y-4">
          {(Object.entries(decadeGroups) as [string, TimelineEvent[]][]).map(([decadeTitle, groupEvents]) => (
            <div key={decadeTitle} className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl overflow-hidden">
              <div className="bg-[#121212] px-4 py-2.5 border-b border-[#262626] flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#B88E3E] uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#B88E3E]" />
                  <span>{decadeTitle}</span>
                </h3>
                <span className="text-[10px] font-mono font-bold bg-[#262626] px-2 py-0.5 rounded text-[#E5E5E5]">
                  Подій: {groupEvents.length}
                </span>
              </div>

              <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {groupEvents.map((ev) => {
                  const badge = getEventBadge(ev.type);
                  const Icon = badge.icon;
                  return (
                    <div
                      key={ev.id}
                      className="p-3 bg-[#121212] border border-[#262626] rounded-lg hover:border-[#B88E3E] transition-all"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-mono text-xs font-extrabold text-[#B88E3E]">
                          {ev.fullDate || `${ev.year} р.`}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold ${badge.bg}`}>
                          {ev.categoryLabel || badge.label}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-[#E5E5E5] line-clamp-1">{ev.title}</h4>
                      {ev.description && (
                        <p className="text-[11px] text-[#A3A3A3] line-clamp-2 mt-1">{ev.description}</p>
                      )}
                      {ev.personId && (
                        <button
                          onClick={() => onInspectPerson?.(ev.personId!)}
                          className="mt-2 text-[10px] font-bold text-[#B88E3E] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>Переглянути особу</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* MODE 4: LIFESPAN COMPARISON PARALLEL BARS */
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-[#262626] pb-2">
            <h3 className="text-xs font-bold text-[#E5E5E5] uppercase tracking-wider flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-[#B88E3E]" />
              <span>Тривалість життя та епохи мешканців проєкту</span>
            </h3>
            <span className="text-[10px] text-[#8C8C8C]">Початок від {minYear} р. до {maxYear} р.</span>
          </div>

          <div className="space-y-3">
            {persons.map((p) => {
              const bYear = parseYear(p.birthDate || (p as any).birthYear) || minYear;
              const dYear = parseYear(p.deathDate || (p as any).deathYear) || new Date().getFullYear();
              const totalSpan = Math.max(1, maxYear - minYear);
              
              const startPct = Math.max(0, Math.min(100, ((bYear - minYear) / totalSpan) * 100));
              const widthPct = Math.max(2, Math.min(100 - startPct, ((dYear - bYear) / totalSpan) * 100));
              const birthY = parseYear(p.birthDate || (p as any).birthYear);
              const deathY = parseYear(p.deathDate || (p as any).deathYear);
              const age = birthY && deathY ? deathY - birthY : null;

              return (
                <div key={p.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <button
                      onClick={() => onInspectPerson?.(p.id)}
                      className="font-bold text-[#E5E5E5] hover:text-[#B88E3E] transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <span>{p.lastName} {p.firstName}</span>
                      {age !== null && <span className="text-[10px] font-mono text-[#8C8C8C]">({age} р.)</span>}
                    </button>
                    <span className="font-mono text-[10px] text-[#8C8C8C]">
                      {p.birthDate?.slice(0, 4) || '???'} — {p.deathDate?.slice(0, 4) || 'нині'}
                    </span>
                  </div>

                  <div className="h-4 bg-[#121212] border border-[#262626] rounded-full relative overflow-hidden">
                    <div
                      style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                      className={`absolute top-0 bottom-0 rounded-full transition-all flex items-center justify-end px-1.5 ${
                        p.gender === 'female' || p.gender === 'F'
                          ? 'bg-gradient-to-r from-rose-900/80 to-pink-600 border border-pink-400/50'
                          : 'bg-gradient-to-r from-blue-900/80 to-blue-600 border border-blue-400/50'
                      }`}
                    >
                      {widthPct > 8 && (
                        <span className="text-[8px] font-mono font-bold text-white uppercase truncate">
                          {bYear}–{dYear}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
