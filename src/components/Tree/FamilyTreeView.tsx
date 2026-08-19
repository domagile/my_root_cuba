/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { ZoomIn, ZoomOut, Maximize2, User, Plus, Sparkles, GitFork, ArrowRight, Heart } from 'lucide-react';
import { useGenealogy } from '../../context/GenealogyContext';
import { getThemeConfig } from '../../utils/theme';
import { Person } from '../../types';

export const FamilyTreeView: React.FC = () => {
  const { persons, selectedPersonId, setSelectedPersonId, themePalette } = useGenealogy();
  const theme = getThemeConfig(themePalette);
  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 40, y: 40 });

  const activePerson = persons.find((p) => p.id === selectedPersonId) || persons[0];

  // Build tree relationships around active person
  const familyData = useMemo(() => {
    if (!activePerson) return { parents: [], spouses: [], children: [], siblings: [] };

    const parents = persons.filter((p) => p.id === activePerson.fatherId || p.id === activePerson.motherId);
    const spouses = persons.filter((p) => activePerson.spouseIds?.includes(p.id) || p.spouseIds?.includes(activePerson.id));
    const children = persons.filter((p) => p.fatherId === activePerson.id || p.motherId === activePerson.id || activePerson.childrenIds?.includes(p.id));
    const siblings = persons.filter((p) => 
      p.id !== activePerson.id && 
      ((activePerson.fatherId && p.fatherId === activePerson.fatherId) || 
       (activePerson.motherId && p.motherId === activePerson.motherId))
    );

    return { parents, spouses, children, siblings };
  }, [activePerson, persons]);

  return (
    <div className={`flex-1 flex flex-col h-full overflow-hidden ${theme.appBg} relative`}>
      {/* Floating Toolbar */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 p-1.5 rounded-2xl bg-white/90 dark:bg-slate-850/90 backdrop-blur-md border border-neutral-200 dark:border-neutral-700 shadow-xl">
        <button
          onClick={() => setScale((s) => Math.min(s + 0.15, 2))}
          className="p-2 rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          title="Наблизити"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setScale((s) => Math.max(s - 0.15, 0.5))}
          className="p-2 rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          title="Віддалити"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => { setScale(1); setPan({ x: 40, y: 40 }); }}
          className="p-2 rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          title="Скинути масштаб"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Canvas View */}
      <div className="flex-1 overflow-auto p-8 flex items-center justify-center">
        <div
          style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
          className="transition-transform duration-200 ease-out flex flex-col items-center space-y-12 max-w-5xl"
        >
          {/* 1. Parents Level */}
          <div className="flex items-center gap-8">
            {familyData.parents.map((parent) => (
              <div
                key={parent.id}
                onClick={() => setSelectedPersonId(parent.id)}
                className={`p-4 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} shadow-lg hover:shadow-xl hover:border-[#B88E3E] transition-all cursor-pointer w-64 text-center space-y-1.5`}
              >
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#B88E3E]">
                  {parent.gender === 'male' ? 'Батько' : 'Мати'}
                </span>
                <div className={`font-bold text-base ${theme.cardTitle}`}>
                  {parent.firstName} {parent.lastName}
                </div>
                <div className={`text-xs ${theme.cardSubtext}`}>
                  {parent.birthYear ? `нар. ${parent.birthYear}` : ''} {parent.deathYear ? `— пом. ${parent.deathYear}` : ''}
                </div>
              </div>
            ))}
            {familyData.parents.length === 0 && (
              <div className="p-4 rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700 text-xs text-neutral-400">
                Батьків не вказано
              </div>
            )}
          </div>

          {/* 2. Active Person and Spouses Level */}
          <div className="flex items-center gap-6">
            {activePerson && (
              <div
                className={`p-6 rounded-3xl border-2 border-[#B88E3E] ${theme.cardBg} shadow-2xl w-72 text-center space-y-2 relative overflow-hidden`}
              >
                <div className="absolute -top-10 -right-10 w-28 h-28 bg-[#B88E3E]/20 rounded-full blur-xl pointer-events-none" />
                <span className="text-[10px] uppercase font-extrabold tracking-widest px-2.5 py-1 rounded-full bg-[#B88E3E] text-white">
                  Фокусна персона
                </span>
                <h3 className={`font-extrabold text-lg ${theme.cardTitle} pt-1`}>
                  {activePerson.firstName} {activePerson.lastName}
                </h3>
                <p className={`text-xs ${theme.cardSubtext}`}>
                  {activePerson.birthDate || activePerson.birthYear ? `Нар: ${activePerson.birthDate || activePerson.birthYear}` : ''}
                  {activePerson.birthPlace ? ` (${activePerson.birthPlace})` : ''}
                </p>
                {activePerson.occupation && (
                  <p className="text-xs text-[#B88E3E] font-medium">
                    {activePerson.occupation}
                  </p>
                )}
              </div>
            )}

            {familyData.spouses.map((spouse) => (
              <div
                key={spouse.id}
                onClick={() => setSelectedPersonId(spouse.id)}
                className={`p-5 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} shadow-lg hover:border-[#B88E3E] transition-all cursor-pointer w-64 text-center space-y-1`}
              >
                <span className="text-[10px] uppercase font-bold text-rose-500 flex items-center justify-center gap-1">
                  <Heart className="w-3 h-3 fill-rose-500" />
                  <span>{spouse.gender === 'female' ? 'Дружина' : 'Чоловік'}</span>
                </span>
                <div className={`font-bold text-base ${theme.cardTitle}`}>
                  {spouse.firstName} {spouse.lastName}
                </div>
                <div className={`text-xs ${theme.cardSubtext}`}>
                  {spouse.birthYear ? `нар. ${spouse.birthYear}` : ''}
                </div>
              </div>
            ))}
          </div>

          {/* 3. Children Level */}
          <div className="space-y-3 text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Діти ({familyData.children.length})
            </span>
            <div className="flex flex-wrap justify-center gap-4">
              {familyData.children.map((child) => (
                <div
                  key={child.id}
                  onClick={() => setSelectedPersonId(child.id)}
                  className={`p-4 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} shadow-md hover:border-[#B88E3E] transition-all cursor-pointer w-56 text-center space-y-1`}
                >
                  <span className="text-[10px] uppercase font-bold text-blue-500">
                    {child.gender === 'male' ? 'Син' : 'Донька'}
                  </span>
                  <div className={`font-bold text-sm ${theme.cardTitle}`}>
                    {child.firstName} {child.lastName}
                  </div>
                  <div className={`text-xs ${theme.cardSubtext}`}>
                    {child.birthYear ? `нар. ${child.birthYear}` : ''}
                  </div>
                </div>
              ))}
              {familyData.children.length === 0 && (
                <div className="p-3 text-xs text-neutral-400">Дітей не зафіксовано</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
