import React from 'react';
import { useGenealogy } from '../context/GenealogyContext';
import { getThemeConfig } from '../utils/theme';
import { NyshporkaApp } from './nyshporka/NyshporkaApp';

export const ExperimentView: React.FC = () => {
  const { themePalette } = useGenealogy();
  const theme = getThemeConfig(themePalette);

  return (
    <div className={`flex-1 p-4 md:p-6 overflow-y-auto overflow-x-auto ${theme.appBg}`}>
      <div className="max-w-7xl mx-auto">
        <NyshporkaApp theme={theme} />
      </div>
    </div>
  );
};

