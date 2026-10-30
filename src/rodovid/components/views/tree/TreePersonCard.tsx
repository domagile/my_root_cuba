/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { memo } from 'react';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ExternalLink,
  Pencil,
  GitMerge,
  MoreVertical,
  GitFork,
  Target,
  Plus,
  Minus,
  Users,
  X,
  ChevronDown,
  Shield
} from 'lucide-react';
import { Person } from '../../../types/genealogy';
import { DuplicatePair } from '../../../../types';
import { TreeNodeLayout } from '../../../utils/treeLayout';
import { getPersonUrl, openPersonInNewWindow } from '../../../../stores/useUIStore';
import { isPersonLiving, getPrivacySafePerson } from '../../../utils/privacy';
import {
  formatLifespan,
  getGenealogyCode,
  getPersonClanColor,
  getPersonRodName
} from '../../../utils/treeLayout';
import { normalizeUkrainianSurnameGender } from '../../../../utils/ukrainianPhonetics';

export interface TreePersonCardProps {
  node: TreeNodeLayout;
  activePersonId: string;
  rootPersonId: string;
  isLightCanvas: boolean;
  isWhitelisted: boolean;
  isCardHovered: boolean;
  isMicroLOD: boolean;
  isPillLOD: boolean;
  isCompact: boolean;
  isReadOnly: boolean;
  orientation: 'vertical' | 'horizontal';

  // Bloodline highlights
  isNodeInBloodline: boolean;
  isHoveredTarget: boolean;
  isAncestorOfHovered: boolean;
  isDescendantOfHovered: boolean;
  bloodlineColor: string;
  bloodlineActive: boolean;

  // Focus Highlights
  isNodeFocused: boolean;
  isDimmed: boolean;
  focusType: string;
  focusColor: string;
  focusTitle: string;
  focusPersonId: string;
  selectedClanId: string | null;

  // Duplicate pair
  matchedDuplicate?: DuplicatePair;

  // Collateral siblings data
  collateralSiblings: Person[];
  isCollateralPerson: boolean;
  personSiblings: Person[];
  collapsedSiblings: Set<string>;
  showSiblings: boolean;

  // Parents data
  father?: Person | null;
  mother?: Person | null;

  // Selective popover state
  selectiveParentsMenuPersonId: string | null;
  selectiveMenuPersonId: string | null;

  // Node position index for lateral detection
  nodeByPersonId: Map<string, TreeNodeLayout>;

  // Callback handlers (stable references)
  onCardMouseEnter: (id: string) => void;
  onCardMouseLeave: () => void;
  onSelectPerson: (id: string) => void;
  onEditPerson?: (id: string) => void;
  onChangeRoot: (id: string) => void;
  onOpenRelationManager?: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  onOpenContextMenuAtButton: (e: React.MouseEvent, id: string) => void;
  onSetActiveMergePair: (pair: DuplicatePair) => void;

  // Toggles
  onToggleCollapseParents: (personId: string, isCurrentlyCollapsed?: boolean) => void;
  onToggleCollapseParentBranch: (personId: string, branch: 'paternal' | 'maternal', isCurrentlyCollapsed?: boolean) => void;
  onToggleCollapseChildren: (personId: string, isCurrentlyCollapsed?: boolean) => void;
  onToggleCollapseSingleSibling: (siblingId: string, anchorPersonId?: string) => void;
  onCollapseAllSiblingsOfPerson: (personId: string) => void;
  onExpandAllSiblingsOfPerson: (personId: string) => void;
  onSetSelectiveParentsMenuPersonId: (personId: string | null) => void;
  onSetSelectiveMenuPersonId: (personId: string | null) => void;

  // Focus toggles
  onToggleClanFocus: (clanId: string) => void;
  onToggleDirectAncestorsFocus: (personId: string) => void;
}

