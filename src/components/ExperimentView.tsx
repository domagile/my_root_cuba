import React from 'react';
import { FlaskConical } from 'lucide-react';
import { useGenealogy } from '../context/GenealogyContext';
import { getThemeConfig } from '../utils/theme';

export const ExperimentView: React.FC = () => {
  const { themePalette } = useGenealogy();
  const theme = getThemeConfig(themePalette);

  return (
    <div className={`flex-1 p-6 overflow-y-auto overflow-x-auto ${theme.appBg}`}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <FlaskConical className="w-6 h-6" />
          </div>
          <div>
            <h1 className={`text-xl font-bold ${theme.cardTitle}`}>
              Експеримент
            </h1>
            <p className={`text-xs ${theme.cardSubtext}`}>
              Експериментальна вкладка
            </p>
          </div>
        </div>

        {/* Placeholder Card */}
        <div className={`p-12 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} text-center space-y-3 shadow-sm`}>
          <FlaskConical className="w-10 h-10 mx-auto opacity-30 text-amber-500" />
          <h3 className={`text-base font-bold ${theme.cardTitle}`}>
            Експериментальний модуль
          </h3>
          <p className={`text-xs ${theme.cardSubtext} max-w-md mx-auto leading-relaxed`}>
            Ця вкладка готова для проведення майбутніх експериментів.
          </p>
        </div>
      </div>
    </div>
  );
};
