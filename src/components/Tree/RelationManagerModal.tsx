/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, UserPlus, Users, Heart, GitFork } from 'lucide-react';
import { useGenealogy } from '../../context/GenealogyContext';
import { getThemeConfig } from '../../utils/theme';
import { Person } from '../../types';

interface RelationManagerModalProps {
  targetPerson: Person;
  onClose: () => void;
  onOpenAddModalWithRelation: (
    type: 'father' | 'mother' | 'child' | 'spouse' | 'sibling',
    targetPersonId: string
  ) => void;
}

export const RelationManagerModal: React.FC<RelationManagerModalProps> = ({
  targetPerson,
  onClose,
  onOpenAddModalWithRelation
}) => {
  const { themePalette } = useGenealogy();
  const theme = getThemeConfig(themePalette);

  const relationOptions = [
    { type: 'father' as const, label: 'Додати батька', icon: UserPlus, desc: 'Вказати батька для обраної особи' },
    { type: 'mother' as const, label: 'Додати матір', icon: UserPlus, desc: 'Вказати матір для обраної особи' },
    { type: 'child' as const, label: 'Додати дитину (сина/доньку)', icon: GitFork, desc: 'Додати нащадка до цього родоводу' },
    { type: 'spouse' as const, label: 'Додати подружжя (чоловіка/дружину)', icon: Heart, desc: 'Створити шлюбний зв\'язок' },
    { type: 'sibling' as const, label: 'Додати брата/сестру', icon: Users, desc: 'Додати особу зі спільними батьками' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className={`w-full max-w-md rounded-3xl ${theme.cardBg} border ${theme.cardBorder} shadow-2xl p-6 space-y-5 relative`}>
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#B88E3E]">
            Родинне дерево
          </span>
          <h2 className={`text-lg font-bold ${theme.cardTitle}`}>
            Додати родича до {targetPerson.firstName} {targetPerson.lastName}
          </h2>
          <p className={`text-xs ${theme.cardSubtext}`}>
            Оберіть тип родинного зв'язку, який необхідно створити:
          </p>
        </div>

        <div className="space-y-2.5">
          {relationOptions.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.type}
                onClick={() => onOpenAddModalWithRelation(opt.type, targetPerson.id)}
                className={`w-full p-3.5 rounded-2xl border ${theme.cardBorder} bg-neutral-50/50 dark:bg-neutral-800/40 hover:border-[#B88E3E] hover:bg-[#B88E3E]/5 transition-all text-left flex items-center gap-3 group cursor-pointer`}
              >
                <div className="w-10 h-10 rounded-xl bg-[#B88E3E]/15 text-[#B88E3E] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className={`font-bold text-sm ${theme.cardTitle} group-hover:text-[#B88E3E] transition-colors`}>
                    {opt.label}
                  </div>
                  <div className="text-xs text-neutral-500 line-clamp-1">
                    {opt.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
