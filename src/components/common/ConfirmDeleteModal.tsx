/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { useUIStore } from '../../stores/useUIStore';
import { getThemeConfig } from '../../utils/theme';

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title?: string;
  itemName?: string;
  itemType?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onClose: () => void;
  isPermanent?: boolean;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  title = 'Підтвердження видалення',
  itemName,
  itemType = 'запис',
  message,
  confirmText = 'Видалити',
  cancelText = 'Скасувати',
  onConfirm,
  onClose,
  isPermanent = false
}) => {
  const themePalette = useUIStore((s) => s.themePalette);
  const theme = getThemeConfig(themePalette);
  const isDark = theme.category === 'dark';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 ${
          isDark
            ? 'bg-[#1b1f24] border-[#323840] text-white shadow-black/80'
            : 'bg-white border-neutral-200 text-neutral-900 shadow-xl'
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        {/* Modal Header */}
        <div className={`p-4 border-b flex items-center justify-between ${
          isDark ? 'border-[#2d3238] bg-[#15181b]' : 'border-neutral-100 bg-neutral-50'
        }`}>
          <div className="flex items-center gap-2.5 text-rose-500">
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 id="confirm-dialog-title" className="text-sm font-bold tracking-tight">
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100'
            }`}
            aria-label="Закрити"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-3">
          <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-neutral-600'}`}>
            {message ? (
              message
            ) : itemName ? (
              <>
                Ви дійсно бажаєте видалити {itemType} <strong className={`font-semibold ${isDark ? 'text-white' : 'text-neutral-900'}`}>«{itemName}»</strong>?
              </>
            ) : (
              <>Ви дійсно бажаєте видалити цей {itemType}?</>
            )}
          </p>

          {isPermanent && (
            <div className={`p-3 rounded-xl border text-xs font-medium flex items-start gap-2.5 ${
              isDark
                ? 'bg-rose-950/30 border-rose-900/50 text-rose-300'
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}>
              <Trash2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Цю дію неможливо скасувати. Всі пов&apos;язані дані буде безповоротно видалено.</span>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className={`p-4 border-t flex items-center justify-end gap-2.5 ${
          isDark ? 'border-[#2d3238] bg-[#15181b]' : 'border-neutral-100 bg-neutral-50'
        }`}>
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer border ${
              isDark
                ? 'border-[#323840] bg-[#22262a] text-slate-300 hover:text-white hover:bg-[#2c3238]'
                : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-900/20 active:scale-98 transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
