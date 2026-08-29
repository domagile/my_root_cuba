/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  GitFork,
  ArrowDownUp,
  User,
  Plus,
  BookOpen,
  FileText,
  Calendar,
  X,
  Printer,
  Download,
  Upload,
  Image as ImageIcon,
  ChevronDown,
  PieChart,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  MapPin,
  Compass
} from 'lucide-react';
import { GenealogyDatabase, TreeLayoutType, Person } from '../../types/genealogy';
import {
  calculateClassicFamilyTreeLayout,
  calculateAncestorsLayout,
  calculateDescendantsLayout,
  getGenealogyCode,
  formatLifespan,
  CLASSIC_CARD_WIDTH,
  CLASSIC_CARD_HEIGHT
} from '../../utils/treeLayout';
import { getFullName } from '../../utils/relationship';
import { useUIStore } from '../../../stores/useUIStore';
import { getThemeConfig } from '../../../utils/theme';
import { PngBranchManagerModal } from '../../../components/Tree/PngBranchManagerModal';

interface TreeViewProps {
  database: GenealogyDatabase;
  activePersonId: string;
  onSelectPerson: (id: string) => void;
  onOpenAddChild: (parentId: string) => void;
  onOpenAddParent: (childId: string) => void;
  onChangeRoot: (id: string) => void;
  onOpenRelationManager?: (personId: string) => void;
  onSwitchToFan?: () => void;
}

