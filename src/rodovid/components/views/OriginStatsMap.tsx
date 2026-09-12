/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  MapPin,
  Compass,
  Building,
  Calendar,
  ExternalLink,
  Users,
  Search,
  Layers,
  ArrowUpDown,
  FileText,
  PieChart as PieChartIcon,
  BarChart3,
  Map as MapIcon,
  Baby,
  HeartHandshake,
  Cross,
  Sparkles,
  ChevronRight,
  Filter,
  Download,
  Info
} from 'lucide-react';
import { GenealogyDatabase, Person, MetricRecord } from '../../types/genealogy';
import { useUIStore } from '../../../stores/useUIStore';
import { getThemeConfig } from '../../../utils/theme';
import { DoveIcon } from '../../../components/common/GenealogyIcons';
import {
  computeOriginStats,
  UKRAINE_REGIONS,
  OriginPlaceItem,
  OriginStatsSummary
} from '../../utils/originStats';
import { getFullName } from '../../utils/relationship';
import { isPersonMale, isPersonFemale } from '../../utils/genderUtils';

interface OriginStatsMapProps {
  database: GenealogyDatabase;
  metricRecordsList?: MetricRecord[];
  onSelectPerson: (id: string) => void;
  className?: string;
}

type ViewDisplayMode = 'map' | 'bars' | 'donut' | 'metrics';
type MetricFilterType = 'all' | 'birth' | 'marriage' | 'death';
type ScopeType = 'regions' | 'settlements';

