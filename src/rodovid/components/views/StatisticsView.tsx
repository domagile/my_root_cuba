/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { BarChart3, Users, Heart, Calendar, Trophy, PieChart } from 'lucide-react';
import { GenealogyDatabase, Person, Family } from '../../types/genealogy';

interface StatisticsViewProps {
  database: GenealogyDatabase;
  onSelectPerson: (id: string) => void;
}

export const StatisticsView: React.FC<StatisticsViewProps> = ({ database, onSelectPerson }) => {
  const persons = useMemo(() => {
    return Object.values(database.persons || {}) as Person[];
  }, [database]);

  const families = useMemo(() => {
    return Object.values(database.families || {}) as Family[];
  }, [database]);

  const stats = useMemo(() => {
    const totalPersons = persons.length;
    const males = persons.filter((p) => p.gender === 'male' || p.gender === 'M').length;
    const females = persons.filter((p) => p.gender === 'female' || p.gender === 'F').length;

    // Lifespan calculations
    let totalLifespan = 0;
    let deceasedWithAgeCount = 0;
    let longestLived: { person: Person; age: number } | null = null;

    persons.forEach((p) => {
      const birth = typeof p.birthYear === 'number' ? p.birthYear : parseInt(String(p.birthDate || '').substring(0, 4), 10);
      const death = typeof p.deathYear === 'number' ? p.deathYear : parseInt(String(p.deathDate || '').substring(0, 4), 10);
      if (!isNaN(birth) && !isNaN(death) && death >= birth) {
        const age = death - birth;
        totalLifespan += age;
        deceasedWithAgeCount += 1;
        if (!longestLived || age > longestLived.age) {
          longestLived = { person: p, age };
        }
      }
    });

    const averageLifespan = deceasedWithAgeCount > 0 ? Math.round(totalLifespan / deceasedWithAgeCount) : 0;

    // Surnames distribution
    const surnameMap: Record<string, number> = {};
    persons.forEach((p) => {
      const s = p.lastName?.trim();
      if (s) {
        surnameMap[s] = (surnameMap[s] || 0) + 1;
      }
    });

    const topSurnames = Object.entries(surnameMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    return {
      totalPersons,
      males,
      females,
      totalFamilies: families.length,
      averageLifespan,
      longestLived,
      topSurnames
    };
  }, [persons, families]);

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-900 text-slate-100 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#B88E3E]/20 text-[#B88E3E] flex items-center justify-center border border-[#B88E3E]/30">
          <BarChart3 className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-100">Генеалогічна Статистика</h2>
          <p className="text-xs text-slate-400">Демографічний та поколінний аналіз родинної бази</p>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-2">
          <span className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
            <Users className="w-4 h-4 text-blue-400" />
            Всього персон у дереві
          </span>
          <div className="text-3xl font-extrabold text-white font-mono">{stats.totalPersons}</div>
          <div className="text-xs text-slate-400 flex gap-3 pt-1">
            <span>Чол: <strong className="text-blue-400">{stats.males}</strong></span>
            <span>Жін: <strong className="text-rose-400">{stats.females}</strong></span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-2">
          <span className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
            <Heart className="w-4 h-4 text-rose-400" />
            Кількість шлюбів / сімей
          </span>
          <div className="text-3xl font-extrabold text-white font-mono">{stats.totalFamilies}</div>
          <div className="text-xs text-slate-400 pt-1">Зафіксованих родинних союзів</div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-2">
          <span className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
            <Calendar className="w-4 h-4 text-amber-400" />
            Середня тривалість життя
          </span>
          <div className="text-3xl font-extrabold text-amber-400 font-mono">
            {stats.averageLifespan > 0 ? `${stats.averageLifespan} р.` : '—'}
          </div>
          <div className="text-xs text-slate-400 pt-1">За даними метричних записів</div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-2">
          <span className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
            <Trophy className="w-4 h-4 text-[#B88E3E]" />
            Найдовговічніший предок
          </span>
          {stats.longestLived ? (
            <div>
              <div className="text-2xl font-extrabold text-[#B88E3E] font-mono">
                {stats.longestLived.age} років
              </div>
              <div
                onClick={() => onSelectPerson(stats.longestLived!.person.id)}
                className="text-xs text-slate-300 hover:text-white cursor-pointer hover:underline truncate mt-1"
              >
                {stats.longestLived.person.firstName} {stats.longestLived.person.lastName}
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500 pt-2">Недостатньо дат</div>
          )}
        </div>
      </div>

      {/* Top Surnames */}
      <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-4">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 uppercase tracking-wider">
          <PieChart className="w-4 h-4 text-[#B88E3E]" />
          <span>Найпоширеніші прізвища родоводу</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.topSurnames.map(([surname, count]) => (
            <div
              key={surname}
              className="p-3 rounded-xl bg-slate-900/80 border border-slate-700/60 flex items-center justify-between"
            >
              <span className="font-semibold text-sm text-slate-200 truncate">{surname}</span>
              <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-[#B88E3E]/20 text-[#B88E3E] font-bold">
                {count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
