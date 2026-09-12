import React, { useState } from 'react';
import {
  User,
  Crown,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Heart,
  GitCommit,
  Lock,
  ExternalLink,
  RotateCcw,
  Sparkles,
  Dna,
  Share2,
  Copy,
  Check,
  ChevronDown,
  Layers,
  ArrowLeftRight
} from 'lucide-react';
import { Person, GenealogyDatabase } from '../../types/genealogy';
import { KinshipCalculationResult, KinshipPathStep, getFullName } from '../../utils/relationship';
import { isPersonLiving, getPrivacySafePerson } from '../../utils/privacy';
import { ThemeConfig } from '../../../utils/theme';

interface VisualKinshipPathProps {
  database: GenealogyDatabase;
  result: KinshipCalculationResult;
  isWhitelisted: boolean;
  theme: ThemeConfig;
  isDark: boolean;
  onSelectPerson: (id: string) => void;
  onSetPersonA?: (id: string) => void;
  onSetPersonB?: (id: string) => void;
  onSwapPersons?: () => void;
}

export const VisualKinshipPath: React.FC<VisualKinshipPathProps> = ({
  database,
  result,
  isWhitelisted,
  theme,
  isDark,
  onSelectPerson,
  onSetPersonA,
  onSetPersonB,
  onSwapPersons
}) => {
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [copied, setCopied] = useState(false);
  const [hoveredStepIndex, setHoveredStepIndex] = useState<number | null>(null);

  const path = result.path || [];

  const handleCopyPathText = () => {
    if (!path.length) return;
    const lines = path.map((step, idx) => {
      const raw = database.persons[step.personId];
      const isLiving = isPersonLiving(raw);
      const isMasked = !isWhitelisted && isLiving;
      const p = isMasked ? getPrivacySafePerson(raw, false) : raw;
      const name = isMasked ? 'Скрито (Жива особа)' : getFullName(p);
      const years = isMasked ? '' : ` (${p.birthYear || '?'} — ${p.isLiving ? 'живий' : p.deathYear || '?'})`;
      const relation = idx === 0 ? 'Початок' : `→ ${step.relationFromPrevious}`;
      return `${idx + 1}. [${relation}] ${name}${years}`;
    });

    const header = `Родинний зв'язок: ${result.relationshipName}\n` +
      `Від: ${getFullName(result.personA)} до: ${getFullName(result.personB)}\n` +
      `Ступінь: ${result.degree} кроків | Спільні гени (ДНК): ≈ ${result.coefficient}%\n\nЛанцюжок:\n`;

    navigator.clipboard.writeText(header + lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const getStepIcon = (dir?: string, isApex?: boolean) => {
    if (isApex) return <Crown className="w-3.5 h-3.5 text-amber-400" />;
    switch (dir) {
      case 'up':
        return <ArrowUp className="w-3.5 h-3.5 text-sky-400" />;
      case 'down':
        return <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />;
      case 'spouse':
        return <Heart className="w-3.5 h-3.5 text-rose-400" />;
      case 'sibling':
        return <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-400" />;
      default:
        return <GitCommit className="w-3.5 h-3.5 text-emerald-400" />;
    }
  };

  const getGenerationLabel = (offset?: number) => {
    if (offset === undefined || offset === 0) return 'Покоління А (0)';
    if (offset > 0) return `+${offset} (висхідне)`;
    return `${offset} (низхідне)`;
  };

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${theme.textSecondary}`}>
            Візуалізація родовідного шляху:
          </span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${isDark ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
            {path.length} {path.length === 1 ? 'особа' : path.length < 5 ? 'особи' : 'осіб'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Orientation switch */}
          <div className={`inline-flex p-0.5 rounded-lg border ${theme.cardBorder} ${theme.surfaceBg}`}>
            <button
              type="button"
              onClick={() => setOrientation('horizontal')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                orientation === 'horizontal'
                  ? isDark
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-600 text-white shadow-xs'
                  : `${theme.textMuted} hover:${theme.textPrimary}`
              }`}
              title="Горизонтальний потік зв'язку"
            >
              Горизонтально
            </button>
            <button
              type="button"
              onClick={() => setOrientation('vertical')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                orientation === 'vertical'
                  ? isDark
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-600 text-white shadow-xs'
                  : `${theme.textMuted} hover:${theme.textPrimary}`
              }`}
              title="Вертикальне дерево"
            >
              Вертикально
            </button>
          </div>

          {/* Copy button */}
          <button
            type="button"
            onClick={handleCopyPathText}
            className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg border ${theme.cardBorder} ${theme.surfaceBg} hover:border-emerald-500 transition-colors ${theme.textPrimary}`}
            title="Скопіювати текстовий ланцюжок"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-500 font-medium">Скопійовано!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Скопіювати</span>
              </>
            )}
          </button>

          {onSwapPersons && (
            <button
              type="button"
              onClick={onSwapPersons}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg border ${theme.cardBorder} ${theme.surfaceBg} hover:border-emerald-500 transition-colors ${theme.textPrimary}`}
              title="Поміняти місцями особу А та особу Б"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">А ⇄ Б</span>
            </button>
          )}
        </div>
      </div>

      {/* HORIZONTAL FLOW */}
      {orientation === 'horizontal' ? (
        <div className={`p-4 rounded-xl border ${theme.cardBorder} ${theme.surfaceBg} overflow-x-auto shadow-inner`}>
          <div className="flex items-center min-w-max py-6 px-2 gap-0">
            {path.map((step, idx) => {
              const rawPerson = database.persons[step.personId];
              if (!rawPerson) return null;

              const isLiving = isPersonLiving(rawPerson);
              const isMasked = !isWhitelisted && isLiving;
              const person = isMasked ? getPrivacySafePerson(rawPerson, false) : rawPerson;

              const isStart = idx === 0;
              const isEnd = idx === path.length - 1;
              const isApex = Boolean(step.isCommonAncestor);
              const isFemale = person.gender === 'female' || person.gender === 'F';
              const isMale = person.gender === 'male' || person.gender === 'M';

              const isHovered = hoveredStepIndex === idx;

              return (
                <React.Fragment key={step.personId + idx}>
                  {/* Connector before this node (if not the first node) */}
                  {idx > 0 && (
                    <div className="flex flex-col items-center justify-center px-1.5 -mx-1 z-10 select-none">
                      {/* Badge on the connector line */}
                      <div
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border shadow-xs transition-all ${
                          isApex
                            ? isDark
                              ? 'bg-amber-950/80 border-amber-500/50 text-amber-300'
                              : 'bg-amber-50 border-amber-300 text-amber-900'
                            : isDark
                            ? 'bg-slate-900/90 border-slate-700 text-slate-200'
                            : 'bg-white border-neutral-300 text-neutral-800'
                        }`}
                        title={`${step.relationFromPrevious || ''}`}
                      >
                        {getStepIcon(step.direction, isApex)}
                        <span className="whitespace-nowrap">{step.relationFromPrevious}</span>
                      </div>

                      {/* SVG Line / Arrow */}
                      <div className="w-16 h-3 flex items-center justify-center relative">
                        <div
                          className={`w-full h-0.5 ${
                            isApex
                              ? 'bg-amber-400'
                              : isDark
                              ? 'bg-emerald-500/50'
                              : 'bg-emerald-400'
                          }`}
                        />
                        <div
                          className={`absolute right-0 w-1.5 h-1.5 border-t-2 border-r-2 transform rotate-45 ${
                            isApex
                              ? 'border-amber-400'
                              : isDark
                              ? 'border-emerald-400'
                              : 'border-emerald-500'
                          }`}
                        />
                      </div>
                    </div>
                  )}

                  {/* Node Card */}
                  <div
                    onMouseEnter={() => setHoveredStepIndex(idx)}
                    onMouseLeave={() => setHoveredStepIndex(null)}
                    onClick={() => onSelectPerson(person.id)}
                    className={`relative group w-52 p-3.5 rounded-xl border-2 cursor-pointer transition-all duration-200 shrink-0 select-none ${
                      isStart
                        ? isDark
                          ? 'bg-emerald-950/40 border-emerald-500 shadow-md shadow-emerald-950/40'
                          : 'bg-emerald-50/70 border-emerald-500 shadow-md shadow-emerald-100'
                        : isEnd
                        ? isDark
                          ? 'bg-indigo-950/40 border-indigo-400 shadow-md shadow-indigo-950/40'
                          : 'bg-indigo-50/70 border-indigo-500 shadow-md shadow-indigo-100'
                        : isApex
                        ? isDark
                          ? 'bg-amber-950/40 border-amber-400 shadow-md shadow-amber-950/40'
                          : 'bg-amber-50/70 border-amber-500 shadow-md shadow-amber-100'
                        : isDark
                        ? 'bg-slate-900/90 border-slate-700/80 hover:border-emerald-400 shadow-xs'
                        : 'bg-white border-neutral-200 hover:border-emerald-400 shadow-xs'
                    } ${isHovered ? 'scale-[1.02]' : ''}`}
                  >
                    {/* Top status tag */}
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          isStart
                            ? 'bg-emerald-600 text-white'
                            : isEnd
                            ? 'bg-indigo-600 text-white'
                            : isApex
                            ? 'bg-amber-500 text-slate-950 font-extrabold flex items-center gap-1'
                            : isDark
                            ? 'bg-slate-800 text-slate-300'
                            : 'bg-neutral-100 text-neutral-600'
                        }`}
                      >
                        {isStart ? (
                          'Особа А (Початок)'
                        ) : isEnd ? (
                          'Особа Б (Ціль)'
                        ) : isApex ? (
                          <>
                            <Crown className="w-2.5 h-2.5" /> Спільний предок
                          </>
                        ) : (
                          getGenerationLabel(step.generationOffset)
                        )}
                      </span>

                      {step.generationOffset !== undefined && !isStart && !isEnd && (
                        <span className={`text-[10px] font-mono ${theme.textMuted}`}>
                          G {step.generationOffset >= 0 ? `+${step.generationOffset}` : step.generationOffset}
                        </span>
                      )}
                    </div>

                    {/* Person main info */}
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border ${
                          isStart
                            ? 'bg-emerald-600 text-white border-emerald-400'
                            : isEnd
                            ? 'bg-indigo-600 text-white border-indigo-400'
                            : isApex
                            ? 'bg-amber-500 text-slate-950 border-amber-300'
                            : isFemale
                            ? isDark
                              ? 'bg-rose-950/60 text-rose-300 border-rose-800/40'
                              : 'bg-rose-100 text-rose-700 border-rose-300'
                            : isMale
                            ? isDark
                              ? 'bg-sky-950/60 text-sky-300 border-sky-800/40'
                              : 'bg-sky-100 text-sky-700 border-sky-300'
                            : isDark
                            ? 'bg-slate-800 text-slate-300 border-slate-700'
                            : 'bg-neutral-200 text-neutral-700 border-neutral-300'
                        }`}
                      >
                        {isMasked ? (
                          <Lock className="w-4 h-4" />
                        ) : isApex ? (
                          <Crown className="w-4 h-4" />
                        ) : (
                          <User className="w-4 h-4" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4
                          className={`text-xs font-bold leading-snug truncate ${theme.textPrimary}`}
                          title={isMasked ? 'Конфіденційно' : getFullName(person)}
                        >
                          {isMasked ? '🔒 Скрито' : getFullName(person)}
                        </h4>
                        <p className={`text-[10px] ${theme.textMuted} font-mono mt-0.5 truncate`}>
                          {isMasked
                            ? 'Жива особа'
                            : `${person.birthYear || '?'} — ${person.isLiving ? 'живий' : person.deathYear || '?'}`}
                        </p>
                      </div>
                    </div>

                    {/* Bottom relation badge / quick hint */}
                    <div className="mt-2.5 pt-2 border-t border-dashed border-neutral-200 dark:border-neutral-800/80 flex items-center justify-between text-[10px]">
                      <span className={`${theme.textMuted} truncate`}>
                        {isStart
                          ? 'Вихідна точка'
                          : isEnd
                          ? result.relationshipName
                          : step.relationFromPrevious || 'Родич'}
                      </span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 group-hover:underline flex items-center gap-0.5">
                        Картка <ExternalLink className="w-2.5 h-2.5" />
                      </span>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      ) : (
        /* VERTICAL TREE FLOW */
        <div className={`p-4 rounded-xl border ${theme.cardBorder} ${theme.surfaceBg} shadow-inner`}>
          <div className="space-y-0 relative py-2 pl-4">
            {path.map((step, idx) => {
              const rawPerson = database.persons[step.personId];
              if (!rawPerson) return null;

              const isLiving = isPersonLiving(rawPerson);
              const isMasked = !isWhitelisted && isLiving;
              const person = isMasked ? getPrivacySafePerson(rawPerson, false) : rawPerson;

              const isStart = idx === 0;
              const isEnd = idx === path.length - 1;
              const isApex = Boolean(step.isCommonAncestor);
              const isFemale = person.gender === 'female' || person.gender === 'F';
              const isMale = person.gender === 'male' || person.gender === 'M';

              return (
                <div key={step.personId + idx} className="relative">
                  {/* Vertical connector line */}
                  {idx > 0 && (
                    <div className="flex items-center gap-3 py-2 pl-5 my-0.5">
                      <div className="w-0.5 h-8 bg-emerald-500/60 dark:bg-emerald-400/50 relative">
                        <div className="absolute top-1/2 -left-1 transform -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      </div>
                      <div
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          isApex
                            ? 'bg-amber-100 dark:bg-amber-950/80 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200'
                            : `${theme.cardBg} ${theme.cardBorder} ${theme.textPrimary}`
                        }`}
                      >
                        {getStepIcon(step.direction, isApex)}
                        <span>{step.relationFromPrevious}</span>
                        {step.generationOffset !== undefined && (
                          <span className={`text-[10px] font-mono ${theme.textMuted}`}>
                            (G {step.generationOffset >= 0 ? `+${step.generationOffset}` : step.generationOffset})
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Card row */}
                  <div
                    onClick={() => onSelectPerson(person.id)}
                    className={`flex items-center justify-between p-3.5 rounded-xl border-2 cursor-pointer transition-all hover:border-emerald-500 ${
                      isStart
                        ? isDark
                          ? 'bg-emerald-950/40 border-emerald-500'
                          : 'bg-emerald-50/70 border-emerald-500'
                        : isEnd
                        ? isDark
                          ? 'bg-indigo-950/40 border-indigo-400'
                          : 'bg-indigo-50/70 border-indigo-500'
                        : isApex
                        ? isDark
                          ? 'bg-amber-950/40 border-amber-400'
                          : 'bg-amber-50/70 border-amber-400'
                        : `${theme.cardBg} ${theme.cardBorder}`
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${
                          isStart
                            ? 'bg-emerald-600 text-white border-emerald-400'
                            : isEnd
                            ? 'bg-indigo-600 text-white border-indigo-400'
                            : isApex
                            ? 'bg-amber-500 text-slate-950 border-amber-300'
                            : isFemale
                            ? isDark
                              ? 'bg-rose-950/60 text-rose-300 border-rose-800/40'
                              : 'bg-rose-100 text-rose-700 border-rose-300'
                            : isMale
                            ? isDark
                              ? 'bg-sky-950/60 text-sky-300 border-sky-800/40'
                              : 'bg-sky-100 text-sky-700 border-sky-300'
                            : isDark
                            ? 'bg-slate-800 text-slate-300'
                            : 'bg-neutral-200 text-neutral-700'
                        }`}
                      >
                        {isMasked ? (
                          <Lock className="w-5 h-5" />
                        ) : isApex ? (
                          <Crown className="w-5 h-5" />
                        ) : (
                          <User className="w-5 h-5" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              isStart
                                ? 'bg-emerald-600 text-white'
                                : isEnd
                                ? 'bg-indigo-600 text-white'
                                : isApex
                                ? 'bg-amber-500 text-slate-950 font-extrabold'
                                : isDark
                                ? 'bg-slate-800 text-slate-300'
                                : 'bg-neutral-100 text-neutral-600'
                            }`}
                          >
                            {isStart
                              ? 'Особа А'
                              : isEnd
                              ? 'Особа Б'
                              : isApex
                              ? 'Спільний предок'
                              : `Крок ${idx + 1}`}
                          </span>
                          <span className={`text-[10px] font-mono ${theme.textMuted}`}>
                            {getGenerationLabel(step.generationOffset)}
                          </span>
                        </div>

                        <h4 className={`text-sm font-bold truncate mt-0.5 ${theme.textPrimary}`}>
                          {isMasked ? '🔒 Скрито (Жива особа)' : getFullName(person)}
                        </h4>
                        <p className={`text-xs ${theme.textMuted} font-mono`}>
                          {isMasked
                            ? '🔒 Конфіденційно'
                            : `${person.birthYear || '?'} — ${person.isLiving ? 'живий' : person.deathYear || '?'}`}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-2">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
                        isStart
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : isEnd
                          ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                          : isApex
                          ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                          : `${theme.surfaceBg} ${theme.textPrimary}`
                      }`}>
                        {isStart ? 'Початок' : isEnd ? result.relationshipName : step.relationFromPrevious}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Genetic and Kinship Metrics Footer */}
      <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2`}>
        <div className={`p-3 rounded-xl border ${theme.cardBorder} ${theme.surfaceBg} flex items-center gap-3`}>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-emerald-950/60 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
            <Dna className="w-5 h-5" />
          </div>
          <div>
            <span className={`text-[10px] uppercase font-mono ${theme.textMuted} block`}>
              Спільна ДНК (оцінка)
            </span>
            <span className={`text-sm font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
              ≈ {result.coefficient}%
            </span>
          </div>
        </div>

        <div className={`p-3 rounded-xl border ${theme.cardBorder} ${theme.surfaceBg} flex items-center gap-3`}>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-indigo-950/60 text-indigo-400' : 'bg-indigo-100 text-indigo-700'}`}>
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className={`text-[10px] uppercase font-mono ${theme.textMuted} block`}>
              Ступінь близькості
            </span>
            <span className={`text-sm font-bold ${theme.textPrimary}`}>
              {result.degree}-й ступінь ({result.degree} {result.degree === 1 ? 'крок' : 'кроків'})
            </span>
          </div>
        </div>

        <div className={`p-3 rounded-xl border ${theme.cardBorder} ${theme.surfaceBg} flex items-center gap-3`}>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-amber-950/60 text-amber-400' : 'bg-amber-100 text-amber-700'}`}>
            <Crown className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className={`text-[10px] uppercase font-mono ${theme.textMuted} block`}>
              Спільний предок
            </span>
            <span className={`text-sm font-bold truncate block ${theme.textPrimary}`}>
              {result.commonAncestors.length > 0
                ? getFullName(result.commonAncestors[0])
                : 'Пряма висхідна/низхідна лінія'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