export const OriginStatsMap: React.FC<OriginStatsMapProps> = ({
  database,
  metricRecordsList,
  onSelectPerson,
  className = ''
}) => {
  const themePalette = useUIStore((s) => s.themePalette);
  const theme = getThemeConfig(themePalette);
  const isDark = theme.category === 'dark';

  const [displayMode, setDisplayMode] = useState<ViewDisplayMode>('map');
  const [scope, setScope] = useState<ScopeType>('regions');
  const [metricFilter, setMetricFilter] = useState<MetricFilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [hoveredPlaceId, setHoveredPlaceId] = useState<string | null>(null);
  const [personSearchQuery, setPersonSearchQuery] = useState('');

  // 1. Calculate Origin Data
  const stats: OriginStatsSummary = useMemo(() => {
    return computeOriginStats(database, metricRecordsList);
  }, [database, metricRecordsList]);

  // 2. Active List based on Scope (Regions vs Settlements) and Metric Filter
  const activeList = useMemo<OriginPlaceItem[]>(() => {
    const rawList = scope === 'regions' ? stats.regions : stats.settlements;
    return rawList
      .filter((item) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesName = item.name.toLowerCase().includes(q) || item.regionName.toLowerCase().includes(q);
          const matchesClan = item.clans.some((c) => c.surname.toLowerCase().includes(q));
          if (!matchesName && !matchesClan) return false;
        }

        if (metricFilter === 'birth') return item.birthCount > 0;
        if (metricFilter === 'marriage') return item.marriageCount > 0;
        if (metricFilter === 'death') return item.deathCount > 0;
        return true;
      })
      .sort((a, b) => {
        if (metricFilter === 'birth') return b.birthCount - a.birthCount;
        if (metricFilter === 'marriage') return b.marriageCount - a.marriageCount;
        if (metricFilter === 'death') return b.deathCount - a.deathCount;
        return b.personCount - a.personCount || b.totalRecords - a.totalRecords;
      });
  }, [stats, scope, metricFilter, searchQuery]);

  // 3. Selected Place Object
  const selectedPlace = useMemo(() => {
    if (!selectedPlaceId) {
      return activeList[0] || stats.primaryCradle || null;
    }
    const fromActive = activeList.find((p) => p && p.id === selectedPlaceId);
    if (fromActive) return fromActive;
    return (
      stats.regions.find((r) => r && r.id === selectedPlaceId) ||
      stats.settlements.find((s) => s && s.id === selectedPlaceId) ||
      activeList[0] ||
      null
    );
  }, [selectedPlaceId, activeList, stats]);

  // 4. Persons of selected place filtered by search
  const selectedPersons = useMemo(() => {
    if (!selectedPlace) return [];
    if (!personSearchQuery.trim()) return selectedPlace.persons;
    const q = personSearchQuery.toLowerCase();
    return selectedPlace.persons.filter((p) => {
      const name = getFullName(p).toLowerCase();
      return name.includes(q);
    });
  }, [selectedPlace, personSearchQuery]);

  // Maximum value for bar scaling
  const maxCount = useMemo(() => {
    if (activeList.length === 0) return 1;
    if (metricFilter === 'birth') return Math.max(...activeList.map((x) => x.birthCount), 1);
    if (metricFilter === 'marriage') return Math.max(...activeList.map((x) => x.marriageCount), 1);
    if (metricFilter === 'death') return Math.max(...activeList.map((x) => x.deathCount), 1);
    return Math.max(...activeList.map((x) => x.personCount), 1);
  }, [activeList, metricFilter]);

  // Export Origin Stats as CSV / Text
  const handleExportCSV = () => {
    const headers = ['Назва', 'Тип', 'Регіон', 'Кількість осіб', 'Частка у роді (%)', 'Народжень', 'Шлюбів', 'Упокоєнь', 'Всього метрик', 'Роди'];
    const rows = (scope === 'regions' ? stats.regions : stats.settlements).map((p) => [
      `"${p.name}"`,
      p.type === 'region' ? 'Регіон' : 'Населений пункт',
      `"${p.regionName}"`,
      p.personCount,
      `${p.percentage}%`,
      p.birthCount,
      p.marriageCount,
      p.deathCount,
      p.totalRecords,
      `"${p.clans.map((c) => c.surname).join(', ')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `rodovid_origin_stats_${scope}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Color palette for Donut Chart
  const DONUT_COLORS = [
    '#f59e0b', '#3b82f6', '#10b981', '#ec4899', '#8b5cf6',
    '#06b6d4', '#eab308', '#f97316', '#14b8a6', '#0284c7'
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 1. TOP STATS BANNER */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Unique Regions */}
        <div className={`p-4.5 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} space-y-1.5 shadow-xs`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs ${theme.textMuted} flex items-center gap-1.5 font-medium`}>
              <Compass className="w-4 h-4 text-amber-500" />
              Охоплено регіонів
            </span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${isDark ? 'bg-amber-950/60 text-amber-400' : 'bg-amber-100 text-amber-900'}`}>
              Україна
            </span>
          </div>
          <div className="text-3xl font-extrabold font-mono text-amber-500">
            {stats.totalRegionsCount}
          </div>
          <div className={`text-xs ${theme.textMuted} truncate`}>
            Історичних та сучасних земель
          </div>
        </div>

        {/* Card 2: Settlements */}
        <div className={`p-4.5 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} space-y-1.5 shadow-xs`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs ${theme.textMuted} flex items-center gap-1.5 font-medium`}>
              <Building className="w-4 h-4 text-sky-500" />
              Населених пунктів
            </span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${isDark ? 'bg-sky-950/60 text-sky-400' : 'bg-sky-100 text-sky-900'}`}>
              Локації
            </span>
          </div>
          <div className="text-3xl font-extrabold font-mono text-sky-500">
            {stats.totalSettlementsCount}
          </div>
          <div className={`text-xs ${theme.textMuted} truncate`}>
            Сіл, містечок, хуторів та парафій
          </div>
        </div>

        {/* Card 3: Persons in Metric Records */}
        <div className={`p-4.5 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} space-y-1.5 shadow-xs`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs ${theme.textMuted} flex items-center gap-1.5 font-medium`}>
              <Users className="w-4 h-4 text-emerald-500" />
              Осіб із географією
            </span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${isDark ? 'bg-emerald-950/60 text-emerald-400' : 'bg-emerald-100 text-emerald-900'}`}>
              {stats.totalPersonsWithMetricPlaces > 0 && Object.keys(database.persons || {}).length > 0
                ? `${Math.round((stats.totalPersonsWithMetricPlaces / Object.keys(database.persons).length) * 100)}%`
                : '0%'}
            </span>
          </div>
          <div className="text-3xl font-extrabold font-mono text-emerald-500">
            {stats.totalPersonsWithMetricPlaces}
          </div>
          <div className={`text-xs ${theme.textMuted} truncate`}>
            Зафіксовано у метричних записах
          </div>
        </div>

        {/* Card 4: Primary Cradle */}
        <div className={`p-4.5 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} space-y-1.5 shadow-xs relative overflow-hidden`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs ${theme.textMuted} flex items-center gap-1.5 font-medium`}>
              <Sparkles className="w-4 h-4 text-amber-500" />
              Головне родове гніздо
            </span>
            {stats.primaryCradle && (
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-800'}`}>
                {stats.primaryCradle.percentage}% роду
              </span>
            )}
          </div>
          <div className="text-xl font-bold truncate text-amber-600 dark:text-amber-400">
            {stats.primaryCradle?.name || 'Невизначено'}
          </div>
          <div className={`text-xs ${theme.textMuted} truncate`}>
            {stats.primaryCradle ? `${stats.primaryCradle.personCount} осіб • ${stats.primaryCradle.regionName}` : 'Додайте географічні дані'}
          </div>
        </div>
      </div>

      {/* 2. CONTROLS TOOLBAR & VIEW MODES */}
      <div className={`p-4 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs`}>
        {/* Left: View Mode Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 w-full md:w-auto">
          <button
            type="button"
            onClick={() => setDisplayMode('map')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              displayMode === 'map'
                ? isDark
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                  : 'bg-amber-100 text-amber-900 border border-amber-300 shadow-xs'
                : `${theme.surfaceBg} ${theme.textMuted} border ${theme.borderSubtle} hover:${theme.textPrimary}`
            }`}
          >
            <MapIcon className="w-4 h-4 text-amber-500" />
            <span>Статистична карта</span>
          </button>

          <button
            type="button"
            onClick={() => setDisplayMode('bars')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              displayMode === 'bars'
                ? isDark
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-xs'
                  : 'bg-sky-100 text-sky-900 border border-sky-300 shadow-xs'
                : `${theme.surfaceBg} ${theme.textMuted} border ${theme.borderSubtle} hover:${theme.textPrimary}`
            }`}
          >
            <BarChart3 className="w-4 h-4 text-sky-500" />
            <span>Стовпчикова діаграма</span>
          </button>

          <button
            type="button"
            onClick={() => setDisplayMode('donut')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              displayMode === 'donut'
                ? isDark
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                  : 'bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-xs'
                : `${theme.surfaceBg} ${theme.textMuted} border ${theme.borderSubtle} hover:${theme.textPrimary}`
            }`}
          >
            <PieChartIcon className="w-4 h-4 text-emerald-500" />
            <span>Частки походження</span>
          </button>

          <button
            type="button"
            onClick={() => setDisplayMode('metrics')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              displayMode === 'metrics'
                ? isDark
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-xs'
                  : 'bg-purple-100 text-purple-900 border border-purple-300 shadow-xs'
                : `${theme.surfaceBg} ${theme.textMuted} border ${theme.borderSubtle} hover:${theme.textPrimary}`
            }`}
          >
            <FileText className="w-4 h-4 text-purple-500" />
            <span>Структура метрик</span>
          </button>
        </div>

        {/* Right: Scope toggle & Export */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          {/* Scope (Regions vs Settlements) */}
          <div className={`inline-flex p-1 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle}`}>
            <button
              type="button"
              onClick={() => setScope('regions')}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                scope === 'regions'
                  ? 'bg-amber-600 text-white shadow-xs font-bold'
                  : `${theme.textMuted} hover:${theme.textPrimary}`
              }`}
            >
              Регіони ({stats.regions.length})
            </button>
            <button
              type="button"
              onClick={() => setScope('settlements')}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                scope === 'settlements'
                  ? 'bg-amber-600 text-white shadow-xs font-bold'
                  : `${theme.textMuted} hover:${theme.textPrimary}`
              }`}
            >
              Населені пункти ({stats.settlements.length})
            </button>
          </div>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            title="Завантажити звіт у CSV"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium ${theme.surfaceBg} border ${theme.borderSubtle} hover:border-amber-500 transition-colors cursor-pointer`}
          >
            <Download className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Експорт</span>
          </button>
        </div>
      </div>

      {/* 3. FILTERS BAR (Metric Type & Search) */}
      <div className={`p-3.5 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} flex flex-col sm:flex-row items-center justify-between gap-3 text-xs`}>
        {/* Metric Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <span className={`text-[11px] font-semibold ${theme.textMuted} mr-1 shrink-0`}>Метричні записи:</span>
          <button
            type="button"
            onClick={() => setMetricFilter('all')}
            className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              metricFilter === 'all'
                ? 'bg-amber-600 text-white font-bold shadow-xs'
                : `${theme.cardBg} ${theme.textSecondary} border ${theme.cardBorder} hover:border-amber-500`
            }`}
          >
            Всі записи ({stats.totalMetricRecordsCount})
          </button>
          <button
            type="button"
            onClick={() => setMetricFilter('birth')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              metricFilter === 'birth'
                ? 'bg-emerald-600 text-white font-bold shadow-xs'
                : `${theme.cardBg} ${theme.textSecondary} border ${theme.cardBorder} hover:border-emerald-500`
            }`}
          >
            <Baby className="w-3 h-3" />
            <span>Народження ({stats.recordsByType.births})</span>
          </button>
          <button
            type="button"
            onClick={() => setMetricFilter('marriage')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              metricFilter === 'marriage'
                ? 'bg-rose-600 text-white font-bold shadow-xs'
                : `${theme.cardBg} ${theme.textSecondary} border ${theme.cardBorder} hover:border-rose-500`
            }`}
          >
            <HeartHandshake className="w-3 h-3" />
            <span>Шлюби ({stats.recordsByType.marriages})</span>
          </button>
          <button
            type="button"
            onClick={() => setMetricFilter('death')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              metricFilter === 'death'
                ? 'bg-purple-600 text-white font-bold shadow-xs'
                : `${theme.cardBg} ${theme.textSecondary} border ${theme.cardBorder} hover:border-purple-500`
            }`}
          >
            <DoveIcon className="w-3 h-3 text-purple-300" />
            <span>Упокоєння ({stats.recordsByType.deaths})</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className={`w-3.5 h-3.5 absolute left-3 top-2.5 ${theme.textMuted}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Фільтр локації чи роду..."
            className={`w-full pl-8 pr-3 py-1.5 text-xs ${theme.inputBg} border ${theme.inputBorder} rounded-lg ${theme.textPrimary} placeholder:text-neutral-400 focus:outline-none focus:border-amber-500`}
          />
        </div>
      </div>

      {/* 4. MAIN VISUALIZATION AREA */}
      {/* MODE 1: STATISTICAL GEOGRAPHIC MAP */}
      {displayMode === 'map' && (
        <div className={`p-6 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-xs space-y-4`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200/40 dark:border-neutral-800/60 pb-3">
            <div>
              <h3 className={`font-bold text-sm ${theme.textPrimary} flex items-center gap-2`}>
                <Compass className="w-4 h-4 text-amber-500" />
                <span>Карта розселення та метричних осередків роду</span>
              </h3>
              <p className={`text-xs ${theme.textMuted}`}>
                Кольорова насиченість відображає концентрацію предків за регіонами та населеними пунктами України
              </p>
            </div>

            {/* Map Legend */}
            <div className="flex items-center gap-3 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse"></span>
                <span className={theme.textMuted}>Головне гніздо</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-emerald-500/80"></span>
                <span className={theme.textMuted}>Осередки роду</span>
              </div>
            </div>
          </div>

          {/* Interactive SVG Ukraine Map Container */}
          <div className="relative w-full aspect-[16/10] max-h-[540px] bg-slate-900/10 dark:bg-slate-950/40 rounded-2xl border border-neutral-200/50 dark:border-neutral-800/80 overflow-hidden flex items-center justify-center p-2 sm:p-4">
            <svg
              viewBox="0 0 1000 620"
              className="w-full h-full select-none"
              style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))' }}
            >
              {/* Background Map Contours & Grid Lines */}
              <g opacity="0.15" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 8">
                <line x1="0" y1="200" x2="1000" y2="200" />
                <line x1="0" y1="400" x2="1000" y2="400" />
                <line x1="300" y1="0" x2="300" y2="620" />
                <line x1="600" y1="0" x2="600" y2="620" />
              </g>

              {/* Dnieper River stylized representation */}
              <path
                d="M 490 80 Q 480 160 520 230 T 570 340 T 630 420 T 530 480"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="4"
                strokeLinecap="round"
                opacity="0.35"
              />

              {/* Regions Polygons (Choropleth fill based on persons density) */}
              {UKRAINE_REGIONS.filter((r) => Boolean(r && r.svgPath && r.id)).map((reg) => {
                const regData = stats?.regions?.find((r) => r && r.id === reg.id);
                const count = regData?.personCount || 0;
                const isSelected = Boolean(selectedPlace && (selectedPlace.regionId === reg.id || selectedPlace.id === reg.id));
                const isHovered = hoveredPlaceId === reg.id;

                // Dynamic opacity / saturation based on count
                const fillOpacity = count > 0 ? Math.min(0.2 + (count / (maxCount || 1)) * 0.65, 0.85) : 0.08;

                return (
                  <g
                    key={reg.id}
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedPlaceId(reg.id)}
                    onMouseEnter={() => setHoveredPlaceId(reg.id)}
                    onMouseLeave={() => setHoveredPlaceId(null)}
                  >
                    <path
                      d={reg.svgPath}
                      fill={reg.color}
                      fillOpacity={isSelected ? 0.75 : isHovered ? 0.55 : fillOpacity}
                      stroke={isSelected ? '#fbbf24' : isHovered ? '#ffffff' : reg.color}
                      strokeWidth={isSelected ? 3.5 : isHovered ? 2.5 : 1.2}
                      strokeLinejoin="round"
                      className="transition-all duration-200"
                    />

                    {/* Region Label */}
                    <text
                      x={reg.coords.x}
                      y={reg.coords.y - 12}
                      textAnchor="middle"
                      className={`text-[12px] font-bold pointer-events-none fill-neutral-800 dark:fill-neutral-200 transition-opacity ${
                        isSelected || isHovered || count > 0 ? 'opacity-100' : 'opacity-40'
                      }`}
                      style={{ textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}
                    >
                      {reg.name}
                    </text>

                    {/* Region Person Count Badge */}
                    {count > 0 && (
                      <g transform={`translate(${reg.coords.x}, ${reg.coords.y + 4})`}>
                        <rect
                          x="-20"
                          y="-10"
                          width="40"
                          height="20"
                          rx="10"
                          fill={isSelected ? '#f59e0b' : '#1e293b'}
                          stroke={isSelected ? '#ffffff' : '#64748b'}
                          strokeWidth="1"
                        />
                        <text
                          x="0"
                          y="4"
                          textAnchor="middle"
                          className="text-[10px] font-mono font-bold fill-white"
                        >
                          {count}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Settlement Hotspots & Pins (when settlements have locations) */}
              {scope === 'settlements' &&
                activeList.filter((item): item is OriginPlaceItem => Boolean(item && item.id)).map((item) => {
                  const isCradle = Boolean(stats.primaryCradle?.id && stats.primaryCradle.id === item.id);
                  const isSelected = Boolean(selectedPlace?.id && selectedPlace.id === item.id);
                  const radius = Math.min(8 + (item.personCount / (maxCount || 1)) * 14, 22);

                  return (
                    <g
                      key={item.id}
                      transform={`translate(${item.coordinates.x}, ${item.coordinates.y})`}
                      className="cursor-pointer transition-transform duration-200 hover:scale-125"
                      onClick={() => setSelectedPlaceId(item.id)}
                      onMouseEnter={() => setHoveredPlaceId(item.id)}
                      onMouseLeave={() => setHoveredPlaceId(null)}
                    >
                      {/* Pulsing ring for cradle */}
                      {isCradle && (
                        <circle
                          r={radius + 8}
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth="2"
                          opacity="0.6"
                          className="animate-ping"
                        />
                      )}

                      {/* Hotspot Circle */}
                      <circle
                        r={radius}
                        fill={isSelected ? '#f59e0b' : isCradle ? '#ea580c' : '#10b981'}
                        stroke="#ffffff"
                        strokeWidth="2"
                        opacity={isSelected ? 1 : 0.85}
                        className="shadow-md"
                      />

                      {/* Count inside pin */}
                      <text
                        x="0"
                        y="3.5"
                        textAnchor="middle"
                        className="text-[9px] font-mono font-extrabold fill-white pointer-events-none"
                      >
                        {item.personCount}
                      </text>

                      {/* Settlement Name tooltip when selected or hovered */}
                      {(isSelected || hoveredPlaceId === item.id) && (
                        <g transform={`translate(0, ${-radius - 8})`}>
                          <rect
                            x="-45"
                            y="-16"
                            width="90"
                            height="18"
                            rx="5"
                            fill="#0f172a"
                            stroke="#f59e0b"
                            strokeWidth="1"
                          />
                          <text
                            x="0"
                            y="-4"
                            textAnchor="middle"
                            className="text-[9px] font-semibold fill-amber-300 pointer-events-none truncate"
                          >
                            {item.name.slice(0, 14)}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
            </svg>
          </div>
        </div>
      )}

      {/* MODE 2: RANKED BAR CHART (Стовпчикова діаграма) */}
      {displayMode === 'bars' && (
        <div className={`p-6 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-xs space-y-4`}>
          <div className="flex items-center justify-between border-b border-neutral-200/40 dark:border-neutral-800/60 pb-3">
            <div>
              <h3 className={`font-bold text-sm ${theme.textPrimary} flex items-center gap-2`}>
                <BarChart3 className="w-4 h-4 text-sky-500" />
                <span>Рейтинг походження родоводу ({scope === 'regions' ? 'Регіони' : 'Населені пункти'})</span>
              </h3>
              <p className={`text-xs ${theme.textMuted}`}>
                Розподіл за кількістю осіб та відсотком від загального масиву родоводу
              </p>
            </div>
            <span className={`text-xs font-mono font-semibold px-2.5 py-1 rounded-lg ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-neutral-100 text-neutral-800'}`}>
              Всього позицій: {activeList.length}
            </span>
          </div>

          <div className="space-y-3 pt-2">
            {activeList.filter((item): item is OriginPlaceItem => Boolean(item && item.id)).map((item, idx) => {
              const isSelected = Boolean(selectedPlace?.id && selectedPlace.id === item.id);
              const countVal =
                metricFilter === 'birth'
                  ? item.birthCount
                  : metricFilter === 'marriage'
                  ? item.marriageCount
                  : metricFilter === 'death'
                  ? item.deathCount
                  : item.personCount;

              const barWidth = Math.max(Math.round((countVal / (maxCount || 1)) * 100), 4);

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedPlaceId(item.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? isDark
                        ? 'bg-amber-950/40 border-amber-500 shadow-xs'
                        : 'bg-amber-50 border-amber-500 shadow-xs'
                      : `${theme.surfaceBg} ${theme.borderSubtle} hover:border-neutral-400`
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 text-xs mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-neutral-200 text-neutral-700'}`}>
                        #{idx + 1}
                      </span>
                      <span className={`font-bold truncate ${isSelected ? 'text-amber-500' : theme.textPrimary}`}>
                        {item.name}
                      </span>
                      {scope === 'settlements' && (
                        <span className={`text-[11px] ${theme.textMuted} truncate hidden sm:inline`}>
                          ({item.regionName})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Metric event mini badges */}
                      <div className="hidden md:flex items-center gap-2 text-[11px] text-neutral-400">
                        {item.birthCount > 0 && <span>👶 {item.birthCount}</span>}
                        {item.marriageCount > 0 && <span>💍 {item.marriageCount}</span>}
                        {item.deathCount > 0 && <span>🕊️ {item.deathCount}</span>}
                      </div>

                      <span className="font-bold text-xs font-mono">
                        {countVal} {countVal === 1 ? 'особа' : countVal < 5 ? 'особи' : 'осіб'}
                      </span>
                      <span className={`font-mono text-[11px] px-2 py-0.5 rounded-full font-semibold ${isDark ? 'bg-amber-950/60 text-amber-400' : 'bg-amber-100 text-amber-800'}`}>
                        {item.percentage}%
                      </span>
                    </div>
                  </div>

                  {/* Visual Bar */}
                  <div className="w-full bg-neutral-200 dark:bg-neutral-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isSelected
                          ? 'bg-amber-500'
                          : metricFilter === 'birth'
                          ? 'bg-emerald-500'
                          : metricFilter === 'marriage'
                          ? 'bg-rose-500'
                          : metricFilter === 'death'
                          ? 'bg-purple-500'
                          : 'bg-sky-500'
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>

                  {/* Clannish surnames preview */}
                  {item.clans.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[11px] text-neutral-400">
                      <span className="opacity-70">Роди:</span>
                      {item.clans.slice(0, 4).map((c) => (
                        <span
                          key={c.surname}
                          className={`px-1.5 py-0.5 rounded border text-[10px] ${isDark ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-neutral-200 text-neutral-700'}`}
                        >
                          {c.surname} ({c.count})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {activeList.length === 0 && (
              <div className="py-12 text-center text-xs text-neutral-400 italic">
                Не знайдено локацій за обраними фільтрами
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODE 3: DONUT CHART (Частки походження) */}
      {displayMode === 'donut' && (
        <div className={`p-6 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-xs space-y-6`}>
          <div className="border-b border-neutral-200/40 dark:border-neutral-800/60 pb-3">
            <h3 className={`font-bold text-sm ${theme.textPrimary} flex items-center gap-2`}>
              <PieChartIcon className="w-4 h-4 text-emerald-500" />
              <span>Географічні частки родоводу ({scope === 'regions' ? 'Регіони' : 'Населені пункти'})</span>
            </h3>
            <p className={`text-xs ${theme.textMuted}`}>
              Співвідношення предків за місцем походження у метричних документах
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* SVG Donut */}
            <div className="relative flex items-center justify-center p-4">
              <svg viewBox="0 0 300 300" className="w-64 h-64 select-none">
                {(() => {
                  const total = activeList.reduce((sum, item) => sum + item.personCount, 0) || 1;
                  let accumulatedAngle = 0;

                  return activeList.slice(0, 10).map((item, idx) => {
                    const sliceAngle = (item.personCount / total) * 360;
                    const startAngle = accumulatedAngle;
                    const endAngle = accumulatedAngle + sliceAngle;
                    accumulatedAngle += sliceAngle;

                    // Convert polar to cartesian
                    const r = 100;
                    const rInner = 60;
                    const startRad = ((startAngle - 90) * Math.PI) / 180;
                    const endRad = ((endAngle - 90) * Math.PI) / 180;

                    const x1 = 150 + r * Math.cos(startRad);
                    const y1 = 150 + r * Math.sin(startRad);
                    const x2 = 150 + r * Math.cos(endRad);
                    const y2 = 150 + r * Math.sin(endRad);

                    const x3 = 150 + rInner * Math.cos(endRad);
                    const y3 = 150 + rInner * Math.sin(endRad);
                    const x4 = 150 + rInner * Math.cos(startRad);
                    const y4 = 150 + rInner * Math.sin(startRad);

                    const largeArcFlag = sliceAngle > 180 ? 1 : 0;
                    const pathData = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${largeArcFlag} 0 ${x4} ${y4} Z`;
                    const color = DONUT_COLORS[idx % DONUT_COLORS.length];
                    const isSelected = Boolean(selectedPlace?.id && selectedPlace.id === item.id);

                    return (
                      <path
                        key={item.id}
                        d={pathData}
                        fill={color}
                        stroke={isSelected ? '#ffffff' : '#0f172a'}
                        strokeWidth={isSelected ? 3 : 1}
                        className="cursor-pointer transition-all duration-200 hover:opacity-85"
                        onClick={() => setSelectedPlaceId(item.id)}
                      />
                    );
                  });
                })()}

                {/* Donut Center Display */}
                <circle cx="150" cy="150" r="54" fill={isDark ? '#0f172a' : '#ffffff'} />
                <text x="150" y="142" textAnchor="middle" className="text-[10px] font-sans fill-neutral-400">
                  Головний край
                </text>
                <text x="150" y="160" textAnchor="middle" className="text-[12px] font-bold fill-amber-500 truncate">
                  {selectedPlace?.name || stats.primaryCradle?.name || '—'}
                </text>
                <text x="150" y="174" textAnchor="middle" className="text-[10px] font-mono fill-neutral-400">
                  {selectedPlace ? `${selectedPlace.percentage}% роду` : ''}
                </text>
              </svg>
            </div>

            {/* Donut Legend */}
            <div className="space-y-2">
              <h4 className={`text-xs font-bold uppercase tracking-wider ${theme.textMuted} mb-3`}>
                Розподіл часток походження
              </h4>
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-2">
                {activeList.filter((item): item is OriginPlaceItem => Boolean(item && item.id)).map((item, idx) => {
                  const color = DONUT_COLORS[idx % DONUT_COLORS.length];
                  const isSelected = Boolean(selectedPlace?.id && selectedPlace.id === item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedPlaceId(item.id)}
                      className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer border transition-colors ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500/10 text-white'
                          : `${theme.surfaceBg} ${theme.borderSubtle} hover:border-neutral-400`
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className="font-semibold truncate">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 font-mono">
                        <span className={theme.textMuted}>{item.personCount} осіб</span>
                        <strong className="text-amber-500">{item.percentage}%</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODE 4: RECORD TYPES COMPARISON (Структура метрик) */}
      {displayMode === 'metrics' && (
        <div className={`p-6 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-xs space-y-4`}>
          <div className="border-b border-neutral-200/40 dark:border-neutral-800/60 pb-3">
            <h3 className={`font-bold text-sm ${theme.textPrimary} flex items-center gap-2`}>
              <FileText className="w-4 h-4 text-purple-500" />
              <span>Структура метричних записів за локаціями</span>
            </h3>
            <p className={`text-xs ${theme.textMuted}`}>
              Співвідношення метрик про народження (хрещення), шлюб (вінчання) та упокоєння (смерть)
            </p>
          </div>

          <div className="space-y-4 pt-2">
            {activeList.filter((item): item is OriginPlaceItem => Boolean(item && item.id)).slice(0, 12).map((item) => {
              const total = item.birthCount + item.marriageCount + item.deathCount || 1;
              const birthPct = Math.round((item.birthCount / total) * 100);
              const marriagePct = Math.round((item.marriageCount / total) * 100);
              const deathPct = Math.round((item.deathCount / total) * 100);
              const isSelected = Boolean(selectedPlace?.id && selectedPlace.id === item.id);

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedPlaceId(item.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? isDark
                        ? 'bg-amber-950/40 border-amber-500'
                        : 'bg-amber-50 border-amber-500'
                      : `${theme.surfaceBg} ${theme.borderSubtle} hover:border-neutral-400`
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold">{item.name}</span>
                    <span className="font-mono text-neutral-400">
                      Всього метричних подій: <strong className={theme.textPrimary}>{item.totalRecords}</strong>
                    </span>
                  </div>

                  {/* Multi-segmented Bar */}
                  <div className="w-full bg-neutral-200 dark:bg-neutral-800 rounded-full h-3 flex overflow-hidden">
                    {item.birthCount > 0 && (
                      <div
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${birthPct}%` }}
                        title={`Народження: ${item.birthCount} (${birthPct}%)`}
                      />
                    )}
                    {item.marriageCount > 0 && (
                      <div
                        className="h-full bg-rose-500 transition-all duration-300"
                        style={{ width: `${marriagePct}%` }}
                        title={`Шлюби: ${item.marriageCount} (${marriagePct}%)`}
                      />
                    )}
                    {item.deathCount > 0 && (
                      <div
                        className="h-full bg-purple-500 transition-all duration-300"
                        style={{ width: `${deathPct}%` }}
                        title={`Упокоєння: ${item.deathCount} (${deathPct}%)`}
                      />
                    )}
                  </div>

                  {/* Labels */}
                  <div className="flex items-center justify-between text-[11px] text-neutral-400 mt-2">
                    <span className="text-emerald-500 font-medium">👶 Народження: {item.birthCount} ({birthPct}%)</span>
                    <span className="text-rose-500 font-medium">💍 Шлюби: {item.marriageCount} ({marriagePct}%)</span>
                    <span className="text-purple-500 font-medium">🕊️ Упокоєння: {item.deathCount} ({deathPct}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. SELECTED LOCATION INSPECTOR & RELATED PERSONS */}
      {selectedPlace && (
        <div className={`p-6 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-xs space-y-6`}>
          {/* Header of Inspector */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-neutral-200/40 dark:border-neutral-800/60 pb-4">
            <div className="flex items-center gap-3.5">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? 'bg-amber-950/50 text-amber-400 border border-amber-800/60' : 'bg-amber-100 text-amber-800 border border-amber-300'}`}>
                {selectedPlace.type === 'region' ? <Compass className="w-6 h-6" /> : <Building className="w-6 h-6" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold">{selectedPlace.name}</h3>
                  <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ${isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-800'}`}>
                    {selectedPlace.type === 'region' ? 'Регіон' : 'Населений пункт'}
                  </span>
                </div>
                <p className={`text-xs ${theme.textMuted}`}>
                  {selectedPlace.regionName} • {selectedPlace.personCount} пов'язаних осіб роду ({selectedPlace.percentage}% бази)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedPlace.name + ', Ukraine')}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium ${theme.surfaceBg} border ${theme.borderSubtle} hover:border-amber-500 transition-colors`}
              >
                <ExternalLink className="w-3.5 h-3.5 text-amber-500" />
                <span>Google Карти</span>
              </a>
            </div>
          </div>

          {/* Quick Stats of the place */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className={`p-3 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} text-center`}>
              <span className={`block text-[10px] ${theme.textMuted}`}>Осіб у роді</span>
              <strong className="text-sm font-mono font-bold text-amber-500">{selectedPlace.personCount}</strong>
            </div>
            <div className={`p-3 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} text-center`}>
              <span className={`block text-[10px] ${theme.textMuted}`}>Народжень</span>
              <strong className="text-sm font-mono font-bold text-emerald-500">{selectedPlace.birthCount}</strong>
            </div>
            <div className={`p-3 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} text-center`}>
              <span className={`block text-[10px] ${theme.textMuted}`}>Шлюбів</span>
              <strong className="text-sm font-mono font-bold text-rose-500">{selectedPlace.marriageCount}</strong>
            </div>
            <div className={`p-3 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} text-center`}>
              <span className={`block text-[10px] ${theme.textMuted}`}>Упокоєнь</span>
              <strong className="text-sm font-mono font-bold text-purple-500">{selectedPlace.deathCount}</strong>
            </div>
          </div>

          {/* Related Persons List */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className={`text-xs font-bold uppercase tracking-wider ${theme.textMuted} flex items-center gap-1.5`}>
                <Users className="w-3.5 h-3.5 text-amber-500" />
                <span>Предки та родичі з цієї місцевості ({selectedPersons.length})</span>
              </h4>

              <div className="relative w-full sm:w-56">
                <Search className={`w-3 h-3 absolute left-2.5 top-2 text-neutral-400`} />
                <input
                  type="text"
                  value={personSearchQuery}
                  onChange={(e) => setPersonSearchQuery(e.target.value)}
                  placeholder="Пошук особи за ім'ям..."
                  className={`w-full pl-7 pr-2 py-1 text-[11px] ${theme.inputBg} border ${theme.inputBorder} rounded-lg ${theme.textPrimary} placeholder:text-neutral-400 focus:outline-none focus:border-amber-500`}
                />
              </div>
            </div>

            {selectedPersons.length === 0 ? (
              <p className={`text-xs ${theme.textMuted} italic py-4 text-center`}>
                Не знайдено осіб за пошуковим запитом
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {selectedPersons.filter((p): p is Person => Boolean(p && p.id)).map((p) => {
                  const isMale = isPersonMale(p, database);
                  const isFemale = isPersonFemale(p, database);
                  const name = getFullName(p);
                  const birthYr = p.birthYear || (p.birthDate ? p.birthDate.slice(0, 4) : null);
                  const deathYr = p.deathYear || (p.deathDate ? p.deathDate.slice(0, 4) : null);
                  const datesStr = birthYr || deathYr ? `${birthYr || '?'} — ${deathYr || (p.isLiving !== false ? 'н.ч.' : '?')}` : '';

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onSelectPerson(p.id)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isDark
                          ? 'bg-[#1b1f24] hover:bg-neutral-800 border-[#2d3238] hover:border-amber-500'
                          : 'bg-white hover:bg-amber-50/50 border-neutral-200 hover:border-amber-400'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isMale ? 'bg-sky-500' : isFemale ? 'bg-rose-500' : 'bg-neutral-400'}`} />
                          <span className="font-bold text-xs truncate" title={name}>
                            {name}
                          </span>
                        </div>
                        {datesStr && (
                          <span className={`block text-[11px] font-mono ${theme.textMuted} mt-0.5 pl-3.5`}>
                            {datesStr}
                          </span>
                        )}
                      </div>

                      <ChevronRight className={`w-4 h-4 shrink-0 text-neutral-400`} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
