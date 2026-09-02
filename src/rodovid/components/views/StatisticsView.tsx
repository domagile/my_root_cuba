/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { BarChart3, Users, Heart, Calendar, Trophy, PieChart } from 'lucide-react';
import { GenealogyDatabase, Person, Family } from '../../types/genealogy';
import { useUIStore } from '../../../stores/useUIStore';
import { getThemeConfig } from '../../../utils/theme';
import { normalizeUkrainianSurnameGender } from '../../../utils/ukrainianPhonetics';
import { isPersonMale, isPersonFemale } from '../../utils/genderUtils';

interface StatisticsViewProps {
  database: GenealogyDatabase;
  onSelectPerson: (id: string) => void;
}

export const StatisticsView: React.FC<StatisticsViewProps> = ({ database, onSelectPerson }) => {
  const themePalette = useUIStore((s) => s.themePalette);
  const theme = getThemeConfig(themePalette);
  const isDark = theme.category === 'dark';

  const persons = useMemo(() => {
    return Object.values(database.persons || {}) as Person[];
  }, [database]);

  const families = useMemo(() => {
    return Object.values(database.families || {}) as Family[];
  }, [database]);

  const stats = useMemo(() => {
    const totalPersons = persons.length;
    const males = persons.filter((p) => isPersonMale(p, database)).length;
    const females = persons.filter((p) => isPersonFemale(p, database)).length;

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

    // Surnames distribution with gender normalization (e.g. Шевченко, Ковальський/Ковальська -> Ковальський)
    const surnameMap: Record<string, number> = {};
    persons.forEach((p) => {
      const rawSurname = p.lastName?.trim();
      if (rawSurname) {
        const canonicalSurname = normalizeUkrainianSurnameGender(rawSurname);
        surnameMap[canonicalSurname] = (surnameMap[canonicalSurname] || 0) + 1;
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
    <div className={`max-w-7xl mx-auto px-4 py-6 space-y-6 ${theme.textPrimary}`}>
      <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-xl p-4 shadow-xs flex items-center gap-3`}>
        <div className={`w-10 h-10 rounded-xl ${isDark ? 'bg-amber-950/40 text-amber-400 border border-amber-800/60' : 'bg-amber-100 text-amber-800 border border-amber-300'} flex items-center justify-center`}>
          <BarChart3 className="w-5 h-5" />
        </div>
        <div>
          <h2 className={`text-xl font-bold ${theme.textPrimary}`}>Генеалогічна Статистика</h2>
          <p className={`text-xs ${theme.textMuted}`}>Демографічний та поколінний аналіз родинної бази</p>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-2 shadow-xs`}>
          <span className={`text-xs ${theme.textMuted} flex items-center gap-1.5 font-medium`}>
            <Users className="w-4 h-4 text-sky-500" />
            Всього персон у дереві
          </span>
          <div className={`text-3xl font-extrabold ${theme.textPrimary} font-mono`}>{stats.totalPersons}</div>
          <div className={`text-xs ${theme.textMuted} flex gap-3 pt-1`}>
            <span>Чол: <strong className="text-sky-500">{stats.males}</strong></span>
            <span>Жін: <strong className="text-rose-500">{stats.females}</strong></span>
          </div>
        </div>

        <div className={`p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-2 shadow-xs`}>
          <span className={`text-xs ${theme.textMuted} flex items-center gap-1.5 font-medium`}>
            <Heart className="w-4 h-4 text-rose-500" />
            Кількість шлюбів / сімей
          </span>
          <div className={`text-3xl font-extrabold ${theme.textPrimary} font-mono`}>{stats.totalFamilies}</div>
          <div className={`text-xs ${theme.textMuted} pt-1`}>Зафіксованих родинних союзів</div>
        </div>

        <div className={`p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-2 shadow-xs`}>
          <span className={`text-xs ${theme.textMuted} flex items-center gap-1.5 font-medium`}>
            <Calendar className="w-4 h-4 text-amber-500" />
            Середня тривалість життя
          </span>
          <div className="text-3xl font-extrabold text-amber-500 font-mono">
            {stats.averageLifespan > 0 ? `${stats.averageLifespan} р.` : '—'}
          </div>
          <div className={`text-xs ${theme.textMuted} pt-1`}>За даними метричних записів</div>
        </div>

        <div className={`p-5 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-2 shadow-xs`}>
          <span className={`text-xs ${theme.textMuted} flex items-center gap-1.5 font-medium`}>
            <Trophy className="w-4 h-4 text-amber-500" />
            Найдовговічніший предок
          </span>
          {stats.longestLived ? (
            <div>
              <div className="text-2xl font-extrabold text-amber-500 font-mono">
                {stats.longestLived.age} років
              </div>
              <div
                onClick={() => onSelectPerson(stats.longestLived!.person.id)}
                className={`text-xs ${theme.textSecondary} hover:text-amber-500 cursor-pointer hover:underline truncate mt-1`}
              >
                {stats.longestLived.person.firstName} {stats.longestLived.person.lastName}
              </div>
            </div>
          ) : (
            <div className={`text-xs ${theme.textMuted} pt-2`}>Недостатньо дат</div>
          )}
        </div>
      </div>

      {/* Top Surnames */}
      <div className={`p-6 rounded-xl ${theme.cardBg} border ${theme.cardBorder} space-y-4 shadow-xs`}>
        <h3 className={`text-xs font-bold ${theme.textSecondary} flex items-center gap-2 uppercase tracking-wider`}>
          <PieChart className="w-4 h-4 text-amber-500" />
          <span>Найпоширеніші прізвища родоводу</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.topSurnames.map(([surname, count]) => (
            <div
              key={surname}
              className={`p-3 rounded-xl ${theme.surfaceBg} border ${theme.borderSubtle} flex items-center justify-between`}
            >
              <span className={`font-semibold text-xs ${theme.textPrimary} truncate`}>{surname}</span>
              <span className={`font-mono text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-amber-950/60 text-amber-400' : 'bg-amber-100 text-amber-800'} font-bold`}>
                {count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
