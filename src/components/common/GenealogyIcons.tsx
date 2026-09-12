import React from 'react';
import { TreeDeciduous, Trees, FolderTree } from 'lucide-react';

/**
 * Custom Genealogical Fan Chart Icon (Віялова діаграма родоводу)
 * Displays a radial multi-layered genealogical pedigree fan.
 */
export const FanIcon: React.FC<{ className?: string; size?: number }> = ({ 
  className = 'w-4 h-4', 
  size = 16 
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Outer arched fan boundary */}
      <path d="M 2 20 A 10 10 0 0 1 22 20 Z" fill="currentColor" fillOpacity="0.12" />
      {/* Mid arched division ring */}
      <path d="M 6 20 A 6 6 0 0 1 18 20" />
      {/* Inner root hub arc */}
      <path d="M 9.5 20 A 2.5 2.5 0 0 1 14.5 20" />
      {/* Radial pedigree branch rays */}
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="12" y1="20" x2="5" y2="13" />
      <line x1="12" y1="20" x2="19" y2="13" />
      <line x1="12" y1="20" x2="7.8" y2="11" />
      <line x1="12" y1="20" x2="16.2" y2="11" />
    </svg>
  );
};

/**
 * Custom Genealogical Tree Icon (Класичне дерево родоводу)
 */
export const TreeIcon: React.FC<{ className?: string; size?: number }> = ({ 
  className = 'w-4 h-4', 
  size = 16 
}) => {
  return <TreeDeciduous className={className} size={size} />;
};

/**
 * Custom Memorial Dove Icon (Голуб - символ миру, Духа Святого та душі, що відійшла у вічність до Бога)
 */
export const DoveIcon: React.FC<{ className?: string; size?: number }> = ({ 
  className = 'w-4 h-4', 
  size = 16 
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M288 167.2v-28.1c-28.2-36.3-47.1-79.3-54.1-125.2-2.1-13.5-19-18.8-27.8-8.3-21.1 24.9-37.7 54.1-48.9 86.5 34.2 38.3 80 64.6 130.8 75.1zM400 64c-44.2 0-80 35.9-80 80.1v59.4C215.6 197.3 127 133 87 41.8c-5.5-12.5-23.2-13.2-29-.9C41.4 76 32 115.2 32 156.6c0 70.8 34.1 136.9 85.1 185.9 13.2 12.7 26.1 23.2 38.9 32.8l-143.9 36C1.4 414-3.4 426.4 2.6 435.7 20 462.6 63 508.2 155.8 512c8 .3 16-2.6 22.1-7.9l65.2-56.1H320c88.4 0 160-71.5 160-159.9V128l32-64H400zm0 96.1c-8.8 0-16-7.2-16-16s7.2-16 16-16 16 7.2 16 16-7.2 16-16 16z" />
    </svg>
  );
};

