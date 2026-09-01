import React, { useState, useMemo } from 'react';
import {
  Compass,
  ArrowRight,
  User,
  GitCommit,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  Shield,
  Lock
} from 'lucide-react';
import { GenealogyDatabase, Person } from '../../types/genealogy';
import { calculateKinship, getFullName, sortPersonsBySurnameAndBirthDesc } from '../../utils/relationship';
import { useUIStore } from '../../../stores/useUIStore';
import { useAuthStore } from '../../../stores/useAuthStore';
import { getPrivacySafePerson, isPersonLiving, isUserWhitelisted } from '../../utils/privacy';
import { getThemeConfig } from '../../../utils/theme';

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

  const result = useMemo(() => {
    return calculateKinship(database, personAId, personBId);
  }, [database, personAId, personBId]);

  return (
    <div className={`max-w-4xl mx-auto px-4 py-6 space-y-6 ${theme.textPrimary}`}>
      {/* Header */}
      <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-xl p-4 shadow-xs`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg ${isDark ? 'bg-emerald-600/20 border-emerald-500/30 text-emerald-400' : 'bg-emerald-100 border-emerald-300 text-emerald-700'} border flex items-center justify-center`}>
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className={`text-xl font-bold tracking-tight ${theme.textPrimary}`}>
              Калькулятор спорідненості та ступенів близькості
            </h1>
            <p className={`text-xs ${theme.textMuted} mt-0.5`}>
              Точний розрахунок генеалогічного зв'язку, спільного предка та термінів спорідненості
            </p>
          </div>
        </div>

        {/* Person Selectors */}
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 pt-4 border-t ${theme.borderSubtle}`}>
          <div>
            <label className={`block text-xs font-semibold ${theme.textSecondary} mb-1.5`}>
              Перша особа (А):
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

          <div>
            <label className={`block text-xs font-semibold ${theme.textSecondary} mb-1.5`}>
              Друга особа (Б):
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
      ) : !result ? (
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
              <h2 className={`text-2xl font-bold ${theme.textPrimary} mt-0.5`}>
                {result.relationshipName}
              </h2>
              <p className={`text-xs ${theme.textMuted} mt-1`}>
                Ким є {!isWhitelisted && isPersonLiving(result.personB) ? '🔒 Скрито (Жива особа)' : getFullName(result.personB)} по відношенню до{' '}
                {!isWhitelisted && isPersonLiving(result.personA) ? '🔒 Скрито (Жива особа)' : getFullName(result.personA)}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <span className={`text-[10px] ${theme.textMuted} uppercase font-mono block`}>
                  Довжина шляху
                </span>
                <span className={`text-lg font-bold font-mono ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                  {result.degreeOfConsanguinity} кроків
                </span>
              </div>
            </div>
          </div>

          {/* Common Ancestors */}
          {result.commonAncestors.length > 0 && (
            <div className="space-y-2">
              <span className={`text-xs font-semibold ${theme.textSecondary} flex items-center gap-1.5`}>
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Найближчий спільний предок:
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
                      className={`flex items-center gap-3 p-3 ${theme.surfaceBg} border ${theme.borderSubtle} rounded-lg hover:border-emerald-600 cursor-pointer text-xs transition-colors`}
                    >
                      <div className={`w-8 h-8 rounded ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-neutral-200 text-neutral-700'} flex items-center justify-center shrink-0`}>
                        {isMasked ? <Lock className="w-4 h-4 text-emerald-400" /> : <User className="w-4 h-4" />}
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

          {/* Step-by-Step Path */}
          <div className="space-y-3">
            <span className={`text-xs font-semibold ${theme.textSecondary}`}>
              Покроковий ланцюжок спорідненості ({result.path.length} осіб):
            </span>

            <div className="space-y-2 relative">
              {result.path.map((step, idx) => {
                const rawPerson = database.persons[step.personId];
                if (!rawPerson) return null;
                const isLiving = isPersonLiving(rawPerson);
                const isMasked = !isWhitelisted && isLiving;
                const person = isMasked ? getPrivacySafePerson(rawPerson, false) : rawPerson;

                const isStart = idx === 0;
                const isEnd = idx === result.path.length - 1;

                return (
                  <div key={idx} className="flex items-center gap-3">
                    <div
                      onClick={() => onSelectPerson(person.id)}
                      className={`flex-1 p-3 rounded-lg border cursor-pointer transition-colors flex items-center justify-between text-xs ${
                        isStart || isEnd
                          ? `${theme.surfaceBg} border-emerald-500 shadow-xs`
                          : `${theme.surfaceBg} ${theme.borderSubtle} hover:border-neutral-400`
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold font-mono ${
                            isStart || isEnd
                              ? 'bg-emerald-600 text-white'
                              : isDark
                              ? 'bg-slate-800 text-slate-400'
                              : 'bg-neutral-200 text-neutral-700'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div>
                          <div className={`font-semibold ${theme.textPrimary}`}>
                            {isMasked ? '🔒 Скрито (Жива особа)' : getFullName(person)}
                          </div>
                          <div className={`text-[10px] ${theme.textMuted} font-mono`}>
                            {isMasked
                              ? '🔒 Конфіденційно'
                              : `${person.birthYear || '?'} — ${person.isLiving ? 'живий' : person.deathYear || '?'}`}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`px-2 py-0.5 ${isDark ? 'bg-slate-800 text-emerald-400' : 'bg-emerald-100 text-emerald-800'} font-medium rounded text-[11px]`}>
                          {step.relationFromPrevious}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
