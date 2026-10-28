/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ExternalLink, Eye, Pencil, Target, UserPlus, Copy } from 'lucide-react';
import { Person } from '../../../types/genealogy';
import { getPersonUrl } from '../../../../stores/useUIStore';

interface TreeContextMenuProps {
  contextMenu: { x: number; y: number; personId: string } | null;
  person?: Person | null;
  isReadOnly?: boolean;
  onClose: () => void;
  onSelectPerson: (id: string) => void;
  onEditPerson?: (id: string) => void;
  onChangeRoot: (id: string) => void;
  onOpenRelationManager?: (id: string) => void;
}

export const TreeContextMenu: React.FC<TreeContextMenuProps> = ({
  contextMenu,
  person,
  isReadOnly = false,
  onClose,
  onSelectPerson,
  onEditPerson,
  onChangeRoot,
  onOpenRelationManager
}) => {
  if (!contextMenu || !person) return null;

  const isMale = person.gender === 'male' || (person as any).sex === 'M';
  const isFemale = person.gender === 'female' || (person as any).sex === 'F';
  const name = `${person.lastName || ''} ${person.firstName || ''}`.trim() || 'Особа';
  const personUrl = getPersonUrl(person.id);

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-auto"
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        style={{
          position: 'fixed',
          left: `${Math.max(10, Math.min(contextMenu.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 250))}px`,
          top: `${Math.max(10, Math.min(contextMenu.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 320))}px`
        }}
        onClick={(e) => e.stopPropagation()}
        className="w-64 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-2xl overflow-hidden py-1.5 z-50 text-sm animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/10 dark:ring-white/10"
      >
        <div className="px-3.5 py-2.5 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850">
          <div className="flex items-center gap-1.5 font-bold text-neutral-900 dark:text-neutral-100 truncate text-xs">
            <span className={`w-2 h-2 rounded-full shrink-0 ${isMale ? 'bg-sky-500' : isFemale ? 'bg-rose-500' : 'bg-slate-400'}`} />
            <span className="truncate">{name}</span>
          </div>
          <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
            ID: {person.id}
          </div>
        </div>

        <div className="py-1">
          {/* 1. Open in new tab - prominent anchor */}
          <a
            href={personUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="flex items-center gap-2.5 px-3.5 py-2 text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 font-semibold transition-colors cursor-pointer group"
          >
            <ExternalLink className="w-4 h-4 shrink-0 text-sky-500 group-hover:scale-110 transition-transform" />
            <span>Відкрити в новій вкладці</span>
          </a>

          {/* 2. Open inspector modal */}
          <button
            type="button"
            onClick={() => {
              onSelectPerson(person.id);
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left cursor-pointer"
          >
            <Eye className="w-4 h-4 shrink-0 text-amber-500" />
            <span>Переглянути анкету</span>
          </button>

          {/* 3. Edit person */}
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => {
                if (onEditPerson) onEditPerson(person.id);
                else onSelectPerson(person.id);
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left cursor-pointer"
            >
              <Pencil className="w-4 h-4 shrink-0 text-blue-500" />
              <span>Редагувати картку</span>
            </button>
          )}

          {/* 4. Center tree on this person */}
          <button
            type="button"
            onClick={() => {
              onChangeRoot(person.id);
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left cursor-pointer"
          >
            <Target className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>Зробити центром дерева</span>
          </button>

          {/* 5. Add relative */}
          {!isReadOnly && onOpenRelationManager && (
            <button
              type="button"
              onClick={() => {
                onOpenRelationManager(person.id);
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left cursor-pointer"
            >
              <UserPlus className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>Додати родича</span>
            </button>
          )}

          <div className="my-1 border-t border-neutral-100 dark:border-neutral-800" />

          {/* 6. Copy link */}
          <button
            type="button"
            onClick={async () => {
              try {
                const fullUrl = new URL(personUrl, window.location.origin).href;
                await navigator.clipboard.writeText(fullUrl);
              } catch {}
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left text-xs cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 shrink-0" />
            <span>Копіювати посилання</span>
          </button>
        </div>
      </div>
    </div>
  );
};