export const TreeView: React.FC<TreeViewProps> = ({
  database,
  activePersonId,
  onSelectPerson,
  onOpenAddChild,
  onOpenAddParent,
  onChangeRoot,
  onOpenRelationManager,
  onSwitchToFan
}) => {
  const [layoutType, setLayoutType] = useState<TreeLayoutType>('ancestors');
  const [generations, setGenerations] = useState<number>(8);
  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 80, y: 80 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showMinimap, setShowMinimap] = useState<boolean>(true);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isPngModalOpen, setIsPngModalOpen] = useState<boolean>(false);
  const [pngModalTab, setPngModalTab] = useState<'export' | 'import'>('export');
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerDimensions, setContainerDimensions] = useState<{ width: number; height: number }>({
    width: 1200,
    height: 800
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        setContainerDimensions({
          width: containerRef.current.clientWidth || 1200,
          height: containerRef.current.clientHeight || 800
        });
      }
    };
    updateSize();
    const resizeObs = new ResizeObserver(updateSize);
    resizeObs.observe(containerRef.current);
    return () => resizeObs.disconnect();
  }, []);

  // Compute Layout (Classic Family Pedigree with grouped spouses and orthogonal lines)
  const layout = useMemo(() => {
    return calculateClassicFamilyTreeLayout(database, activePersonId, generations);
  }, [database, activePersonId, generations]);

  // Viewport Culling Bounding Box
  const visibleBounds = useMemo(() => {
    const margin = 250;
    return {
      minX: (-pan.x - margin) / scale,
      maxX: (-pan.x + containerDimensions.width + margin) / scale,
      minY: (-pan.y - margin) / scale,
      maxY: (-pan.y + containerDimensions.height + margin) / scale
    };
  }, [pan.x, pan.y, scale, containerDimensions]);

  // Culled Nodes: Only render nodes that intersect visible viewport
  const visibleNodes = useMemo(() => {
    if (layout.nodes.length < 25) return layout.nodes;
    return layout.nodes.filter((node) => {
      const nodeRight = node.x + (node.width || CLASSIC_CARD_WIDTH);
      const nodeBottom = node.y + (node.height || CLASSIC_CARD_HEIGHT);
      return (
        nodeRight >= visibleBounds.minX &&
        node.x <= visibleBounds.maxX &&
        nodeBottom >= visibleBounds.minY &&
        node.y <= visibleBounds.maxY
      );
    });
  }, [layout.nodes, visibleBounds]);

  // Culled Links: Only render paths intersecting visible viewport
  const visibleLinks = useMemo(() => {
    if (layout.links.length < 25) return layout.links;
    return layout.links.filter((link) => {
      const minX = Math.min(link.sourceX, link.targetX) - 20;
      const maxX = Math.max(link.sourceX, link.targetX) + 20;
      const minY = Math.min(link.sourceY, link.targetY) - 20;
      const maxY = Math.max(link.sourceY, link.targetY) + 20;
      return (
        maxX >= visibleBounds.minX &&
        minX <= visibleBounds.maxX &&
        maxY >= visibleBounds.minY &&
        minY <= visibleBounds.maxY
      );
    });
  }, [layout.links, visibleBounds]);

  // Level of Detail (LOD)
  const isLowDetail = scale < 0.45;

  const themePalette = useUIStore((s) => s.themePalette);
  const theme = getThemeConfig(themePalette);
  const isDark = theme.category === 'dark';

  const [canvasTheme, setCanvasTheme] = useState<'classic-dark' | 'parchment' | 'emerald'>('classic-dark');

  // Center tree on container dimensions and tree bounding box
  const centerTree = useCallback(() => {
    if (!layout.nodes.length) return;
    const container = containerRef.current;
    const cw = container ? container.clientWidth : containerDimensions.width || 1000;
    const ch = container ? container.clientHeight : containerDimensions.height || 700;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    layout.nodes.forEach((n) => {
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x + (n.width || CLASSIC_CARD_WIDTH));
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y + (n.height || CLASSIC_CARD_HEIGHT));
    });

    const treeW = Math.max(maxX - minX, CLASSIC_CARD_WIDTH);
    const treeH = Math.max(maxY - minY, CLASSIC_CARD_HEIGHT);

    const fitScaleX = (cw - 120) / treeW;
    const fitScaleY = (ch - 120) / treeH;
    const optimalScale = Math.min(Math.max(Math.min(fitScaleX, fitScaleY), 0.65), 1.1);

    const treeCenterX = (minX + maxX) / 2;
    const treeCenterY = (minY + maxY) / 2;

    const newPanX = cw / 2 - treeCenterX * optimalScale;
    const newPanY = ch / 2 - treeCenterY * optimalScale;

    setPan({ x: Math.round(newPanX), y: Math.round(newPanY) });
    setScale(optimalScale);
  }, [layout.nodes, containerDimensions]);

  useEffect(() => {
    const timer = setTimeout(() => {
      centerTree();
    }, 40);
    return () => clearTimeout(timer);
  }, [centerTree, activePersonId]);

  const touchStateRef = useRef<{
    initialDist: number;
    initialScale: number;
    initialPan: { x: number; y: number };
    midPoint: { x: number; y: number };
  } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch Support
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y
      });
      touchStateRef.current = null;
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const midX = (t1.clientX + t2.clientX) / 2;
      const midY = (t1.clientY + t2.clientY) / 2;
      touchStateRef.current = {
        initialDist: Math.max(dist, 10),
        initialScale: scale,
        initialPan: { ...pan },
        midPoint: { x: midX, y: midY }
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      setPan({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y
      });
    } else if (e.touches.length === 2 && touchStateRef.current) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const currentMidX = (t1.clientX + t2.clientX) / 2;
      const currentMidY = (t1.clientY + t2.clientY) / 2;

      const { initialDist, initialScale, initialPan, midPoint } = touchStateRef.current;
      const zoomFactor = currentDist / initialDist;
      const targetScale = Math.min(Math.max(initialScale * zoomFactor, 0.3), 2.5);

      const deltaPanX = currentMidX - midPoint.x;
      const deltaPanY = currentMidY - midPoint.y;

      setScale(targetScale);
      setPan({
        x: initialPan.x + deltaPanX,
        y: initialPan.y + deltaPanY
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      setIsDragging(false);
      touchStateRef.current = null;
    } else if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y
      });
      touchStateRef.current = null;
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    const newScale = Math.min(Math.max(scale * zoomFactor, 0.35), 2.4);
    setScale(newScale);
  };

  const activePerson = database.persons[activePersonId];

  const handlePrint = () => {
    window.print();
  };

  const handleExportSvg = () => {
    if (!layout.nodes.length) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    layout.nodes.forEach((n) => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    });

    const padding = 100;
    const originX = minX - padding;
    const originY = minY - padding;
    const totalWidth = maxX - minX + padding * 2;
    const totalHeight = maxY - minY + padding * 2;

    const escapeXml = (unsafe: string) =>
      unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    let svgContent = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    svgContent += `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="${originX} ${originY} ${totalWidth} ${totalHeight}" style="background:#2d3238; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">\n`;
    svgContent += `<style>
      .node-card { fill: #23272b; rx: 10px; }
      .text-first { fill: #ffffff; font-size: 13px; font-weight: bold; text-anchor: middle; }
      .text-last { fill: #ffffff; font-size: 13px; font-weight: bold; text-anchor: middle; }
      .text-dates { fill: #94a3b8; font-size: 11px; text-anchor: middle; }
      .text-code { fill: #64748b; font-size: 10px; font-family: monospace; text-anchor: middle; }
      .tree-link { fill: none; stroke: #717d8a; stroke-width: 2px; }
    </style>\n`;

    svgContent += `<rect x="${originX}" y="${originY}" width="${totalWidth}" height="${totalHeight}" fill="#2d3238" />\n`;

    // Render orthogonal link paths
    layout.links.forEach((link) => {
      const d = link.path || `M ${link.sourceX} ${link.sourceY} L ${link.targetX} ${link.targetY}`;
      svgContent += `<path d="${d}" class="tree-link" />\n`;
    });

    // Render classic nodes
    layout.nodes.forEach((node) => {
      const p = node.person;
      const isMale = p.gender === 'male' || p.gender === 'M';
      const isFemale = p.gender === 'female' || p.gender === 'F';
      const avatarBg = isMale ? '#0c4a6e' : isFemale ? '#701a4f' : '#334155';
      const avatarStroke = isMale ? '#0284c7' : isFemale ? '#e11d48' : '#64748b';
      const isRoot = p.id === activePersonId;
      const cardBorder = isRoot ? (isFemale ? '#f43f5e' : '#38bdf8') : '#393f47';
      const borderWidth = isRoot ? '2.5' : '1.5';

      const firstName = escapeXml(p.name?.given || p.firstName || '');
      const lastName = escapeXml(p.name?.surname || p.lastName || '');
      const dates = escapeXml(formatLifespan(p));
      const code = escapeXml(getGenealogyCode(p));

      const cx = node.x + node.width / 2;

      svgContent += `<g transform="translate(${node.x}, ${node.y})">\n`;
      svgContent += `  <rect width="${node.width}" height="${node.height}" rx="10" class="node-card" stroke="${cardBorder}" stroke-width="${borderWidth}" />\n`;
      svgContent += `  <circle cx="${node.width / 2}" cy="42" r="23" fill="${avatarBg}" stroke="${avatarStroke}" stroke-width="1.5" />\n`;
      svgContent += `  <text x="${node.width / 2}" y="95" class="text-first">${firstName}</text>\n`;
      svgContent += `  <text x="${node.width / 2}" y="113" class="text-last">${lastName}</text>\n`;
      svgContent += `  <text x="${node.width / 2}" y="133" class="text-dates">${dates}</text>\n`;
      svgContent += `  <text x="${node.width / 2}" y="152" class="text-code">${code}</text>\n`;
      svgContent += `</g>\n`;
    });

    svgContent += `</svg>`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pedigree-tree-${activePerson?.lastName || 'tree'}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-[#23272b] overflow-hidden relative select-none">
      {/* Top Toolbar */}
      <div className="h-14 bg-[#1e2226] border-b border-[#323840] px-4 flex items-center justify-between z-20 shrink-0 print:hidden shadow-md">
        <div className="flex items-center gap-3">
          {/* Layout & Mode Switch */}
          <div className="flex items-center bg-[#15181b] p-0.5 rounded-lg border border-[#2d3238]">
            <button
              onClick={() => setLayoutType('ancestors')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 text-white shadow-sm cursor-pointer"
              title="Класична вертикальна структура родоводу (FamilySearch style)"
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>Класичне дерево</span>
            </button>

            {onSwitchToFan && (
              <button
                onClick={onSwitchToFan}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Перемкнути у віялову діаграму"
              >
                <PieChart className="w-3.5 h-3.5 text-amber-400" />
                <span>Віяло</span>
              </button>
            )}
          </div>

          {/* Generations counter */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-300 bg-[#15181b] border border-[#2d3238] px-3 py-1.5 rounded-lg">
            <span className="text-slate-400">Поколінь:</span>
            {[3, 4, 5, 6, 7, 8, 9].map((g) => (
              <button
                key={g}
                onClick={() => setGenerations(g)}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                  generations === g
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Root Person Selector */}
          <div className="hidden md:flex items-center gap-2">
            <span className="text-xs text-slate-400">Корінь:</span>
            <select
              value={activePersonId}
              onChange={(e) => onChangeRoot(e.target.value)}
              className="bg-[#15181b] text-slate-200 border border-[#2d3238] text-xs rounded-md px-2.5 py-1.5 focus:outline-hidden focus:border-emerald-500 max-w-[210px] truncate cursor-pointer shadow-xs"
            >
              {(Object.values(database.persons) as Person[]).map((p) => (
                <option key={p.id} value={p.id}>
                  {getFullName(p)} {p.birthYear ? `(${p.birthYear})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Export Menu */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setIsExportOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                isExportOpen
                  ? 'bg-slate-700 text-white border-slate-600 shadow-xs'
                  : 'bg-[#15181b] text-slate-300 hover:text-white hover:bg-slate-800 border-[#2d3238]'
              }`}
              title="Експорт та друк дерева"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Експорт</span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isExportOpen ? 'rotate-180' : ''}`} />
            </button>

            {isExportOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-[#1b1f24] border border-[#323840] rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1 text-[10px] uppercase font-bold tracking-wider text-slate-400 border-b border-[#2d3238] mb-1">
                  Збереження та експорт
                </div>
                <button
                  onClick={() => {
                    setPngModalTab('export');
                    setIsPngModalOpen(true);
                    setIsExportOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-slate-200 hover:bg-[#252a30] hover:text-white transition-colors cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <div className="font-bold flex items-center gap-1.5 text-slate-100">
                      <span>Скачати картинку дерева (PNG)</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold">HD</span>
                    </div>
                    <div className="text-[10px] text-slate-400">Висока роздільна здатність, стилі та кольори</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    handleExportSvg();
                    setIsExportOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-slate-200 hover:bg-[#252a30] hover:text-white transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-medium text-slate-200">Скачати векторне дерево (SVG)</div>
                    <div className="text-[10px] text-slate-400">Векторний файл без втрати якості для друку</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    handlePrint();
                    setIsExportOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-slate-200 hover:bg-[#252a30] hover:text-white transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-sky-400 shrink-0" />
                  <div>
                    <div className="font-medium text-slate-200">Роздрукувати / Зберегти в PDF</div>
                    <div className="text-[10px] text-slate-400">Друк на папері або експорт у PDF</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Quick Import PNG Branch Button */}
          <button
            onClick={() => {
              setPngModalTab('import');
              setIsPngModalOpen(true);
            }}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border-emerald-700/60 transition-all cursor-pointer shadow-xs"
            title="Додати нові гілки або родичів з PNG зображення / фотографії схеми"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>+ Гілка з PNG</span>
          </button>

          {/* Canvas Theme Selector */}
          <div className="hidden lg:flex items-center gap-1 bg-[#15181b] border border-[#2d3238] p-1 rounded-lg">
            <button
              onClick={() => setCanvasTheme('classic-dark')}
              className={`px-2 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                canvasTheme === 'classic-dark' ? 'bg-[#2d333b] text-white shadow-xs font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Класичний графітовий фон (як у FamilySearch)"
            >
              Графіт
            </button>
            <button
              onClick={() => setCanvasTheme('parchment')}
              className={`px-2 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                canvasTheme === 'parchment' ? 'bg-amber-200 text-amber-950 font-bold shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Світлий архівний пергамент"
            >
              Пергамент
            </button>
            <button
              onClick={() => setCanvasTheme('emerald')}
              className={`px-2 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                canvasTheme === 'emerald' ? 'bg-emerald-800 text-white shadow-xs font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Смарагдовий ліс"
            >
              Ліс
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-[#15181b] border border-[#2d3238] p-1 rounded-lg">
            <button
              onClick={() => setScale((s) => Math.min(s * 1.15, 2.4))}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
              title="Збільшити"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setScale((s) => Math.max(s * 0.85, 0.35))}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
              title="Зменшити"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={centerTree}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
              title="Центрувати дерево у вікні"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <span className="text-[11px] text-slate-400 font-mono px-2">
              {Math.round(scale * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onWheel={handleWheel}
        className={`flex-1 relative overflow-hidden touch-none ${
          canvasTheme === 'parchment'
            ? 'bg-[#e5ded0]'
            : canvasTheme === 'emerald'
            ? 'bg-[#041a14]'
            : 'bg-[#2d3238]'
        } ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          backgroundImage:
            canvasTheme === 'parchment'
              ? 'radial-gradient(circle at 1px 1px, rgba(120, 90, 50, 0.22) 1px, transparent 0)'
              : canvasTheme === 'emerald'
              ? 'radial-gradient(circle at 1px 1px, rgba(52, 211, 153, 0.18) 1px, transparent 0)'
              : 'radial-gradient(circle at 1px 1px, rgba(140, 155, 170, 0.18) 1px, transparent 0)',
          backgroundSize: '24px 24px',
          touchAction: 'none'
        }}
      >
        {/* World Transform Layer */}
        <div
          className="absolute origin-top-left transition-transform duration-75"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`
          }}
        >
          {/* SVG Orthogonal Links (Image 2 style) */}
          <svg
            className="overflow-visible pointer-events-none absolute inset-0"
            style={{ width: layout.width, height: layout.height }}
          >
            <defs>
              <marker
                id="arrow-down"
                viewBox="0 0 10 10"
                refX="5"
                refY="7"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 1 2 L 5 7 L 9 2" fill="none" stroke="#717d8a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </marker>
              <marker
                id="arrow-up"
                viewBox="0 0 10 10"
                refX="5"
                refY="3"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 1 8 L 5 3 L 9 8" fill="none" stroke="#717d8a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </marker>
            </defs>

            {visibleLinks.map((link) => {
              const pathData = link.path || `M ${link.sourceX} ${link.sourceY} L ${link.targetX} ${link.targetY}`;
              const isMarriage = link.type === 'marriage';

              return (
                <g key={link.id}>
                  <path
                    d={pathData}
                    fill="none"
                    stroke={isMarriage ? '#8b96a2' : '#6c7782'}
                    strokeWidth={isMarriage ? '2' : '1.8'}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {link.arrow === 'down' && (
                    <path
                      d={`M ${link.targetX - 4} ${link.targetY - 6} L ${link.targetX} ${link.targetY - 1} L ${link.targetX + 4} ${link.targetY - 6}`}
                      fill="none"
                      stroke="#8b96a2"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                </g>
              );
            })}
          </svg>

          {/* HTML Classic Pedigree Nodes (Image 2 style) */}
          {visibleNodes.map((node) => {
            const p = node.person;
            const isRoot = p.id === activePersonId;
            const isMale = p.gender === 'male' || p.gender === 'M';
            const isFemale = p.gender === 'female' || p.gender === 'F';
            const isLightCanvas = canvasTheme === 'parchment';

            const firstName = p.name?.given || p.firstName || '—';
            const lastName = p.name?.surname || p.lastName || '—';
            const lifespanStr = formatLifespan(p);
            const fsCode = getGenealogyCode(p);

            // LOD distant zoom
            if (isLowDetail) {
              return (
                <div
                  key={node.id}
                  style={{
                    position: 'absolute',
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    width: `${node.width}px`,
                    height: `${node.height}px`
                  }}
                  className={`group rounded-xl border p-2.5 shadow-lg transition-all cursor-pointer flex flex-col justify-center text-center ${
                    isLightCanvas
                      ? 'bg-[#f4efe4] border-[#d3c9b8] text-neutral-900'
                      : 'bg-[#22262a] border-[#363c44] text-white'
                  } ${isRoot ? 'ring-2 ring-rose-500 border-rose-500 shadow-xl' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPerson(p.id);
                  }}
                >
                  <div className={`w-8 h-8 mx-auto mb-1.5 rounded-full flex items-center justify-center ${
                    isMale ? 'bg-[#0e4e6d] text-cyan-300' : isFemale ? 'bg-[#6b1b48] text-pink-300' : 'bg-slate-700 text-slate-300'
                  }`}>
                    <User className="w-4 h-4" />
                  </div>
                  <div className="font-bold text-xs truncate leading-tight">{firstName}</div>
                  <div className="font-bold text-xs truncate leading-tight">{lastName}</div>
                  <div className="text-[10px] text-slate-400 mt-1 truncate">{lifespanStr}</div>
                </div>
              );
            }

            return (
              <div
                key={node.id}
                style={{
                  position: 'absolute',
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  width: `${node.width}px`,
                  height: `${node.height}px`
                }}
                className={`group rounded-xl border transition-all cursor-pointer flex flex-col justify-between p-3 select-none relative shadow-xl ${
                  isLightCanvas
                    ? 'bg-[#f8f5ee] border-[#d8cfbe] text-neutral-900 hover:border-emerald-600'
                    : 'bg-[#22262a] border-[#383e46] text-white hover:border-slate-400 shadow-black/40'
                } ${
                  isRoot
                    ? isFemale
                      ? 'ring-2 ring-rose-500/90 border-rose-500 shadow-rose-950/50 shadow-2xl'
                      : 'ring-2 ring-sky-500/90 border-sky-500 shadow-sky-950/50 shadow-2xl'
                    : ''
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectPerson(p.id);
                }}
              >
                {/* Top Quick-Add (+) Button in corner */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenRelationManager) {
                      onOpenRelationManager(p.id);
                    }
                  }}
                  className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#181b1f] hover:bg-emerald-600 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-[#30353c] hover:border-emerald-400 shadow-xs"
                  title="Додати родича (+ батьків, дітей, подружжя)"
                  aria-label="Додати родича"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>

                {/* Centered Avatar (Image 2 style) */}
                <div className="flex flex-col items-center mt-1">
                  <div className="relative">
                    {p.avatarUrl || p.photoUrl ? (
                      <img
                        src={p.avatarUrl || p.photoUrl}
                        alt={firstName}
                        className="w-12 h-12 rounded-full object-cover border-2 border-[#47515c] shadow-md"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-inner ${
                          isMale
                            ? 'bg-[#0f4f6e] border-[#0284c7]/50 text-[#38bdf8]'
                            : isFemale
                            ? 'bg-[#6d1b4a] border-[#e11d48]/50 text-[#f472b6]'
                            : 'bg-slate-700 border-slate-600 text-slate-300'
                        }`}
                      >
                        <User className="w-6 h-6 stroke-[1.8]" />
                      </div>
                    )}
                    {isRoot && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#22262a]" />
                    )}
                  </div>
                </div>

                {/* Name & Genealogical Information */}
                <div className="text-center my-auto px-0.5">
                  {/* First Name */}
                  <h4 className="font-bold text-[13px] leading-tight truncate text-white group-hover:text-emerald-400 transition-colors">
                    {firstName}
                  </h4>
                  {/* Last Name */}
                  <h4 className="font-bold text-[13px] leading-tight truncate text-white group-hover:text-emerald-400 transition-colors">
                    {lastName}
                  </h4>

                  {/* Lifespan */}
                  <div className="text-[11px] text-[#94a3b8] mt-1.5 font-normal tracking-tight">
                    {lifespanStr}
                  </div>

                  {/* FamilySearch-style unique ID code */}
                  <div className="text-[10px] font-mono text-[#64748b] tracking-wider mt-0.5">
                    {fsCode}
                  </div>
                </div>

                {/* Bottom Source & Document Badges (Image 2 style) */}
                <div className="flex items-center justify-center gap-1.5 pt-1.5 border-t border-[#2e343c]">
                  {/* Citations / Documents Badge */}
                  <div
                    className="w-5 h-5 rounded-md bg-[#0e7490]/30 hover:bg-[#0e7490]/60 text-[#38bdf8] flex items-center justify-center border border-[#0e7490]/50 transition-colors"
                    title={`Джерела та архівні записи: ${p.citations?.length || (p.sourceIds?.length || 1)}`}
                  >
                    <FileText className="w-3 h-3" />
                  </div>

                  {/* Estate / Confession / Relatives Badge */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onOpenRelationManager) {
                        onOpenRelationManager(p.id);
                      }
                    }}
                    className="w-5 h-5 rounded-md bg-[#334155]/60 hover:bg-emerald-700/80 text-slate-300 hover:text-white flex items-center justify-center border border-slate-600/50 transition-colors cursor-pointer"
                    title="Родинні зв'язки"
                  >
                    <GitFork className="w-3 h-3 rotate-90" />
                  </button>
                </div>

                {/* Side Expand Chevron (if ancestors/descendants continue) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChangeRoot(p.id);
                  }}
                  className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-6 rounded-r bg-[#181b1f] hover:bg-emerald-600 text-slate-400 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all border border-l-0 border-[#383e46]"
                  title="Зробити фокусною персоною"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Empty Tree Fallback */}
        {layout.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center z-10 pointer-events-auto">
            <div className="p-6 rounded-2xl border max-w-md bg-[#1e2226] border-[#323840] text-white shadow-2xl backdrop-blur-md">
              <GitFork className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-base font-bold mb-1">Візуалізація родоводу</h3>
              <p className="text-xs mb-4 text-slate-300">
                Натисніть кнопку нижче, щоб відобразити повне родинне дерево Ольги Бом (39 осіб, 9 поколінь).
              </p>
              <button
                type="button"
                onClick={() => {
                  onChangeRoot('p_bom_olga');
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-transform hover:scale-105"
              >
                Відобразити родовід (Ольга Бом)
              </button>
            </div>
          </div>
        )}

        {/* Mini-Map / Overview Navigator (Image 2 style bottom-left) */}
        {showMinimap && layout.nodes.length > 0 && (
          <div className="absolute bottom-4 left-4 z-20 p-2.5 rounded-xl bg-[#1a1e22]/90 backdrop-blur-md border border-[#323840] shadow-2xl">
            <div className="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-[#282d33]">
              <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                <Compass className="w-3 h-3 text-emerald-400" />
                <span>Огляд дерева ({layout.nodes.length})</span>
              </div>
              <button
                onClick={() => setShowMinimap(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Сховати міні-мапу"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            {/* Miniature Canvas */}
            <div
              className="w-40 h-28 bg-[#121518] rounded-lg border border-[#262a30] relative overflow-hidden cursor-crosshair"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const clickY = e.clientY - rect.top;
                const normX = clickX / 160;
                const normY = clickY / 112;

                const worldX = normX * layout.width;
                const worldY = normY * layout.height;

                setPan({
                  x: containerDimensions.width / 2 - worldX * scale,
                  y: containerDimensions.height / 2 - worldY * scale
                });
              }}
            >
              {/* Miniature Node dots */}
              {layout.nodes.map((n) => {
                const isMale = n.person.gender === 'male' || n.person.gender === 'M';
                const isFemale = n.person.gender === 'female' || n.person.gender === 'F';
                const isRoot = n.person.id === activePersonId;

                const miniX = (n.x / layout.width) * 160;
                const miniY = (n.y / layout.height) * 112;

                return (
                  <div
                    key={n.id}
                    style={{
                      left: `${miniX}px`,
                      top: `${miniY}px`,
                      width: '6px',
                      height: '7px'
                    }}
                    className={`absolute rounded-xs ${
                      isRoot
                        ? 'bg-rose-500 ring-1 ring-white'
                        : isMale
                        ? 'bg-sky-400'
                        : isFemale
                        ? 'bg-pink-400'
                        : 'bg-slate-400'
                    }`}
                  />
                );
              })}

              {/* Viewport Frame */}
              <div
                style={{
                  left: `${Math.max(0, ((-pan.x / scale) / layout.width) * 160)}px`,
                  top: `${Math.max(0, ((-pan.y / scale) / layout.height) * 112)}px`,
                  width: `${Math.min(160, ((containerDimensions.width / scale) / layout.width) * 160)}px`,
                  height: `${Math.min(112, ((containerDimensions.height / scale) / layout.height) * 112)}px`
                }}
                className="absolute border border-emerald-400/80 bg-emerald-400/10 pointer-events-none rounded-xs"
              />
            </div>
          </div>
        )}

        {!showMinimap && (
          <button
            onClick={() => setShowMinimap(true)}
            className="absolute bottom-4 left-4 z-20 px-2.5 py-1.5 rounded-lg bg-[#1a1e22]/90 hover:bg-[#252a30] text-slate-300 text-xs font-medium border border-[#323840] shadow-lg flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Compass className="w-3.5 h-3.5 text-emerald-400" />
            <span>Міні-мапа</span>
          </button>
        )}
      </div>

      {/* PNG Branch Export/Import Modal */}
      {isPngModalOpen && (
        <PngBranchManagerModal
          isOpen={isPngModalOpen}
          onClose={() => setIsPngModalOpen(false)}
          initialTab={pngModalTab}
        />
      )}
    </div>
  );
};
