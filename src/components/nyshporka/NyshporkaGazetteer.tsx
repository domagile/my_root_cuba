/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  MapPin, 
  Search, 
  BookOpen, 
  ExternalLink, 
  Building2, 
  Compass, 
  Church, 
  CheckCircle2,
  Filter,
  PanelLeftClose,
  PanelLeftOpen,
  Copy,
  Check,
  Users,
  ScrollText,
  Calendar,
  Layers,
  Sparkles,
  Info,
  ChevronRight,
  RotateCcw
} from 'lucide-react';
import { useGenealogyStore } from '../../stores/useGenealogyStore';
import { Person } from '../../types';

interface SettlementItem {
  id: string;
  name: string;
  historicalName?: string;
  type: 'село' | 'містечко' | 'місто' | 'хутір';
  volost: string;
  district: string; // повіт
  gubernia: string;
  churchName: string;
  fondCode: string;
  archiveCode: string;
  archiveName: string;
  hasDigitalScans: boolean;
  yearsRange: string;
  notes?: string;
}

const SAMPLE_GAZETTEER: SettlementItem[] = [
  {
    id: '1',
    name: 'Липовеньке',
    historicalName: 'Липовенька',
    type: 'село',
    volost: 'Липовеньківська',
    district: 'Балтський повіт',
    gubernia: 'Подільська губернія',
    churchName: 'Свято-Покровська / Свято-Іоанно-Богословська церква',
    fondCode: 'Фонд 315, Опис 1',
    archiveCode: 'ДАХмО',
    archiveName: 'Державний архів Хмельницької області',
    hasDigitalScans: true,
    yearsRange: '1796–1920',
    notes: 'Збереглися справи про священицькі роди (справа 159 про дякона Григорія Долищинського 1821-1822 рр.)'
  },
  {
    id: '2',
    name: 'Голованівськ',
    historicalName: 'м-ко Головановскъ',
    type: 'містечко',
    volost: 'Голованівська',
    district: 'Балтський повіт',
    gubernia: 'Подільська губернія',
    churchName: 'Свято-Іоанно-Богословська церква',
    fondCode: 'Фонд 315, Опис 1',
    archiveCode: 'ДАХмО',
    archiveName: 'Державний архів Хмельницької області',
    hasDigitalScans: true,
    yearsRange: '1800–1918',
    notes: 'Священицький рід Виробинських та Лобкевичів'
  },
  {
    id: '3',
    name: 'Кам’янець-Подільський',
    historicalName: 'Каменецъ-Подольскій',
    type: 'місто',
    volost: 'Центр губернії',
    district: 'Кам’янецький повіт',
    gubernia: 'Подільська губернія',
    churchName: 'Кафедральний собор, Іоанно-Предтеченська, Миколаївська, Георгіївська',
    fondCode: 'Фонд 315, 226, 227',
    archiveCode: 'ДАХмО',
    archiveName: 'Державний архів Хмельницької області',
    hasDigitalScans: true,
    yearsRange: '1795–1922',
    notes: 'Подільська духовна консисторія, Подільська казенна палата (ревізії)'
  },
  {
    id: '4',
    name: 'Проскурів',
    historicalName: 'Проскуровъ (нині Хмельницький)',
    type: 'місто',
    volost: 'Центр повіту',
    district: 'Проскурівський повіт',
    gubernia: 'Подільська губернія',
    churchName: 'Різдво-Богородицька, соборна церква',
    fondCode: 'Фонд 315, 13614',
    archiveCode: 'ДАХмО',
    archiveName: 'Державний архів Хмельницької області',
    hasDigitalScans: true,
    yearsRange: '1796–1920',
    notes: 'Метричні книги та судові справи повітового суду'
  },
  {
    id: '5',
    name: 'Васильків',
    historicalName: 'Васильковъ',
    type: 'місто',
    volost: 'Центр повіту',
    district: 'Васильківський повіт',
    gubernia: 'Київська губернія',
    churchName: 'Свято-Антоніє-Феодосіївський собор, Свято-Миколаївська церква',
    fondCode: 'Фонд 127, Опис 1012',
    archiveCode: 'ЦДІАК',
    archiveName: 'Центральний державний історичний архів України, м. Київ',
    hasDigitalScans: true,
    yearsRange: '1720–1919',
    notes: 'Київська духовна консисторія, метричні книги та сповідні відомості козацьких і міщанських родин'
  },
  {
    id: '6',
    name: 'Біла Церква',
    historicalName: 'Бѣлая Церковь',
    type: 'місто',
    volost: 'Білоцерківська',
    district: 'Васильківський повіт',
    gubernia: 'Київська губернія',
    churchName: 'Преображенський собор, Марії Магдалини, костел св. Іоанна Хрестителя',
    fondCode: 'Фонд 127, 280',
    archiveCode: 'ЦДІАК / ДАКО',
    archiveName: 'ЦДІАК України та Держ. архів Київської області',
    hasDigitalScans: true,
    yearsRange: '1740–1920',
    notes: 'Браніцькі маєтки, ревізькі казки селян і шляхти'
  },
  {
    id: '7',
    name: 'Житомир',
    historicalName: 'Житоміръ',
    type: 'місто',
    volost: 'Центр губернії',
    district: 'Житомирський повіт',
    gubernia: 'Волинська губернія',
    churchName: 'Спасо-Преображенський собор, Хрестовоздвиженська, св. Софії',
    fondCode: 'Фонд 1, 118',
    archiveCode: 'ДАЖО',
    archiveName: 'Державний архів Житомирської області',
    hasDigitalScans: true,
    yearsRange: '1795–1920',
    notes: 'Волинська духовна консисторія, метрики шляхти та селян'
  },
  {
    id: '8',
    name: 'Лубни',
    historicalName: 'Лубны',
    type: 'місто',
    volost: 'Лубенська',
    district: 'Лубенський повіт',
    gubernia: 'Полтавська губернія',
    churchName: 'Різдва Богородиці, Троїцька, Воскресенська церква',
    fondCode: 'Фонд 706, 1011',
    archiveCode: 'ДАПО',
    archiveName: 'Державний архів Полтавської області',
    hasDigitalScans: true,
    yearsRange: '1750–1920',
    notes: 'Козацькі родовідні книги Лубенського козацького полку'
  },
  {
    id: '9',
    name: 'Балта',
    historicalName: 'Балта',
    type: 'місто',
    volost: 'Центр повіту',
    district: 'Балтський повіт',
    gubernia: 'Подільська губернія',
    churchName: 'Миколаївський собор, Успенська церква',
    fondCode: 'Фонд 315, 37',
    archiveCode: 'ДАХмО / ДАОО',
    archiveName: 'ДАХмО та Держ. архів Одеської області',
    hasDigitalScans: true,
    yearsRange: '1797–1920',
    notes: 'Прикордонні землі Поділля та Новоросії'
  },
  {
    id: '10',
    name: 'Вінниця',
    historicalName: 'Винница',
    type: 'місто',
    volost: 'Центр повіту',
    district: 'Вінницький повіт',
    gubernia: 'Подільська губернія',
    churchName: 'Преображенський собор, Воскресенська, Миколаївська церква',
    fondCode: 'Фонд 315, 200',
    archiveCode: 'ДАВіО / ДАХмО',
    archiveName: 'Держ. архів Вінницької області та ДАХмО',
    hasDigitalScans: true,
    yearsRange: '1796–1922',
    notes: 'Метричні книги міщанських та шляхетських родин Поділля'
  }
];

