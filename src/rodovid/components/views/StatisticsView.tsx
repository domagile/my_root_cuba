/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Users,
  Heart,
  Calendar,
  Trophy,
  PieChart,
  MapPin,
  Baby,
  HeartHandshake,
  CalendarDays,
  Clock,
  Compass,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  GitBranch,
  Layers,
  Award,
  ScrollText
} from 'lucide-react';
import { GenealogyDatabase, Person } from '../../types/genealogy';
import { useUIStore } from '../../../stores/useUIStore';
import { getThemeConfig } from '../../../utils/theme';
import { DoveIcon } from '../../../components/common/GenealogyIcons';
import { computeComprehensiveStats, getPersonName } from '../../utils/genealogyStats';
import { useResearchStore } from '../../../stores/useResearchStore';
import { OriginStatsMap } from './OriginStatsMap';

interface StatisticsViewProps {
  database: GenealogyDatabase;
  onSelectPerson: (id: string) => void;
}

type StatTab = 'overview' | 'relationships' | 'places' | 'age' | 'births' | 'marriages' | 'children';

export const StatisticsView: React.FC<StatisticsViewProps> = ({ database, onSelectPerson }) => {
  const themePalette = useUIStore((s) => s.themePalette);
  const theme = getThemeConfig(themePalette);
  const isDark = theme.category === 'dark';

  const [activeTab, setActiveTab] = useState<StatTab>('overview');
  const metricRecords = useResearchStore((s) => s.metricRecords);

  // Compute all statistics in a memoized helper
  const stats = useMemo(() => {
    return computeComprehensiveStats(database);
  }, [database]);

  const tabs: { id: StatTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: 'Огляд', icon: BarChart3 },
    { id: 'relationships', label: 'Відносини', icon: Users },
    { id: 'places', label: 'Місця', icon: MapPin },
    { id: 'age', label: 'Вік', icon: Clock },
    { id: 'births', label: 'Народження', icon: CalendarDays },
    { id: 'marriages', label: 'Шлюби', icon: HeartHandshake },
    { id: 'children', label: 'Діти', icon: Baby },
  ];

  return (
    <div className={`max-w-7xl mx-auto px-4 py-6 space-y-6 ${theme.textPrimary}`}>
      {/* Top Header */}
      <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-2xl p-5 shadow-xs`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                isDark
                  ? 'bg-amber-950/40 text-amber-400 border border-amber-800/60'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Родинна статистика</h2>
              <p className={`text-xs ${theme.textMuted}`}>
                Демографічний, поколінний та біографічний аналіз бази родоводу
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-3 py-1 rounded-full font-semibold ${
                isDark ? 'bg-neutral-800 text-amber-400 border border-neutral-700' : 'bg-amber-50 text-amber-900 border border-amber-200'
              }`}
            >
              {stats.totalPersons} осіб • {stats.totalFamilies} сімей
            </span>
          </div>
        </div>

        {/* MyHeritage Style Tabs Row */}
        <div className="mt-5 pt-4 border-t border-neutral-200/50 dark:border-neutral-800/60 flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? isDark
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-xs'
                      : 'bg-amber-100/90 text-amber-900 border border-amber-300/80 shadow-xs'
                    : `text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/60`
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-500' : 'opacity-70'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: ОГЛЯД (Overview) */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Main Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-2 shadow-xs`}>
              <span className={`text-xs ${theme.textMuted} flex items-center gap-1.5 font-medium`}>
                <Users className="w-4 h-4 text-sky-500" />
                Всього персон у дереві
              </span>
              <div className="text-3xl font-extrabold font-mono">{stats.totalPersons}</div>
              <div className={`text-xs ${theme.textMuted} flex gap-3 pt-1`}>
                <span>
                  Чол: <strong className="text-sky-500">{stats.males}</strong>{' '}
                  <span className="opacity-60">
                    ({stats.totalPersons ? Math.round((stats.males / stats.totalPersons) * 100) : 0}%)
                  </span>
                </span>
                <span>
                  Жін: <strong className="text-rose-500">{stats.females}</strong>{' '}
                  <span className="opacity-60">
                    ({stats.totalPersons ? Math.round((stats.females / stats.totalPersons) * 100) : 0}%)
                  </span>
                </span>
              </div>
            </div>

            <div className={`p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-2 shadow-xs`}>
              <span className={`text-xs ${theme.textMuted} flex items-center gap-1.5 font-medium`}>
                <HeartHandshake className="w-4 h-4 text-rose-500" />
                Кількість сімейних союзів
              </span>
              <div className="text-3xl font-extrabold font-mono">{stats.totalFamilies}</div>
              <div className={`text-xs ${theme.textMuted} pt-1`}>Зафіксованих родинних шлюбів</div>
            </div>

            <div className={`p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-2 shadow-xs`}>
              <span className={`text-xs ${theme.textMuted} flex items-center gap-1.5 font-medium`}>
                <Calendar className="w-4 h-4 text-amber-500" />
                Середня тривалість життя
              </span>
              <div className="text-3xl font-extrabold text-amber-500 font-mono">
                {stats.averageLifespanOverall > 0 ? `${stats.averageLifespanOverall} р.` : '—'}
              </div>
              <div className={`text-xs ${theme.textMuted} pt-1`}>За даними метричних записів</div>
            </div>

            <div className={`p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-2 shadow-xs`}>
              <span className={`text-xs ${theme.textMuted} flex items-center gap-1.5 font-medium`}>
                <Trophy className="w-4 h-4 text-amber-500" />
                Найдовговічніший предок
              </span>
              {stats.longestLived.length > 0 ? (
                <div>
                  <div className="text-2xl font-extrabold text-amber-500 font-mono">
                    {stats.longestLived[0].age} років
                  </div>
                  <div
                    onClick={() => onSelectPerson(stats.longestLived[0].person.id)}
                    className={`text-xs ${theme.textSecondary} hover:text-amber-500 cursor-pointer hover:underline truncate mt-1 flex items-center gap-1`}
                    title="Перейти до особи"
                  >
                    <span>{getPersonName(stats.longestLived[0].person)}</span>
                    <ArrowRight className="w-3 h-3 shrink-0" />
                  </div>
                </div>
              ) : (
                <div className={`text-xs ${theme.textMuted} pt-2`}>Недостатньо дат</div>
              )}
            </div>
          </div>

          {/* Life Status and Profile Quality summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-3 shadow-xs`}>
              <h3 className={`text-xs font-bold ${theme.textSecondary} uppercase tracking-wider flex items-center gap-1.5`}>
                <Heart className="w-3.5 h-3.5 text-emerald-500" />
                <span>Статус життя родичів</span>
              </h3>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className={`p-3 rounded-lg ${theme.surfaceBg} border ${theme.borderSubtle}`}>
                  <div className="flex items-center gap-1.5 text-emerald-500 font-semibold text-xs mb-1">
                    <Heart className="w-3.5 h-3.5 fill-emerald-500" />
                    <span>Нині живі</span>
                  </div>
                  <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {stats.livingCount}
                  </div>
                  <div className={`text-[11px] ${theme.textMuted}`}>
                    {stats.totalPersons ? Math.round((stats.livingCount / stats.totalPersons) * 100) : 0}% від бази
                  </div>
                </div>

                <div className={`p-3 rounded-lg ${theme.surfaceBg} border ${theme.borderSubtle}`}>
                  <div className="flex items-center gap-1.5 text-neutral-400 font-semibold text-xs mb-1">
                    <DoveIcon className="w-3.5 h-3.5" />
                    <span>Упокоїлися з Богом</span>
                  </div>
                  <div className="text-2xl font-bold font-mono text-neutral-700 dark:text-neutral-300">
                    {stats.deceasedCount}
                  </div>
                  <div className={`text-[11px] ${theme.textMuted}`}>
                    {stats.totalPersons ? Math.round((stats.deceasedCount / stats.totalPersons) * 100) : 0}% від бази
                  </div>
                </div>
              </div>
            </div>

            <div className={`p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-3 shadow-xs`}>
              <h3 className={`text-xs font-bold ${theme.textSecondary} uppercase tracking-wider flex items-center gap-1.5`}>
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Повнота заповнення профілів</span>
              </h3>
              <div className="space-y-2.5 pt-1">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={theme.textMuted}>З роками народження/смерті</span>
                    <span className="font-semibold font-mono">
                      {stats.profilesWithDates} ({stats.totalPersons ? Math.round((stats.profilesWithDates / stats.totalPersons) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="w-full bg-neutral-200 dark:bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full"
                      style={{ width: `${stats.totalPersons ? (stats.profilesWithDates / stats.totalPersons) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={theme.textMuted}>Із зазначеними селами/містами</span>
                    <span className="font-semibold font-mono">
                      {stats.profilesWithPlaces} ({stats.totalPersons ? Math.round((stats.profilesWithPlaces / stats.totalPersons) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="w-full bg-neutral-200 dark:bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full"
                      style={{ width: `${stats.totalPersons ? (stats.profilesWithPlaces / stats.totalPersons) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={theme.textMuted}>Із портретними фотографіями</span>
                    <span className="font-semibold font-mono">
                      {stats.profilesWithPhotos} ({stats.totalPersons ? Math.round((stats.profilesWithPhotos / stats.totalPersons) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="w-full bg-neutral-200 dark:bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-sky-500 h-full rounded-full"
                      style={{ width: `${stats.totalPersons ? (stats.profilesWithPhotos / stats.totalPersons) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Clans & Lineages Section (preserved from current implementation) */}
          <div className={`p-6 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-4 shadow-xs`}>
            <div className="flex items-center justify-between">
              <h3 className={`text-xs font-bold ${theme.textSecondary} flex items-center gap-2 uppercase tracking-wider`}>
                <PieChart className="w-4 h-4 text-amber-500" />
                <span>Роди та гілки родоводу</span>
              </h3>
              <span className={`text-[11px] ${theme.textMuted}`}>{stats.clans.length} родів у базі</span>
            </div>

            {stats.clans.length === 0 ? (
              <p className={`text-xs ${theme.textMuted} italic py-4 text-center`}>Немає даних про роди</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {stats.clans.map((clan) => {
                  const pct = stats.totalPersons > 0 ? Math.round((clan.count / stats.totalPersons) * 100) : 0;
                  return (
                    <div
                      key={clan.id}
                      className={`p-3.5 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} flex flex-col justify-between space-y-2 hover:border-amber-500/40 transition-colors`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/25 shadow-xs"
                            style={{ backgroundColor: clan.color }}
                          />
                          <span className={`font-bold text-xs ${theme.textPrimary} truncate`} title={clan.name}>
                            {clan.name}
                          </span>
                        </div>
                        <span
                          className={`font-mono text-xs px-2 py-0.5 rounded-full ${
                            isDark ? 'bg-amber-950/60 text-amber-400' : 'bg-amber-100 text-amber-800'
                          } font-bold shrink-0`}
                        >
                          {clan.count} {clan.count === 1 ? 'особа' : clan.count < 5 ? 'особи' : 'осіб'}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="w-full bg-slate-700/30 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: clan.color }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>Частка у базі: {pct}%</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1 pt-1">
                        {clan.persons.slice(0, 3).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => onSelectPerson(p.id)}
                            className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors truncate max-w-[140px] cursor-pointer ${
                              isDark
                                ? 'bg-[#1b1f24] hover:bg-slate-700 text-slate-300 border-[#2d3238]'
                                : 'bg-white hover:bg-amber-50 text-slate-700 border-slate-200'
                            }`}
                            title={`Перейти до ${getPersonName(p)}`}
                          >
                            {getPersonName(p)}
                          </button>
                        ))}
                        {clan.persons.length > 3 && (
                          <span className="text-[10px] text-slate-400 self-center pl-0.5">
                            +{clan.persons.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top Surnames (preserved from current implementation) */}
          <div className={`p-6 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-4 shadow-xs`}>
            <div className="flex items-center justify-between">
              <h3 className={`text-xs font-bold ${theme.textSecondary} flex items-center gap-2 uppercase tracking-wider`}>
                <PieChart className="w-4 h-4 text-amber-500" />
                <span>Найпоширеніші роди / прізвища</span>
              </h3>
              <span className={`text-[11px] ${theme.textMuted}`}>канонізовані за родами</span>
            </div>
            {stats.topSurnames.length === 0 ? (
              <p className={`text-xs ${theme.textMuted} italic py-4 text-center`}>Немає даних про прізвища</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {stats.topSurnames.map(([surname, count]) => (
                  <div
                    key={surname}
                    className={`p-3 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} flex items-center justify-between`}
                  >
                    <span className={`font-semibold text-xs ${theme.textPrimary} truncate`} title={surname}>
                      {surname}
                    </span>
                    <span
                      className={`font-mono text-xs px-2 py-0.5 rounded-full ${
                        isDark ? 'bg-amber-950/60 text-amber-400' : 'bg-amber-100 text-amber-800'
                      } font-bold shrink-0 ml-2`}
                    >
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Metrical Records and Archival Sources Summary */}
          {metricRecords.length > 0 && (
            <div className={`p-4 rounded-xl ${isDark ? 'bg-amber-950/20 border-amber-500/30' : 'bg-amber-50 border-amber-200'} border flex flex-wrap items-center justify-between gap-4 shadow-xs`}>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-lg ${isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-800'}`}>
                  <ScrollText className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-xs flex items-center gap-2">
                    <span>Метрична та першоджерельна база досліджень</span>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold">
                      {metricRecords.length} опрацьованих записів
                    </span>
                  </div>
                  <div className={`text-[11px] ${theme.textMuted} pt-0.5`}>
                    Дані з метричних книг, ревізьких казок та сповідних розписів інтегровано у розрахунки географії роду та дат.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('places')}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-neutral-950 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>Переглянути статистичну карту походження</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ВІДНОСИНИ (Relationships & Generations) */}
      {activeTab === 'relationships' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={`p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-2 shadow-xs`}>
              <span className={`text-xs ${theme.textMuted} flex items-center gap-1.5 font-medium`}>
                <Layers className="w-4 h-4 text-amber-500" />
                Поколінь простежено
              </span>
              <div className="text-3xl font-extrabold font-mono text-amber-500">
                {stats.maxGenerationsCount}
              </div>
              <div className={`text-xs ${theme.textMuted} pt-1`}>
                Глибина вертикальних родинних ліній
              </div>
            </div>

            <div className={`p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-2 shadow-xs`}>
              <span className={`text-xs ${theme.textMuted} flex items-center gap-1.5 font-medium`}>
                <GitBranch className="w-4 h-4 text-sky-500" />
                Родинні гілки
              </span>
              <div className="text-3xl font-extrabold font-mono text-sky-500">
                {stats.clans.length}
              </div>
              <div className={`text-xs ${theme.textMuted} pt-1`}>
                Зафіксованих родів за прізвищами
              </div>
            </div>

            <div className={`p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-2 shadow-xs`}>
              <span className={`text-xs ${theme.textMuted} flex items-center gap-1.5 font-medium`}>
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Підтверджено документами
              </span>
              <div className="text-3xl font-extrabold font-mono text-emerald-500">
                {stats.researchStatusStats.find((s) => s.status === 'confirmed')?.count || 0}
              </div>
              <div className={`text-xs ${theme.textMuted} pt-1`}>
                Осіб із верифікованими зв'язками
              </div>
            </div>
          </div>

          {/* Generations Breakdown Chart */}
          <div className={`p-6 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-4 shadow-xs`}>
            <div className="flex items-center justify-between">
              <h3 className={`text-xs font-bold ${theme.textSecondary} flex items-center gap-2 uppercase tracking-wider`}>
                <Layers className="w-4 h-4 text-amber-500" />
                <span>Розподіл персон за поколіннями</span>
              </h3>
              <span className={`text-[11px] ${theme.textMuted}`}>від предків до нащадків</span>
            </div>

            <div className="space-y-3 pt-2">
              {stats.generations.map((g) => {
                const maxCount = Math.max(...stats.generations.map((x) => x.count), 1);
                const pct = Math.round((g.count / maxCount) * 100);
                return (
                  <div key={g.gen} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold">
                        Покоління {g.gen}{' '}
                        {g.gen === 1 ? '(Старійшини / Коріння)' : ''}
                      </span>
                      <span className="font-mono font-bold text-neutral-500 dark:text-neutral-400">
                        {g.count} осіб
                      </span>
                    </div>
                    <div className="w-full bg-neutral-200 dark:bg-neutral-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(pct, 5)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Research & Data Reliability Status */}
          <div className={`p-6 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-4 shadow-xs`}>
            <div className="flex items-center justify-between">
              <h3 className={`text-xs font-bold ${theme.textSecondary} flex items-center gap-2 uppercase tracking-wider`}>
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Статуси верифікації та дослідницького пошуку</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.researchStatusStats.map((st) => (
                <div
                  key={st.status}
                  className={`p-4 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} space-y-1`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: st.color }} />
                    <span className={`text-xs font-semibold ${theme.textPrimary}`}>{st.label}</span>
                  </div>
                  <div className="text-2xl font-extrabold font-mono pt-1" style={{ color: st.color }}>
                    {st.count}
                  </div>
                  <div className={`text-[11px] ${theme.textMuted}`}>
                    {stats.totalPersons ? Math.round((st.count / stats.totalPersons) * 100) : 0}% від бази
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: МІСЦЯ (Places & Geography) */}
      {activeTab === 'places' && (
        <div className="space-y-6">
          {/* Statistical Origin Map & Diagrams based on metric records and places */}
          <OriginStatsMap
            database={database}
            metricRecordsList={metricRecords}
            onSelectPerson={onSelectPerson}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={`p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-2 shadow-xs`}>
              <span className={`text-xs ${theme.textMuted} flex items-center gap-1.5 font-medium`}>
                <MapPin className="w-4 h-4 text-emerald-500" />
                Унікальних населених пунктів
              </span>
              <div className="text-3xl font-extrabold font-mono text-emerald-500">
                {stats.topPlaces.length}
              </div>
              <div className={`text-xs ${theme.textMuted} pt-1`}>Села, містечка та парафії роду</div>
            </div>

            <div className={`p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-2 shadow-xs`}>
              <span className={`text-xs ${theme.textMuted} flex items-center gap-1.5 font-medium`}>
                <Compass className="w-4 h-4 text-sky-500" />
                Корінні мешканці (осілість)
              </span>
              <div className="text-3xl font-extrabold font-mono text-sky-500">
                {stats.localRootedCount}
              </div>
              <div className={`text-xs ${theme.textMuted} pt-1`}>
                Народилися та упокоїлися в одній місцевості
              </div>
            </div>

            <div className={`p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-2 shadow-xs`}>
              <span className={`text-xs ${theme.textMuted} flex items-center gap-1.5 font-medium`}>
                <ArrowRight className="w-4 h-4 text-amber-500" />
                Міграції та переїзди
              </span>
              <div className="text-3xl font-extrabold font-mono text-amber-500">
                {stats.migratedCount}
              </div>
              <div className={`text-xs ${theme.textMuted} pt-1`}>
                Змінили місцевість протягом життя
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top General Places */}
            <div className={`p-6 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-4 shadow-xs`}>
              <div className="flex items-center justify-between">
                <h3 className={`text-xs font-bold ${theme.textSecondary} flex items-center gap-2 uppercase tracking-wider`}>
                  <MapPin className="w-4 h-4 text-emerald-500" />
                  <span>Найпоширеніші населені пункти (Загалом)</span>
                </h3>
              </div>
              {stats.topPlaces.length === 0 ? (
                <p className={`text-xs ${theme.textMuted} italic py-4 text-center`}>Немає даних про населені пункти</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {stats.topPlaces.map(([place, count]) => (
                    <div
                      key={place}
                      className={`p-3.5 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} flex items-center justify-between`}
                    >
                      <span className={`font-semibold text-xs ${theme.textPrimary} truncate`} title={place}>
                        {place}
                      </span>
                      <span
                        className={`font-mono text-xs px-2 py-0.5 rounded-full ${
                          isDark ? 'bg-emerald-950/60 text-emerald-400' : 'bg-emerald-100 text-emerald-800'
                        } font-bold shrink-0 ml-2`}
                      >
                        {count} {count === 1 ? 'запис' : 'записи'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Birth Places */}
            <div className={`p-6 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-4 shadow-xs`}>
              <div className="flex items-center justify-between">
                <h3 className={`text-xs font-bold ${theme.textSecondary} flex items-center gap-2 uppercase tracking-wider`}>
                  <CalendarDays className="w-4 h-4 text-sky-500" />
                  <span>Осередки народження (Родові гнізда)</span>
                </h3>
              </div>
              {stats.topBirthPlaces.length === 0 ? (
                <p className={`text-xs ${theme.textMuted} italic py-4 text-center`}>Немає даних про місця народження</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {stats.topBirthPlaces.map(([place, count]) => (
                    <div
                      key={place}
                      className={`p-3.5 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} flex items-center justify-between`}
                    >
                      <span className={`font-semibold text-xs ${theme.textPrimary} truncate`} title={place}>
                        {place}
                      </span>
                      <span
                        className={`font-mono text-xs px-2 py-0.5 rounded-full ${
                          isDark ? 'bg-sky-950/60 text-sky-400' : 'bg-sky-100 text-sky-800'
                        } font-bold shrink-0 ml-2`}
                      >
                        {count} народж.
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ВІК (Lifespan & Age Records) */}
      {activeTab === 'age' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={`p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-2 shadow-xs`}>
              <span className={`text-xs ${theme.textMuted} flex items-center gap-1.5 font-medium`}>
                <Clock className="w-4 h-4 text-amber-500" />
                Середня тривалість життя
              </span>
              <div className="text-3xl font-extrabold font-mono text-amber-500">
                {stats.averageLifespanOverall > 0 ? `${stats.averageLifespanOverall} р.` : '—'}
              </div>
              <div className={`text-xs ${theme.textMuted} pt-1`}>Загалом по роду</div>
            </div>

            <div className={`p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-2 shadow-xs`}>
              <span className={`text-xs ${theme.textMuted} flex items-center gap-1.5 font-medium`}>
                <Users className="w-4 h-4 text-sky-500" />
                Середній вік чоловіків
              </span>
              <div className="text-3xl font-extrabold font-mono text-sky-500">
                {stats.averageLifespanMales > 0 ? `${stats.averageLifespanMales} р.` : '—'}
              </div>
              <div className={`text-xs ${theme.textMuted} pt-1`}>Для предків чоловічої статі</div>
            </div>

            <div className={`p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-2 shadow-xs`}>
              <span className={`text-xs ${theme.textMuted} flex items-center gap-1.5 font-medium`}>
                <Heart className="w-4 h-4 text-rose-500" />
                Середній вік жінок
              </span>
              <div className="text-3xl font-extrabold font-mono text-rose-500">
                {stats.averageLifespanFemales > 0 ? `${stats.averageLifespanFemales} р.` : '—'}
              </div>
              <div className={`text-xs ${theme.textMuted} pt-1`}>Для предків жіночої статі</div>
            </div>
          </div>

          {/* Longest Lived Ancestors Grid */}
          <div className={`p-6 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-4 shadow-xs`}>
            <div className="flex items-center justify-between">
              <h3 className={`text-xs font-bold ${theme.textSecondary} flex items-center gap-2 uppercase tracking-wider`}>
                <Trophy className="w-4 h-4 text-amber-500" />
                <span>Довгожителі роду (Топ довговічних предків)</span>
              </h3>
              <span className={`text-[11px] ${theme.textMuted}`}>80+ років</span>
            </div>

            {stats.longestLived.length === 0 ? (
              <p className={`text-xs ${theme.textMuted} italic py-4 text-center`}>
                Недостатньо дат народження та смерті для розрахунку довгожителів
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {stats.longestLived.map((item, idx) => (
                  <div
                    key={item.person.id}
                    onClick={() => onSelectPerson(item.person.id)}
                    className={`p-3.5 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} hover:border-amber-500/50 transition-all cursor-pointer space-y-1.5 group`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-xs font-bold text-amber-500">
                        <Award className="w-3.5 h-3.5" />
                        <span>#{idx + 1}</span>
                      </span>
                      <span className="font-mono text-xs font-extrabold text-amber-500 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                        {item.age} років
                      </span>
                    </div>
                    <div className="font-bold text-xs truncate group-hover:text-amber-500 transition-colors">
                      {getPersonName(item.person)}
                    </div>
                    <div className={`text-[11px] ${theme.textMuted}`}>
                      {item.birthYear} — {item.deathYear}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Oldest Living Relatives (Поважні старійшини роду) */}
          {stats.oldestLiving && stats.oldestLiving.length > 0 && (
            <div className={`p-6 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-4 shadow-xs`}>
              <div className="flex items-center justify-between">
                <h3 className={`text-xs font-bold ${theme.textSecondary} flex items-center gap-2 uppercase tracking-wider`}>
                  <Heart className="w-4 h-4 text-emerald-500" />
                  <span>Поважні старійшини роду (Найстарші нині живі)</span>
                </h3>
                <span className="text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  Нині з нами
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {stats.oldestLiving.map((item, idx) => (
                  <div
                    key={item.person.id}
                    onClick={() => onSelectPerson(item.person.id)}
                    className={`p-3.5 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} hover:border-emerald-500/50 transition-all cursor-pointer space-y-1.5 group`}
                    title="Натисніть для переходу до анкети особи"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-xs font-bold text-emerald-500">
                        <Award className="w-3.5 h-3.5" />
                        <span>#{idx + 1}</span>
                      </span>
                      <span className="font-mono text-xs font-extrabold text-emerald-500 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        {item.age} років
                      </span>
                    </div>
                    <div className="font-bold text-xs truncate group-hover:text-emerald-500 transition-colors">
                      {getPersonName(item.person)}
                    </div>
                    <div className={`text-[11px] ${theme.textMuted}`}>
                      нар. {item.birthYear || '—'} р.
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Age Distribution Buckets & By Century */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className={`p-6 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-4 shadow-xs`}>
              <h3 className={`text-xs font-bold ${theme.textSecondary} flex items-center gap-2 uppercase tracking-wider`}>
                <Clock className="w-4 h-4 text-amber-500" />
                <span>Розподіл за віковими групами</span>
              </h3>
              <div className="space-y-3 pt-1">
                {stats.ageDistribution.map((b) => (
                  <div key={b.label} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{b.label}</span>
                      <span className="font-mono text-neutral-500 dark:text-neutral-400">
                        {b.count} осіб ({b.pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-neutral-200 dark:bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full"
                        style={{ width: `${Math.max(b.pct, 2)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`p-6 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-4 shadow-xs`}>
              <h3 className={`text-xs font-bold ${theme.textSecondary} flex items-center gap-2 uppercase tracking-wider`}>
                <Calendar className="w-4 h-4 text-sky-500" />
                <span>Середня тривалість життя за епохами</span>
              </h3>
              {stats.lifespanByCentury.length === 0 ? (
                <p className={`text-xs ${theme.textMuted} italic py-4 text-center`}>Немає даних за століттями</p>
              ) : (
                <div className="space-y-3 pt-1">
                  {stats.lifespanByCentury.map((c) => (
                    <div
                      key={c.century}
                      className={`p-3 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} flex items-center justify-between`}
                    >
                      <div>
                        <div className="font-bold text-xs">{c.century}</div>
                        <div className={`text-[11px] ${theme.textMuted}`}>{c.count} зафіксованих предків</div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-base font-extrabold text-sky-500">
                          {c.avgAge} р.
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: НАРОДЖЕННЯ (Births) */}
      {activeTab === 'births' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={`p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-2 shadow-xs`}>
              <span className={`text-xs ${theme.textMuted} flex items-center gap-1.5 font-medium`}>
                <CalendarDays className="w-4 h-4 text-amber-500" />
                Найдавніший зафіксований предок
              </span>
              {stats.earliestBorn ? (
                <div>
                  <div className="text-3xl font-extrabold text-amber-500 font-mono">
                    {stats.earliestBorn.year} рік
                  </div>
                  <div
                    onClick={() => onSelectPerson(stats.earliestBorn!.person.id)}
                    className={`text-xs ${theme.textSecondary} hover:text-amber-500 cursor-pointer hover:underline truncate mt-1 flex items-center gap-1`}
                  >
                    <span>{getPersonName(stats.earliestBorn.person)}</span>
                    <ArrowRight className="w-3 h-3 shrink-0" />
                  </div>
                </div>
              ) : (
                <div className={`text-xs ${theme.textMuted} pt-2`}>Немає даних</div>
              )}
            </div>

            <div className={`p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-2 shadow-xs`}>
              <span className={`text-xs ${theme.textMuted} flex items-center gap-1.5 font-medium`}>
                <Baby className="w-4 h-4 text-emerald-500" />
                Наймолодший представник роду
              </span>
              {stats.latestBorn ? (
                <div>
                  <div className="text-3xl font-extrabold text-emerald-500 font-mono">
                    {stats.latestBorn.year} рік
                  </div>
                  <div
                    onClick={() => onSelectPerson(stats.latestBorn!.person.id)}
                    className={`text-xs ${theme.textSecondary} hover:text-emerald-500 cursor-pointer hover:underline truncate mt-1 flex items-center gap-1`}
                  >
                    <span>{getPersonName(stats.latestBorn.person)}</span>
                    <ArrowRight className="w-3 h-3 shrink-0" />
                  </div>
                </div>
              ) : (
                <div className={`text-xs ${theme.textMuted} pt-2`}>Немає даних</div>
              )}
            </div>

            <div className={`p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-2 shadow-xs`}>
              <span className={`text-xs ${theme.textMuted} flex items-center gap-1.5 font-medium`}>
                <Clock className="w-4 h-4 text-sky-500" />
                Охоплення хронології
              </span>
              <div className="text-3xl font-extrabold text-sky-500 font-mono">
                {stats.earliestBorn && stats.latestBorn
                  ? `${stats.latestBorn.year - stats.earliestBorn.year} р.`
                  : '—'}
              </div>
              <div className={`text-xs ${theme.textMuted} pt-1`}>
                Часовий проміжок між першим та останнім предком
              </div>
            </div>
          </div>

          {/* Seasonality of Births (Months) */}
          <div className={`p-6 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-4 shadow-xs`}>
            <div className="flex items-center justify-between">
              <h3 className={`text-xs font-bold ${theme.textSecondary} flex items-center gap-2 uppercase tracking-wider`}>
                <Calendar className="w-4 h-4 text-amber-500" />
                <span>Сезонність народжень за місяцями року</span>
              </h3>
              <span className={`text-[11px] ${theme.textMuted}`}>за даними метрик і сповідей</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
              {stats.birthsByMonth.map((m) => {
                const maxBirths = Math.max(...stats.birthsByMonth.map((x) => x.count), 1);
                const isPeak = m.count === maxBirths && m.count > 0;
                return (
                  <div
                    key={m.month}
                    className={`p-3 rounded-xl border text-center space-y-1 transition-all ${
                      isPeak
                        ? isDark
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                          : 'bg-amber-50 border-amber-300 text-amber-900'
                        : `${theme.surfaceBg} ${theme.borderSubtle}`
                    }`}
                  >
                    <div className="text-[11px] font-medium opacity-80">{m.name}</div>
                    <div className="text-xl font-extrabold font-mono">{m.count}</div>
                    <div className="text-[10px] opacity-60">народжень</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Births by Century */}
          <div className={`p-6 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-4 shadow-xs`}>
            <h3 className={`text-xs font-bold ${theme.textSecondary} flex items-center gap-2 uppercase tracking-wider`}>
              <Layers className="w-4 h-4 text-sky-500" />
              <span>Народження за століттями</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              {stats.birthsByCentury.map((c) => (
                <div
                  key={c.century}
                  className={`p-4 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} space-y-1 text-center`}
                >
                  <div className="text-xs font-bold">{c.century}</div>
                  <div className="text-2xl font-extrabold font-mono text-sky-500">{c.count}</div>
                  <div className={`text-[11px] ${theme.textMuted}`}>предків</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: ШЛЮБИ (Marriages) */}
      {activeTab === 'marriages' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={`p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-2 shadow-xs`}>
              <span className={`text-xs ${theme.textMuted} flex items-center gap-1.5 font-medium`}>
                <HeartHandshake className="w-4 h-4 text-rose-500" />
                Шлюбів із відомими датами
              </span>
              <div className="text-3xl font-extrabold font-mono text-rose-500">
                {stats.totalMarriagesWithDates}
              </div>
              <div className={`text-xs ${theme.textMuted} pt-1`}>
                З {stats.totalFamilies} загальних родинних союзів
              </div>
            </div>

            <div className={`p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-2 shadow-xs`}>
              <span className={`text-xs ${theme.textMuted} flex items-center gap-1.5 font-medium`}>
                <Users className="w-4 h-4 text-sky-500" />
                Середній вік нареченого
              </span>
              <div className="text-3xl font-extrabold font-mono text-sky-500">
                {stats.avgMarriageAgeMen !== null ? `${stats.avgMarriageAgeMen} р.` : '—'}
              </div>
              <div className={`text-xs ${theme.textMuted} pt-1`}>
                На момент укладення першого шлюбу
              </div>
            </div>

            <div className={`p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-2 shadow-xs`}>
              <span className={`text-xs ${theme.textMuted} flex items-center gap-1.5 font-medium`}>
                <Heart className="w-4 h-4 text-amber-500" />
                Середній вік нареченої
              </span>
              <div className="text-3xl font-extrabold font-mono text-amber-500">
                {stats.avgMarriageAgeWomen !== null ? `${stats.avgMarriageAgeWomen} р.` : '—'}
              </div>
              <div className={`text-xs ${theme.textMuted} pt-1`}>
                На момент вінчання у церкві
              </div>
            </div>
          </div>

          {/* Extreme Values: Youngest and Oldest Bride & Groom */}
          <div className={`p-6 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-4 shadow-xs`}>
            <h3 className={`text-xs font-bold ${theme.textSecondary} flex items-center gap-2 uppercase tracking-wider`}>
              <Trophy className="w-4 h-4 text-amber-500" />
              <span>Вікові рекорди одруження в роду</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Youngest Groom */}
              <div className={`p-4 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} space-y-1`}>
                <div className="text-[11px] font-semibold text-sky-500 uppercase">Наймолодший наречений</div>
                {stats.youngestGroom ? (
                  <div
                    onClick={() => onSelectPerson(stats.youngestGroom!.person.id)}
                    className="cursor-pointer group"
                  >
                    <div className="text-xl font-extrabold font-mono text-sky-500">
                      {stats.youngestGroom.age} років
                    </div>
                    <div className="font-bold text-xs truncate group-hover:text-amber-500 mt-1">
                      {getPersonName(stats.youngestGroom.person)}
                    </div>
                    <div className={`text-[11px] ${theme.textMuted}`}>
                      У шлюбі з: {stats.youngestGroom.spouseName} ({stats.youngestGroom.year} р.)
                    </div>
                  </div>
                ) : (
                  <div className={`text-xs ${theme.textMuted}`}>Немає даних</div>
                )}
              </div>

              {/* Youngest Bride */}
              <div className={`p-4 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} space-y-1`}>
                <div className="text-[11px] font-semibold text-rose-500 uppercase">Наймолодша наречена</div>
                {stats.youngestBride ? (
                  <div
                    onClick={() => onSelectPerson(stats.youngestBride!.person.id)}
                    className="cursor-pointer group"
                  >
                    <div className="text-xl font-extrabold font-mono text-rose-500">
                      {stats.youngestBride.age} років
                    </div>
                    <div className="font-bold text-xs truncate group-hover:text-amber-500 mt-1">
                      {getPersonName(stats.youngestBride.person)}
                    </div>
                    <div className={`text-[11px] ${theme.textMuted}`}>
                      У шлюбі з: {stats.youngestBride.spouseName} ({stats.youngestBride.year} р.)
                    </div>
                  </div>
                ) : (
                  <div className={`text-xs ${theme.textMuted}`}>Немає даних</div>
                )}
              </div>

              {/* Oldest Groom */}
              <div className={`p-4 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} space-y-1`}>
                <div className="text-[11px] font-semibold text-sky-500 uppercase">Найстарший наречений</div>
                {stats.oldestGroom ? (
                  <div
                    onClick={() => onSelectPerson(stats.oldestGroom!.person.id)}
                    className="cursor-pointer group"
                  >
                    <div className="text-xl font-extrabold font-mono text-sky-500">
                      {stats.oldestGroom.age} років
                    </div>
                    <div className="font-bold text-xs truncate group-hover:text-amber-500 mt-1">
                      {getPersonName(stats.oldestGroom.person)}
                    </div>
                    <div className={`text-[11px] ${theme.textMuted}`}>
                      У шлюбі з: {stats.oldestGroom.spouseName} ({stats.oldestGroom.year} р.)
                    </div>
                  </div>
                ) : (
                  <div className={`text-xs ${theme.textMuted}`}>Немає даних</div>
                )}
              </div>

              {/* Oldest Bride */}
              <div className={`p-4 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} space-y-1`}>
                <div className="text-[11px] font-semibold text-rose-500 uppercase">Найстарша наречена</div>
                {stats.oldestBride ? (
                  <div
                    onClick={() => onSelectPerson(stats.oldestBride!.person.id)}
                    className="cursor-pointer group"
                  >
                    <div className="text-xl font-extrabold font-mono text-rose-500">
                      {stats.oldestBride.age} років
                    </div>
                    <div className="font-bold text-xs truncate group-hover:text-amber-500 mt-1">
                      {getPersonName(stats.oldestBride.person)}
                    </div>
                    <div className={`text-[11px] ${theme.textMuted}`}>
                      У шлюбі з: {stats.oldestBride.spouseName} ({stats.oldestBride.year} р.)
                    </div>
                  </div>
                ) : (
                  <div className={`text-xs ${theme.textMuted}`}>Немає даних</div>
                )}
              </div>
            </div>
          </div>

          {/* Age gaps & Longest marriages */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Age Gaps */}
            <div className={`p-6 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-4 shadow-xs`}>
              <div className="flex items-center justify-between">
                <h3 className={`text-xs font-bold ${theme.textSecondary} flex items-center gap-2 uppercase tracking-wider`}>
                  <HeartHandshake className="w-4 h-4 text-amber-500" />
                  <span>Найбільша різниця у віці в парах</span>
                </h3>
                {stats.avgAgeGapBetweenSpouses !== null && (
                  <span className={`text-[11px] ${theme.textMuted}`}>
                    Середня різниця: {stats.avgAgeGapBetweenSpouses} р.
                  </span>
                )}
              </div>

              {stats.biggestAgeGaps.length === 0 ? (
                <p className={`text-xs ${theme.textMuted} italic py-4 text-center`}>Немає пар із різницею від 5 років</p>
              ) : (
                <div className="space-y-2.5">
                  {stats.biggestAgeGaps.map((item) => (
                    <div
                      key={item.familyId}
                      className={`p-3 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} flex items-center justify-between gap-3`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSelectPerson(item.husband.id)}
                            className="hover:text-amber-500 hover:underline cursor-pointer truncate max-w-[140px] text-left"
                            title={`Перейти до: ${getPersonName(item.husband)}`}
                          >
                            {getPersonName(item.husband)}
                          </button>
                          <span className={`${theme.textMuted} font-normal`}>та</span>
                          <button
                            type="button"
                            onClick={() => onSelectPerson(item.wife.id)}
                            className="hover:text-amber-500 hover:underline cursor-pointer truncate max-w-[140px] text-left"
                            title={`Перейти до: ${getPersonName(item.wife)}`}
                          >
                            {getPersonName(item.wife)}
                          </button>
                        </div>
                        <div className={`text-[11px] ${theme.textMuted} pt-0.5`}>
                          {item.older === 'husband' ? 'Чоловік старший' : 'Дружина старша'}
                        </div>
                      </div>
                      <span className="font-mono text-xs px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 font-bold shrink-0">
                        +{item.gap} р.
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Longest Marriages */}
            <div className={`p-6 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-4 shadow-xs`}>
              <div className="flex items-center justify-between">
                <h3 className={`text-xs font-bold ${theme.textSecondary} flex items-center gap-2 uppercase tracking-wider`}>
                  <Heart className="w-4 h-4 text-rose-500" />
                  <span>Найдовші шлюби (Золоті союзи роду)</span>
                </h3>
              </div>

              {stats.longestMarriages.length === 0 ? (
                <p className={`text-xs ${theme.textMuted} italic py-4 text-center`}>
                  Недостатньо дат вінчання та смерті обох із подружжя
                </p>
              ) : (
                <div className="space-y-2.5">
                  {stats.longestMarriages.map((item) => (
                    <div
                      key={item.familyId}
                      className={`p-3 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} flex items-center justify-between gap-3`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSelectPerson(item.husband.id)}
                            className="hover:text-rose-500 hover:underline cursor-pointer truncate max-w-[140px] text-left"
                            title={`Перейти до: ${getPersonName(item.husband)}`}
                          >
                            {getPersonName(item.husband)}
                          </button>
                          <span className={`${theme.textMuted} font-normal`}>та</span>
                          <button
                            type="button"
                            onClick={() => onSelectPerson(item.wife.id)}
                            className="hover:text-rose-500 hover:underline cursor-pointer truncate max-w-[140px] text-left"
                            title={`Перейти до: ${getPersonName(item.wife)}`}
                          >
                            {getPersonName(item.wife)}
                          </button>
                        </div>
                        <div className={`text-[11px] ${theme.textMuted} pt-0.5`}>Разом у шлюбі</div>
                      </div>
                      <span className="font-mono text-xs px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-400 font-bold shrink-0">
                        {item.duration} років
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Ethnographic Notes on Ukrainian Marriages */}
          <div className={`p-4 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} flex items-start gap-3 text-xs leading-relaxed shadow-xs`}>
            <Sparkles className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold text-amber-500">
                Українські шлюбні звичаї та церковні канони:
              </span>
              <p className={theme.textMuted}>
                В українських селах традиційно виділяли два основні весільні сезони: <strong>Осінній (від свята Покрови Пресвятої Богородиці 14 жовтня до початку Пилипівського посту 28 листопада)</strong> та <strong>Зимові М&apos;ясниці (від Водохреща до Масляної)</strong>. У періоди чотирьох великих постів (Великого перед Великоднем, Петрового, Успенського та Пилипівського) вінчання суворо заборонялися церковним уставом, що наочно відображено у спадах графіку вінчань.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: ДІТИ (Children & Parenting) */}
      {activeTab === 'children' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className={`p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-2 shadow-xs`}>
              <span className={`text-xs ${theme.textMuted} flex items-center gap-1.5 font-medium`}>
                <Baby className="w-4 h-4 text-emerald-500" />
                Середня кількість дітей
              </span>
              <div className="text-3xl font-extrabold font-mono text-emerald-500">
                {stats.averageChildrenPerFamily}
              </div>
              <div className={`text-xs ${theme.textMuted} pt-1`}>На одну сім'ю з дітьми</div>
            </div>

            <div className={`p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-2 shadow-xs`}>
              <span className={`text-xs ${theme.textMuted} flex items-center gap-1.5 font-medium`}>
                <Heart className="w-4 h-4 text-rose-500" />
                Вік матері при 1-й дитині
              </span>
              <div className="text-3xl font-extrabold font-mono text-rose-500">
                {stats.avgMotherAgeAtFirstChild !== null ? `${stats.avgMotherAgeAtFirstChild} р.` : '—'}
              </div>
              <div className={`text-xs ${theme.textMuted} pt-1`}>Середній вік народження первістка</div>
            </div>

            <div className={`p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-2 shadow-xs`}>
              <span className={`text-xs ${theme.textMuted} flex items-center gap-1.5 font-medium`}>
                <Users className="w-4 h-4 text-sky-500" />
                Вік батька при 1-й дитині
              </span>
              <div className="text-3xl font-extrabold font-mono text-sky-500">
                {stats.avgFatherAgeAtFirstChild !== null ? `${stats.avgFatherAgeAtFirstChild} р.` : '—'}
              </div>
              <div className={`text-xs ${theme.textMuted} pt-1`}>Середній вік батьківства</div>
            </div>

            <div className={`p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-2 shadow-xs`}>
              <span className={`text-xs ${theme.textMuted} flex items-center gap-1.5 font-medium`}>
                <Clock className="w-4 h-4 text-amber-500" />
                Інтервал між дітьми
              </span>
              <div className="text-3xl font-extrabold font-mono text-amber-500">
                {stats.avgChildIntervalYears !== null ? `${stats.avgChildIntervalYears} р.` : '—'}
              </div>
              <div className={`text-xs ${theme.textMuted} pt-1`}>Середній проміжок у сім'ї</div>
            </div>
          </div>

          {/* Largest Families in Lineage */}
          <div className={`p-6 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-4 shadow-xs`}>
            <div className="flex items-center justify-between">
              <h3 className={`text-xs font-bold ${theme.textSecondary} flex items-center gap-2 uppercase tracking-wider`}>
                <Trophy className="w-4 h-4 text-amber-500" />
                <span>Сім'ї-рекордсмени роду (Найбільша кількість дітей)</span>
              </h3>
            </div>

            {stats.largestFamilies.length === 0 ? (
              <p className={`text-xs ${theme.textMuted} italic py-4 text-center`}>Немає зафіксованих сімей із дітьми</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.largestFamilies.map((fam, idx) => (
                  <div
                    key={fam.familyId}
                    className={`p-4 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} space-y-2 hover:border-amber-500/40 transition-colors`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-500 flex items-center gap-1">
                        <Award className="w-3.5 h-3.5" />
                        <span>#{idx + 1}</span>
                      </span>
                      <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-extrabold">
                        {fam.count} {fam.count === 1 ? 'дитина' : fam.count < 5 ? 'дитини' : 'дітей'}
                      </span>
                    </div>

                    <div className="font-bold text-xs flex flex-wrap items-center gap-1.5">
                      {fam.husband ? (
                        <button
                          type="button"
                          onClick={() => onSelectPerson(fam.husband!.id)}
                          className="hover:text-amber-500 hover:underline cursor-pointer truncate max-w-[120px] text-left"
                          title={`Перейти до: ${getPersonName(fam.husband)}`}
                        >
                          {getPersonName(fam.husband)}
                        </button>
                      ) : (
                        <span className={theme.textMuted}>Невідомий</span>
                      )}
                      <span className={`${theme.textMuted} font-normal`}>та</span>
                      {fam.wife ? (
                        <button
                          type="button"
                          onClick={() => onSelectPerson(fam.wife!.id)}
                          className="hover:text-amber-500 hover:underline cursor-pointer truncate max-w-[120px] text-left"
                          title={`Перейти до: ${getPersonName(fam.wife)}`}
                        >
                          {getPersonName(fam.wife)}
                        </button>
                      ) : (
                        <span className={theme.textMuted}>Невідома</span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1 pt-1">
                      {fam.children.slice(0, 4).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => onSelectPerson(c.id)}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors truncate max-w-[120px] cursor-pointer ${
                            isDark
                              ? 'bg-[#1b1f24] hover:bg-slate-700 text-slate-300 border-[#2d3238]'
                              : 'bg-white hover:bg-emerald-50 text-slate-700 border-slate-200'
                          }`}
                          title={getPersonName(c)}
                        >
                          {getPersonName(c)}
                        </button>
                      ))}
                      {fam.children.length > 4 && (
                        <span className="text-[10px] text-slate-400 self-center pl-0.5">
                          +{fam.children.length - 4}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Parental Age Extremes */}
          <div className={`p-6 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-4 shadow-xs`}>
            <h3 className={`text-xs font-bold ${theme.textSecondary} flex items-center gap-2 uppercase tracking-wider`}>
              <Heart className="w-4 h-4 text-rose-500" />
              <span>Вік батьків при народженні дітей</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className={`p-4 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} space-y-1`}>
                <div className="text-[11px] font-semibold text-rose-500 uppercase">Наймолодша мати</div>
                {stats.youngestMother ? (
                  <div
                    onClick={() => onSelectPerson(stats.youngestMother!.person.id)}
                    className="cursor-pointer group"
                  >
                    <div className="text-xl font-extrabold font-mono text-rose-500">
                      {stats.youngestMother.age} років
                    </div>
                    <div className="font-bold text-xs truncate group-hover:text-amber-500 mt-1">
                      {getPersonName(stats.youngestMother.person)}
                    </div>
                    <div className={`text-[11px] ${theme.textMuted}`}>Дитина: {stats.youngestMother.childName}</div>
                  </div>
                ) : (
                  <div className={`text-xs ${theme.textMuted}`}>Немає даних</div>
                )}
              </div>

              <div className={`p-4 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} space-y-1`}>
                <div className="text-[11px] font-semibold text-sky-500 uppercase">Наймолодший батько</div>
                {stats.youngestFather ? (
                  <div
                    onClick={() => onSelectPerson(stats.youngestFather!.person.id)}
                    className="cursor-pointer group"
                  >
                    <div className="text-xl font-extrabold font-mono text-sky-500">
                      {stats.youngestFather.age} років
                    </div>
                    <div className="font-bold text-xs truncate group-hover:text-amber-500 mt-1">
                      {getPersonName(stats.youngestFather.person)}
                    </div>
                    <div className={`text-[11px] ${theme.textMuted}`}>Дитина: {stats.youngestFather.childName}</div>
                  </div>
                ) : (
                  <div className={`text-xs ${theme.textMuted}`}>Немає даних</div>
                )}
              </div>

              <div className={`p-4 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} space-y-1`}>
                <div className="text-[11px] font-semibold text-rose-500 uppercase">Найстарша мати</div>
                {stats.oldestMother ? (
                  <div
                    onClick={() => onSelectPerson(stats.oldestMother!.person.id)}
                    className="cursor-pointer group"
                  >
                    <div className="text-xl font-extrabold font-mono text-rose-500">
                      {stats.oldestMother.age} років
                    </div>
                    <div className="font-bold text-xs truncate group-hover:text-amber-500 mt-1">
                      {getPersonName(stats.oldestMother.person)}
                    </div>
                    <div className={`text-[11px] ${theme.textMuted}`}>Дитина: {stats.oldestMother.childName}</div>
                  </div>
                ) : (
                  <div className={`text-xs ${theme.textMuted}`}>Немає даних</div>
                )}
              </div>

              <div className={`p-4 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} space-y-1`}>
                <div className="text-[11px] font-semibold text-sky-500 uppercase">Найстарший батько</div>
                {stats.oldestFather ? (
                  <div
                    onClick={() => onSelectPerson(stats.oldestFather!.person.id)}
                    className="cursor-pointer group"
                  >
                    <div className="text-xl font-extrabold font-mono text-sky-500">
                      {stats.oldestFather.age} років
                    </div>
                    <div className="font-bold text-xs truncate group-hover:text-amber-500 mt-1">
                      {getPersonName(stats.oldestFather.person)}
                    </div>
                    <div className={`text-[11px] ${theme.textMuted}`}>Дитина: {stats.oldestFather.childName}</div>
                  </div>
                ) : (
                  <div className={`text-xs ${theme.textMuted}`}>Немає даних</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
