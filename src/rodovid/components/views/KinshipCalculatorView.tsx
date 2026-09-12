import React, { useState, useMemo } from 'react';
import {
  Compass,
  ArrowRight,
  ArrowLeftRight,
  User,
  GitCommit,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  Shield,
  Lock,
  Network,
  ListOrdered,
  Dna,
  Crown,
  Layers,
  ChevronRight
} from 'lucide-react';
import { GenealogyDatabase, Person } from '../../types/genealogy';
import { calculateKinship, getFullName, sortPersonsBySurnameAndBirthDesc } from '../../utils/relationship';
import { useUIStore } from '../../../stores/useUIStore';
import { useAuthStore } from '../../../stores/useAuthStore';
import { getPrivacySafePerson, isPersonLiving, isUserWhitelisted } from '../../utils/privacy';
import { getThemeConfig } from '../../../utils/theme';
import { VisualKinshipPath } from './VisualKinshipPath';

interface KinshipCalculatorViewProps {
  database: GenealogyDatabase;
  initialPersonAId?: string;
  onSelectPerson: (id: string) => void;
}

export const KinshipCalculatorView: React.FC<KinshipCalculatorViewProps> = ({
  database,
  initialPersonAId,
  onSelectPerson
}) => {
  const themePalette = useUIStore((s) => s.themePalette);
  const theme = getThemeConfig(themePalette);
  const isDark = theme.category === 'dark';

  const currentUser = useAuthStore((s) => s.currentUser);
  const whitelist = useAuthStore((s) => s.whitelist);
  const isWhitelisted = useMemo(() => isUserWhitelisted(currentUser, whitelist), [currentUser, whitelist]);

  const dropdownPersons = useMemo(() => {
    const rawList = Object.values(database.persons || {}) as Person[];
    if (isWhitelisted) {
      return sortPersonsBySurnameAndBirthDesc(rawList);
    }
    const safeList = rawList.map((p) => getPrivacySafePerson(p, false));
    return sortPersonsBySurnameAndBirthDesc(safeList);
  }, [database.persons, isWhitelisted]);

  const [personAId, setPersonAId] = useState<string>(initialPersonAId || dropdownPersons[0]?.id || '');
  const [personBId, setPersonBId] = useState<string>(dropdownPersons[1]?.id || dropdownPersons[0]?.id || '');
  const [activeTab, setActiveTab] = useState<'visual' | 'steps' | 'dna'>('visual');

  const handleSwapPersons = () => {
    setPersonAId(personBId);
    setPersonBId(personAId);
  };

  const result = useMemo(() => {
    return calculateKinship(database, personAId, personBId);
  }, [database, personAId, personBId]);

  return (
    <div className={`max-w-5xl mx-auto px-4 py-6 space-y-6 ${theme.textPrimary}`}>
      {/* Header */}
      <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-xl p-5 shadow-xs`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg ${isDark ? 'bg-emerald-600/20 border-emerald-500/30 text-emerald-400' : 'bg-emerald-100 border-emerald-300 text-emerald-700'} border flex items-center justify-center`}>
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className={`text-xl font-bold tracking-tight ${theme.textPrimary}`}>
              Калькулятор спорідненості та ступенів близькості
            </h1>
            <p className={`text-xs ${theme.textMuted} mt-0.5`}>
              Точний розрахунок генеалогічного зв'язку, спільних предків, відстані поколінь та візуальна схема
            </p>
          </div>
        </div>

        {/* Person Selectors with Swap */}
        <div className={`grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-end gap-3 mt-5 pt-4 border-t ${theme.borderSubtle}`}>
          <div>
            <label className={`block text-xs font-semibold ${theme.textSecondary} mb-1.5`}>
              Перша особа (А) — Відправна точка:
            </label>
            <select
              value={personAId}
              onChange={(e) => setPersonAId(e.target.value)}
              className={`w-full px-3 py-2 ${theme.inputBg} border ${theme.inputBorder} rounded-lg text-xs ${theme.textPrimary} focus:outline-none focus:border-emerald-500 cursor-pointer`}
            >
              {dropdownPersons.map((p) => {
                const isLiving = isPersonLiving(database.persons[p.id]);
                const isMasked = !isWhitelisted && isLiving;
                return (
                  <option key={p.id} value={p.id}>
                    {isMasked ? '🔒 Скрито (Жива особа)' : `${getFullName(p)}${p.birthYear ? ` (${p.birthYear})` : ''}`}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex justify-center pb-0.5">
            <button
              type="button"
              onClick={handleSwapPersons}
              title="Поміняти місцями (А ⇄ Б)"
              className={`p-2 rounded-lg border ${theme.cardBorder} ${theme.surfaceBg} hover:border-emerald-500 hover:text-emerald-500 transition-colors ${theme.textPrimary}`}
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className={`block text-xs font-semibold ${theme.textSecondary} mb-1.5`}>
              Друга особа (Б) — Шукана особа:
            </label>
            <select
              value={personBId}
              onChange={(e) => setPersonBId(e.target.value)}
              className={`w-full px-3 py-2 ${theme.inputBg} border ${theme.inputBorder} rounded-lg text-xs ${theme.textPrimary} focus:outline-none focus:border-emerald-500 cursor-pointer`}
            >
              {dropdownPersons.map((p) => {
                const isLiving = isPersonLiving(database.persons[p.id]);
                const isMasked = !isWhitelisted && isLiving;
                return (
                  <option key={p.id} value={p.id}>
                    {isMasked ? '🔒 Скрито (Жива особа)' : `${getFullName(p)}${p.birthYear ? ` (${p.birthYear})` : ''}`}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Result Card */}
      {personAId === personBId ? (
        <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-xl p-8 text-center ${theme.textMuted} text-xs`}>
          Виберіть двох різних людей для розрахунку родинного зв'язку.
        </div>
      ) : !result || result.path.length === 0 ? (
        <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-xl p-8 text-center space-y-2`}>
          <HelpCircle className={`w-10 h-10 ${theme.textMuted} mx-auto`} />
          <h3 className={`text-sm font-semibold ${theme.textPrimary}`}>
            Прямий родинний ланцюжок не знайдено
          </h3>
          <p className={`text-xs ${theme.textMuted} max-w-md mx-auto`}>
            Ці дві особи знаходяться у різних непов'язаних гілках або ще не зв'язані сімейним
            союзом у базі даних.
          </p>
        </div>
      ) : (
        <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-xl p-6 shadow-xs space-y-6`}>
          {/* Main Title of Kinship */}
          <div className={`${theme.surfaceBg} p-5 rounded-xl border ${isDark ? 'border-emerald-500/30' : 'border-emerald-300'} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
            <div>
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                Визначений ступінь спорідненості
              </span>
              <h2 className={`text-2xl font-bold ${theme.textPrimary} mt-0.5 flex items-center gap-2 flex-wrap`}>
                <span>{result.relationshipName}</span>
                {result.coefficient > 0 && (
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${isDark ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'}`}>
                    ≈ {result.coefficient}% спільних генів
                  </span>
                )}
              </h2>
              <p className={`text-xs ${theme.textMuted} mt-1`}>
                Ким є {!isWhitelisted && isPersonLiving(result.personB) ? '🔒 Скрито (Жива особа)' : getFullName(result.personB)} по відношенню до{' '}
                {!isWhitelisted && isPersonLiving(result.personA) ? '🔒 Скрито (Жива особа)' : getFullName(result.personA)}
              </p>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right">
                <span className={`text-[10px] ${theme.textMuted} uppercase font-mono block`}>
                  Довжина шляху
                </span>
                <span className={`text-lg font-bold font-mono ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                  {result.degree} {result.degree === 1 ? 'крок' : result.degree < 5 ? 'кроки' : 'кроків'}
                </span>
              </div>
            </div>
          </div>

          {/* View Mode Tabs */}
          <div className="flex items-center border-b border-neutral-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setActiveTab('visual')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'visual'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              <Network className="w-4 h-4" />
              <span>Візуальна схема родоводу</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('steps')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'steps'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              <ListOrdered className="w-4 h-4" />
              <span>Покроковий ланцюжок ({result.path.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('dna')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'dna'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              <Dna className="w-4 h-4" />
              <span>Генетичний аналіз</span>
            </button>
          </div>

          {/* TAB 1: Visual Kinship Path Diagram */}
          {activeTab === 'visual' && (
            <VisualKinshipPath
              database={database}
              result={result}
              isWhitelisted={isWhitelisted}
              theme={theme}
              isDark={isDark}
              onSelectPerson={onSelectPerson}
              onSetPersonA={(id) => setPersonAId(id)}
              onSetPersonB={(id) => setPersonBId(id)}
              onSwapPersons={handleSwapPersons}
            />
          )}

          {/* TAB 2: Step-by-Step Path */}
          {activeTab === 'steps' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold ${theme.textSecondary}`}>
                  Повний покроковий маршрут між особами ({result.path.length} осіб):
                </span>
                <span className={`text-xs font-mono ${theme.textMuted}`}>
                  {result.description}
                </span>
              </div>

              <div className="space-y-2.5 relative">
                {result.path.map((step, idx) => {
                  const rawPerson = database.persons[step.personId];
                  if (!rawPerson) return null;
                  const isLiving = isPersonLiving(rawPerson);
                  const isMasked = !isWhitelisted && isLiving;
                  const person = isMasked ? getPrivacySafePerson(rawPerson, false) : rawPerson;

                  const isStart = idx === 0;
                  const isEnd = idx === result.path.length - 1;
                  const isApex = Boolean(step.isCommonAncestor);

                  return (
                    <div key={idx} className="flex items-center gap-3">
                      <div
                        onClick={() => onSelectPerson(person.id)}
                        className={`flex-1 p-3 rounded-lg border cursor-pointer transition-colors flex items-center justify-between text-xs ${
                          isStart || isEnd
                            ? `${theme.surfaceBg} border-emerald-500 shadow-xs`
                            : isApex
                            ? `${theme.surfaceBg} border-amber-400 shadow-xs`
                            : `${theme.surfaceBg} ${theme.borderSubtle} hover:border-neutral-400`
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold font-mono ${
                              isStart || isEnd
                                ? 'bg-emerald-600 text-white'
                                : isApex
                                ? 'bg-amber-500 text-slate-950'
                                : isDark
                                ? 'bg-slate-800 text-slate-400'
                                : 'bg-neutral-200 text-neutral-700'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div>
                            <div className={`font-semibold flex items-center gap-1.5 ${theme.textPrimary}`}>
                              <span>{isMasked ? '🔒 Скрито (Жива особа)' : getFullName(person)}</span>
                              {isApex && (
                                <span className="text-[10px] bg-amber-500 text-slate-950 font-bold px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                                  <Crown className="w-2.5 h-2.5" /> Предок
                                </span>
                              )}
                            </div>
                            <div className={`text-[10px] ${theme.textMuted} font-mono`}>
                              {isMasked
                                ? '🔒 Конфіденційно'
                                : `${person.birthYear || '?'} — ${person.isLiving ? 'живий' : person.deathYear || '?'}`}
                            </div>
                          </div>
                        </div>

                        <div className="text-right flex items-center gap-2">
                          <span className={`px-2.5 py-1 ${
                            isStart
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : isEnd
                              ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                              : isApex
                              ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                              : isDark
                              ? 'bg-slate-800 text-slate-300'
                              : 'bg-neutral-100 text-neutral-800'
                          } font-medium rounded text-[11px]`}>
                            {step.relationFromPrevious}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: Genetic Analysis */}
          {activeTab === 'dna' && (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl border ${theme.cardBorder} ${theme.surfaceBg} space-y-4`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg ${isDark ? 'bg-emerald-950/60 text-emerald-400' : 'bg-emerald-100 text-emerald-700'} flex items-center justify-center`}>
                    <Dna className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold ${theme.textPrimary}`}>
                      Коефіцієнт генетичної спорідненості
                    </h3>
                    <p className={`text-xs ${theme.textMuted}`}>
                      Теоретична частка спільних алелей та генів між особами згідно з законами Менделя
                    </p>
                  </div>
                </div>

                {/* Visual DNA Bar */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className={theme.textPrimary}>Розрахунковий спільний геном:</span>
                    <span className={isDark ? 'text-emerald-400' : 'text-emerald-700'}>
                      ≈ {result.coefficient}%
                    </span>
                  </div>
                  <div className="w-full h-3 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden p-0.5">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(2, result.coefficient))}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-neutral-400 pt-1">
                    <span>0% (Чужі / Свояцтво)</span>
                    <span>12.5% (Кузени/Правнуки)</span>
                    <span>25% (Дідусі/Дядьки)</span>
                    <span>50% (Батьки/Брати)</span>
                    <span>100% (Близнюк)</span>
                  </div>
                </div>

                <div className={`p-3 rounded-lg border ${theme.borderSubtle} text-xs leading-relaxed ${theme.textSecondary}`}>
                  <p>
                    <strong>Аналітичний підсумок:</strong> {result.description}
                  </p>
                  {result.coefficient > 0 ? (
                    <p className="mt-1">
                      Особи мають спільне біологічне походження. З імовірністю ~{result.coefficient}% будь-який випадковий ген є спільним за походженням (identical by descent).
                    </p>
                  ) : (
                    <p className="mt-1">
                      Зв'язок утворений через шлюб (свояцтво). Біологічної спорідненості (спільної ДНК) у прямому родоводі немає.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Common Ancestors Section */}
          {result.commonAncestors.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-dashed border-neutral-200 dark:border-neutral-800">
              <span className={`text-xs font-semibold ${theme.textSecondary} flex items-center gap-1.5`}>
                <Crown className="w-3.5 h-3.5 text-amber-500" />
                Найближчий спільний предок (вершина гілки):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {result.commonAncestors.map((rawAnc) => {
                  const isLiving = isPersonLiving(rawAnc);
                  const isMasked = !isWhitelisted && isLiving;
                  const anc = isMasked ? getPrivacySafePerson(rawAnc, false) : rawAnc;

                  return (
                    <div
                      key={anc.id}
                      onClick={() => onSelectPerson(anc.id)}
                      className={`flex items-center gap-3 p-3 ${theme.surfaceBg} border ${theme.borderSubtle} rounded-lg hover:border-amber-500 cursor-pointer text-xs transition-colors`}
                    >
                      <div className={`w-8 h-8 rounded ${isDark ? 'bg-amber-950/60 text-amber-300' : 'bg-amber-100 text-amber-800'} flex items-center justify-center shrink-0`}>
                        {isMasked ? <Lock className="w-4 h-4 text-emerald-400" /> : <Crown className="w-4 h-4" />}
                      </div>
                      <div>
                        <h4 className={`font-semibold ${theme.textPrimary}`}>
                          {isMasked ? '🔒 Скрито (Жива особа)' : getFullName(anc)}
                        </h4>
                        <p className={`text-[10px] ${theme.textMuted} font-mono`}>
                          {isMasked ? '🔒 Конфіденційно' : `${anc.birthYear || '?'} — ${anc.deathYear || '?'}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