const TreePersonCardComponent: React.FC<TreePersonCardProps> = ({
  node,
  activePersonId,
  rootPersonId,
  isLightCanvas,
  isWhitelisted,
  isCardHovered,
  isMicroLOD,
  isPillLOD,
  isCompact,
  isReadOnly,
  orientation,
  isNodeInBloodline,
  isHoveredTarget,
  isAncestorOfHovered,
  isDescendantOfHovered,
  bloodlineColor,
  bloodlineActive,
  isNodeFocused,
  isDimmed,
  focusType,
  focusColor,
  focusTitle,
  focusPersonId,
  selectedClanId,
  matchedDuplicate,
  collateralSiblings,
  isCollateralPerson,
  personSiblings,
  collapsedSiblings,
  showSiblings,
  father,
  mother,
  selectiveParentsMenuPersonId,
  selectiveMenuPersonId,
  nodeByPersonId,
  onCardMouseEnter,
  onCardMouseLeave,
  onSelectPerson,
  onEditPerson,
  onChangeRoot,
  onOpenRelationManager,
  onContextMenu,
  onOpenContextMenuAtButton,
  onSetActiveMergePair,
  onToggleCollapseParents,
  onToggleCollapseParentBranch,
  onToggleCollapseChildren,
  onToggleCollapseSingleSibling,
  onCollapseAllSiblingsOfPerson,
  onExpandAllSiblingsOfPerson,
  onSetSelectiveParentsMenuPersonId,
  onSetSelectiveMenuPersonId,
  onToggleClanFocus,
  onToggleDirectAncestorsFocus
}) => {
  const rawPerson = node.person;
  const isLiving = isPersonLiving(rawPerson);
  const isMasked = !isWhitelisted && isLiving;
  const p = isMasked ? getPrivacySafePerson(rawPerson, false) : rawPerson;

  const isRoot = p.id === activePersonId;
  const isTreeRoot = p.id === rootPersonId;
  const isMale = p.gender === 'male' || p.gender === 'M';
  const isFemale = p.gender === 'female' || p.gender === 'F';

  const firstName = isMasked ? 'Скрито' : (p.name?.given || p.firstName || '—');
  const lastName = isMasked ? 'Скрито' : (p.name?.surname || p.lastName || '—');
  const rawMaidenName = isMasked ? '' : (p.name?.maidenName || p.maidenName || '').trim();
  const maidenName = rawMaidenName && rawMaidenName.toLowerCase() !== (lastName !== '—' ? lastName.toLowerCase() : '')
    ? rawMaidenName
    : '';
  const maidenFormatted = maidenName ? `(${maidenName})` : '';
  const lifespanStr = isMasked ? '🔒 Скрито (Жива особа)' : formatLifespan(p);
  const fsCode = isMasked ? '🔒 ЗАХИЩЕНО' : getGenealogyCode(p);

  const rawRod = getPersonRodName(p);
  const rawSurname = (p.name?.surname || p.lastName || p.name?.maidenName || p.maidenName || '').trim();
  const canonicalRod = normalizeUkrainianSurnameGender(rawSurname) || rawRod;
  const cardBorderColor = isLightCanvas ? '#d8cfbe' : '#383e46';

  const clanColor = getPersonClanColor(p);
  const shortLifespan = (() => {
    if (!lifespanStr || lifespanStr.includes('Скрито')) return '';
    const match = lifespanStr.match(/\b\d{4}\b/g);
    if (match) {
      if (match.length >= 2) return `${match[0]}–${match[1]}`;
      return match[0];
    }
    return lifespanStr;
  })();

  // 1. LOD Tier 2: Ultra-distant zoom (< 28%) - Micro Marker Panorama
  if (isMicroLOD) {
    return (
      <div
        key={`${node.id}_${node.x}_${node.y}`}
        style={{
          position: 'absolute',
          left: `${node.x}px`,
          top: `${node.y}px`,
          width: `${node.width}px`,
          height: `${node.height}px`,
          contain: 'paint layout',
          opacity: bloodlineActive ? (isNodeInBloodline ? 1 : 0.30) : (isDimmed ? 0.18 : 1),
          filter: isDimmed ? 'grayscale(50%)' : 'none',
          transition: 'opacity 0.25s ease'
        }}
        className="relative select-none pointer-events-none"
      >
        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[2px] bg-slate-400/25 dark:bg-slate-700/40 pointer-events-none" />
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-slate-400/20 dark:bg-slate-700/30 pointer-events-none" />

        <div
          style={{
            backgroundColor: isNodeInBloodline
              ? bloodlineColor
              : (clanColor || (isMale ? '#0284c7' : isFemale ? '#e11d48' : '#475569')),
            boxShadow: isNodeInBloodline
              ? `0 0 18px ${bloodlineColor}`
              : isNodeFocused && focusType !== 'none'
              ? `0 0 16px ${focusColor}`
              : undefined
          }}
          onMouseEnter={() => onCardMouseEnter(p.id)}
          onMouseLeave={onCardMouseLeave}
          onClick={(e) => {
            e.stopPropagation();
            if (e.metaKey || e.ctrlKey || e.button === 1) {
              openPersonInNewWindow(p.id);
              return;
            }
            if (p.id !== activePersonId) {
              onChangeRoot(p.id);
            }
          }}
          onAuxClick={(e) => {
            if (e.button === 1) {
              e.preventDefault();
              e.stopPropagation();
              openPersonInNewWindow(p.id);
            }
          }}
          onContextMenu={(e) => onContextMenu(e, p.id)}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onSelectPerson(p.id);
          }}
          className={`pointer-events-auto absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[142px] h-[34px] rounded-full px-2.5 shadow-lg flex items-center justify-between gap-1 cursor-pointer transition-transform duration-100 hover:scale-110 hover:z-30 text-white border ${
            isNodeInBloodline
              ? 'ring-4 ring-white border-amber-300 scale-105 z-20 font-bold'
              : isNodeFocused && focusType !== 'none'
              ? 'ring-4 ring-white border-amber-300 scale-105'
              : isRoot
              ? 'ring-4 ring-amber-400 ring-offset-2 ring-offset-slate-900 shadow-amber-500/70 border-white/30'
              : 'border-white/30'
          }`}
          title={`${firstName} ${lastName}${maidenFormatted ? ` ${maidenFormatted}` : ''} (${lifespanStr})\n• Клік: фокусувати дерево\n• Подвійний клік: відкрити картку\n• Ctrl+клік / ПКМ: у новій вкладці`}
        >
          <div className="flex items-center gap-1 truncate min-w-0 flex-1">
            {isTreeRoot ? (
              <span className="text-[11px] shrink-0">👑</span>
            ) : isMasked ? (
              <Lock className="w-2.5 h-2.5 text-emerald-200 shrink-0" />
            ) : null}
            <span className="font-black text-[11px] truncate tracking-tight">
              {lastName} {maidenFormatted && <span className="font-normal opacity-85">{maidenFormatted}</span>}
            </span>
          </div>
          {shortLifespan && (
            <span className="text-[9px] font-mono opacity-85 shrink-0 group-hover:hidden">
              {shortLifespan}
            </span>
          )}
          <a
            href={getPersonUrl(p.id)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="hidden group-hover:flex items-center justify-center p-0.5 rounded hover:bg-white/25 text-white shrink-0 transition-all cursor-pointer"
            title="Відкрити особу у новій вкладці браузера"
          >
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </div>
    );
  }

  // 2. LOD Tier 1: Distant zoom (28% - 50%) - Compact Colored Pill
  if (isPillLOD) {
    return (
      <div
        key={`${node.id}_${node.x}_${node.y}`}
        style={{
          position: 'absolute',
          left: `${node.x}px`,
          top: `${node.y}px`,
          width: `${node.width}px`,
          height: `${node.height}px`,
          contain: 'paint layout',
          opacity: bloodlineActive ? (isNodeInBloodline ? 1 : 0.30) : (isDimmed ? 0.22 : 1),
          filter: isDimmed ? 'grayscale(40%)' : 'none',
          transition: 'opacity 0.25s ease'
        }}
        className="relative select-none pointer-events-none"
      >
        <div
          style={{
            borderColor: isNodeInBloodline
              ? bloodlineColor
              : isNodeFocused && focusType !== 'none'
              ? focusColor
              : (clanColor || cardBorderColor),
            boxShadow: isNodeInBloodline
              ? `0 0 20px ${bloodlineColor}`
              : isNodeFocused && focusType !== 'none'
              ? `0 0 18px ${focusColor}`
              : undefined
          }}
          onMouseEnter={() => onCardMouseEnter(p.id)}
          onMouseLeave={onCardMouseLeave}
          onClick={(e) => {
            e.stopPropagation();
            if (e.metaKey || e.ctrlKey || e.button === 1) {
              openPersonInNewWindow(p.id);
              return;
            }
            if (p.id !== activePersonId) {
              onChangeRoot(p.id);
            }
          }}
          onAuxClick={(e) => {
            if (e.button === 1) {
              e.preventDefault();
              e.stopPropagation();
              openPersonInNewWindow(p.id);
            }
          }}
          onContextMenu={(e) => onContextMenu(e, p.id)}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onSelectPerson(p.id);
          }}
          className={`pointer-events-auto absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[184px] h-[52px] rounded-xl px-2.5 py-1.5 shadow-xl flex flex-col justify-between cursor-pointer border-2 transition-transform duration-100 hover:scale-105 hover:z-30 ${
            isLightCanvas ? 'bg-white text-neutral-900' : 'bg-[#22262a] text-white'
          } ${
            isNodeInBloodline
              ? 'ring-4 ring-amber-300 scale-105 z-20 font-bold'
              : isNodeFocused && focusType !== 'none'
              ? 'ring-4 ring-white scale-105'
              : isRoot
              ? 'ring-4 ring-amber-400 ring-offset-2 ring-offset-slate-900 shadow-amber-500/70'
              : ''
          }`}
          title={`${firstName} ${lastName}${maidenFormatted ? ` ${maidenFormatted}` : ''} (${lifespanStr})\n• Клік: фокусувати дерево\n• Подвійний клік: відкрити картку\n• Ctrl+клік / ПКМ: у новій вкладці`}
        >
          <div className="flex items-center justify-between gap-1 min-w-0">
            <div className="flex items-center gap-1.5 truncate min-w-0 flex-1">
              {isTreeRoot ? (
                <span className="text-[12px] shrink-0" title="Корінь родоводу">👑</span>
              ) : isMasked ? (
                <Lock className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
              ) : (
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    isMale ? 'bg-sky-400' : isFemale ? 'bg-rose-400' : 'bg-slate-400'
                  }`}
                />
              )}
              <a
                href={getPersonUrl(p.id)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelectPerson(p.id);
                  }
                }}
                className="font-extrabold text-xs truncate leading-tight tracking-tight hover:underline cursor-pointer"
                title="Клік: відкрити картку • Ctrl+клік / ПКМ: у новій вкладці"
              >
                {lastName} {maidenFormatted && <span className="font-semibold opacity-90">{maidenFormatted} </span>}{firstName !== '—' ? firstName : ''}
              </a>
            </div>

            {!isMasked && (
              <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPerson(p.id);
                  }}
                  className="p-0.5 rounded hover:bg-black/20 dark:hover:bg-white/20 shrink-0 cursor-pointer"
                  title="Переглянути заповнені дані особи"
                >
                  <Eye className="w-2.5 h-2.5" />
                </button>
                <a
                  href={getPersonUrl(p.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-0.5 rounded hover:bg-black/20 dark:hover:bg-white/20 shrink-0 cursor-pointer text-sky-400 hover:text-sky-300"
                  title="Відкрити особу у новій вкладці браузера"
                >
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onEditPerson) {
                      onEditPerson(p.id);
                    } else {
                      onSelectPerson(p.id);
                    }
                  }}
                  className="p-0.5 rounded hover:bg-black/20 dark:hover:bg-white/20 shrink-0 cursor-pointer"
                  title="Редагувати картку"
                >
                  <Pencil className="w-2.5 h-2.5" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-1 text-[10px] opacity-90 min-w-0">
            <span className="truncate font-mono font-medium">
              {shortLifespan || lifespanStr}
            </span>
            {canonicalRod && canonicalRod !== 'Рід' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleClanFocus(canonicalRod);
                }}
                className="text-[9px] px-1 py-0.2 rounded font-bold truncate max-w-[65px] hover:scale-105 transition-transform cursor-pointer"
                style={{
                  backgroundColor: clanColor ? `${clanColor}25` : 'rgba(0,0,0,0.2)',
                  color: clanColor || undefined
                }}
                title={`Рід: ${canonicalRod}. Клікніть для фокусу`}
              >
                {canonicalRod}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 3. Full Standard Detailed Card
  const parentsAvailableCount = (father ? 1 : 0) + (mother ? 1 : 0);
  const isBothCollapsed = node.isParentsCollapsed;
  const isPartiallyCollapsed = !isBothCollapsed && (node.isPaternalCollapsed || node.isMaternalCollapsed);
  const isParentsMenuOpen = selectiveParentsMenuPersonId === p.id;

  return (
    <div
      key={`${node.id}_${node.x}_${node.y}`}
      style={{
        position: 'absolute',
        left: `${node.x}px`,
        top: `${node.y}px`,
        width: `${node.width}px`,
        height: `${node.height}px`,
        borderColor: isNodeInBloodline
          ? bloodlineColor
          : isNodeFocused && focusType !== 'none'
          ? focusColor
          : cardBorderColor,
        borderWidth: isNodeInBloodline ? '2.5px' : (isNodeFocused && focusType !== 'none' ? '2px' : '1px'),
        borderStyle: 'solid',
        opacity: bloodlineActive ? (isNodeInBloodline ? 1 : 0.30) : (isDimmed ? 0.22 : 1),
        filter: isDimmed ? 'grayscale(45%)' : 'none',
        boxShadow: isNodeInBloodline
          ? `0 0 22px ${bloodlineColor}80`
          : (isNodeFocused && focusType !== 'none' ? `0 0 20px ${focusColor}40` : undefined),
        transition: 'opacity 0.25s ease, filter 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease'
      }}
      onMouseEnter={() => onCardMouseEnter(p.id)}
      onMouseLeave={onCardMouseLeave}
      className={`group rounded-xl transition-all cursor-pointer flex flex-col justify-between ${isCompact ? 'p-2' : 'p-3'} select-none relative shadow-xl ${
        isLightCanvas
          ? 'bg-white text-neutral-900 shadow-md hover:shadow-lg'
          : 'bg-[#22262a] text-white shadow-black/40'
      } ${
        isNodeInBloodline
          ? 'ring-2 ring-amber-300 shadow-amber-500/30'
          : isNodeFocused && focusType !== 'none'
          ? 'ring-2 ring-white/70'
          : isRoot
          ? isFemale
            ? 'ring-2 ring-rose-500/90 ring-offset-2 ring-offset-[#22262a] shadow-rose-950/50 shadow-2xl'
            : 'ring-2 ring-sky-500/90 ring-offset-2 ring-offset-[#22262a] shadow-sky-950/50 shadow-2xl'
          : ''
      }`}
      onClick={(e) => {
        e.stopPropagation();
        if (e.metaKey || e.ctrlKey || e.button === 1) {
          openPersonInNewWindow(p.id);
          return;
        }
        if (p.id !== activePersonId) {
          onChangeRoot(p.id);
        }
      }}
      onAuxClick={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          e.stopPropagation();
          openPersonInNewWindow(p.id);
        }
      }}
      onContextMenu={(e) => onContextMenu(e, p.id)}
      title={p.id === activePersonId ? 'Поточна особа • Ctrl+клік або ПКМ: у новій вкладці' : 'Зробити фокусом дерева • Ctrl+клік або ПКМ: у новій вкладці'}
    >
      {/* Bloodline highlight role badge on hover */}
      {bloodlineActive && isNodeInBloodline && (
        <span
          className="absolute -top-2.5 right-3 z-10 px-2 py-0.5 rounded-full font-bold text-[9.5px] flex items-center gap-1 shadow-md border border-white/60 ring-1 select-none animate-in fade-in"
          style={{
            backgroundColor: bloodlineColor,
            color: '#000000'
          }}
          title={
            isHoveredTarget
              ? 'Особа у фокусі наведення'
              : isAncestorOfHovered
              ? 'Прямий предок вибраної особи'
              : 'Прямий нащадок вибраної особи'
          }
        >
          <span>{isHoveredTarget ? '⭐ Фокус' : isAncestorOfHovered ? '▲ Предок' : '▼ Нащадок'}</span>
        </span>
      )}

      {/* Root Person Indicator Badge */}
      {isTreeRoot && (
        <span
          className="absolute -top-2.5 left-3 z-10 px-2 py-0.5 rounded-full bg-amber-500 text-stone-950 font-bold text-[10px] flex items-center gap-1 shadow-md border border-amber-300 ring-1 ring-amber-400/50 select-none"
          title="Коренева особа родоводу"
        >
          <span>👑</span>
          <span>Корінь</span>
        </span>
      )}

      {/* Focused Lineage Badge */}
      {focusType !== 'none' && isNodeFocused && (
        <span
          className="absolute -top-2.5 right-3 z-10 px-2 py-0.5 rounded-full font-bold text-[10px] flex items-center gap-1 shadow-md border border-white/60 ring-1 select-none animate-in fade-in zoom-in-95"
          style={{
            backgroundColor: focusColor,
            color: '#000000'
          }}
          title={`Особа у фокусі (${focusTitle})`}
        >
          <Target className="w-2.5 h-2.5 stroke-[2.5]" />
          <span>У фокусі</span>
        </span>
      )}

      {/* Clan / Rod tag pill at top-left */}
      {canonicalRod && canonicalRod !== 'Рід' && !isTreeRoot && !isCompact && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleClanFocus(canonicalRod);
          }}
          className={`absolute -top-2.5 left-2.5 z-10 px-2 py-0.2 rounded-full text-[9px] font-bold truncate max-w-[95px] border shadow-xs transition-transform hover:scale-105 cursor-pointer ${
            focusType === 'clan' && selectedClanId === canonicalRod
              ? 'ring-1 ring-white shadow-md'
              : ''
          }`}
          style={{
            backgroundColor: clanColor ? `${clanColor}35` : 'rgba(30, 41, 59, 0.85)',
            color: clanColor || '#94a3b8',
            borderColor: clanColor || '#475569'
          }}
          title={`Рід: ${canonicalRod}. Клікніть для фокусу роду`}
        >
          {canonicalRod}
        </button>
      )}

      {/* Selective Single-Person Hide/Collapse Button (for collateral sibling cards) */}
      {!isTreeRoot && isCollateralPerson && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapseSingleSibling(p.id);
          }}
          className={`absolute top-2 left-2 w-5 h-5 rounded-md flex items-center justify-center transition-all cursor-pointer border shadow-xs z-10 ${
            isLightCanvas
              ? 'bg-stone-100 hover:bg-rose-600 text-stone-600 hover:text-white border-stone-300 hover:border-rose-500'
              : 'bg-[#181b1f] hover:bg-rose-600 text-slate-400 hover:text-white border-[#30353c] hover:border-rose-500'
          }`}
          title="Згорнути (сховати) цю особу з дерева"
          aria-label="Згорнути особу з дерева"
        >
          <Minus className="w-3 h-3 stroke-[2.5]" />
        </button>
      )}

      {/* Top Quick-Add (+) Button in corner */}
      {!isReadOnly && !isCompact && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onOpenRelationManager) {
              onOpenRelationManager(p.id);
            }
          }}
          className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center transition-all cursor-pointer border shadow-xs ${
            isLightCanvas
              ? 'bg-stone-100 hover:bg-emerald-600 text-stone-700 hover:text-white border-stone-300 hover:border-emerald-500'
              : 'bg-[#181b1f] hover:bg-emerald-600 text-slate-400 hover:text-white border-[#30353c] hover:border-emerald-400'
          }`}
          title="Додати родича (+ батьків, дітей, подружжя)"
          aria-label="Додати родича"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
      )}

      {/* Top/Left Collapse/Expand Parents Branch Badge ([-]/[+]) */}
      {node.hasParents && (
        <div
          className={`absolute ${
            orientation === 'horizontal'
              ? '-left-3.5 top-1/2 -translate-y-1/2'
              : '-top-3 left-1/2 -translate-x-1/2'
          } z-20 flex items-center shadow-md rounded-full`}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (isBothCollapsed || isPartiallyCollapsed) {
                onToggleCollapseParents(p.id, true);
              } else {
                onToggleCollapseParents(p.id, false);
              }
            }}
            className={`h-5 px-1.5 transition-all duration-200 cursor-pointer flex items-center justify-center text-[10px] font-bold border ${
              parentsAvailableCount > 1 ? 'rounded-l-full' : 'rounded-full'
            } ${
              isBothCollapsed
                ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-400'
                : isPartiallyCollapsed
                ? 'bg-amber-600/90 hover:bg-amber-500 text-white border-amber-300'
                : isLightCanvas
                ? 'bg-[#ece5d8] hover:bg-[#ded5c5] text-stone-900 border-[#cfc3af]'
                : 'bg-[#1e2329] hover:bg-slate-700 text-slate-300 border-[#3b434d]'
            }`}
            title={
              isBothCollapsed
                ? `Розгорнути предків (+${node.parentsCount})`
                : isPartiallyCollapsed
                ? `Розгорнути приховану лінію предків`
                : 'Сховати предків'
            }
            aria-label="Перемикач предків"
          >
            {isBothCollapsed ? (
              <>
                <Plus className="w-2.5 h-2.5 stroke-[3] text-white" />
                <span className="text-[9px] leading-none">{node.parentsCount}</span>
              </>
            ) : isPartiallyCollapsed ? (
              <>
                <Minus className="w-2.5 h-2.5 stroke-[2.5]" />
                <span className="text-[9px] leading-none">+1</span>
              </>
            ) : (
              <Minus className="w-2.5 h-2.5 stroke-[3] text-amber-500" />
            )}
          </button>

          {parentsAvailableCount > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSetSelectiveParentsMenuPersonId(isParentsMenuOpen ? null : p.id);
              }}
              className={`h-5 w-4 flex items-center justify-center rounded-r-full border border-l-0 text-[9px] transition-colors cursor-pointer ${
                isBothCollapsed || isPartiallyCollapsed
                  ? 'bg-amber-700 hover:bg-amber-600 text-white border-amber-400'
                  : isLightCanvas
                  ? 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300'
                  : 'bg-[#22272e] hover:bg-slate-700 text-slate-300 border-[#383e46]'
              }`}
              title="Вибірково обрати лінію предків (батьківська / материнська)"
              aria-label="Вибірково обрати лінію предків"
            >
              <ChevronDown className="w-2.5 h-2.5" />
            </button>
          )}

          {isParentsMenuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className={`absolute ${
                orientation === 'horizontal'
                  ? 'right-full mr-2 top-1/2 -translate-y-1/2'
                  : 'bottom-full mb-2 left-1/2 -translate-x-1/2'
              } w-64 ${
                isLightCanvas
                  ? 'bg-[#fbf9f5] border-[#d8cfbf] text-stone-800 shadow-xl'
                  : 'bg-[#1b1f24] border-[#383e46] text-slate-200 shadow-2xl'
              } border rounded-xl p-2.5 z-50 animate-in fade-in zoom-in-95 select-none text-left`}
            >
              <div
                className={`flex items-center justify-between pb-1.5 mb-1.5 border-b ${
                  isLightCanvas ? 'border-[#e6ded0]' : 'border-[#2d3238]'
                }`}
              >
                <div
                  className={`flex items-center gap-1.5 text-xs font-bold ${
                    isLightCanvas ? 'text-stone-900' : 'text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-amber-500" />
                  <span>Лінії предків ({parentsAvailableCount})</span>
                </div>
                <button
                  type="button"
                  onClick={() => onSetSelectiveParentsMenuPersonId(null)}
                  className={`text-xs p-0.5 cursor-pointer ${
                    isLightCanvas ? 'text-stone-400 hover:text-stone-700' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div
                className={`text-[10px] mb-2 leading-tight ${
                  isLightCanvas ? 'text-stone-500' : 'text-slate-400'
                }`}
              >
                Керуйте показом батьківської та материнської гілок окремо:
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                {father && (
                  <div
                    className={`flex items-center justify-between p-1.5 rounded-lg border text-xs ${
                      isLightCanvas
                        ? 'bg-white border-[#e0d7c7]'
                        : 'bg-[#22272e] border-[#2d3238]'
                    }`}
                  >
                    <div className="min-w-0 pr-1.5">
                      <div className="text-[10px] text-blue-500 font-semibold uppercase tracking-wider">Батько</div>
                      <div className={`font-medium truncate ${isLightCanvas ? 'text-stone-800' : 'text-white'}`}>
                        {father.lastName} {father.firstName}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleCollapseParentBranch(p.id, 'paternal', node.isPaternalCollapsed)}
                      className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors shrink-0 cursor-pointer flex items-center gap-1 ${
                        node.isPaternalCollapsed
                          ? 'bg-amber-600 hover:bg-amber-500 text-white'
                          : isLightCanvas
                          ? 'bg-stone-200 hover:bg-stone-300 text-stone-700'
                          : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                      }`}
                    >
                      {node.isPaternalCollapsed ? (
                        <>
                          <Eye className="w-2.5 h-2.5" />
                          Показати
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-2.5 h-2.5" />
                          Сховати
                        </>
                      )}
                    </button>
                  </div>
                )}

                {mother && (
                  <div
                    className={`flex items-center justify-between p-1.5 rounded-lg border text-xs ${
                      isLightCanvas
                        ? 'bg-white border-[#e0d7c7]'
                        : 'bg-[#22272e] border-[#2d3238]'
                    }`}
                  >
                    <div className="min-w-0 pr-1.5">
                      <div className="text-[10px] text-rose-500 font-semibold uppercase tracking-wider">Мати</div>
                      <div className={`font-medium truncate ${isLightCanvas ? 'text-stone-800' : 'text-white'}`}>
                        {mother.lastName ? `${mother.lastName} ` : ''}
                        {(mother.name?.maidenName || mother.maidenName) && (mother.name?.maidenName || mother.maidenName) !== mother.lastName && (
                          <span className="text-amber-600 dark:text-amber-300 font-normal">({mother.name?.maidenName || mother.maidenName}) </span>
                        )}
                        {mother.firstName}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleCollapseParentBranch(p.id, 'maternal', node.isMaternalCollapsed)}
                      className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors shrink-0 cursor-pointer flex items-center gap-1 ${
                        node.isMaternalCollapsed
                          ? 'bg-amber-600 hover:bg-amber-500 text-white'
                          : isLightCanvas
                          ? 'bg-stone-200 hover:bg-stone-300 text-stone-700'
                          : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                      }`}
                    >
                      {node.isMaternalCollapsed ? (
                        <>
                          <Eye className="w-2.5 h-2.5" />
                          Показати
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-2.5 h-2.5" />
                          Сховати
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div
                className={`flex items-center justify-between gap-1.5 mt-2 pt-1.5 border-t ${
                  isLightCanvas ? 'border-[#e6ded0]' : 'border-[#2d3238]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onToggleCollapseParents(p.id, true)}
                  className={`flex-1 py-1 text-center text-[10px] font-semibold rounded transition-colors cursor-pointer ${
                    isLightCanvas
                      ? 'bg-[#ede6d8] hover:bg-[#e2d9c8] text-amber-800'
                      : 'bg-[#282e36] hover:bg-[#323942] text-amber-300'
                  }`}
                >
                  Показати обох
                </button>
                <button
                  type="button"
                  onClick={() => onToggleCollapseParents(p.id, false)}
                  className={`flex-1 py-1 text-center text-[10px] font-semibold rounded transition-colors cursor-pointer ${
                    isLightCanvas
                      ? 'bg-[#ede6d8] hover:bg-[#e2d9c8] text-stone-700'
                      : 'bg-[#282e36] hover:bg-[#323942] text-slate-300'
                  }`}
                >
                  Сховати обох
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isCompact ? (
        <div className="flex items-center gap-2 h-full my-auto px-1 min-w-0">
          <a
            href={getPersonUrl(p.id)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
                e.preventDefault();
                e.stopPropagation();
                onSelectPerson(p.id);
              }
            }}
            className="relative shrink-0 block cursor-pointer"
            title="Клік: відкрити картку • Ctrl+клік або ПКМ: у новій вкладці"
          >
            {isMasked ? (
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center border shadow-xs ${
                  isLightCanvas
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : 'bg-emerald-950/80 border-emerald-700/60 text-emerald-400'
                }`}
                title="Дані живої особи захищено"
              >
                <Lock className="w-3.5 h-3.5" />
              </div>
            ) : p.avatarUrl || p.photoUrl ? (
              <img
                src={p.avatarUrl || p.photoUrl}
                alt={firstName}
                className="w-7 h-7 rounded-full object-cover border border-[#47515c] shadow-xs"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center border shadow-xs ${
                  isMale
                    ? 'bg-[#0f4f6e] border-[#0284c7]/50 text-[#38bdf8]'
                    : isFemale
                    ? 'bg-[#6d1b4a] border-[#e11d48]/50 text-[#f472b6]'
                    : isLightCanvas
                    ? 'bg-slate-200 border-slate-300 text-slate-700'
                    : 'bg-slate-700 border-slate-600 text-slate-300'
                }`}
              >
                <User className="w-3.5 h-3.5 stroke-[1.8]" />
              </div>
            )}
            {isRoot && (
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border border-[#22262a]" />
            )}
          </a>

          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex items-center justify-between gap-1 min-w-0">
              <a
                href={getPersonUrl(p.id)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelectPerson(p.id);
                  }
                }}
                className={`font-bold text-[12px] leading-tight truncate transition-colors hover:underline block cursor-pointer ${
                  isLightCanvas
                    ? 'text-neutral-900 hover:text-sky-600'
                    : 'text-white hover:text-sky-400'
                }`}
                title={`${lastName}${maidenFormatted ? ` ${maidenFormatted}` : ''} ${firstName}\n• Клік: відкрити картку • Ctrl+клік або ПКМ: у новій вкладці`}
              >
                {lastName} {maidenFormatted && <span className={`font-semibold text-[11px] ${isLightCanvas ? 'text-amber-800' : 'text-amber-300'}`}>{maidenFormatted} </span>}{firstName !== '—' ? firstName : ''}
              </a>
              {!isMasked && (
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPerson(p.id);
                    }}
                    className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 shrink-0 cursor-pointer text-amber-600 dark:text-amber-400"
                    title="Переглянути заповнені дані особи"
                  >
                    <Eye className="w-2.5 h-2.5" />
                  </button>
                  <a
                    href={getPersonUrl(p.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 shrink-0 cursor-pointer text-sky-400 hover:text-sky-300"
                    title="Відкрити особу у новій вкладці браузера"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onEditPerson) {
                        onEditPerson(p.id);
                      } else {
                        onSelectPerson(p.id);
                      }
                    }}
                    className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 shrink-0 cursor-pointer"
                    title="Редагувати особу"
                  >
                    <Pencil className="w-2.5 h-2.5 text-slate-400 hover:text-white" />
                  </button>
                </div>
              )}

              {matchedDuplicate && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetActiveMergePair(matchedDuplicate);
                  }}
                  className="p-0.5 rounded bg-amber-500 hover:bg-amber-400 text-stone-950 shrink-0 cursor-pointer shadow-xs ml-0.5"
                  title={`Виявлено дублікат (${matchedDuplicate.confidence}%). Клікніть для об'єднання.`}
                >
                  <GitMerge className="w-2.5 h-2.5 stroke-[2.5]" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-1 mt-0.5 min-w-0">
              <span
                className={`text-[10px] font-mono truncate font-medium ${
                  isLightCanvas ? 'text-neutral-700' : 'text-[#94a3b8]'
                }`}
              >
                {shortLifespan || lifespanStr}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {node.isSpouseNode && node.marriageStatus === 'Divorced' && (
                  <span title="Розлучення" className="text-[9px]">💔</span>
                )}
                {node.isSpouseNode && node.marriageStatus === 'Widowed' && (
                  <span title="Вдівство" className="text-[9px]">✝️</span>
                )}
                <span
                  className={`text-[9px] font-semibold px-1 rounded shrink-0 ${
                    isMale
                      ? 'text-sky-400 bg-sky-950/40 border border-sky-800/40'
                      : isFemale
                      ? 'text-rose-400 bg-rose-950/40 border border-rose-800/40'
                      : 'text-slate-400'
                  }`}
                >
                  {isMale ? 'чол.' : isFemale ? 'жін.' : ''}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Centered Avatar */}
          <div className="flex flex-col items-center mt-1">
            <a
              href={getPersonUrl(p.id)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelectPerson(p.id);
                }
              }}
              className="relative block cursor-pointer hover:opacity-95 transition-opacity"
              title="Клік: відкрити картку • Ctrl+клік або ПКМ: у новій вкладці"
            >
              {isMasked ? (
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-inner ${
                    isLightCanvas
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                      : 'bg-emerald-950/80 border-emerald-700/60 text-emerald-400'
                  }`}
                  title="Дані живої особи захищено (доступно для білого списку)"
                >
                  <Lock className="w-5 h-5" />
                </div>
              ) : p.avatarUrl || p.photoUrl ? (
                <img
                  src={p.avatarUrl || p.photoUrl}
                  alt={firstName}
                  className="w-12 h-12 rounded-full object-cover border-2 border-[#47515c] shadow-md"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-inner ${
                    isMale
                      ? 'bg-[#0f4f6e] border-[#0284c7]/50 text-[#38bdf8]'
                      : isFemale
                      ? 'bg-[#6d1b4a] border-[#e11d48]/50 text-[#f472b6]'
                      : isLightCanvas
                      ? 'bg-slate-200 border-slate-300 text-slate-700'
                      : 'bg-slate-700 border-slate-600 text-slate-300'
                  }`}
                >
                  <User className="w-6 h-6 stroke-[1.8]" />
                </div>
              )}
              {isRoot && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#22262a]" />
              )}
            </a>

            {node.isSpouseNode && (node.marriageStatus === 'Divorced' || node.marriageStatus === 'Widowed') && (
              <div className="flex items-center justify-center gap-1 mt-1 flex-wrap">
                {node.marriageStatus === 'Divorced' && (
                  <span className="px-1 py-0.5 rounded text-[9px] font-medium bg-rose-950/80 border border-rose-800 text-rose-300">
                    💔 Розлучення
                  </span>
                )}
                {node.marriageStatus === 'Widowed' && (
                  <span className="px-1 py-0.5 rounded text-[9px] font-medium bg-stone-800 border border-stone-600 text-stone-300">
                    ✝️ Вдівство
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Name & Genealogical Information */}
          <div className="text-center my-auto px-0.5">
            <a
              href={getPersonUrl(p.id)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelectPerson(p.id);
                }
              }}
              className="block hover:underline cursor-pointer"
              title="Клік: відкрити картку • Ctrl+клік або ПКМ: у новій вкладці"
            >
              <h4 className={`font-bold text-[13px] leading-tight truncate transition-colors ${
                isLightCanvas
                  ? 'text-neutral-900 group-hover:text-emerald-700'
                  : 'text-white group-hover:text-emerald-400'
              }`}>
                {firstName}
              </h4>
              <h4 className={`font-bold text-[13px] leading-tight truncate transition-colors ${
                isLightCanvas
                  ? 'text-neutral-900 group-hover:text-emerald-700'
                  : 'text-white group-hover:text-emerald-400'
              }`} title={maidenFormatted ? `${lastName} ${maidenFormatted}` : lastName}>
                {lastName} {maidenFormatted && (
                  <span className={`font-semibold text-[11px] ${
                    isLightCanvas ? 'text-amber-800' : 'text-amber-300'
                  }`}>
                    {maidenFormatted}
                  </span>
                )}
              </h4>
            </a>

            <div className={`text-[11px] mt-1.5 font-medium tracking-tight ${
              isLightCanvas ? 'text-neutral-700 font-semibold' : 'text-[#94a3b8]'
            }`}>
              {lifespanStr}
            </div>

            <div className={`text-[10px] font-mono tracking-wider mt-0.5 ${
              isLightCanvas ? 'text-neutral-600 font-medium' : 'text-[#64748b]'
            }`}>
              {fsCode}
            </div>

            {matchedDuplicate && (
              <div className="flex justify-center mt-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetActiveMergePair(matchedDuplicate);
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/25 hover:bg-amber-500/40 border border-amber-500/60 text-amber-300 hover:text-amber-200 font-bold text-[9.5px] cursor-pointer transition-transform hover:scale-105 shadow-xs"
                  title={`Виявлено дублікат (${matchedDuplicate.confidence}%): ${
                    matchedDuplicate.personB.id === p.id
                      ? `${matchedDuplicate.personA.lastName || ''} ${matchedDuplicate.personA.firstName || ''}`
                      : `${matchedDuplicate.personB.lastName || ''} ${matchedDuplicate.personB.firstName || ''}`
                  }. Натисніть, щоб об'єднати.`}
                >
                  <GitMerge className="w-2.5 h-2.5 text-amber-400 stroke-[2.5]" />
                  <span>Об'єднати ({matchedDuplicate.confidence}%)</span>
                </button>
              </div>
            )}

            {p.tags && p.tags.length > 0 && (
              <div className="flex items-center justify-center gap-1 mt-1 flex-wrap overflow-hidden max-h-[36px]">
                {p.tags.slice(0, 2).map((tag, tIdx) => {
                  const clean = tag.replace(/^#+/, '');
                  return (
                    <span
                      key={tIdx}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-semibold truncate max-w-[70px] ${
                        isLightCanvas
                          ? 'bg-amber-100 text-amber-900 border border-amber-300/80'
                          : 'bg-amber-950/50 text-amber-300 border border-amber-800/60'
                      }`}
                      title={`#${clean}`}
                    >
                      #{clean}
                    </span>
                  );
                })}
                {p.tags.length > 2 && (
                  <span
                    className={`px-1 py-0.5 rounded text-[9px] font-bold ${
                      isLightCanvas
                        ? 'bg-stone-200 text-stone-700'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                    title={p.tags.map((t) => `#${t.replace(/^#+/, '')}`).join(', ')}
                  >
                    +{p.tags.length - 2}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Bottom Source & Document Badges */}
          <div className={`flex items-center justify-center gap-1.5 pt-1.5 border-t ${
            isLightCanvas ? 'border-stone-200' : 'border-[#2e343c]'
          }`}>
            {isMasked ? (
              <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold py-0.5">
                <Shield className="w-3.5 h-3.5" />
                <span>Захищено</span>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPerson(p.id);
                  }}
                  className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors cursor-pointer ${
                    isLightCanvas
                      ? 'bg-amber-50 hover:bg-amber-600 text-amber-800 hover:text-white border-amber-300'
                      : 'bg-amber-950/40 hover:bg-amber-600 text-amber-400 hover:text-white border-amber-800/60'
                  }`}
                  title="Переглянути заповнені дані особи"
                >
                  <Eye className="w-3 h-3" />
                </button>

                <a
                  href={getPersonUrl(p.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors cursor-pointer ${
                    isLightCanvas
                      ? 'bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border-blue-300'
                      : 'bg-blue-950/40 hover:bg-blue-600 text-blue-400 hover:text-white border-blue-800/60'
                  }`}
                  title="Відкрити картку цієї особи у новій вкладці браузера"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onEditPerson) {
                      onEditPerson(p.id);
                    } else {
                      onSelectPerson(p.id);
                    }
                  }}
                  className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors cursor-pointer ${
                    isLightCanvas
                      ? 'bg-sky-50 hover:bg-sky-600 text-sky-800 hover:text-white border-sky-300'
                      : 'bg-[#0e7490]/30 hover:bg-sky-600 text-[#38bdf8] hover:text-white border-[#0e7490]/50'
                  }`}
                  title="Редагувати особу"
                >
                  <Pencil className="w-3 h-3" />
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenRelationManager) {
                      onOpenRelationManager(p.id);
                    }
                  }}
                  className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors cursor-pointer ${
                    isLightCanvas
                      ? 'bg-stone-100 hover:bg-emerald-600 text-stone-700 hover:text-white border-stone-300'
                      : 'bg-[#334155]/60 hover:bg-emerald-700/80 text-slate-300 hover:text-white border-slate-600/50'
                  }`}
                  title="Родинні зв'язки"
                >
                  <GitFork className="w-3 h-3 rotate-90" />
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleDirectAncestorsFocus(p.id);
                  }}
                  className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors cursor-pointer ${
                    focusPersonId === p.id && focusType !== 'none'
                      ? 'bg-amber-500 text-stone-950 border-amber-300 ring-1 ring-amber-400'
                      : isLightCanvas
                      ? 'bg-amber-50 hover:bg-amber-600 text-amber-800 hover:text-white border-amber-300'
                      : 'bg-amber-950/40 hover:bg-amber-600 text-amber-400 hover:text-white border-amber-800/60'
                  }`}
                  title={
                    focusPersonId === p.id && focusType !== 'none'
                      ? 'Вимкнути фокус лінії'
                      : 'Сфокусувати пряму лінію предків'
                  }
                >
                  <Target className="w-3 h-3" />
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenContextMenuAtButton(e, p.id);
                  }}
                  className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors cursor-pointer ${
                    isLightCanvas
                      ? 'bg-stone-100 hover:bg-stone-300 text-stone-700 hover:text-black border-stone-300'
                      : 'bg-[#334155]/60 hover:bg-slate-600 text-slate-300 hover:text-white border-slate-600/50'
                  }`}
                  title="Меню дій з особою (у т.ч. видалення предків)"
                >
                  <MoreVertical className="w-3 h-3" />
                </button>

                {matchedDuplicate && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetActiveMergePair(matchedDuplicate);
                    }}
                    className="w-5 h-5 rounded-md flex items-center justify-center border transition-all cursor-pointer bg-amber-500 hover:bg-amber-400 text-stone-950 border-amber-300 shadow-xs"
                    title={`Знайдено дублікат (${matchedDuplicate.confidence}%). Натисніть для об'єднання.`}
                  >
                    <GitMerge className="w-3 h-3 stroke-[2.5]" />
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Bottom/Right Collapse/Expand Children Branch Badge */}
      {node.hasChildren && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapseChildren(p.id, node.isChildrenCollapsed);
          }}
          className={`absolute ${
            orientation === 'horizontal'
              ? '-right-2.5 top-1/2 -translate-y-1/2'
              : '-bottom-2.5 left-1/2 -translate-x-1/2'
          } z-10 h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center gap-0.5 shadow-md transition-all cursor-pointer border ${
            node.isChildrenCollapsed
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 scale-105'
              : isLightCanvas
              ? 'bg-[#ece5d8] hover:bg-[#ded5c5] text-stone-900 border-[#cfc3af]'
              : 'bg-[#1e2329] hover:bg-slate-700 text-slate-300 border-[#3b434d]'
          }`}
          title={node.isChildrenCollapsed ? `Розгорнути нащадків (+${node.descendantsCount || node.childrenCount})` : 'Сховати нащадків'}
          aria-label="Перемикач нащадків"
        >
          {node.isChildrenCollapsed ? (
            <>
              <Plus className="w-2.5 h-2.5 stroke-[3] text-white" />
              <span className="text-[9px] leading-none">{node.descendantsCount || node.childrenCount}</span>
            </>
          ) : (
            <Minus className="w-2.5 h-2.5 stroke-[3] text-emerald-500" />
          )}
        </button>
      )}

      {/* Lateral / Sibling Branch Collapse/Expand Controller */}
      {(node.hasSiblings || collateralSiblings.length > 0) && (() => {
        let siblingSide: 'left' | 'right' = 'right';
        let sideDescription = 'сестер/братів справа';
        if (node.isSpouseNode) {
          siblingSide = 'right';
          sideDescription = 'осіб справа (жіноча лінія)';
        } else if (node.spouseId) {
          siblingSide = 'left';
          sideDescription = 'осіб зліва (чоловіча лінія)';
        } else {
          const hasLeftSibling = personSiblings.some((s) => {
            const sn = nodeByPersonId.get(s.id);
            return sn && sn.generation === node.generation && sn.x < node.x;
          });
          if (hasLeftSibling) {
            siblingSide = 'left';
            sideDescription = 'осіб зліва';
          } else {
            siblingSide = 'right';
            sideDescription = 'осіб справа';
          }
        }

        const collapsedCollaterals = collateralSiblings.filter(
          (s) => collapsedSiblings.has(s.id) || !showSiblings
        );
        const visibleCollaterals = collateralSiblings.filter(
          (s) => !collapsedSiblings.has(s.id) && showSiblings
        );
        const isAllCollapsed = collateralSiblings.length > 0 && collapsedCollaterals.length === collateralSiblings.length;
        const isPartiallyCollapsed = collapsedCollaterals.length > 0 && visibleCollaterals.length > 0;
        const displayCollapsedCount = collapsedCollaterals.length || node.siblingsCount || 1;
        const displayVisibleCount = visibleCollaterals.length;
        const isSiblingsMenuOpen = selectiveMenuPersonId === p.id;

        return (
          <div
            className={`absolute ${
              orientation === 'horizontal'
                ? (siblingSide === 'left' ? '-top-3 left-1/2 -translate-x-1/2' : '-bottom-3 left-1/2 -translate-x-1/2')
                : (siblingSide === 'left' ? '-left-3.5 top-1/2 -translate-y-1/2' : '-right-3.5 top-1/2 -translate-y-1/2')
            } z-30 flex items-center shadow-md rounded-full`}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isAllCollapsed || isPartiallyCollapsed) {
                  onExpandAllSiblingsOfPerson(p.id);
                } else {
                  onCollapseAllSiblingsOfPerson(p.id);
                }
              }}
              className={`h-6 px-1.5 transition-all duration-200 cursor-pointer flex items-center justify-center text-[10px] font-bold ${
                collateralSiblings.length > 1
                  ? siblingSide === 'left' ? 'rounded-l-full' : 'rounded-l-full'
                  : 'rounded-full'
              } ${
                isAllCollapsed
                  ? 'bg-amber-600 hover:bg-amber-500 text-white border-2 border-amber-300 ring-2 ring-amber-500/30 gap-0.5'
                  : isPartiallyCollapsed
                  ? 'bg-amber-600/90 hover:bg-amber-500 text-white border border-amber-300 gap-0.5'
                  : isLightCanvas
                  ? 'bg-white hover:bg-rose-50 text-stone-600 hover:text-rose-600 border border-stone-300 hover:border-rose-400'
                  : 'bg-[#181b1f] hover:bg-rose-950/80 text-slate-300 hover:text-rose-300 border border-[#383e46] hover:border-rose-600'
              }`}
              title={
                isAllCollapsed
                  ? `Розгорнути всі ${sideDescription} (+${displayCollapsedCount})`
                  : isPartiallyCollapsed
                  ? `Згорнути решту ${sideDescription} (видимо ${displayVisibleCount}, приховано ${displayCollapsedCount})`
                  : `Згорнути всі ${sideDescription} (${displayVisibleCount || 1} осіб)`
              }
              aria-label="Згорнути або розгорнути бічну гілку"
            >
              {isAllCollapsed ? (
                <>
                  <Plus className="w-3 h-3 stroke-[3]" />
                  <span>{displayCollapsedCount}</span>
                </>
              ) : isPartiallyCollapsed ? (
                <>
                  <Minus className="w-3 h-3 stroke-[2.5]" />
                  <span>+{displayCollapsedCount}</span>
                </>
              ) : (
                <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
              )}
            </button>

            {collateralSiblings.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSetSelectiveMenuPersonId(isSiblingsMenuOpen ? null : p.id);
                }}
                className={`h-6 w-4 flex items-center justify-center rounded-r-full border border-l-0 text-[9px] transition-colors cursor-pointer ${
                  isAllCollapsed || isPartiallyCollapsed
                    ? 'bg-amber-700 hover:bg-amber-600 text-white border-amber-300'
                    : isLightCanvas
                    ? 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300'
                    : 'bg-[#22272e] hover:bg-slate-700 text-slate-300 border-[#383e46]'
                }`}
                title="Вибірково обрати осіб (братів/сестер)"
                aria-label="Вибірково обрати осіб"
              >
                <ChevronDown className="w-2.5 h-2.5" />
              </button>
            )}

            {isSiblingsMenuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className={`absolute ${
                  orientation === 'horizontal'
                    ? (siblingSide === 'left' ? 'bottom-full mb-2 left-1/2 -translate-x-1/2' : 'top-full mt-2 left-1/2 -translate-x-1/2')
                    : (siblingSide === 'left' ? 'right-full mr-2 top-1/2 -translate-y-1/2' : 'left-full ml-2 top-1/2 -translate-y-1/2')
                } w-64 bg-[#1b1f24] border border-[#383e46] rounded-xl shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 select-none text-left`}
              >
                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[#2d3238]">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                    <span>Брати та сестри ({collateralSiblings.length})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSetSelectiveMenuPersonId(null)}
                    className="text-slate-400 hover:text-white text-xs p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="text-[10px] text-slate-400 mb-2 leading-tight">
                  Клікніть на особу, щоб вибірково сховати або показати її у дереві:
                </div>

                <div className="flex items-center gap-1.5 mb-2">
                  <button
                    type="button"
                    onClick={() => onCollapseAllSiblingsOfPerson(p.id)}
                    className="flex-1 py-1 px-1.5 text-[10px] font-semibold rounded bg-[#252a30] hover:bg-rose-950/70 text-slate-300 hover:text-rose-300 border border-[#383e46] hover:border-rose-600 transition-colors cursor-pointer text-center"
                  >
                    Згорнути всіх
                  </button>
                  <button
                    type="button"
                    onClick={() => onExpandAllSiblingsOfPerson(p.id)}
                    className="flex-1 py-1 px-1.5 text-[10px] font-semibold rounded bg-[#252a30] hover:bg-emerald-950/70 text-slate-300 hover:text-emerald-300 border border-[#383e46] hover:border-emerald-600 transition-colors cursor-pointer text-center"
                  >
                    Розгорнути всіх
                  </button>
                </div>

                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {collateralSiblings.map((sib, sIdx) => {
                    const isCollapsed = collapsedSiblings.has(sib.id) || !showSiblings;
                    const sibMaiden = (sib.name?.maidenName || sib.maidenName || '').trim();
                    const sibMaidenStr = sibMaiden && sibMaiden.toLowerCase() !== (sib.lastName || '').toLowerCase() ? ` (${sibMaiden})` : '';
                    const sibName = `${sib.firstName || ''} ${sib.lastName || ''}${sibMaidenStr}`.trim() || 'Без імені';
                    const relationLabel = sib.gender === 'female' ? 'сестра' : 'брат';
                    return (
                      <div
                        key={`${sib.id}_${sIdx}`}
                        className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-[#22262c] border border-[#2e343c] text-xs hover:border-slate-500 transition-colors"
                      >
                        <div className="flex items-center gap-1.5 min-w-0 pr-1">
                          <div
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isCollapsed ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                          />
                          <div className="truncate">
                            <span className="text-white font-medium text-xs truncate block">
                              {sibName}
                            </span>
                            <span className="text-[10px] text-slate-400 leading-none">
                              {relationLabel}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onToggleCollapseSingleSibling(sib.id, p.id)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors shrink-0 cursor-pointer ${
                            isCollapsed
                              ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-400'
                              : 'bg-slate-700 hover:bg-rose-700 text-slate-200 hover:text-white border-slate-600'
                          }`}
                          title={isCollapsed ? 'Показати в дереві' : 'Сховати з дерева'}
                        >
                          {isCollapsed ? '+ Показати' : '– Сховати'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};

function areTreePersonCardPropsEqual(prev: TreePersonCardProps, next: TreePersonCardProps): boolean {
  // If identity or coordinates changed
  if (prev.node.id !== next.node.id) return false;
  if (prev.node.x !== next.node.x || prev.node.y !== next.node.y) return false;
  if (prev.node.width !== next.node.width || prev.node.height !== next.node.height) return false;

  // Person object change (name, photo, tags, dates)
  if (prev.node.person !== next.node.person) return false;

  // Selection & Tree Root
  if (prev.activePersonId !== next.activePersonId) {
    const wasActive = prev.node.person.id === prev.activePersonId;
    const isNowActive = next.node.person.id === next.activePersonId;
    if (wasActive !== isNowActive) return false;
  }
  if (prev.rootPersonId !== next.rootPersonId) {
    const wasRoot = prev.node.person.id === prev.rootPersonId;
    const isNowRoot = next.node.person.id === next.rootPersonId;
    if (wasRoot !== isNowRoot) return false;
  }

  // Hover state (critical for mouse movement performance!)
  if (prev.isCardHovered !== next.isCardHovered) return false;

  // LOD mode changes
  if (prev.isMicroLOD !== next.isMicroLOD || prev.isPillLOD !== next.isPillLOD) return false;
  if (prev.isCompact !== next.isCompact) return false;
  if (prev.isLightCanvas !== next.isLightCanvas) return false;
  if (prev.isWhitelisted !== next.isWhitelisted) return false;
  if (prev.orientation !== next.orientation) return false;
  if (prev.isReadOnly !== next.isReadOnly) return false;

  // Bloodline highlights
  if (prev.isNodeInBloodline !== next.isNodeInBloodline) return false;
  if (prev.bloodlineActive !== next.bloodlineActive) return false;
  if (prev.isHoveredTarget !== next.isHoveredTarget) return false;
  if (prev.isAncestorOfHovered !== next.isAncestorOfHovered) return false;
  if (prev.isDescendantOfHovered !== next.isDescendantOfHovered) return false;
  if (prev.bloodlineColor !== next.bloodlineColor) return false;

  // Lineage focus highlights
  if (prev.isNodeFocused !== next.isNodeFocused) return false;
  if (prev.isDimmed !== next.isDimmed) return false;
  if (prev.focusType !== next.focusType) return false;
  if (prev.focusColor !== next.focusColor) return false;
  if (prev.focusTitle !== next.focusTitle) return false;
  if (prev.selectedClanId !== next.selectedClanId) return false;
  if (prev.focusPersonId !== next.focusPersonId) {
    const wasFocus = prev.node.person.id === prev.focusPersonId;
    const isNowFocus = next.node.person.id === next.focusPersonId;
    if (wasFocus !== isNowFocus) return false;
  }

  // Duplicate pairs
  if (prev.matchedDuplicate !== next.matchedDuplicate) return false;

  // Branch collapse states on this specific node
  if (prev.node.isParentsCollapsed !== next.node.isParentsCollapsed) return false;
  if (prev.node.isPaternalCollapsed !== next.node.isPaternalCollapsed) return false;
  if (prev.node.isMaternalCollapsed !== next.node.isMaternalCollapsed) return false;
  if (prev.node.isChildrenCollapsed !== next.node.isChildrenCollapsed) return false;
  if (prev.node.isSiblingsCollapsed !== next.node.isSiblingsCollapsed) return false;

  // Popover menus state for this person
  const pId = prev.node.person.id;
  const prevParentsOpen = prev.selectiveParentsMenuPersonId === pId;
  const nextParentsOpen = next.selectiveParentsMenuPersonId === pId;
  if (prevParentsOpen !== nextParentsOpen) return false;

  const prevSiblingsOpen = prev.selectiveMenuPersonId === pId;
  const nextSiblingsOpen = next.selectiveMenuPersonId === pId;
  if (prevSiblingsOpen !== nextSiblingsOpen) return false;

  // Siblings collapse membership check
  if (prev.showSiblings !== next.showSiblings) return false;
  if (prev.collapsedSiblings !== next.collapsedSiblings) {
    const prevCollapsed = prev.collapsedSiblings.has(pId);
    const nextCollapsed = next.collapsedSiblings.has(pId);
    if (prevCollapsed !== nextCollapsed) return false;
  }

  return true;
}

export const TreePersonCard = memo(TreePersonCardComponent, areTreePersonCardPropsEqual);
