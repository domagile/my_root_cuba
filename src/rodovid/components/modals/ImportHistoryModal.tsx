/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Standalone Import and Merge History Modal Dialog
 */

import React from 'react';
import { X, History } from 'lucide-react';
import { ImportHistoryView } from './ImportHistoryView';

interface ImportHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPerson?: (personId: string) => void;
  onOpenImport?: () => void;
}

export const ImportHistoryModal: React.FC<ImportHistoryModalProps> = ({
  isOpen,
  onClose,
  onSelectPerson,
  onOpenImport
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-950/80 border border-emerald-800/80 text-emerald-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Історія імпорту та злиття даних
              </h2>
              <p className="text-xs text-slate-400">
                Звіти про доданих родичів, спільні злиті записи та розв'язані конфлікти полів
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Закрити"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto scrollbar-thin flex-1">
          <ImportHistoryView
            onSelectPerson={onSelectPerson}
            onClose={onClose}
            onOpenImport={onOpenImport}
            isInsideModal={true}
          />
        </div>
      </div>
    </div>
  );
};
