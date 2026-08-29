import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  GitFork,
  ArrowDownUp,
  User,
  ExternalLink,
  Plus,
  BookOpen,
  MapPin,
  Calendar,
  X,
  Info,
  Printer,
  Download,
  ChevronDown
} from 'lucide-react';
import { GenealogyDatabase, TreeLayoutType, Person } from '../../types/genealogy';
import { calculateAncestorsLayout, calculateDescendantsLayout } from '../../utils/treeLayout';
import { getFullName } from '../../utils/relationship';

interface TreeViewProps {
  database: GenealogyDatabase;
  activePersonId: string;
  onSelectPerson: (id: string) => void;
  onOpenAddChild: (parentId: string) => void;
  onOpenAddParent: (childId: string) => void;
  onChangeRoot: (id: string) => void;
  onOpenRelationManager?: (personId: string) => void;
}

export const TreeView: React.FC<TreeViewProps> = ({
  database,
  activePersonId,
  onSelectPerson,
  onOpenAddChild,
  onOpenAddParent,
  onChangeRoot,
  onOpenRelationManager
}) => {
  const [layoutType, setLayoutType] = useState<TreeLayoutType>('ancestors');
  const [generations, setGenerations] = useState<number>(5);
  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 80, y: 120 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showInfoPanel, setShowInfoPanel] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('gramps_tree_show_info');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
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

  const handleToggleInfoPanel = (show: boolean) => {
    setShowInfoPanel(show);
    try {
      localStorage.setItem('gramps_tree_show_info', String(show));
    } catch {
      // ignore
    }
  };

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

  const layout = useMemo(() => {
    if (layoutType === 'ancestors') {
      return calculateAncestorsLayout(database, activePersonId, generations);
    } else {
      return calculateDescendantsLayout(database, activePersonId, generations);
    }
  }, [database, activePersonId, layoutType, generations]);

  // Viewport Culling Bounding Box (world coordinates)
  const visibleBounds = useMemo(() => {
    const margin = 200; // Extra buffer around viewport
    return {
      minX: (-pan.x - margin) / scale,
      maxX: (-pan.x + containerDimensions.width + margin) / scale,
      minY: (-pan.y - margin) / scale,
      maxY: (-pan.y + containerDimensions.height + margin) / scale
    };
  }, [pan.x, pan.y, scale, containerDimensions]);

  // Culled Nodes: Only render nodes that fall within current visible viewport
  const visibleNodes = useMemo(() => {
    if (layout.nodes.length < 30) return layout.nodes;
    return layout.nodes.filter((node) => {
      const nodeRight = node.x + (node.width || 220);
      const nodeBottom = node.y + (node.height || 100);
      return (
        nodeRight >= visibleBounds.minX &&
        node.x <= visibleBounds.maxX &&
        nodeBottom >= visibleBounds.minY &&
        node.y <= visibleBounds.maxY
      );
    });
  }, [layout.nodes, visibleBounds]);

  // Culled Links: Only render bezier paths intersecting the viewport
  const visibleLinks = useMemo(() => {
    if (layout.links.length < 30) return layout.links;
    return layout.links.filter((link) => {
      const minX = Math.min(link.sourceX, link.targetX);
      const maxX = Math.max(link.sourceX, link.targetX);
      const minY = Math.min(link.sourceY, link.targetY);
      const maxY = Math.max(link.sourceY, link.targetY);
      return (
        maxX >= visibleBounds.minX &&
        minX <= visibleBounds.maxX &&
        maxY >= visibleBounds.minY &&
        minY <= visibleBounds.maxY
      );
    });
  }, [layout.links, visibleBounds]);

  // Level of Detail (LOD): When zoomed far out, render ultra-lightweight simplified cards
  const isLowDetail = scale < 0.52;

  // Center tree on person change or initial mount
  useEffect(() => {
    setPan({ x: 80, y: 120 });
    setScale(1);
  }, [activePersonId, layoutType]);

  const touchStateRef = useRef<{
    initialDist: number;
    initialScale: number;
    initialPan: { x: number; y: number };
    midPoint: { x: number; y: number };
  } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag if left click and not clicking directly on a button/card action
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

  // Touch Support for Tablets & Mobile (1-finger pan, 2-finger pinch-zoom)
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

      // Pan adjustment to zoom into pinch center
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
      // Transition from pinch back to 1-finger drag
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
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.min(Math.max(scale * zoomFactor, 0.3), 2.5);
    setScale(newScale);
  };

  const activePerson = database.persons[activePersonId];

  const handlePrint = () => {
    window.print();
  };

  const handleExportSvg = () => {
    if (!layout.nodes.length) return;

    // Calculate exact bounding box of all nodes and links with padding
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

    const isHorizontal = layoutType === 'ancestors';
    const padding = 80;
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
    svgContent += `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="${originX} ${originY} ${totalWidth} ${totalHeight}" style="background:#090d16; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">\n`;
    svgContent += `<style>
      .node-card { fill: #0f172a; rx: 12px; }
      .text-title { fill: #ffffff; font-size: 13px; font-weight: bold; }
      .text-sub { fill: #94a3b8; font-size: 11px; }
      .text-dates { fill: #38bdf8; font-size: 11px; font-weight: 600; }
      .tree-link { fill: none; stroke: #475569; stroke-width: 2.5px; stroke-linecap: round; }
    </style>\n`;

    // Background rect
    svgContent += `<rect x="${originX}" y="${originY}" width="${totalWidth}" height="${totalHeight}" fill="#090d16" />\n`;

    // Render link paths
    layout.links.forEach((link) => {
      const midX = (link.sourceX + link.targetX) / 2;
      const midY = (link.sourceY + link.targetY) / 2;
      const d = isHorizontal
        ? `M ${link.sourceX} ${link.sourceY} C ${midX} ${link.sourceY}, ${midX} ${link.targetY}, ${link.targetX} ${link.targetY}`
        : `M ${link.sourceX} ${link.sourceY} C ${link.sourceX} ${midY}, ${link.targetX} ${midY}, ${link.targetX} ${link.targetY}`;
      svgContent += `<path d="${d}" class="tree-link" />\n`;
      svgContent += `<circle cx="${link.targetX}" cy="${link.targetY}" r="4" fill="#10b981" />\n`;
    });

    // Render nodes
    layout.nodes.forEach((node) => {
      const p = node.person;
      const isMale = p.gender === 'M';
      const isFemale = p.gender === 'F';
      const strokeColor = isMale ? '#3b82f6' : isFemale ? '#f43f5e' : '#64748b';
      const avatarBg = isMale ? 'rgba(59, 130, 246, 0.25)' : isFemale ? 'rgba(244, 63, 94, 0.25)' : 'rgba(100, 116, 139, 0.25)';
      const avatarTextColor = isMale ? '#93c5fd' : isFemale ? '#fda4af' : '#cbd5e1';

      const isRoot = p.id === activePersonId;
      const cardBorder = isRoot ? '#10b981' : strokeColor;
      const borderWidth = isRoot ? '2.5' : '1.5';

      const fullName = escapeXml(getFullName(p));
      const birthStr = p.birthYear ? String(p.birthYear) : '—';
      const deathStr = p.deathYear ? String(p.deathYear) : (p.isLiving ? 'зараз' : '—');
      const dates = escapeXml(`${birthStr} – ${deathStr}`);
      const rawOcc = p.occupation || p.birthPlace || '';
      const occ = escapeXml(rawOcc);
      const initial = escapeXml((p.name?.given?.[0] || p.name?.surname?.[0] || '?').toUpperCase());

      svgContent += `<g transform="translate(${node.x}, ${node.y})">\n`;
      svgContent += `  <rect width="${node.width}" height="${node.height}" rx="12" class="node-card" stroke="${cardBorder}" stroke-width="${borderWidth}" />\n`;
      svgContent += `  <rect x="10" y="14" width="36" height="36" rx="8" fill="${avatarBg}" stroke="${strokeColor}" stroke-width="1" />\n`;
      svgContent += `  <text x="28" y="38" text-anchor="middle" fill="${avatarTextColor}" font-size="16" font-weight="bold">${initial}</text>\n`;
      svgContent += `  <text x="54" y="28" class="text-title">${fullName}</text>\n`;
      svgContent += `  <text x="54" y="46" class="text-dates">${dates}</text>\n`;
      if (occ) {
        svgContent += `  <text x="54" y="64" class="text-sub">${occ}</text>\n`;
      }
      svgContent += `</g>\n`;
    });

    svgContent += `</svg>`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `genealogy-tree-${activePerson?.name?.surname || 'tree'}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 overflow-hidden relative select-none">
      {/* Control Bar */}
      <div className="h-14 bg-slate-900/90 backdrop-blur border-b border-slate-800 px-4 flex items-center justify-between z-20 shrink-0 print:hidden">
        <div className="flex items-center gap-3">
          {/* Layout switch */}
          <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700">
            <button
              onClick={() => setLayoutType('ancestors')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                layoutType === 'ancestors'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <GitFork className="w-3.5 h-3.5 rotate-90" />
              <span>Висхідне (Предки)</span>
            </button>
            <button
              onClick={() => setLayoutType('descendants')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                layoutType === 'descendants'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <ArrowDownUp className="w-3.5 h-3.5" />
              <span>Низхідне (Нащадки)</span>
            </button>
          </div>

          {/* Generations counter */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
            <span>Поколінь:</span>
            {[3, 4, 5, 6].map((g) => (
              <button
                key={g}
                onClick={() => setGenerations(g)}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                  generations === g
                    ? 'bg-emerald-600 text-white'
                    : 'hover:bg-slate-700 text-slate-400'
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Quick Root Person Selector */}
          <div className="hidden md:flex items-center gap-2">
            <span className="text-xs text-slate-400">Корінь дерева:</span>
            <select
              value={activePersonId}
              onChange={(e) => onChangeRoot(e.target.value)}
              className="bg-slate-800 text-slate-200 text-xs border border-slate-700 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 max-w-[200px] truncate"
            >
              {(Object.values(database.persons) as Person[]).map((p) => (
                <option key={p.id} value={p.id}>
                  {getFullName(p)} {p.birthYear ? `(${p.birthYear})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Controls: Export, Print, Zoom */}
        <div className="flex items-center gap-2">
          {/* Compact Export Menu (On-demand) */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setIsExportOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                isExportOpen
                  ? 'bg-slate-700 text-white border-slate-600 shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border-slate-700'
              }`}
              title="Експорт та друк дерева"
              aria-expanded={isExportOpen}
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Експорт</span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isExportOpen ? 'rotate-180' : ''}`} />
            </button>

            {isExportOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1 text-[10px] uppercase font-bold tracking-wider text-slate-400 border-b border-slate-800 mb-1">
                  Збереження та друк
                </div>
                <button
                  onClick={() => {
                    handleExportSvg();
                    setIsExportOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <Download className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-medium text-slate-200">Скачати векторне дерево (SVG)</div>
                    <div className="text-[10px] text-slate-400">Векторний файл без втрати якості для плакатів</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    handlePrint();
                    setIsExportOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <Printer className="w-4 h-4 text-sky-400 shrink-0" />
                  <div>
                    <div className="font-medium text-slate-200">Роздрукувати / Зберегти в PDF</div>
                    <div className="text-[10px] text-slate-400">Друк на папері або експорт у PDF-документ</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
            <button
              onClick={() => setScale((s) => Math.min(s * 1.2, 2.5))}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
              title="Збільшити"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setScale((s) => Math.max(s * 0.8, 0.3))}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
              title="Зменшити"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setScale(1);
                setPan({ x: 80, y: 120 });
              }}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
              title="Скинути масштаб"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <span className="text-[11px] text-slate-400 font-mono px-2">
              {Math.round(scale * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Canvas */}
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
        className={`flex-1 relative overflow-hidden touch-none bg-radial from-slate-900 to-slate-950 ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)',
          backgroundSize: '24px 24px',
          touchAction: 'none'
        }}
      >
        <div
          className="absolute origin-top-left transition-transform duration-75"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`
          }}
        >
          {/* SVG Links (Viewport Culled) */}
          <svg
            className="overflow-visible pointer-events-none absolute inset-0"
            style={{ width: layout.width, height: layout.height }}
          >
            {visibleLinks.map((link) => {
              // Smooth bezier curve connecting nodes
              const isHorizontal = layoutType === 'ancestors';
              const midX = (link.sourceX + link.targetX) / 2;
              const midY = (link.sourceY + link.targetY) / 2;

              const pathData = isHorizontal
                ? `M ${link.sourceX} ${link.sourceY} C ${midX} ${link.sourceY}, ${midX} ${link.targetY}, ${link.targetX} ${link.targetY}`
                : `M ${link.sourceX} ${link.sourceY} C ${link.sourceX} ${midY}, ${link.targetX} ${midY}, ${link.targetX} ${link.targetY}`;

              return (
                <g key={link.id}>
                  <path
                    d={pathData}
                    fill="none"
                    stroke="#475569"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <circle cx={link.targetX} cy={link.targetY} r="3.5" fill="#10b981" />
                </g>
              );
            })}
          </svg>

          {/* HTML Nodes (Viewport Culled + LOD) */}
          {visibleNodes.map((node) => {
            const p = node.person;
            const isRoot = p.id === activePersonId;
            const isMale = p.gender === 'M';
            const isFemale = p.gender === 'F';

            const genderBg = isMale
              ? 'border-blue-500/40 bg-slate-900/95 hover:border-blue-400'
              : isFemale
              ? 'border-rose-500/40 bg-slate-900/95 hover:border-rose-400'
              : 'border-slate-600 bg-slate-900/95';

            // LOD (Level of Detail) Lightweight node for distant zoom
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
                  className={`group rounded-lg border p-2 shadow-sm transition-all cursor-pointer flex flex-col justify-center ${genderBg} ${
                    isRoot ? 'ring-2 ring-emerald-500' : ''
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPerson(p.id);
                  }}
                >
                  <div className="font-bold text-xs text-white truncate">
                    {p.name?.surname || p.lastName || ''} {p.name?.given || p.firstName || ''}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                    {p.birthYear || '?'} — {p.isLiving ? 'теп. час' : p.deathYear || '?'}
                  </div>
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
                className={`group rounded-xl border p-2.5 shadow-lg transition-all cursor-pointer flex flex-col justify-between ${genderBg} ${
                  isRoot ? 'ring-2 ring-emerald-500 shadow-emerald-950/50' : ''
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectPerson(p.id);
                }}
              >
                <div className="flex items-start gap-2.5">
                  {/* Avatar / Portrait */}
                  <div className="relative shrink-0">
                    {p.avatarUrl ? (
                      <img
                        src={p.avatarUrl}
                        alt={p.name?.given || p.firstName || ''}
                        className="w-11 h-11 rounded-lg object-cover border border-slate-700 shadow-sm"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className={`w-11 h-11 rounded-lg flex items-center justify-center border ${
                          isMale
                            ? 'bg-blue-950/60 border-blue-800 text-blue-300'
                            : isFemale
                            ? 'bg-rose-950/60 border-rose-800 text-rose-300'
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        <User className="w-5 h-5" />
                      </div>
                    )}
                    {isRoot && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-900" />
                    )}
                  </div>

                  {/* Name and Dates */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-1">
                      <h4 className="font-semibold text-xs text-white truncate group-hover:text-emerald-400 transition-colors">
                        {p.name?.surname || p.lastName || ''} {p.name?.given || p.firstName || ''}
                      </h4>

                      {/* Prominent Quick-Add Relative (+) Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenRelationManager) {
                            onOpenRelationManager(p.id);
                          }
                        }}
                        className="w-5 h-5 -mt-0.5 -mr-0.5 rounded-md bg-emerald-600/90 hover:bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm hover:scale-110 active:scale-95 transition-all cursor-pointer border border-emerald-400/40"
                        title="Додати родича (+ батька, матір, дітей, подружжя)"
                        aria-label="Додати родича"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    </div>

                    {(p.name?.patronymic || p.patronymic || p.name?.maidenName || p.maidenName) && (
                      <p className="text-[10px] text-slate-400 truncate -mt-0.5">
                        {p.name?.patronymic || p.patronymic || ''}
                        {(p.name?.maidenName || p.maidenName) && ` (до шлюбу ${p.name?.maidenName || p.maidenName})`}
                      </p>
                    )}

                    {/* Life dates */}
                    <div className="flex items-center gap-1 text-[10px] text-slate-300 font-mono mt-1">
                      <Calendar className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="truncate">
                        {p.birthYear || '?'} — {p.isLiving ? 'теп. час' : p.deathYear || '?'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom line: Occupation / Place / Badges */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/80 pt-1 mt-1">
                  <span className="truncate max-w-[110px]" title={p.occupation || p.birthPlace}>
                    {p.occupation || p.birthPlace || 'Немає опису'}
                  </span>

                  <div className="flex items-center gap-1 shrink-0">
                    {p.citations && p.citations.length > 0 && (
                      <span
                        className="flex items-center gap-0.5 px-1 py-0.2 bg-amber-950/50 text-amber-300 border border-amber-800/60 rounded text-[9px]"
                        title={`Цитат з архіву: ${p.citations.length}`}
                      >
                        <BookOpen className="w-2.5 h-2.5" />
                        {p.citations.length}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onOpenRelationManager) {
                          onOpenRelationManager(p.id);
                        }
                      }}
                      className="px-1.5 py-0.5 bg-slate-800 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-700/40 rounded flex items-center gap-0.5 text-[9px] font-semibold transition-colors cursor-pointer"
                      title="Керування родичами / Додати родича"
                    >
                      <Plus className="w-2.5 h-2.5" />
                      <span>Родичі</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onChangeRoot(p.id);
                      }}
                      className="p-1 hover:bg-slate-700 text-slate-400 hover:text-emerald-400 rounded transition-colors cursor-pointer"
                      title="Зробити фокусною персоною дерева"
                    >
                      <GitFork className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Floating Quick Legend & Current Root Info */}
        {showInfoPanel ? (
          <div className="absolute bottom-4 left-4 bg-slate-900/95 backdrop-blur border border-slate-800 rounded-xl p-3 shadow-2xl max-w-sm pointer-events-auto transition-all animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-xs font-semibold text-white truncate">
                  {activePerson ? getFullName(activePerson) : 'Особу не обрано'}
                </span>
              </div>
              <button
                onClick={() => handleToggleInfoPanel(false)}
                className="p-1 -mr-1 -mt-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors shrink-0"
                title="Закрити вікно підказки"
                aria-label="Закрити підказку"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-slate-400 line-clamp-2">
              {activePerson?.bio || activePerson?.occupation || 'Натисніть на будь-яку картку для перегляду повного досьє або зміни кореня.'}
            </p>
            <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded bg-blue-500 shrink-0" /> Чоловіча стать
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded bg-rose-500 shrink-0" /> Жіноча стать
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => handleToggleInfoPanel(true)}
            className="absolute bottom-4 left-4 bg-slate-900/90 hover:bg-slate-800 backdrop-blur border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-lg px-2.5 py-1.5 shadow-lg transition-all flex items-center gap-1.5 text-xs font-medium pointer-events-auto"
            title="Показати інформаційну картку та легенду"
          >
            <Info className="w-4 h-4 text-emerald-400" />
            <span>Інфо / Легенда</span>
          </button>
        )}
      </div>
    </div>
  );
};
