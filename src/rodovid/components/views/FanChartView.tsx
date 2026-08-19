import React, { useState, useMemo, useRef, useEffect } from 'react';
import { PieChart, ZoomIn, ZoomOut, Maximize2, User, GitFork, X, Info, Download, Printer, ChevronDown } from 'lucide-react';
import { GenealogyDatabase, Person } from '../../types/genealogy';
import { calculateFanChart, FanChartSector } from '../../utils/treeLayout';
import { getFullName } from '../../utils/relationship';

interface FanChartViewProps {
  database: GenealogyDatabase;
  activePersonId: string;
  onSelectPerson: (id: string) => void;
  onChangeRoot: (id: string) => void;
}

export const FanChartView: React.FC<FanChartViewProps> = ({
  database,
  activePersonId,
  onSelectPerson,
  onChangeRoot
}) => {
  const [generations, setGenerations] = useState<number>(5);
  const [hoveredSector, setHoveredSector] = useState<FanChartSector | null>(null);
  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const touchStateRef = useRef<{
    initialDist: number;
    initialScale: number;
    initialPan: { x: number; y: number };
    midPoint: { x: number; y: number };
  } | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset pan and scale when person changes
  useEffect(() => {
    setPan({ x: 0, y: 0 });
    setScale(1);
  }, [activePersonId]);

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
      const targetScale = Math.min(Math.max(initialScale * zoomFactor, 0.4), 2.2);

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
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.min(Math.max(scale * zoomFactor, 0.4), 2.2);
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

  const sectors = useMemo(() => {
    return calculateFanChart(database, activePersonId, generations, 60, 75);
  }, [database, activePersonId, generations]);

  const centerX = 450;
  const centerY = 380;

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
    cloned.setAttribute('style', 'background-color: #090d16; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;');
    
    // Add background rect to cloned SVG
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('width', '900');
    bgRect.setAttribute('height', '760');
    bgRect.setAttribute('fill', '#090d16');
    cloned.insertBefore(bgRect, cloned.firstChild);

    const svgData = `<?xml version="1.0" encoding="UTF-8"?>\n` + new XMLSerializer().serializeToString(cloned);
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

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 overflow-hidden relative select-none">
      {/* Top Controls */}
      <div className="h-14 bg-slate-900/90 backdrop-blur border-b border-slate-800 px-4 flex items-center justify-between z-20 shrink-0 print:hidden">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
            <PieChart className="w-3.5 h-3.5 text-emerald-400" />
            <span>Поколінь віяла:</span>
            {[3, 4, 5, 6, 7].map((g) => (
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

          <div className="hidden md:flex items-center gap-2">
            <span className="text-xs text-slate-400">Центральна особа:</span>
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
              title="Експорт та друк віяла"
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
                    <div className="font-medium text-slate-200">Скачати векторне віяло (SVG)</div>
                    <div className="text-[10px] text-slate-400">Векторне віяло 3–7 поколінь без втрати якості</div>
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
              onClick={() => setScale((s) => Math.min(s * 1.15, 2.2))}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
              title="Збільшити"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setScale((s) => Math.max(s * 0.85, 0.4))}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
              title="Зменшити"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setScale(1);
                setPan({ x: 0, y: 0 });
              }}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
              title="Скинути масштаб і центрувати"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <span className="text-[11px] text-slate-400 font-mono px-2">
              {Math.round(scale * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Fan Chart Canvas */}
      <div
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onWheel={handleWheel}
        className={`flex-1 overflow-hidden touch-none relative flex items-center justify-center p-6 bg-radial from-slate-900 to-slate-950 ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{
          touchAction: 'none',
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)',
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
            width="900"
            height="760"
            viewBox="0 0 900 760"
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
              const textPos = polarToCartesian(centerX, centerY, midRadius, midAngle);
              const isHovered = hoveredSector?.ahnentafelNumber === sec.ahnentafelNumber;

              const angleDeg = (midAngle * 180) / Math.PI;
              const rotation = angleDeg > 90 && angleDeg < 270 ? angleDeg + 180 : angleDeg;

              return (
                <g
                  key={sec.ahnentafelNumber}
                  className="cursor-pointer transition-transform duration-200"
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
                    fill={sec.color}
                    stroke="#0f172a"
                    strokeWidth="1.5"
                    className={`transition-all duration-150 ${
                      isHovered ? 'brightness-125 stroke-white stroke-2' : 'hover:brightness-110'
                    }`}
                  />

                  {/* Text inside sector (LOD optimized) */}
                  {sec.person && (scale >= 0.52 || sec.generation <= 3 || isHovered) && (() => {
                    const surname = sec.person.name?.surname || sec.person.lastName || '';
                    const given = sec.person.name?.given || sec.person.firstName || '';
                    return (
                      <text
                        x={textPos.x}
                        y={textPos.y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        transform={`rotate(${rotation}, ${textPos.x}, ${textPos.y})`}
                        fill="#ffffff"
                        className="pointer-events-none font-medium select-none"
                        fontSize={sec.generation <= 2 ? '11px' : sec.generation <= 4 ? '9px' : '7.5px'}
                      >
                        {sec.generation <= 3 ? (
                          <>
                            <tspan x={textPos.x} dy="-0.4em">
                              {surname}
                            </tspan>
                            <tspan x={textPos.x} dy="1.1em" fontSize="8px" fill="#cbd5e1">
                              {given}
                            </tspan>
                          </>
                        ) : (
                          `${surname} ${given.charAt(0)}.`
                        )}
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
          <div className="absolute bottom-6 right-6 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-xl p-4 shadow-2xl max-w-xs z-30 animate-in fade-in duration-150">
            <div className="flex items-center gap-3">
              {hoveredSector.person.avatarUrl ? (
                <img
                  src={hoveredSector.person.avatarUrl}
                  alt=""
                  className="w-12 h-12 rounded-lg object-cover border border-slate-600"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
                  <User className="w-6 h-6" />
                </div>
              )}
              <div>
                <span className="text-[10px] uppercase font-mono text-emerald-400 font-semibold">
                  Ahnentafel #{hoveredSector.ahnentafelNumber} • Покоління {hoveredSector.generation}
                </span>
                <h4 className="font-bold text-sm text-white leading-tight">
                  {getFullName(hoveredSector.person)}
                </h4>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {hoveredSector.person.birthYear || '?'} —{' '}
                  {hoveredSector.person.isLiving ? 'теп. час' : hoveredSector.person.deathYear || '?'}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mt-2 line-clamp-2">
              {hoveredSector.person.occupation || hoveredSector.person.birthPlace || 'Немає опису'}
            </p>

            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-800">
              <button
                onClick={() => onSelectPerson(hoveredSector.person!.id)}
                className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-medium transition-colors text-center"
              >
                Відкрити картку
              </button>
              <button
                onClick={() => onChangeRoot(hoveredSector.person!.id)}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-xs font-medium transition-colors"
                title="Зробити центром віяла"
              >
                <GitFork className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Legend */}
        {showLegend ? (
          <div className="absolute top-20 left-6 bg-slate-900/95 backdrop-blur border border-slate-800 rounded-xl p-3.5 shadow-2xl max-w-xs text-xs space-y-2 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-semibold text-slate-200">Кольорові гілки Gramps</h4>
              <button
                onClick={() => handleToggleLegend(false)}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title="Закрити легенду"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-blue-600 shrink-0" />
                <span>Гілка дідуся (батькова)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-sky-500 shrink-0" />
                <span>Гілка бабусі (батькова)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-orange-600 shrink-0" />
                <span>Гілка дідуся (материнська)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-rose-600 shrink-0" />
                <span>Гілка бабусі (материнська)</span>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => handleToggleLegend(true)}
            className="absolute top-20 left-6 bg-slate-900/90 hover:bg-slate-800 backdrop-blur border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-lg px-2.5 py-1.5 shadow-lg transition-all flex items-center gap-1.5 text-xs font-medium"
            title="Показати легенду кольорів"
          >
            <Info className="w-4 h-4 text-emerald-400" />
            <span>Легенда</span>
          </button>
        )}
      </div>
    </div>
  );
};
