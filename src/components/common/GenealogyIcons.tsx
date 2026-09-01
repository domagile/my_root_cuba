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