interface NyshporkaGazetteerProps {
  theme: any;
  onOpenViewer?: () => void;
}

export const NyshporkaGazetteer: React.FC<NyshporkaGazetteerProps> = ({ theme, onOpenViewer }) => {
  const isDark = theme?.category === 'dark';
  const persons = useGenealogyStore((s) => s.persons);

  const [query, setQuery] = useState('');
  const [districtFilter, setDistrictFilter] = useState('ALL');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedSettlementId, setSelectedSettlementId] = useState<string>('1');
  const [copiedFondCode, setCopiedFondCode] = useState(false);

  // Map persons from genealogy store to settlements
  const settlementPersonsMap = useMemo(() => {
    const map: Record<string, Person[]> = {};
    if (!persons || persons.length === 0) return map;

    SAMPLE_GAZETTEER.forEach((item) => {
      const sName = item.name.toLowerCase();
      const sHist = (item.historicalName || '').toLowerCase();
      const found = persons.filter((p) => {
        const bp = (p.birthPlace || '').toLowerCase();
        const rp = (p.residencePlace || '').toLowerCase();
        const dp = (p.deathPlace || '').toLowerCase();
        const ep = (p.events || []).map((e) => (e.place || '').toLowerCase()).join(' ');
        return (
          bp.includes(sName) ||
          rp.includes(sName) ||
          dp.includes(sName) ||
          ep.includes(sName) ||
          (sHist && (bp.includes(sHist) || rp.includes(sHist) || dp.includes(sHist)))
        );
      });
      map[item.id] = found;
    });

    return map;
  }, [persons]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return SAMPLE_GAZETTEER.filter((item) => {
      const matchDistrict = districtFilter === 'ALL' || item.district.includes(districtFilter);
      const matchQuery =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.historicalName && item.historicalName.toLowerCase().includes(q)) ||
        item.district.toLowerCase().includes(q) ||
        item.churchName.toLowerCase().includes(q) ||
        item.gubernia.toLowerCase().includes(q) ||
        item.volost.toLowerCase().includes(q) ||
        item.archiveCode.toLowerCase().includes(q);
      return matchDistrict && matchQuery;
    });
  }, [query, districtFilter]);

  // Ensure an item is selected from the filtered list if current selection is invalid
  const selectedSettlement = useMemo(() => {
    if (filtered.length === 0) return null;
    const match = filtered.find((item) => item.id === selectedSettlementId);
    return match || filtered[0];
  }, [filtered, selectedSettlementId]);

  const districts = [
    'ALL',
    'Балтський',
    'Кам’янецький',
    'Проскурівський',
    'Васильківський',
    'Лубенський',
    'Житомирський',
    'Вінницький'
  ];

  const handleCopyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedFondCode(true);
    setTimeout(() => setCopiedFondCode(false), 2000);
  };

  const relatedPersons = selectedSettlement ? (settlementPersonsMap[selectedSettlement.id] || []) : [];

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className={`text-xl font-bold ${theme.cardTitle || theme.textPrimary} flex items-center gap-2`}>
            <MapPin className="w-5 h-5 text-amber-500" />
            Газетир: де шукати моє село
          </h2>
          <p className={`text-xs ${theme.cardSubtext || theme.textMuted} mt-0.5`}>
            Географічний довідник історичних населених пунктів, парафій та збереженості метричних фондів
          </p>
        </div>

        {/* Quick stats and toggle indicator */}
        <div className="flex items-center gap-2">
          {isSidebarCollapsed && (
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-all cursor-pointer shadow-xs"
              title="Розгорнути бічну панель «Географія Роду»"
            >
              <PanelLeftOpen className="w-4 h-4" />
              <span>Показати перелік «Географія Роду» ({filtered.length})</span>
            </button>
          )}

          <div className="text-xs px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-medium">
            Всього: <strong className="text-amber-600 dark:text-amber-400">{SAMPLE_GAZETTEER.length}</strong> сіл та міст
          </div>
        </div>
      </div>

      {/* Main Layout: Master-Detail with Collapsible Sidebar */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch min-h-[620px]">
        {/* ================= LEFT SIDEBAR: «Географія Роду» ================= */}
        {isSidebarCollapsed ? (
          <>
            {/* Desktop Collapsed Rail */}
            <div
              onClick={() => setIsSidebarCollapsed(false)}
              title="Розгорнути перелік «Географія Роду»"
              className={`hidden md:flex flex-col items-center py-4 px-1.5 w-12 shrink-0 rounded-2xl border ${theme.cardBorder} ${theme.cardBg} cursor-pointer hover:border-amber-500/50 hover:bg-amber-500/5 transition-all select-none justify-between shadow-xs`}
            >
              <div className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSidebarCollapsed(false);
                  }}
                  title="Розгорнути перелік «Географія Роду»"
                  className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 border border-amber-500/30 transition-colors cursor-pointer"
                >
                  <PanelLeftOpen className="w-4 h-4" />
                </button>
                <Compass className="w-4 h-4 text-amber-500 opacity-80" />
              </div>

              <div className="flex flex-col items-center gap-2 [writing-mode:vertical-lr] rotate-180 text-xs font-bold tracking-wider uppercase text-neutral-400 hover:text-amber-500 transition-colors">
                <span>Географія Роду</span>
              </div>

              <div className="flex flex-col items-center">
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                    isDark ? 'bg-neutral-800 text-amber-400 border border-neutral-700' : 'bg-amber-100 text-amber-800 border border-amber-300'
                  } font-bold`}
                  title={`${filtered.length} знайдено`}
                >
                  {filtered.length}
                </span>
              </div>
            </div>

            {/* Mobile Collapsed Strip */}
            <div className={`md:hidden flex items-center justify-between p-3 rounded-xl border ${theme.cardBorder} ${theme.cardBg}`}>
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(false)}
                className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400 cursor-pointer"
              >
                <PanelLeftOpen className="w-4 h-4" />
                <span>Показати перелік «Географія Роду» ({filtered.length} локацій)</span>
              </button>
            </div>
          </>
        ) : (
          <div
            className={`w-full md:w-80 lg:w-96 shrink-0 rounded-2xl border ${theme.cardBorder} ${theme.cardBg} flex flex-col p-4 shadow-sm space-y-3 transition-all`}
          >
            {/* Sidebar Header */}
            <div className="flex items-center justify-between gap-2 border-b pb-3 border-neutral-200 dark:border-neutral-800/80">
              <div className="flex items-center gap-2 text-amber-500 min-w-0">
                <Compass className="w-5 h-5 shrink-0 text-amber-500" />
                <h2 className={`font-bold text-xs tracking-wide uppercase truncate ${theme.textPrimary}`}>
                  Географія Роду
                </h2>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                    isDark ? 'bg-neutral-800 text-amber-400 border border-neutral-700' : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                >
                  {filtered.length}
                </span>
                <button
                  type="button"
                  onClick={() => setIsSidebarCollapsed(true)}
                  title="Згорнути панель «Географія Роду» (звільнити місце для деталей)"
                  aria-label="Згорнути перелік"
                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${theme.surfaceBg} ${theme.borderSubtle} hover:border-amber-500 text-neutral-500 hover:text-amber-600 dark:hover:text-amber-400`}
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Search within Geography */}
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Пошук села, повіту, парафії..."
                className={`w-full pl-9 pr-7 py-1.5 text-xs rounded-xl ${theme.inputBg} border ${theme.inputBorder} ${theme.inputText} placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-amber-500`}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200 text-xs cursor-pointer"
                >
                  ×
                </button>
              )}
            </div>

            {/* District Quick Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] no-scrollbar">
              {districts.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDistrictFilter(d)}
                  className={`px-2 py-0.5 rounded-md whitespace-nowrap text-[10px] font-medium transition-colors cursor-pointer ${
                    districtFilter === d
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  {d === 'ALL' ? 'Всі' : d.replace(' повіт', '')}
                </button>
              ))}
            </div>

            {/* Settlements List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[520px]">
              {filtered.length === 0 ? (
                <div className="p-6 text-center text-xs text-neutral-400 space-y-2">
                  <MapPin className="w-8 h-8 mx-auto text-neutral-500 opacity-40" />
                  <p>За цим запитом нічого не знайдено</p>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      setDistrictFilter('ALL');
                    }}
                    className="text-amber-500 hover:underline inline-flex items-center gap-1 cursor-pointer font-medium text-[11px]"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Скинути фільтри</span>
                  </button>
                </div>
              ) : (
                filtered.map((item) => {
                  const isSelected = selectedSettlement?.id === item.id;
                  const personsForPlace = settlementPersonsMap[item.id] || [];

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedSettlementId(item.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer text-left ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500/10 shadow-sm ring-1 ring-amber-500/20'
                          : `${theme.cardBorder} hover:border-amber-500/40 hover:bg-neutral-50 dark:hover:bg-neutral-800/40`
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5 mb-1">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-neutral-900 dark:text-neutral-100 truncate">
                              {item.name}
                            </span>
                            <span className="text-[9px] uppercase px-1.5 py-0.2 rounded font-semibold bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                              {item.type}
                            </span>
                          </div>
                          {item.historicalName && (
                            <span className="text-[10px] italic text-neutral-400 block truncate">
                              іст. {item.historicalName}
                            </span>
                          )}
                        </div>

                        {isSelected && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 shrink-0">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                            <span>Обрано</span>
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400 space-y-0.5">
                        <p className="truncate">
                          {item.district} · {item.gubernia.replace(' губернія', ' губ.')}
                        </p>
                        <p className="truncate text-[10px] text-neutral-400">
                          {item.churchName}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-neutral-200/60 dark:border-neutral-800/60 text-[10px]">
                        <span className="font-mono text-neutral-400 font-medium">
                          {item.yearsRange}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {personsForPlace.length > 0 && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold">
                              <Users className="w-3 h-3" />
                              <span>{personsForPlace.length}</span>
                            </span>
                          )}

                          {item.hasDigitalScans && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Скани</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ================= RIGHT PANEL: ДЕТАЛІ ОБРАНОГО НАСЕЛЕНОГО ПУНКТУ ================= */}
        <div
          className={`flex-1 min-w-0 rounded-2xl border ${theme.cardBorder} ${theme.cardBg} p-5 md:p-6 flex flex-col justify-between shadow-sm overflow-hidden`}
        >
          {selectedSettlement ? (
            <div className="space-y-5">
              {/* Detail Header & Action Strip */}
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-neutral-200 dark:border-neutral-800/80">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-xl md:text-2xl font-black text-neutral-900 dark:text-neutral-100">
                      {selectedSettlement.name}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] uppercase font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      {selectedSettlement.type}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      {selectedSettlement.yearsRange}
                    </span>
                  </div>

                  {selectedSettlement.historicalName && (
                    <p className="text-xs font-serif italic text-neutral-500 dark:text-neutral-400">
                      Історичне написання в документах: <strong>{selectedSettlement.historicalName}</strong>
                    </p>
                  )}
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Sidebar Toggle Button directly in the Detail Header */}
                  {isSidebarCollapsed ? (
                    <button
                      type="button"
                      onClick={() => setIsSidebarCollapsed(false)}
                      title="Розгорнути перелік «Географія Роду»"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-all cursor-pointer shadow-xs"
                    >
                      <PanelLeftOpen className="w-4 h-4" />
                      <span>Показати «Географія Роду» ({filtered.length})</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsSidebarCollapsed(true)}
                      title="Згорнути «Географія Роду» (більше простору для перегляду деталей)"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-neutral-500 hover:text-amber-600 dark:hover:text-amber-400 border border-neutral-200 dark:border-neutral-800 hover:border-amber-500/40 transition-colors cursor-pointer"
                    >
                      <PanelLeftClose className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Згорнути «Географія Роду»</span>
                    </button>
                  )}

                  {/* External Google Maps Button */}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${selectedSettlement.name}, ${selectedSettlement.district}, Ukraine`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Мапа</span>
                  </a>

                  {/* Reader Button if Lipovenke or scans */}
                  {selectedSettlement.name === 'Липовеньке' && onOpenViewer && (
                    <button
                      type="button"
                      onClick={onOpenViewer}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all shadow-sm cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Читати справу села</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Information Bento Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 1. Administrative Hierarchy */}
                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                    <Compass className="w-4 h-4 shrink-0" />
                    <span>Адміністративно-територіальний поділ</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div>
                      <span className="text-[10px] text-neutral-400 block font-medium">Губернія:</span>
                      <strong className="text-neutral-800 dark:text-neutral-200">{selectedSettlement.gubernia}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 block font-medium">Повіт:</span>
                      <strong className="text-neutral-800 dark:text-neutral-200">{selectedSettlement.district}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 block font-medium">Волость:</span>
                      <span className="text-neutral-800 dark:text-neutral-200">{selectedSettlement.volost}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 block font-medium">Статус поселення:</span>
                      <span className="text-neutral-800 dark:text-neutral-200 capitalize">{selectedSettlement.type}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Church & Parish */}
                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wide">
                    <Church className="w-4 h-4 shrink-0" />
                    <span>Парафія та церковні книги</span>
                  </div>
                  <div className="text-xs space-y-1.5">
                    <div>
                      <span className="text-[10px] text-neutral-400 block font-medium">Храм / Церква:</span>
                      <strong className="text-neutral-800 dark:text-neutral-200">{selectedSettlement.churchName}</strong>
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 pt-0.5">
                      Містить метричні книги (народження, шлюб, смерть), сповідні розписи парафіян та клірові відомості.
                    </div>
                  </div>
                </div>

                {/* 3. Archival Funds & References */}
                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                      <Building2 className="w-4 h-4 shrink-0" />
                      <span>Архівне зберігання та шифри</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(`${selectedSettlement.archiveCode}: ${selectedSettlement.fondCode}`)}
                      className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                      title="Скопіювати шифр фонду"
                    >
                      {copiedFondCode ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Скопійовано</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-neutral-400" />
                          <span>Копіювати шифр</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="text-xs space-y-1.5">
                    <div>
                      <span className="text-[10px] text-neutral-400 block font-medium">Архівна установа:</span>
                      <strong className="text-neutral-800 dark:text-neutral-200">
                        {selectedSettlement.archiveCode} — {selectedSettlement.archiveName}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 block font-medium">Фонд та опис:</span>
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                        {selectedSettlement.fondCode}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. Family Connections («Географія Роду») */}
                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                    <Users className="w-4 h-4 shrink-0" />
                    <span>Зв&apos;язок з Родоводом ({relatedPersons.length})</span>
                  </div>

                  {relatedPersons.length > 0 ? (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
                        У вашому дереві зафіксовано осіб із цією локацією:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {relatedPersons.map((p, pIdx) => {
                          const pName = `${p.name?.surname || p.lastName || ''} ${p.name?.given || p.firstName || ''}`.trim();
                          return (
                            <span
                              key={`rel_p_${p.id}_${pIdx}`}
                              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                            >
                              <strong>{pName}</strong>
                              {p.birthYear && <span className="text-[10px] opacity-75">({p.birthYear} р.)</span>}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 space-y-1">
                      <p>Прямих збігів за місцем народження наразі не знайдено.</p>
                      <p className="text-[11px] text-neutral-400 italic">
                        Перевірте, чи не належали сусідні хутори до парафії цієї церкви ({selectedSettlement.churchName}).
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Historical Notes Box */}
              {selectedSettlement.notes && (
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 font-bold text-amber-600 dark:text-amber-400">
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <span>Історико-генеалогічна довідка та особливості фонду</span>
                  </div>
                  <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed pl-6">
                    {selectedSettlement.notes}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-neutral-400 text-center space-y-3">
              <MapPin className="w-12 h-12 text-neutral-500 opacity-40" />
              <div className="space-y-1">
                <p className="font-bold text-base text-neutral-300">Населений пункт не обрано</p>
                <p className="text-xs text-neutral-500 max-w-sm">
                  Оберіть село чи містечко з переліку «Географія Роду» ліворуч, щоб переглянути детальні архівні фонди та парафії.
                </p>
              </div>
              {isSidebarCollapsed && (
                <button
                  type="button"
                  onClick={() => setIsSidebarCollapsed(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer shadow-sm transition-all inline-flex items-center gap-1.5"
                >
                  <PanelLeftOpen className="w-4 h-4" />
                  <span>Розгорнути перелік «Географія Роду»</span>
                </button>
              )}
            </div>
          )}

          {/* Detail Panel Bottom Strip */}
          {selectedSettlement && (
            <div className="pt-4 mt-4 border-t border-neutral-200 dark:border-neutral-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                <span className="font-medium">
                  {selectedSettlement.hasDigitalScans ? (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      Оцифровані скани метричних книг доступні онлайн
                    </span>
                  ) : (
                    <span>Зберігається в оригіналі у читальній залі архіву</span>
                  )}
                </span>
              </div>

              {selectedSettlement.name === 'Липовеньке' && onOpenViewer && (
                <button
                  type="button"
                  onClick={onOpenViewer}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all shadow-sm cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Відкрити у гортачі Нишпорки</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
