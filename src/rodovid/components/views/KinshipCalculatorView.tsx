import React, { useState, useMemo } from 'react';
import {
  Compass,
  ArrowRight,
  User,
  GitCommit,
  CheckCircle2,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { GenealogyDatabase, Person } from '../../types/genealogy';
import { calculateKinship, getFullName } from '../../utils/relationship';

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
  const personKeys = Object.keys(database.persons);
  const allPersons = Object.values(database.persons) as Person[];
  const [personAId, setPersonAId] = useState<string>(initialPersonAId || personKeys[0] || '');
  const [personBId, setPersonBId] = useState<string>(personKeys[1] || personKeys[0] || '');

  const result = useMemo(() => {
    return calculateKinship(database, personAId, personBId);
  }, [database, personAId, personBId]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Калькулятор спорідненості та ступенів близькості
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Точний розрахунок генеалогічного зв'язку, спільного предка та термінів спорідненості
            </p>
          </div>
        </div>

        {/* Person Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 pt-4 border-t border-slate-800">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Перша особа (А):
            </label>
            <select
              value={personAId}
              onChange={(e) => setPersonAId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
            >
              {allPersons.map((p) => (
                <option key={p.id} value={p.id}>
                  {getFullName(p)} {p.birthYear ? `(${p.birthYear})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Друга особа (Б):
            </label>
            <select
              value={personBId}
              onChange={(e) => setPersonBId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
            >
              {allPersons.map((p) => (
                <option key={p.id} value={p.id}>
                  {getFullName(p)} {p.birthYear ? `(${p.birthYear})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Result Card */}
      {personAId === personBId ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400 text-xs">
          Виберіть двох різних людей для розрахунку родинного зв'язку.
        </div>
      ) : !result ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-2">
          <HelpCircle className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-200">
            Прямий родинний ланцюжок не знайдено
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Ці дві особи знаходяться у різних непов'язаних гілках або ще не зв'язані сімейним
            союзом у базі даних.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
          {/* Main Title of Kinship */}
          <div className="bg-slate-950 p-5 rounded-xl border border-emerald-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                Визначений ступінь спорідненості
              </span>
              <h2 className="text-2xl font-bold text-white mt-0.5">
                {result.relationshipName}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Ким є {getFullName(result.personB)} по відношенню до{' '}
                {getFullName(result.personA)}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">
                  Довжина шляху
                </span>
                <span className="text-lg font-bold text-emerald-400 font-mono">
                  {result.degreeOfConsanguinity} кроків
                </span>
              </div>
            </div>
          </div>

          {/* Common Ancestors */}
          {result.commonAncestors.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Найближчий спільний предок:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {result.commonAncestors.map((anc) => (
                  <div
                    key={anc.id}
                    onClick={() => onSelectPerson(anc.id)}
                    className="flex items-center gap-3 p-3 bg-slate-950 border border-slate-800 rounded-lg hover:border-emerald-600 cursor-pointer text-xs transition-colors"
                  >
                    <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-slate-300 shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-100">{getFullName(anc)}</h4>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {anc.birthYear || '?'} — {anc.deathYear || '?'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step-by-Step Path */}
          <div className="space-y-3">
            <span className="text-xs font-semibold text-slate-300">
              Покроковий ланцюжок спорідненості ({result.path.length} осіб):
            </span>

            <div className="space-y-2 relative">
              {result.path.map((step, idx) => {
                const person = database.persons[step.personId];
                if (!person) return null;
                const isStart = idx === 0;
                const isEnd = idx === result.path.length - 1;

                return (
                  <div key={idx} className="flex items-center gap-3">
                    <div
                      onClick={() => onSelectPerson(person.id)}
                      className={`flex-1 p-3 rounded-lg border cursor-pointer transition-colors flex items-center justify-between text-xs ${
                        isStart || isEnd
                          ? 'bg-slate-950 border-emerald-500/50 shadow-sm'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold font-mono ${
                            isStart || isEnd
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-semibold text-slate-100">{getFullName(person)}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {person.birthYear || '?'} — {person.isLiving ? 'живий' : person.deathYear || '?'}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="px-2 py-0.5 bg-slate-800 text-emerald-400 font-medium rounded text-[11px]">
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
