import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  PieChart,
  ZoomIn,
  ZoomOut,
  Maximize2,
  User,
  GitFork,
  X,
  Info,
  Download,
  Printer,
  ChevronDown,
  Palette,
  Users,
  Layers,
  Sparkles,
  Filter
} from 'lucide-react';
import { GenealogyDatabase, Person } from '../../types/genealogy';
import {
  calculateFanChart,
  extractFanChartClans,
  FanChartSector,
  FanColorMode,
  FanChartClan,
  getMaxAncestorGenerations
} from '../../utils/treeLayout';
import { getFullName } from '../../utils/relationship';
import { useUIStore } from '../../../stores/useUIStore';
import { getThemeConfig } from '../../../utils/theme';

interface FanChartViewProps {
  database: GenealogyDatabase;
  activePersonId: string;
  onSelectPerson: (id: string) => void;
  onChangeRoot: (id: string) => void;
  onSwitchToTree?: () => void;
}

export const FanChartView: React.FC<FanChartViewProps> = ({
  database,
  activePersonId,
  onSelectPerson,
  onChangeRoot,
  onSwitchToTree
}) => {
  // Default to 0 = ALL generations
  const [generations, setGenerations] = useState<number>(0);
  const [hoveredSector, setHoveredSector] = useState<FanChartSector | null>(null);
  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isColorMenuOpen, setIsColorMenuOpen] = useState<boolean>(false);
  const [selectedClanId, setSelectedClanId] = useState<string | null>(null);
  const [hoveredClanId, setHoveredClanId] = useState<string | null>(null);

  const exportMenuRef = useRef<HTMLDivElement>(null);
  const colorMenuRef = useRef<HTMLDivElement>(null);
  const touchStateRef = useRef<{
    initialDist: number;
    initialScale: number;
    initialPan: { x: number; y: number };
    midPoint: { x: number; y: number };
  } | null>(null);

  // Color Mode: defaults to 'clans' (кожен рід своїм кольором)
  const [colorMode, setColorMode] = useState<FanColorMode>(() => {
    try {
      const saved = localStorage.getItem('gramps_fanchart_color_mode');
      if (
        saved &&
        ['clans', 'grandparents', 'greatgrandparents', 'gender', 'generation'].includes(saved)
      ) {
        return saved as FanColorMode;
      }
      return 'clans';
    } catch {
      return 'clans';
    }
  });

  const handleSetColorMode = (mode: FanColorMode) => {
    setColorMode(mode);
    setIsColorMenuOpen(false);
    setSelectedClanId(null);
    try {
      localStorage.setItem('gramps_fanchart_color_mode', mode);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportOpen(false);
      }
      if (colorMenuRef.current && !colorMenuRef.current.contains(event.target as Node)) {
        setIsColorMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset pan, scale and clan filter when person changes
  useEffect(() => {
    setPan({ x: 0, y: 0 });
    setScale(1);
    setSelectedClanId(null);
  }, [activePersonId]);

  const themePalette = useUIStore((s) => s.themePalette);
  const theme = getThemeConfig(themePalette);
  const isDark = theme.category === 'dark';

  const [canvasTheme, setCanvasTheme] = useState<'dark' | 'parchment' | 'emerald'>(() => {
    try {
      const saved = localStorage.getItem('gramps_tree_canvas_theme');
      if (saved && (saved === 'dark' || saved === 'parchment' || saved === 'emerald')) {
        return saved as any;
      }
      return theme.category === 'light'
        ? 'parchment'
        : theme.id === 'emerald' || theme.id === 'dark-emerald'
        ? 'emerald'
        : 'dark';
    } catch {
      return theme.category === 'light' ? 'parchment' : 'dark';
    }
  });

  // Automatically update canvasTheme when global theme palette changes
  useEffect(() => {
    if (theme.category === 'light') {
      setCanvasTheme('parchment');
    } else if (theme.id === 'emerald' || theme.id === 'dark-emerald') {
      setCanvasTheme('emerald');
    } else {
      setCanvasTheme('dark');
    }
  }, [theme.id, theme.category]);

  const handleSetCanvasTheme = (t: 'dark' | 'parchment' | 'emerald') => {
    setCanvasTheme(t);
    try {
      localStorage.setItem('gramps_tree_canvas_theme', t);
    } catch {
      // ignore
    }
  };

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

  const containerRef = useRef<HTMLDivElement>(null);

  // Touch handlers for Pinch-to-Zoom & Pan on tablets/mobile
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
      const targetScale = Math.min(Math.max(initialScale * zoomFactor, 0.25), 4.0);

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
    const newScale = Math.min(Math.max(scale * zoomFactor, 0.25), 4.0);
    setScale(newScale);
  };

  const [showLegend, setShowLegend] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('gramps_fanchart_show_legend');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const handleToggleLegend = (show: boolean) => {
    setShowLegend(show);
    try {
      localStorage.setItem('gramps_fanchart_show_legend', String(show));
    } catch {
      // ignore
    }
  };

  const activePerson = database.persons[activePersonId];

  const maxAvailableGens = useMemo(() => {
    return getMaxAncestorGenerations(database, activePersonId);
  }, [database, activePersonId]);

  const sectors = useMemo(() => {
    return calculateFanChart(database, activePersonId, generations, colorMode);
  }, [database, activePersonId, generations, colorMode]);

  const clans = useMemo(() => {
    return extractFanChartClans(sectors);
  }, [sectors]);

  const maxRadius = useMemo(() => {
    if (sectors.length === 0) return 400;
    return Math.max(...sectors.map((s) => s.outerRadius));
  }, [sectors]);

  const hasBottomSectors = useMemo(() => {
    return sectors.some((s) => s.generation < 0 || s.side === 'spouse' || s.side === 'child');
  }, [sectors]);

  const bottomMaxRadius = useMemo(() => {
    const bSectors = sectors.filter((s) => s.generation < 0 || s.side === 'spouse' || s.side === 'child');
    return bSectors.length > 0 ? Math.max(...bSectors.map((s) => s.outerRadius)) : 0;
  }, [sectors]);

  const padding = 60;
  const svgWidth = Math.max(1000, Math.round((maxRadius + padding) * 2));
  const svgHeight = Math.max(
    800,
    Math.round(maxRadius + (hasBottomSectors ? bottomMaxRadius : 40) + padding * 2)
  );
  const centerX = svgWidth / 2;
  const centerY = maxRadius + padding;

  const handleFitToScreen = useCallback(() => {
    if (!containerRef.current) {
      setScale(0.85);
      setPan({ x: 0, y: 0 });
      return;
    }
    const { clientWidth, clientHeight } = containerRef.current;
    if (clientWidth === 0 || clientHeight === 0) return;

    const pad = 40;
    const scaleX = (clientWidth - pad * 2) / svgWidth;
    const scaleY = (clientHeight - pad * 2) / svgHeight;
    const fitScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.35), 1.6);

    setScale(Number(fitScale.toFixed(2)));
    setPan({ x: 0, y: 0 });
  }, [svgWidth, svgHeight]);

  // Initial fit on mount & when generations / active person changes
  useEffect(() => {
    const timer = setTimeout(() => {
      handleFitToScreen();
    }, 60);
    return () => clearTimeout(timer);
  }, [handleFitToScreen, generations, activePersonId]);

  // Function to describe SVG arc path
  function describeArc(
    x: number,
    y: number,
    innerRadius: number,
    outerRadius: number,
    startAngle: number,
    endAngle: number
  ): string {
    const startInner = polarToCartesian(x, y, innerRadius, endAngle);
    const endInner = polarToCartesian(x, y, innerRadius, startAngle);
    const startOuter = polarToCartesian(x, y, outerRadius, endAngle);
    const endOuter = polarToCartesian(x, y, outerRadius, startAngle);

    const largeArcFlag = endAngle - startAngle <= Math.PI ? '0' : '1';

    if (innerRadius === 0) {
      return [
        'M',
        x,
        y,
        'L',
        endOuter.x,
        endOuter.y,
        'A',
        outerRadius,
        outerRadius,
        0,
        largeArcFlag,
        1,
        startOuter.x,
        startOuter.y,
        'Z'
      ].join(' ');
    }

    return [
      'M',
      startInner.x,
      startInner.y,
      'L',
      startOuter.x,
      startOuter.y,
      'A',
      outerRadius,
      outerRadius,
      0,
      largeArcFlag,
      0,
      endOuter.x,
      endOuter.y,
      'L',
      endInner.x,
      endInner.y,
      'A',
      innerRadius,
      innerRadius,
      0,
      largeArcFlag,
      1,
      startInner.x,
      startInner.y,
      'Z'
    ].join(' ');
  }

  function polarToCartesian(
    centerX: number,
    centerY: number,
    radius: number,
    angleInRadians: number
  ) {
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians)
    };
  }

  const handlePrint = () => {
    window.print();
  };

  const handleExportSvg = () => {
    const svgElement = document.getElementById('gramps-fanchart-svg');
    if (!svgElement) {
      window.print();
      return;
    }
    const cloned = svgElement.cloneNode(true) as SVGElement;
    cloned.setAttribute(
      'style',
      'background-color: #090d16; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;'
    );

    // Add background rect to cloned SVG
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('width', String(svgWidth));
    bgRect.setAttribute('height', String(svgHeight));
    bgRect.setAttribute('fill', '#090d16');
    cloned.insertBefore(bgRect, cloned.firstChild);

    const svgData =
      `<?xml version="1.0" encoding="UTF-8"?>\n` + new XMLSerializer().serializeToString(cloned);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fan-chart-${activePerson?.name?.surname || 'fanchart'}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Check if sector matches the active clan highlight filter
  const activeFocusClanId = hoveredClanId || selectedClanId;

  return (
    <div
      className={`flex flex-col h-[calc(100vh-4rem)] ${theme.appBg} ${theme.textPrimary} overflow-hidden relative select-none`}
    >
      {/* Top Controls */}
      <div
        className={`h-14 ${theme.headerBg} backdrop-blur border-b ${theme.headerBorder} px-4 flex items-center justify-between z-20 shrink-0 print:hidden`}
      >
        <div className="flex items-center gap-3">
          {onSwitchToTree && (
            <button
              onClick={onSwitchToTree}
              className={`flex items-center gap-1.5 px-3 py-1.5 ${theme.surfaceBg} hover:brightness-110 ${theme.textPrimary} border ${theme.borderSubtle} rounded-lg text-xs font-medium transition-colors cursor-pointer`}
              title="Повернутися до дерева роду"
            >
              <GitFork className="w-3.5 h-3.5 text-emerald-500 rotate-90" />
              <span>Дерево</span>
            </button>
          )}

          {/* Color Mode Selector (Кольорові схеми) */}
          <div className="relative" ref={colorMenuRef}>
            <button
              onClick={() => setIsColorMenuOpen((prev) => !prev)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                colorMode === 'clans'
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                  : `${theme.surfaceBg} ${theme.textPrimary} hover:brightness-110 border ${theme.borderSubtle}`
              }`}
              title="Схема кольорів віяла"
              aria-expanded={isColorMenuOpen}
            >
              <Palette className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {colorMode === 'clans' && 'Кожен рід своїм кольором'}
                {colorMode === 'grandparents' && '4 роди (дідусі/бабусі)'}
                {colorMode === 'greatgrandparents' && '8 ліній пращурів'}
                {colorMode === 'gender' && 'За статтю (чол/жін)'}
                {colorMode === 'generation' && 'За поколіннями'}
              </span>
              <ChevronDown
                className={`w-3 h-3 transition-transform duration-200 ${
                  isColorMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isColorMenuOpen && (
              <div
                className={`absolute left-0 top-full mt-2 w-72 ${theme.cardBg} border ${theme.cardBorder} rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150`}
              >
                <div
                  className={`px-3 py-1 text-[10px] uppercase font-bold tracking-wider ${theme.textMuted} border-b ${theme.borderSubtle} mb-1`}
                >
                  Кольорові схеми віяла
                </div>

                <button
                  onClick={() => handleSetColorMode('clans')}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors cursor-pointer ${
                    colorMode === 'clans'
                      ? 'bg-emerald-500/15 text-emerald-600 font-bold'
                      : `${theme.textPrimary} hover:bg-neutral-500/10`
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div>
                      <div className="font-semibold">Кожен рід своїм кольором</div>
                      <div className={`text-[10px] ${theme.textMuted}`}>
                        Унікальний колір для кожного прізвища та роду
                      </div>
                    </div>
                  </div>
                  {colorMode === 'clans' && <span className="text-emerald-500 text-xs">✓</span>}
                </button>

                <button
                  onClick={() => handleSetColorMode('grandparents')}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors cursor-pointer ${
                    colorMode === 'grandparents'
                      ? 'bg-emerald-500/15 text-emerald-600 font-bold'
                      : `${theme.textPrimary} hover:bg-neutral-500/10`
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Users className="w-4 h-4 text-sky-500 shrink-0" />
                    <div>
                      <div className="font-semibold">4 роди дідусів та бабусь</div>
                      <div className={`text-[10px] ${theme.textMuted}`}>
                        Чотири родові чверті (Gramps)
                      </div>
                    </div>
                  </div>
                  {colorMode === 'grandparents' && (
                    <span className="text-emerald-500 text-xs">✓</span>
                  )}
                </button>

                <button
                  onClick={() => handleSetColorMode('greatgrandparents')}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors cursor-pointer ${
                    colorMode === 'greatgrandparents'
                      ? 'bg-emerald-500/15 text-emerald-600 font-bold'
                      : `${theme.textPrimary} hover:bg-neutral-500/10`
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Layers className="w-4 h-4 text-purple-500 shrink-0" />
                    <div>
                      <div className="font-semibold">8 гілок пращурів</div>
                      <div className={`text-[10px] ${theme.textMuted}`}>
                        Вісім прямих ліній прапрабатьків
                      </div>
                    </div>
                  </div>
                  {colorMode === 'greatgrandparents' && (
                    <span className="text-emerald-500 text-xs">✓</span>
                  )}
                </button>

                <button
                  onClick={() => handleSetColorMode('gender')}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors cursor-pointer ${
                    colorMode === 'gender'
                      ? 'bg-emerald-500/15 text-emerald-600 font-bold'
                      : `${theme.textPrimary} hover:bg-neutral-500/10`
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <User className="w-4 h-4 text-rose-500 shrink-0" />
                    <div>
                      <div className="font-semibold">За статтю</div>
                      <div className={`text-[10px] ${theme.textMuted}`}>
                        Синій — чоловіки, малиновий — жінки
                      </div>
                    </div>
                  </div>
                  {colorMode === 'gender' && <span className="text-emerald-500 text-xs">✓</span>}
                </button>

                <button
                  onClick={() => handleSetColorMode('generation')}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors cursor-pointer ${
                    colorMode === 'generation'
                      ? 'bg-emerald-500/15 text-emerald-600 font-bold'
                      : `${theme.textPrimary} hover:bg-neutral-500/10`
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <PieChart className="w-4 h-4 text-amber-500 shrink-0" />
                    <div>
                      <div className="font-semibold">За поколіннями</div>
                      <div className={`text-[10px] ${theme.textMuted}`}>
                        Концентричні кільця за віком
                      </div>
                    </div>
                  </div>
                  {colorMode === 'generation' && (
                    <span className="text-emerald-500 text-xs">✓</span>
                  )}
                </button>
              </div>
            )}
          </div>

          <div
            className={`flex items-center gap-1.5 text-xs ${theme.textSecondary} ${theme.surfaceBg} px-3 py-1.5 rounded-lg border ${theme.borderSubtle}`}
          >
            <PieChart className="w-3.5 h-3.5 text-amber-500" />
            <span className="font-medium hidden sm:inline">Поколінь:</span>

            {/* All Generations Button */}
            <button
              onClick={() => setGenerations(0)}
              className={`px-2.5 py-0.5 rounded text-xs font-bold transition-colors cursor-pointer ${
                generations === 0
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : isDark
                  ? 'hover:bg-slate-700 text-slate-400'
                  : 'hover:bg-neutral-200 text-neutral-600'
              }`}
              title="Відобразити всі доступні покоління родоводу"
            >
              Всі {maxAvailableGens > 0 ? `(${maxAvailableGens})` : ''}
            </button>

            {/* Specific generation numbers */}
            {Array.from({ length: 7 }, (_, i) => i + 4)
              .filter((g) => g <= Math.max(maxAvailableGens, 10))
              .map((g) => (
                <button
                  key={g}
                  onClick={() => setGenerations(g)}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                    generations === g
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : isDark
                      ? 'hover:bg-slate-700 text-slate-400'
                      : 'hover:bg-neutral-200 text-neutral-600'
                  }`}
                >
                  {g}
                </button>
              ))}
          </div>

          <div className="hidden lg:flex items-center gap-2">
            <span className={`text-xs ${theme.textMuted}`}>Центр:</span>
            <select
              value={activePersonId}
              onChange={(e) => onChangeRoot(e.target.value)}
              className={`${theme.surfaceBg} ${theme.textPrimary} text-xs border ${theme.borderSubtle} rounded-md px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 max-w-[190px] truncate cursor-pointer`}
            >
              {(Object.values(database.persons) as Person[]).map((p) => (
                <option
                  key={p.id}
                  value={p.id}
                  className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-neutral-900'}
                >
                  {getFullName(p)} {p.birthYear ? `(${p.birthYear})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Controls: Export, Print, Canvas Theme, Zoom */}
        <div className="flex items-center gap-2">
          {/* Compact Export Menu (On-demand) */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setIsExportOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                isExportOpen
                  ? `${theme.buttonSecondaryBg} ${theme.textPrimary} border-emerald-500 shadow-sm`
                  : `${theme.surfaceBg} ${theme.textSecondary} hover:brightness-110 border ${theme.borderSubtle}`
              }`}
              title="Експорт та друк віяла"
              aria-expanded={isExportOpen}
            >
              <Download className="w-3.5 h-3.5 text-emerald-500" />
              <span className="hidden sm:inline">Експорт</span>
              <ChevronDown
                className={`w-3 h-3 ${theme.textMuted} transition-transform duration-200 ${
                  isExportOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isExportOpen && (
              <div
                className={`absolute right-0 top-full mt-2 w-64 ${theme.cardBg} border ${theme.cardBorder} rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150`}
              >
                <div
                  className={`px-3 py-1 text-[10px] uppercase font-bold tracking-wider ${theme.textMuted} border-b ${theme.borderSubtle} mb-1`}
                >
                  Збереження та друк
                </div>
                <button
                  onClick={() => {
                    handleExportSvg();
                    setIsExportOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left ${theme.textPrimary} hover:bg-emerald-500/10 transition-colors cursor-pointer`}
                >
                  <Download className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div>
                    <div className="font-medium">Скачати векторне віяло (SVG)</div>
                    <div className={`text-[10px] ${theme.textMuted}`}>
                      Векторне віяло роду з усіма кольорами
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    handlePrint();
                    setIsExportOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left ${theme.textPrimary} hover:bg-emerald-500/10 transition-colors cursor-pointer`}
                >
                  <Printer className="w-4 h-4 text-sky-500 shrink-0" />
                  <div>
                    <div className="font-medium">Роздрукувати / Зберегти в PDF</div>
                    <div className={`text-[10px] ${theme.textMuted}`}>
                      Друк на папері або експорт у PDF-документ
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Background Theme Selector */}
          <div
            className={`hidden md:flex items-center gap-1 ${theme.surfaceBg} p-1 rounded-lg border ${theme.borderSubtle}`}
          >
            <button
              onClick={() => handleSetCanvasTheme('dark')}
              className={`px-2 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                canvasTheme === 'dark'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : `${theme.textMuted} hover:${theme.textPrimary}`
              }`}
              title="Темний графітовий фон"
            >
              Темний
            </button>
            <button
              onClick={() => handleSetCanvasTheme('parchment')}
              className={`px-2 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                canvasTheme === 'parchment'
                  ? 'bg-amber-100 text-amber-950 font-bold shadow-xs'
                  : `${theme.textMuted} hover:${theme.textPrimary}`
              }`}
              title="Світлий архівний пергамент"
            >
              Пергамент
            </button>
            <button
              onClick={() => handleSetCanvasTheme('emerald')}
              className={`px-2 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                canvasTheme === 'emerald'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : `${theme.textMuted} hover:${theme.textPrimary}`
              }`}
              title="Смарагдовий літописний фон"
            >
              Ліс
            </button>
          </div>

          {/* Zoom Controls (FamilySearch style: Fit, 100%, + / -) */}
          <div
            className={`flex items-center gap-1 ${theme.surfaceBg} p-1 rounded-lg border ${theme.borderSubtle}`}
          >
            <button
              onClick={() => setScale((s) => Math.max(Number((s * 0.85).toFixed(2)), 0.3))}
              className={`p-1.5 ${theme.textSecondary} hover:${theme.textPrimary} hover:bg-neutral-500/10 rounded transition-colors cursor-pointer`}
              title="Зменшити (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <button
              onClick={handleFitToScreen}
              className={`px-2 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                Math.abs(scale - 1) > 0.08
                  ? `${theme.buttonSecondaryBg} ${theme.textPrimary} border ${theme.borderSubtle}`
                  : `${theme.textMuted} hover:${theme.textPrimary}`
              }`}
              title="Вписати віяло повністю в екран"
            >
              Вписати
            </button>

            <button
              onClick={() => {
                setScale(1);
                setPan({ x: 0, y: 0 });
              }}
              className={`px-2 py-1 text-[11px] font-bold rounded transition-colors cursor-pointer ${
                Math.abs(scale - 1) <= 0.08
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : `${theme.textMuted} hover:${theme.textPrimary}`
              }`}
              title="100% — Стандартний фіксований масштаб (FamilySearch)"
            >
              100%
            </button>

            <button
              onClick={() => setScale((s) => Math.min(Number((s * 1.15).toFixed(2)), 4.0))}
              className={`p-1.5 ${theme.textSecondary} hover:${theme.textPrimary} hover:bg-neutral-500/10 rounded transition-colors cursor-pointer`}
              title="Збільшити (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <span className={`text-[11px] ${theme.textMuted} font-mono px-1.5 hidden sm:inline min-w-[40px] text-right`}>
              {Math.round(scale * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Fan Chart Canvas */}
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
        className={`flex-1 overflow-hidden touch-none relative flex items-center justify-center p-6 ${
          canvasTheme === 'parchment'
            ? 'bg-[#f6f2e8]'
            : canvasTheme === 'emerald'
            ? 'bg-[#031c15]'
            : 'bg-[#0b1324]'
        } ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          touchAction: 'none',
          backgroundImage:
            canvasTheme === 'parchment'
              ? 'radial-gradient(circle at 1px 1px, rgba(160, 110, 60, 0.28) 1.2px, transparent 0)'
              : canvasTheme === 'emerald'
              ? 'radial-gradient(circle at 1px 1px, rgba(52, 211, 153, 0.25) 1.2px, transparent 0)'
              : 'radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.25) 1.2px, transparent 0)',
          backgroundSize: '24px 24px'
        }}
      >
        <div
          className="transition-transform duration-75 relative"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
        >
          <svg
            id="gramps-fanchart-svg"
            xmlns="http://www.w3.org/2000/svg"
            width={svgWidth}
            height={svgHeight}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="overflow-visible filter drop-shadow-2xl"
          >
            {sectors.map((sec) => {
              const pathD = describeArc(
                centerX,
                centerY,
                sec.innerRadius,
                sec.outerRadius,
                sec.startAngle,
                sec.endAngle
              );

              const midAngle = (sec.startAngle + sec.endAngle) / 2;
              const midRadius = (sec.innerRadius + sec.outerRadius) / 2;
              const isHovered = hoveredSector?.ahnentafelNumber === sec.ahnentafelNumber;

              const isClanActive =
                !activeFocusClanId || sec.clanId === activeFocusClanId;

              const angleDeg = (midAngle * 180) / Math.PI;

              const fillColor =
                sec.fillColor ||
                sec.color ||
                (sec.generation === 0
                  ? '#059669'
                  : sec.person?.gender === 'F' || sec.person?.gender === 'female'
                  ? '#e11d48'
                  : '#2563eb');

              return (
                <g
                  key={sec.ahnentafelNumber}
                  className={`cursor-pointer transition-all duration-200 ${
                    !isClanActive ? 'opacity-25 saturate-50' : 'opacity-100'
                  }`}
                  onMouseEnter={() => setHoveredSector(sec)}
                  onMouseLeave={() => setHoveredSector(null)}
                  onClick={() => {
                    if (sec.person) {
                      onSelectPerson(sec.person.id);
                    }
                  }}
                >
                  <path
                    d={pathD}
                    fill={fillColor}
                    stroke={
                      isHovered
                        ? '#ffffff'
                        : canvasTheme === 'parchment'
                        ? '#ffffff'
                        : '#ffffff'
                    }
                    strokeWidth={
                      isHovered
                        ? 2.5
                        : sec.generation >= 8
                        ? 0.75
                        : sec.generation >= 5
                        ? 1.0
                        : 1.5
                    }
                    className={`transition-all duration-150 ${
                      isHovered ? 'brightness-125' : 'hover:brightness-110'
                    }`}
                  />

                  {/* Text inside sector */}
                  {sec.person && (() => {
                    const surname = sec.person.name?.surname || sec.person.lastName || '';
                    const given = sec.person.name?.given || sec.person.firstName || '';
                    const patronymic = sec.person.name?.patronymic || sec.person.patronymic || '';
                    const maiden = sec.person.name?.maidenName || sec.person.maidenName || '';
                    const birth = sec.person.birthYear || (sec.person.birthDate ? sec.person.birthDate.slice(0, 4) : '');
                    const death = sec.person.deathYear || (sec.person.deathDate ? sec.person.deathDate.slice(0, 4) : '');
                    const isFemale = sec.person.gender === 'female' || sec.person.gender === 'F';

                    const statusStr = sec.person.isLiving
                      ? `${birth || ''}–${isFemale ? 'Живущая' : 'Живущий'}`
                      : birth && death
                      ? `${birth}–${death}`
                      : birth
                      ? `${birth}–${isFemale ? 'Умершая' : 'Умерший'}`
                      : death
                      ? `?–${death}`
                      : '';

                    const givenWithPatronymic = [given, patronymic].filter(Boolean).join(' ');
                    const showMaiden = maiden && maiden.trim() && maiden.trim() !== surname.trim();

                    // --- GEOMETRY & ROTATION SYSTEM ---
                    // 1. Root person (Center semi-circle hub):
                    if (sec.generation === 0 && sec.ahnentafelNumber === 1) {
                      const textX = centerX;
                      const textY = centerY - sec.outerRadius * 0.48;
                      return (
                        <text
                          x={textX}
                          y={textY}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#ffffff"
                          className="pointer-events-none select-none font-sans"
                          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.85)' }}
                        >
                          <tspan x={textX} dy="-1.15em" fontSize="13px" fill="#f8fafc" fontWeight="600">
                            {givenWithPatronymic || given}
                          </tspan>
                          <tspan x={textX} dy="1.25em" fontSize="15px" fontWeight="bold" fill="#ffffff">
                            {surname} {showMaiden ? `(${maiden})` : ''}
                          </tspan>
                          {statusStr && (
                            <tspan x={textX} dy="1.2em" fontSize="11px" fill="#e2e8f0" fontFamily="monospace" fontWeight="500">
                              {statusStr}
                            </tspan>
                          )}
                        </text>
                      );
                    }

                    // 2. Bottom sectors (Spouse & Children):
                    if (sec.side === 'spouse' || sec.side === 'child' || sec.generation < 0) {
                      const bPos = polarToCartesian(centerX, centerY, midRadius, midAngle);
                      return (
                        <text
                          x={bPos.x}
                          y={bPos.y}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#ffffff"
                          className="pointer-events-none select-none font-sans"
                          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.85)' }}
                        >
                          <tspan x={bPos.x} dy="-1.15em" fontSize="12px" fill="#f8fafc" fontWeight="500">
                            {givenWithPatronymic || given}
                          </tspan>
                          <tspan x={bPos.x} dy="1.2em" fontSize="13.5px" fontWeight="bold" fill="#ffffff">
                            {surname}
                          </tspan>
                          {statusStr && (
                            <tspan x={bPos.x} dy="1.15em" fontSize="10.5px" fill="#e2e8f0" fontFamily="monospace">
                              {statusStr}
                            </tspan>
                          )}
                          {sec.relationshipLabel && (
                            <tspan x={bPos.x} dy="1.15em" fontSize="9px" fill="#cbd5e1" fontWeight="600">
                              • {sec.relationshipLabel} •
                            </tspan>
                          )}
                        </text>
                      );
                    }

                    // 3. Generation 1 (Parents - 90 deg wide sectors):
                    // Tangential along arc: angleDeg - 270
                    if (sec.generation === 1) {
                      const pPos = polarToCartesian(centerX, centerY, midRadius, midAngle);
                      const rotation = angleDeg - 270;
                      return (
                        <text
                          x={pPos.x}
                          y={pPos.y}
                          textAnchor="middle"
                          dominantBaseline="central"
                          transform={`rotate(${rotation}, ${pPos.x}, ${pPos.y})`}
                          fill="#ffffff"
                          className="pointer-events-none select-none font-sans"
                          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.85)' }}
                        >
                          <tspan x={pPos.x} dy="-1.2em" fontSize="12px" fill="#f8fafc" fontWeight="500">
                            {givenWithPatronymic || given}
                          </tspan>
                          <tspan x={pPos.x} dy="1.25em" fontSize="14.5px" fontWeight="bold" fill="#ffffff">
                            {surname}
                          </tspan>
                          {showMaiden && (
                            <tspan x={pPos.x} dy="1.15em" fontSize="10.5px" fill="#f1f5f9">
                              ({maiden})
                            </tspan>
                          )}
                          {statusStr && (
                            <tspan x={pPos.x} dy={showMaiden ? '1.15em' : '1.2em'} fontSize="11px" fill="#e2e8f0" fontFamily="monospace">
                              {statusStr}
                            </tspan>
                          )}
                        </text>
                      );
                    }

                    // 4. Generation 2 (Grandparents - 45 deg wide sectors):
                    // Tangential along arc: angleDeg - 270
                    if (sec.generation === 2) {
                      const gpPos = polarToCartesian(centerX, centerY, midRadius, midAngle);
                      const rotation = angleDeg - 270;
                      return (
                        <text
                          x={gpPos.x}
                          y={gpPos.y}
                          textAnchor="middle"
                          dominantBaseline="central"
                          transform={`rotate(${rotation}, ${gpPos.x}, ${gpPos.y})`}
                          fill="#ffffff"
                          className="pointer-events-none select-none font-sans"
                          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.85)' }}
                        >
                          <tspan x={gpPos.x} dy="-1.15em" fontSize="11.5px" fill="#f8fafc" fontWeight="500">
                            {given}
                          </tspan>
                          <tspan x={gpPos.x} dy="1.25em" fontSize="13px" fontWeight="bold" fill="#ffffff">
                            {surname}
                          </tspan>
                          {statusStr && (
                            <tspan x={gpPos.x} dy="1.15em" fontSize="10px" fill="#e2e8f0" fontFamily="monospace">
                              {statusStr}
                            </tspan>
                          )}
                        </text>
                      );
                    }

                    // 5. Generation 3+ (Radial along spoke):
                    const pos = polarToCartesian(centerX, centerY, midRadius, midAngle);
                    const radialRotation = angleDeg < 270 ? angleDeg - 180 : angleDeg - 360;

                    if (sec.generation === 3) {
                      return (
                        <text
                          x={pos.x}
                          y={pos.y}
                          textAnchor="middle"
                          dominantBaseline="central"
                          transform={`rotate(${radialRotation}, ${pos.x}, ${pos.y})`}
                          fill="#ffffff"
                          className="pointer-events-none select-none font-sans"
                          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.85)' }}
                        >
                          <tspan x={pos.x} dy="-1.1em" fontSize="11.5px" fontWeight="bold" fill="#ffffff">
                            {surname}
                          </tspan>
                          <tspan x={pos.x} dy="1.2em" fontSize="10px" fill="#f8fafc" fontWeight="500">
                            {given}
                          </tspan>
                          {statusStr && (
                            <tspan x={pos.x} dy="1.15em" fontSize="9px" fill="#e2e8f0" fontFamily="monospace">
                              {statusStr}
                            </tspan>
                          )}
                        </text>
                      );
                    }

                    // 6. Generation 4 (16 sectors):
                    if (sec.generation === 4) {
                      return (
                        <text
                          x={pos.x}
                          y={pos.y}
                          textAnchor="middle"
                          dominantBaseline="central"
                          transform={`rotate(${radialRotation}, ${pos.x}, ${pos.y})`}
                          fill="#ffffff"
                          className="pointer-events-none select-none font-sans"
                          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.85)' }}
                        >
                          <tspan x={pos.x} dy="-1.05em" fontSize="10px" fontWeight="bold" fill="#ffffff">
                            {surname}
                          </tspan>
                          <tspan x={pos.x} dy="1.15em" fontSize="8.5px" fill="#f8fafc">
                            {given}
                          </tspan>
                          {statusStr && (
                            <tspan x={pos.x} dy="1.1em" fontSize="8px" fill="#e2e8f0" fontFamily="monospace">
                              {statusStr}
                            </tspan>
                          )}
                        </text>
                      );
                    }

                    // 7. Generation 5 (32 sectors):
                    if (sec.generation === 5) {
                      return (
                        <text
                          x={pos.x}
                          y={pos.y}
                          textAnchor="middle"
                          dominantBaseline="central"
                          transform={`rotate(${radialRotation}, ${pos.x}, ${pos.y})`}
                          fill="#ffffff"
                          className="pointer-events-none select-none font-sans"
                          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.85)' }}
                        >
                          <tspan x={pos.x} dy="-0.6em" fontSize="9px" fontWeight="bold" fill="#ffffff">
                            {surname}
                          </tspan>
                          <tspan x={pos.x} dy="1.15em" fontSize="8px" fill="#f8fafc">
                            {given ? `${given.charAt(0)}.` : ''} {birth ? `(${birth})` : ''}
                          </tspan>
                        </text>
                      );
                    }

                    // 8. Generation 6 (64 sectors - single line along spoke):
                    if (sec.generation === 6) {
                      return (
                        <text
                          x={pos.x}
                          y={pos.y}
                          textAnchor="middle"
                          dominantBaseline="central"
                          transform={`rotate(${radialRotation}, ${pos.x}, ${pos.y})`}
                          fill="#ffffff"
                          className="pointer-events-none select-none font-sans"
                          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.95)' }}
                        >
                          <tspan fontSize="8px" fontWeight="bold" fill="#ffffff">{surname}</tspan>{' '}
                          <tspan fontSize="7.2px" fill="#f8fafc">{given ? `${given.charAt(0)}.` : ''} {birth || ''}</tspan>
                        </text>
                      );
                    }

                    // 9. Generation 7 (128 sectors):
                    if (sec.generation === 7) {
                      return (
                        <text
                          x={pos.x}
                          y={pos.y}
                          textAnchor="middle"
                          dominantBaseline="central"
                          transform={`rotate(${radialRotation}, ${pos.x}, ${pos.y})`}
                          fill="#ffffff"
                          className="pointer-events-none select-none font-sans"
                          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.95)' }}
                        >
                          <tspan fontSize="7.2px" fontWeight="bold" fill="#ffffff">{surname}</tspan>{' '}
                          <tspan fontSize="6.5px" fill="#f8fafc">{given ? `${given.charAt(0)}.` : ''} {birth || ''}</tspan>
                        </text>
                      );
                    }

                    // 10. Generation 8+:
                    return (
                      <text
                        x={pos.x}
                        y={pos.y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        transform={`rotate(${radialRotation}, ${pos.x}, ${pos.y})`}
                        fill="#ffffff"
                        fontSize="6.5px"
                        fontWeight="600"
                        className="pointer-events-none select-none font-sans"
                        style={{ textShadow: '0 1px 1px rgba(0,0,0,0.95)' }}
                      >
                        {surname} {given ? `${given.charAt(0)}.` : ''}
                      </text>
                    );
                  })()}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Hovered Person Tooltip Card */}
        {hoveredSector && hoveredSector.person && (
          <div
            className={`absolute bottom-6 right-6 ${
              canvasTheme === 'parchment'
                ? 'bg-white/95 border-neutral-300 text-neutral-900 shadow-xl'
                : 'bg-slate-900/95 border-slate-700 text-white shadow-2xl'
            } backdrop-blur border rounded-xl p-4 max-w-xs z-30 animate-in fade-in duration-150`}
          >
            <div className="flex items-center gap-3">
              {hoveredSector.person.avatarUrl ? (
                <img
                  src={hoveredSector.person.avatarUrl}
                  alt=""
                  className={`w-12 h-12 rounded-lg object-cover border ${
                    canvasTheme === 'parchment' ? 'border-neutral-300' : 'border-slate-600'
                  }`}
                />
              ) : (
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    canvasTheme === 'parchment'
                      ? 'bg-neutral-100 text-neutral-600'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  <User className="w-6 h-6" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                  <span className="text-[10px] uppercase font-mono text-emerald-600 font-semibold">
                    #{hoveredSector.ahnentafelNumber} • Покоління {hoveredSector.generation}
                  </span>
                  {hoveredSector.clanName && (
                    <span
                      className="px-1.5 py-0.2 rounded text-[10px] font-bold text-white shadow-2xs"
                      style={{ backgroundColor: hoveredSector.clanColor || '#2563eb' }}
                    >
                      {hoveredSector.clanName}
                    </span>
                  )}
                </div>
                <h4
                  className={`font-bold text-sm leading-tight ${
                    canvasTheme === 'parchment' ? 'text-neutral-900' : 'text-white'
                  }`}
                >
                  {getFullName(hoveredSector.person)}
                </h4>
                <p
                  className={`text-xs font-mono mt-0.5 ${
                    canvasTheme === 'parchment' ? 'text-neutral-600' : 'text-slate-400'
                  }`}
                >
                  {hoveredSector.person.birthYear || '?'} —{' '}
                  {hoveredSector.person.isLiving
                    ? 'теп. час'
                    : hoveredSector.person.deathYear || '?'}
                </p>
              </div>
            </div>

            <p
              className={`text-xs mt-2 line-clamp-2 ${
                canvasTheme === 'parchment' ? 'text-neutral-700' : 'text-slate-300'
              }`}
            >
              {hoveredSector.person.occupation ||
                hoveredSector.person.birthPlace ||
                'Немає опису'}
            </p>

            <div
              className={`flex items-center gap-2 mt-3 pt-2 border-t ${
                canvasTheme === 'parchment' ? 'border-neutral-200' : 'border-slate-800'
              }`}
            >
              <button
                onClick={() => onSelectPerson(hoveredSector.person!.id)}
                className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-medium transition-colors text-center cursor-pointer shadow-xs"
              >
                Відкрити картку
              </button>
              <button
                onClick={() => onChangeRoot(hoveredSector.person!.id)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  canvasTheme === 'parchment'
                    ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-300'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
                title="Зробити центром віяла"
              >
                <GitFork className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Legend */}
        {showLegend ? (
          <div
            className={`absolute top-20 left-6 ${
              canvasTheme === 'parchment'
                ? 'bg-white/95 border-neutral-300 text-neutral-900 shadow-xl'
                : 'bg-slate-900/95 border-slate-800 text-white shadow-2xl'
            } backdrop-blur border rounded-xl p-3.5 max-w-sm text-xs space-y-2.5 z-30 animate-in fade-in zoom-in-95 duration-150`}
          >
            <div className="flex items-center justify-between gap-2 border-b pb-2 border-inherit">
              <div className="flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-amber-500" />
                <h4
                  className={`font-bold ${
                    canvasTheme === 'parchment' ? 'text-neutral-900' : 'text-slate-200'
                  }`}
                >
                  {colorMode === 'clans' && `Роди у віялі (${clans.length})`}
                  {colorMode === 'grandparents' && '4 гілки дідусів та бабусь'}
                  {colorMode === 'greatgrandparents' && '8 ліній пращурів'}
                  {colorMode === 'gender' && 'Забарвлення за статтю'}
                  {colorMode === 'generation' && 'Забарвлення за поколіннями'}
                </h4>
              </div>
              <div className="flex items-center gap-1">
                {selectedClanId && (
                  <button
                    onClick={() => setSelectedClanId(null)}
                    className="text-[10px] px-1.5 py-0.5 bg-neutral-500/20 hover:bg-neutral-500/30 rounded text-amber-500 font-medium transition-colors cursor-pointer"
                    title="Скинути виділення роду"
                  >
                    Скинути фільтр
                  </button>
                )}
                <button
                  onClick={() => handleToggleLegend(false)}
                  className={`p-1 rounded-lg transition-colors cursor-pointer ${
                    canvasTheme === 'parchment'
                      ? 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title="Закрити легенду"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Clans Color Mode Content */}
            {colorMode === 'clans' && (
              <div className="max-h-60 overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
                <div
                  className={`text-[10px] ${
                    canvasTheme === 'parchment' ? 'text-neutral-500' : 'text-slate-400'
                  } mb-1.5`}
                >
                  Кожен рід виділено індивідуальним кольором. Натисніть на рід, щоб підсвітити його
                  у віялі:
                </div>
                {clans.map((clan) => {
                  const isSelected = selectedClanId === clan.id;
                  const isHoveredClan = hoveredClanId === clan.id;
                  return (
                    <div
                      key={clan.id}
                      onClick={() =>
                        setSelectedClanId((prev) => (prev === clan.id ? null : clan.id))
                      }
                      onMouseEnter={() => setHoveredClanId(clan.id)}
                      onMouseLeave={() => setHoveredClanId(null)}
                      className={`flex items-center justify-between p-1.5 rounded-lg text-[11px] transition-all cursor-pointer ${
                        isSelected
                          ? 'ring-2 ring-emerald-500 font-bold'
                          : isHoveredClan
                          ? 'bg-neutral-500/15'
                          : 'hover:bg-neutral-500/10'
                      } ${canvasTheme === 'parchment' ? 'text-neutral-800' : 'text-slate-200'}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3.5 h-3.5 rounded shrink-0 shadow-2xs"
                          style={{ backgroundColor: clan.color }}
                        />
                        <span className="truncate">{clan.name}</span>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 ml-2 ${
                          canvasTheme === 'parchment'
                            ? 'bg-neutral-200 text-neutral-700'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {clan.count} {clan.count === 1 ? 'особа' : clan.count < 5 ? 'особи' : 'осіб'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 4 Grandparents Branches */}
            {colorMode === 'grandparents' && (
              <div
                className={`grid grid-cols-2 gap-2 text-[11px] ${
                  canvasTheme === 'parchment' ? 'text-neutral-700' : 'text-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-blue-600 shrink-0" />
                  <span>Рід дідуся (батькова лінія)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-cyan-600 shrink-0" />
                  <span>Рід бабусі (батькова лінія)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-orange-600 shrink-0" />
                  <span>Рід дідуся (материнська лінія)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-rose-600 shrink-0" />
                  <span>Рід бабусі (материнська лінія)</span>
                </div>
              </div>
            )}

            {/* 8 Ancestral Lines */}
            {colorMode === 'greatgrandparents' && (
              <div
                className={`grid grid-cols-2 gap-1.5 text-[10px] ${
                  canvasTheme === 'parchment' ? 'text-neutral-700' : 'text-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-[#1d4ed8] shrink-0" />
                  <span>Прадідусь (Б-Б-Б)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-[#3b82f6] shrink-0" />
                  <span>Прабабуся (Б-Б-М)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-[#0284c7] shrink-0" />
                  <span>Прадідусь (Б-М-Б)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-[#06b6d4] shrink-0" />
                  <span>Прабабуся (Б-М-М)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-[#d97706] shrink-0" />
                  <span>Прадідусь (М-Б-Б)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-[#ea580c] shrink-0" />
                  <span>Прабабуся (М-Б-М)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-[#e11d48] shrink-0" />
                  <span>Прадідусь (М-М-Б)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-[#be123c] shrink-0" />
                  <span>Прабабуся (М-М-М)</span>
                </div>
              </div>
            )}

            {/* Gender Color Mode */}
            {colorMode === 'gender' && (
              <div
                className={`flex items-center gap-4 text-[11px] ${
                  canvasTheme === 'parchment' ? 'text-neutral-700' : 'text-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-blue-600 shrink-0" />
                  <span>Чоловіки</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-rose-600 shrink-0" />
                  <span>Жінки</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-600 shrink-0" />
                  <span>Центр віяла</span>
                </div>
              </div>
            )}

            {/* Generation Color Mode */}
            {colorMode === 'generation' && (
              <div
                className={`grid grid-cols-3 gap-1.5 text-[10px] ${
                  canvasTheme === 'parchment' ? 'text-neutral-700' : 'text-slate-300'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-[#059669] shrink-0" />
                  <span>Покоління 0</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-[#0284c7] shrink-0" />
                  <span>Покоління 1</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-[#2563eb] shrink-0" />
                  <span>Покоління 2</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-[#7c3aed] shrink-0" />
                  <span>Покоління 3</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-[#c026d3] shrink-0" />
                  <span>Покоління 4</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-[#e11d48] shrink-0" />
                  <span>Покоління 5</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => handleToggleLegend(true)}
            className={`absolute top-20 left-6 ${
              canvasTheme === 'parchment'
                ? 'bg-white/90 hover:bg-white text-neutral-800 border-neutral-300'
                : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-800'
            } backdrop-blur border rounded-lg px-2.5 py-1.5 shadow-lg transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer z-20`}
            title="Показати легенду кольорів"
          >
            <Info className="w-4 h-4 text-emerald-500" />
            <span>Легенда родів ({clans.length})</span>
          </button>
        )}
      </div>
    </div>
  );
};
