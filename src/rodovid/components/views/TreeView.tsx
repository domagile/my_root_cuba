/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
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
  Compass,
  Users,
  Sparkles,
  Eye,
  EyeOff,
  Palette,
  Sun,
  Moon,
  Check,
  Shield,
  Lock
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
import { getFullName, sortPersonsBySurnameAndBirthDesc } from '../../utils/relationship';
import { useUIStore } from '../../../stores/useUIStore';
import { useAuthStore } from '../../../stores/useAuthStore';
import { isPersonLiving, getPrivacySafePerson, getPrivacyLifespan, isUserWhitelisted } from '../../utils/privacy';
import { getThemeConfig } from '../../../utils/theme';

interface TreeViewProps {
  database: GenealogyDatabase;
  activePersonId: string;
  onSelectPerson: (id: string) => void;
  onOpenAddChild: (parentId: string) => void;
  onOpenAddParent: (childId: string) => void;
  onChangeRoot: (id: string) => void;
  onOpenRelationManager?: (personId: string) => void;
  onSwitchToFan?: () => void;
  isReadOnly?: boolean;
}

export const TreeView: React.FC<TreeViewProps> = ({
  database,
  activePersonId,
  onSelectPerson,
  onOpenAddChild,
  onOpenAddParent,
  onChangeRoot,
  onOpenRelationManager,
  onSwitchToFan,
  isReadOnly = false
}) => {
  const currentUser = useAuthStore((s) => s.currentUser);
  const whitelist = useAuthStore((s) => s.whitelist);
  const isWhitelisted = useMemo(() => isUserWhitelisted(currentUser, whitelist), [currentUser, whitelist]);
  const canvasTheme = useUIStore((s) => s.treeCanvasTheme);
  const setCanvasTheme = useUIStore((s) => s.setTreeCanvasTheme);

  const [layoutType, setLayoutType] = useState<TreeLayoutType>('ancestors');
  // Default to 0 = ALL generations
  const [generations, setGenerations] = useState<number>(0);
  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 80, y: 80 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showMinimap, setShowMinimap] = useState<boolean>(true);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState<boolean>(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportOpen(false);
      }
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setIsThemeMenuOpen(false);
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

  // Visibility & Branch Collapse Filters
  const [showParents, setShowParents] = useState<boolean>(true);
  const [showSiblings, setShowSiblings] = useState<boolean>(true);
  const [showDescendants, setShowDescendants] = useState<boolean>(true);
  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(new Set());
  const [collapsedSiblings, setCollapsedSiblings] = useState<Set<string>>(new Set());
  const [collapsedChildren, setCollapsedChildren] = useState<Set<string>>(new Set());
  const [hoveredPersonId, setHoveredPersonId] = useState<string | null>(null);

  // Anchor tracking: preserve viewport screen position on the person card being expanded/collapsed
  const anchorRef = useRef<{ personId: string; screenX: number; screenY: number } | null>(null);

  // Compute Layout (Classic Family Pedigree with grouped spouses, siblings & orthogonal lines)
  const layout = useMemo(() => {
    return calculateClassicFamilyTreeLayout(database, activePersonId, generations, {
      showParents,
      showSiblings,
      showDescendants,
      collapsedParents,
      collapsedSiblings,
      collapsedChildren
    });
  }, [
    database,
    activePersonId,
    generations,
    showParents,
    showSiblings,
    showDescendants,
    collapsedParents,
    collapsedSiblings,
    collapsedChildren
  ]);

  const setAnchorForPerson = useCallback((personId: string) => {
    const node = layout.nodes.find((n) => n.person.id === personId);
    if (node) {
      anchorRef.current = {
        personId,
        screenX: node.x * scale + pan.x,
        screenY: node.y * scale + pan.y
      };
    }
  }, [layout.nodes, scale, pan.x, pan.y]);

  const toggleCollapseParents = useCallback((personId: string, isCurrentlyCollapsed?: boolean) => {
    setAnchorForPerson(personId);
    setShowParents(true);
    setCollapsedParents((prev) => {
      const next = new Set(prev);
      const shouldCollapse = isCurrentlyCollapsed !== undefined ? !isCurrentlyCollapsed : !next.has(personId);
      if (shouldCollapse) {
        next.add(personId);
      } else {
        next.delete(personId);
        const p = database.persons[personId];
        if (p) {
          if (p.fatherId) next.delete(p.fatherId);
          if (p.motherId) next.delete(p.motherId);
        }
      }
      return next;
    });
  }, [setAnchorForPerson, database.persons]);

  const toggleCollapseSiblings = useCallback((personId: string, isCurrentlyCollapsed?: boolean) => {
    setAnchorForPerson(personId);
    setShowSiblings(true);
    const p = database.persons[personId];
    if (!p) return;
    const fId = p?.fatherId || (p?.parentFamilyId ? database.families[p.parentFamilyId]?.husbandId : undefined);
    const mId = p?.motherId || (p?.parentFamilyId ? database.families[p.parentFamilyId]?.wifeId : undefined);

    const relatedIds = [personId];
    if (p.siblingIds) {
      p.siblingIds.forEach(id => relatedIds.push(id));
    }
    Object.values(database.persons).forEach((cand: any) => {
      const cF = cand.fatherId || (cand.parentFamilyId ? database.families[cand.parentFamilyId]?.husbandId : undefined);
      const cM = cand.motherId || (cand.parentFamilyId ? database.families[cand.parentFamilyId]?.wifeId : undefined);
      if ((fId && cF === fId) || (mId && cM === mId) || (cand.siblingIds && cand.siblingIds.includes(personId))) {
        relatedIds.push(cand.id);
      }
    });

    setCollapsedSiblings((prev) => {
      const next = new Set(prev);
      const shouldCollapse = isCurrentlyCollapsed !== undefined ? !isCurrentlyCollapsed : !next.has(personId);
      relatedIds.forEach((id) => {
        if (shouldCollapse) {
          next.add(id);
        } else {
          next.delete(id);
        }
      });
      return next;
    });
  }, [setAnchorForPerson, database.persons, database.families]);

  const toggleCollapseChildren = useCallback((personId: string, isCurrentlyCollapsed?: boolean) => {
    setAnchorForPerson(personId);
    setCollapsedChildren((prev) => {
      const next = new Set(prev);
      const shouldCollapse = isCurrentlyCollapsed !== undefined ? !isCurrentlyCollapsed : !next.has(personId);
      if (shouldCollapse) {
        next.add(personId);
      } else {
        next.delete(personId);
      }
      return next;
    });
  }, [setAnchorForPerson]);

  const handleExpandAll = useCallback(() => {
    setShowParents(true);
    setShowSiblings(true);
    setShowDescendants(true);
    setCollapsedParents(new Set());
    setCollapsedSiblings(new Set());
    setCollapsedChildren(new Set());
  }, []);

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

  // Tree Bounding Box: dynamically wraps the actual nodes with comfortable padding
  const treeBounds = useMemo(() => {
    if (!layout.nodes.length) {
      return { minX: 0, maxX: 1200, minY: 0, maxY: 800, width: 1200, height: 800 };
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    layout.nodes.forEach((n) => {
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x + (n.width || CLASSIC_CARD_WIDTH));
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y + (n.height || CLASSIC_CARD_HEIGHT));
    });
    const padX = 60;
    const padY = 50;
    const width = Math.max(maxX - minX + padX * 2, 200);
    const height = Math.max(maxY - minY + padY * 2, 150);
    return {
      minX: minX - padX,
      maxX: maxX + padX,
      minY: minY - padY,
      maxY: maxY + padY,
      width,
      height
    };
  }, [layout.nodes]);

  // Center tree on container dimensions and tree bounding box
  const centerTree = useCallback(() => {
    if (!layout.nodes.length) return;
    const container = containerRef.current;
    const cw = container ? container.clientWidth : containerDimensions.width || 1000;
    const ch = container ? container.clientHeight : containerDimensions.height || 700;

    const treeW = treeBounds.width;
    const treeH = treeBounds.height;

    const fitScaleX = (cw - 120) / treeW;
    const fitScaleY = (ch - 120) / treeH;
    const optimalScale = Math.min(Math.max(Math.min(fitScaleX, fitScaleY), 0.5), 1.15);

    const treeCenterX = (treeBounds.minX + treeBounds.maxX) / 2;
    const treeCenterY = (treeBounds.minY + treeBounds.maxY) / 2;

    const newPanX = cw / 2 - treeCenterX * optimalScale;
    const newPanY = ch / 2 - treeCenterY * optimalScale;

    setPan({ x: Math.round(newPanX), y: Math.round(newPanY) });
    setScale(optimalScale);
  }, [layout.nodes, containerDimensions, treeBounds]);

  // Smooth zoom around center for UI buttons (+ / - / reset)
  const zoomAroundCenter = useCallback((multiplier: number) => {
    const cw = containerDimensions.width || 1000;
    const ch = containerDimensions.height || 700;
    const centerX = cw / 2;
    const centerY = ch / 2;

    setScale((prevScale) => {
      const newScale = Math.min(Math.max(prevScale * multiplier, 0.2), 2.5);
      setPan((prevPan) => {
        const worldX = (centerX - prevPan.x) / prevScale;
        const worldY = (centerY - prevPan.y) / prevScale;
        const newPanX = centerX - worldX * newScale;
        const newPanY = centerY - worldY * newScale;
        return { x: Math.round(newPanX), y: Math.round(newPanY) };
      });
      return newScale;
    });
  }, [containerDimensions]);

  const fitTreeWidth = useCallback(() => {
    if (!layout.nodes.length) return;
    const cw = containerDimensions.width || 1200;
    const treeW = treeBounds.width;
    const fitScale = Math.min(Math.max((cw - 80) / treeW, 0.3), 1.5);
    const treeCenterX = (treeBounds.minX + treeBounds.maxX) / 2;
    setPan({
      x: Math.round(cw / 2 - treeCenterX * fitScale),
      y: 80
    });
    setScale(fitScale);
  }, [layout.nodes, containerDimensions, treeBounds]);

  const centerOnActive = useCallback(() => {
    const activeNode = layout.nodes.find(n => n.person.id === activePersonId) || layout.nodes[0];
    if (!activeNode) return;
    const cw = containerDimensions.width || 1200;
    const ch = containerDimensions.height || 800;
    const nodeCenterX = activeNode.x + (activeNode.width || CLASSIC_CARD_WIDTH) / 2;
    const nodeCenterY = activeNode.y + (activeNode.height || CLASSIC_CARD_HEIGHT) / 2;
    setPan({
      x: Math.round(cw / 2 - nodeCenterX * scale),
      y: Math.round(ch / 2 - nodeCenterY * scale)
    });
  }, [layout.nodes, activePersonId, containerDimensions, scale]);

  const scrollStep = useCallback((direction: 'left' | 'right') => {
    const step = 380;
    setPan(prev => ({
      ...prev,
      x: direction === 'left' ? prev.x + step : prev.x - step
    }));
  }, []);

  // When layout updates: if an anchor was set (from branch collapse/expand), adjust pan so that person remains at exact same screen coordinates!
  useLayoutEffect(() => {
    if (anchorRef.current) {
      const { personId, screenX, screenY } = anchorRef.current;
      anchorRef.current = null;
      const newNode = layout.nodes.find((n) => n.person.id === personId);
      if (newNode) {
        const newPanX = screenX - newNode.x * scale;
        const newPanY = screenY - newNode.y * scale;
        setPan({ x: Math.round(newPanX), y: Math.round(newPanY) });
      }
    }
  }, [layout, scale]);

  // Center tree ONLY on initial mount or when active root person / layoutType changes
  const isInitialMount = useRef<boolean>(true);
  const prevRootId = useRef<string>(activePersonId);
  const prevLayoutType = useRef<TreeLayoutType>(layoutType);

  useEffect(() => {
    if (isInitialMount.current || prevRootId.current !== activePersonId || prevLayoutType.current !== layoutType) {
      isInitialMount.current = false;
      prevRootId.current = activePersonId;
      prevLayoutType.current = layoutType;
      const timer = setTimeout(() => {
        centerTree();
      }, 40);
      return () => clearTimeout(timer);
    }
  }, [activePersonId, layoutType, centerTree]);

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

  // Touch Support for tablets and mobile (Smooth pinch-to-zoom anchored to midpoint)
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

      const rect = containerRef.current?.getBoundingClientRect();
      const containerMidX = rect ? currentMidX - rect.left : currentMidX;
      const containerMidY = rect ? currentMidY - rect.top : currentMidY;

      const { initialDist, initialScale, initialPan, midPoint } = touchStateRef.current;
      const initialContainerMidX = rect ? midPoint.x - rect.left : midPoint.x;
      const initialContainerMidY = rect ? midPoint.y - rect.top : midPoint.y;

      const zoomFactor = currentDist / initialDist;
      const targetScale = Math.min(Math.max(initialScale * zoomFactor, 0.2), 2.5);

      const worldX = (initialContainerMidX - initialPan.x) / initialScale;
      const worldY = (initialContainerMidY - initialPan.y) / initialScale;

      const newPanX = containerMidX - worldX * targetScale;
      const newPanY = containerMidY - worldY * targetScale;

      setScale(targetScale);
      setPan({
        x: Math.round(newPanX),
        y: Math.round(newPanY)
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

  // Native non-passive Wheel listener to handle Ctrl+Wheel / Trackpad pinch zoom anchored to mouse pointer without triggering browser UI zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onNativeWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = container.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      if (e.ctrlKey || e.metaKey) {
        // Ctrl + Mouse wheel or Trackpad Pinch
        // Smooth exponential factor based on deltaY
        const zoomFactor = Math.exp(-e.deltaY * 0.0035);

        setScale((prevScale) => {
          const newScale = Math.min(Math.max(prevScale * zoomFactor, 0.2), 2.5);

          setPan((prevPan) => {
            // Anchor point under cursor
            const worldX = (cursorX - prevPan.x) / prevScale;
            const worldY = (cursorY - prevPan.y) / prevScale;

            const newPanX = cursorX - worldX * newScale;
            const newPanY = cursorY - worldY * newScale;
            return { x: Math.round(newPanX), y: Math.round(newPanY) };
          });

          return newScale;
        });
      } else {
        // Natural 2D scroll (trackpad or mouse wheel)
        const deltaX = e.shiftKey ? e.deltaY : e.deltaX;
        const deltaY = e.shiftKey ? 0 : e.deltaY;
        setPan((prev) => ({
          x: Math.round(prev.x - deltaX),
          y: Math.round(prev.y - deltaY)
        }));
      }
    };

    container.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', onNativeWheel);
    };
  }, []);

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
    <div className="flex flex-col h-full w-full bg-[#23272b] overflow-hidden relative select-none">
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
            <button
              onClick={() => setGenerations(0)}
              className={`px-2.5 py-0.5 rounded text-xs font-bold transition-colors cursor-pointer ${
                generations === 0
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Відобразити всі покоління дерева"
            >
              Всі
            </button>
            {[4, 5, 6, 7, 8, 9, 10].map((g) => (
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
              {sortPersonsBySurnameAndBirthDesc(Object.values(database.persons) as Person[]).map((p) => (
                <option key={p.id} value={p.id}>
                  {getFullName(p)} {p.birthYear ? `(${p.birthYear})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Toggle: Siblings (Direct Line vs Collateral) */}
          <button
            type="button"
            onClick={() => {
              if (showSiblings && collapsedSiblings.size === 0) {
                setShowSiblings(false);
                const allWithSiblings = new Set<string>();
                Object.keys(database.persons).forEach(id => allWithSiblings.add(id));
                setCollapsedSiblings(allWithSiblings);
              } else {
                setShowSiblings(true);
                setCollapsedSiblings(new Set());
              }
            }}
            className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              showSiblings && collapsedSiblings.size === 0
                ? 'bg-[#15181b] hover:bg-slate-800 text-slate-300 border-[#2d3238]'
                : 'bg-amber-600 hover:bg-amber-500 text-white border-amber-500 shadow-md'
            }`}
            title={showSiblings && collapsedSiblings.size === 0 ? "Сховати всіх братів та сестер (залишити тільки прямих предків)" : "Показати всіх братів та сестер (непрямих предків)"}
          >
            <Users className="w-3.5 h-3.5 text-amber-300" />
            <span>{showSiblings && collapsedSiblings.size === 0 ? "Брати/сестри: Всі" : "Тільки прямі предки"}</span>
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Export Menu */}
          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setIsExportOpen((prev) => !prev)}
              className={`p-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer flex items-center justify-center ${
                isExportOpen
                  ? 'bg-slate-700 text-white border-slate-600 shadow-xs'
                  : 'bg-[#15181b] text-slate-300 hover:text-white hover:bg-slate-800 border-[#2d3238]'
              }`}
              title="Експорт та друк дерева (SVG / PDF)"
            >
              <Download className="w-4 h-4 text-emerald-400" />
            </button>

            {isExportOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-[#1b1f24] border border-[#323840] rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1 text-[10px] uppercase font-bold tracking-wider text-slate-400 border-b border-[#2d3238] mb-1">
                  Збереження та експорт
                </div>
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

          {/* Canvas Theme Selector Dropdown */}
          <div className="relative" ref={themeMenuRef}>
            <button
              type="button"
              onClick={() => setIsThemeMenuOpen((prev) => !prev)}
              className={`p-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer flex items-center justify-center ${
                isThemeMenuOpen
                  ? 'bg-slate-700 text-white border-slate-600 shadow-xs'
                  : 'bg-[#15181b] text-slate-300 hover:text-white hover:bg-slate-800 border-[#2d3238]'
              }`}
              title="Колірна тема фону дерева"
            >
              <Palette className="w-4 h-4 text-amber-400" />
            </button>

            {isThemeMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-[#1b1f24] border border-[#323840] rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1 text-[10px] uppercase font-bold tracking-wider text-slate-400 border-b border-[#2d3238] mb-1">
                  Тема фону полотна
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCanvasTheme('classic-dark');
                    setIsThemeMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors cursor-pointer ${
                    canvasTheme === 'classic-dark'
                      ? 'bg-[#252a30] text-white font-semibold'
                      : 'text-slate-300 hover:bg-[#252a30] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full bg-[#1b1f23] border border-slate-600 flex items-center justify-center">
                      <Moon className="w-2.5 h-2.5 text-slate-300" />
                    </div>
                    <span>Графіт (Темна)</span>
                  </div>
                  {canvasTheme === 'classic-dark' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCanvasTheme('parchment');
                    setIsThemeMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors cursor-pointer ${
                    canvasTheme === 'parchment'
                      ? 'bg-[#252a30] text-white font-semibold'
                      : 'text-slate-300 hover:bg-[#252a30] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full bg-[#f4ede2] border border-amber-600" />
                    <span>Пергамент</span>
                  </div>
                  {canvasTheme === 'parchment' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCanvasTheme('light');
                    setIsThemeMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors cursor-pointer ${
                    canvasTheme === 'light'
                      ? 'bg-[#252a30] text-white font-semibold'
                      : 'text-slate-300 hover:bg-[#252a30] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full bg-white border border-slate-300 flex items-center justify-center">
                      <Sun className="w-2.5 h-2.5 text-amber-500" />
                    </div>
                    <span>Світла</span>
                  </div>
                  {canvasTheme === 'light' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCanvasTheme('emerald');
                    setIsThemeMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors cursor-pointer ${
                    canvasTheme === 'emerald'
                      ? 'bg-[#252a30] text-white font-semibold'
                      : 'text-slate-300 hover:bg-[#252a30] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full bg-emerald-700 border border-emerald-500" />
                    <span>Смарагдовий ліс</span>
                  </div>
                  {canvasTheme === 'emerald' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </button>
              </div>
            )}
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-[#15181b] border border-[#2d3238] p-1 rounded-lg">
            <button
              onClick={() => zoomAroundCenter(1.18)}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
              title="Збільшити масштаб"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => zoomAroundCenter(0.85)}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
              title="Зменшити масштаб"
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
            <button
              onClick={() => {
                const cw = containerDimensions.width || 1000;
                const ch = containerDimensions.height || 700;
                setScale(1.0);
              }}
              className="text-[11px] text-slate-400 hover:text-white font-mono px-2 py-1 rounded hover:bg-slate-800 transition-colors cursor-pointer"
              title="Скинути масштаб до 100%"
            >
              {Math.round(scale * 100)}%
            </button>
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
        className={`flex-1 relative overflow-hidden touch-none ${
          canvasTheme === 'parchment'
            ? 'bg-[#f4efe4]'
            : canvasTheme === 'light'
            ? 'bg-[#f8fafc]'
            : canvasTheme === 'emerald'
            ? 'bg-[#031d16]'
            : 'bg-[#23272e]'
        } ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          backgroundImage:
            canvasTheme === 'parchment'
              ? 'radial-gradient(circle at 1px 1px, rgba(140, 110, 70, 0.22) 1px, transparent 0)'
              : canvasTheme === 'light'
              ? 'radial-gradient(circle at 1px 1px, rgba(100, 116, 139, 0.18) 1px, transparent 0)'
              : canvasTheme === 'emerald'
              ? 'radial-gradient(circle at 1px 1px, rgba(52, 211, 153, 0.18) 1px, transparent 0)'
              : 'radial-gradient(circle at 1px 1px, rgba(140, 155, 170, 0.16) 1px, transparent 0)',
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
            {visibleLinks.map((link) => {
              const pathData = link.path || `M ${link.sourceX} ${link.sourceY} L ${link.targetX} ${link.targetY}`;
              const isMarriage = link.type === 'marriage';
              const isHovered = Boolean(
                hoveredPersonId && (
                  link.sourcePersonId === hoveredPersonId ||
                  link.targetPersonId === hoveredPersonId ||
                  link.childPersonId === hoveredPersonId ||
                  link.familyId === hoveredPersonId
                )
              );

              const defaultColor = link.color || (isMarriage ? '#a1a1aa' : '#0284c7');
              const strokeColor = isHovered ? '#38bdf8' : defaultColor;
              const strokeWidth = isHovered ? (isMarriage ? 3.5 : 3.2) : (isMarriage ? 2 : 2.2);
              const opacity = hoveredPersonId ? (isHovered ? 1 : 0.38) : 0.95;

              return (
                <g key={link.id} opacity={opacity} className="transition-opacity duration-150">
                  {/* Glowing halo background on hover */}
                  {isHovered && (
                    <path
                      d={pathData}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth={strokeWidth + 4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={0.35}
                    />
                  )}
                  <path
                    d={pathData}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Marriage central connector badge */}
                  {/* Marriage link midpoint symbol / indicator */}
                  {isMarriage && (
                    <g>
                      <circle
                        cx={(link.sourceX + link.targetX) / 2}
                        cy={link.sourceY}
                        r={7}
                        fill="#1e2226"
                        stroke="#a1a1aa"
                        strokeWidth={1.5}
                      />
                      <text
                        x={(link.sourceX + link.targetX) / 2}
                        y={link.sourceY + 3}
                        fontSize="8"
                        textAnchor="middle"
                        fill="#cbd5e1"
                        fontWeight="bold"
                      >
                        {link.marriageOrder || '1'}
                      </text>
                    </g>
                  )}
                  {/* Matching arrowhead in family lineage color */}
                  {link.arrow === 'down' && (
                    <path
                      d={`M ${link.targetX - 4.5} ${link.targetY - 7} L ${link.targetX} ${link.targetY - 0.5} L ${link.targetX + 4.5} ${link.targetY - 7}`}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
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
            const rawPerson = node.person;
            const isLiving = isPersonLiving(rawPerson);
            const isMasked = !isWhitelisted && isLiving;
            const p = isMasked ? getPrivacySafePerson(rawPerson, false) : rawPerson;

            const isRoot = p.id === activePersonId;
            const isMale = p.gender === 'male' || p.gender === 'M';
            const isFemale = p.gender === 'female' || p.gender === 'F';
            const isLightCanvas = canvasTheme === 'parchment' || canvasTheme === 'light';

            const firstName = isMasked ? 'Скрито' : (p.name?.given || p.firstName || '—');
            const lastName = isMasked ? 'Скрито' : (p.name?.surname || p.lastName || '—');
            const lifespanStr = isMasked ? '🔒 Скрито (Жива особа)' : formatLifespan(p);
            const fsCode = isMasked ? '🔒 ЗАХИЩЕНО' : getGenealogyCode(p);

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
                  onMouseEnter={() => setHoveredPersonId(p.id)}
                  onMouseLeave={() => setHoveredPersonId(null)}
                  className={`group rounded-xl border p-2.5 shadow-lg transition-all cursor-pointer flex flex-col justify-center text-center ${
                    isLightCanvas
                      ? 'bg-white border-[#d4c8b5] text-neutral-900 shadow-md'
                      : 'bg-[#22262a] border-[#363c44] text-white'
                  } ${isRoot ? 'ring-2 ring-rose-500 border-rose-500 shadow-xl' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPerson(p.id);
                  }}
                >
                  <div className={`w-8 h-8 mx-auto mb-1.5 rounded-full flex items-center justify-center ${
                    isMasked
                      ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/60'
                      : isMale ? 'bg-[#0e4e6d] text-cyan-300' : isFemale ? 'bg-[#6b1b48] text-pink-300' : 'bg-slate-700 text-slate-300'
                  }`}>
                    {isMasked ? <Lock className="w-3.5 h-3.5" /> : <User className="w-4 h-4" />}
                  </div>
                  <div className={`font-bold text-xs truncate leading-tight ${isLightCanvas ? 'text-neutral-900' : 'text-white'}`}>{firstName}</div>
                  <div className={`font-bold text-xs truncate leading-tight ${isLightCanvas ? 'text-neutral-900' : 'text-white'}`}>{lastName}</div>
                  <div className={`text-[10px] mt-1 truncate ${isLightCanvas ? 'text-neutral-600 font-medium' : 'text-slate-400'}`}>{lifespanStr}</div>
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
                onMouseEnter={() => setHoveredPersonId(p.id)}
                onMouseLeave={() => setHoveredPersonId(null)}
                className={`group rounded-xl border transition-all cursor-pointer flex flex-col justify-between p-3 select-none relative shadow-xl ${
                  isLightCanvas
                    ? 'bg-white border-[#d8cfbe] text-neutral-900 hover:border-emerald-600 shadow-md hover:shadow-lg'
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
                {/* Top-Left: Sibling line toggle (Розкрити / закрити лінію братів і сестер) */}
                {node.hasSiblings && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCollapseSiblings(p.id, node.isSiblingsCollapsed);
                    }}
                    className={`absolute top-2 left-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-md transition-all cursor-pointer border ${
                      node.isSiblingsCollapsed
                        ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-400 scale-105 ring-1 ring-amber-300/40'
                        : isLightCanvas
                        ? 'bg-[#ece5d8] hover:bg-amber-100 text-stone-800 border-[#cfc3af]'
                        : 'bg-[#181b1f] hover:bg-slate-700 text-slate-300 border-[#3b434d]'
                    }`}
                    title={
                      node.isSiblingsCollapsed
                        ? `Розгорнути лінію братів та сестер: +${node.siblingsCount}`
                        : `Сховати лінію братів та сестер (${node.siblingsCount})`
                    }
                    aria-label="Перемикач лінії братів та сестер"
                  >
                    <Users className={`w-3 h-3 ${node.isSiblingsCollapsed ? 'text-white' : 'text-amber-500'}`} />
                    <span>{node.isSiblingsCollapsed ? `+${node.siblingsCount}` : `${node.siblingsCount}`}</span>
                  </button>
                )}

                {/* Top Quick-Add (+) Button in corner (Hidden in read-only mode) */}
                {!isReadOnly && (
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

                {/* Top Collapse/Expand Parents Branch Badge */}
                {node.hasParents && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCollapseParents(p.id, node.isParentsCollapsed);
                    }}
                    className={`absolute -top-2.5 left-1/2 -translate-x-1/2 z-10 w-6 h-5 rounded-full text-[10px] font-bold flex items-center justify-center gap-0.5 shadow-md transition-all cursor-pointer border ${
                      node.isParentsCollapsed
                        ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-400 scale-105'
                        : isLightCanvas
                        ? 'bg-[#ece5d8] hover:bg-[#ded5c5] text-stone-900 border-[#cfc3af]'
                        : 'bg-[#1e2329] hover:bg-slate-700 text-slate-300 border-[#3b434d]'
                    }`}
                    title={node.isParentsCollapsed ? `Розгорнути предків (${node.parentsCount})` : 'Сховати предків'}
                    aria-label="Перемикач предків"
                  >
                    <ChevronUp className={`w-3 h-3 ${node.isParentsCollapsed ? 'text-white' : 'text-amber-500'}`} />
                    {node.isParentsCollapsed && <span className="text-[9px] leading-none">{node.parentsCount}</span>}
                  </button>
                )}

                {/* Centered Avatar (Image 2 style) */}
                <div className="flex flex-col items-center mt-1">
                  <div className="relative">
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
                  </div>

                  {/* Spouse Status Indicator (if divorced or widowed) */}
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
                  {/* First Name */}
                  <h4 className={`font-bold text-[13px] leading-tight truncate transition-colors ${
                    isLightCanvas
                      ? 'text-neutral-900 group-hover:text-emerald-700 font-bold'
                      : 'text-white group-hover:text-emerald-400 font-bold'
                  }`}>
                    {firstName}
                  </h4>
                  {/* Last Name */}
                  <h4 className={`font-bold text-[13px] leading-tight truncate transition-colors ${
                    isLightCanvas
                      ? 'text-neutral-900 group-hover:text-emerald-700 font-bold'
                      : 'text-white group-hover:text-emerald-400 font-bold'
                  }`}>
                    {lastName}
                  </h4>

                  {/* Lifespan */}
                  <div className={`text-[11px] mt-1.5 font-medium tracking-tight ${
                    isLightCanvas ? 'text-neutral-700 font-semibold' : 'text-[#94a3b8]'
                  }`}>
                    {lifespanStr}
                  </div>

                  {/* FamilySearch-style unique ID code */}
                  <div className={`text-[10px] font-mono tracking-wider mt-0.5 ${
                    isLightCanvas ? 'text-neutral-600 font-medium' : 'text-[#64748b]'
                  }`}>
                    {fsCode}
                  </div>
                </div>

                {/* Bottom Source & Document Badges (Image 2 style) */}
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
                      {/* Citations / Documents Badge */}
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                          isLightCanvas
                            ? 'bg-sky-50 text-sky-800 border-sky-300'
                            : 'bg-[#0e7490]/30 text-[#38bdf8] border-[#0e7490]/50'
                        }`}
                        title={`Джерела та архівні записи: ${p.citations?.length || (p.sourceIds?.length || 1)}`}
                      >
                        <FileText className="w-3 h-3" />
                      </div>

                      {/* Sibling Toggle Badge */}
                      {node.hasSiblings && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCollapseSiblings(p.id, node.isSiblingsCollapsed);
                          }}
                          className={`h-5 px-1.5 rounded-md flex items-center gap-1 text-[10px] font-medium border transition-colors cursor-pointer ${
                            node.isSiblingsCollapsed
                              ? 'bg-sky-600 text-white border-sky-400 hover:bg-sky-500'
                              : isLightCanvas
                              ? 'bg-stone-100 hover:bg-sky-100 text-stone-800 border-stone-300'
                              : 'bg-[#334155]/60 hover:bg-sky-900 text-slate-300 border-slate-600/50'
                          }`}
                          title={
                            node.isSiblingsCollapsed
                              ? `Розгорнути братів/сестер (${node.siblingsCount})`
                              : `Сховати братів/сестер (${node.siblingsCount})`
                          }
                        >
                          <Users className="w-3 h-3 text-sky-500" />
                          <span>{node.isSiblingsCollapsed ? `+${node.siblingsCount}` : `${node.siblingsCount}`}</span>
                        </button>
                      )}

                      {/* Estate / Confession / Relatives Badge */}
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
                    </>
                  )}
                </div>

                {/* Bottom Collapse/Expand Children Branch Badge */}
                {node.hasChildren && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCollapseChildren(p.id, node.isChildrenCollapsed);
                    }}
                    className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-10 w-6 h-5 rounded-full text-[10px] font-bold flex items-center justify-center gap-0.5 shadow-md transition-all cursor-pointer border ${
                      node.isChildrenCollapsed
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 scale-105'
                        : isLightCanvas
                        ? 'bg-[#ece5d8] hover:bg-[#ded5c5] text-stone-900 border-[#cfc3af]'
                        : 'bg-[#1e2329] hover:bg-slate-700 text-slate-300 border-[#3b434d]'
                    }`}
                    title={node.isChildrenCollapsed ? `Розгорнути нащадків (${node.childrenCount})` : 'Сховати нащадків'}
                  >
                    <ChevronDown className={`w-3 h-3 ${node.isChildrenCollapsed ? 'text-white' : 'text-emerald-500'}`} />
                    {node.isChildrenCollapsed && <span className="text-[9px] leading-none">{node.childrenCount}</span>}
                  </button>
                )}

                {/* Side Expand/Collapse Siblings Button */}
                {node.hasSiblings && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCollapseSiblings(p.id, node.isSiblingsCollapsed);
                    }}
                    className={`absolute -right-2.5 top-1/2 -translate-y-1/2 z-10 w-5 h-7 rounded-r-lg flex items-center justify-center shadow-md transition-all cursor-pointer border border-l-0 ${
                      node.isSiblingsCollapsed
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 opacity-100 scale-105'
                        : isLightCanvas
                        ? 'bg-[#ece5d8] hover:bg-emerald-600 text-stone-700 hover:text-white border-[#cfc3af] opacity-80 group-hover:opacity-100'
                        : 'bg-[#181b1f] hover:bg-emerald-600 text-slate-300 hover:text-white border-[#383e46] opacity-80 group-hover:opacity-100'
                    }`}
                    title={
                      node.isSiblingsCollapsed
                        ? `Розгорнути лінію братів/сестер (${node.siblingsCount})`
                        : `Сховати лінію братів/сестер (${node.siblingsCount})`
                    }
                  >
                    {node.isSiblingsCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5 text-white" />
                    ) : (
                      <ChevronLeft className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
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
                Виберіть або додайте персону, щоб розпочати побудову родинного дерева.
              </p>
              {Object.keys(database.persons).length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const firstId = Object.keys(database.persons)[0];
                    if (firstId) onChangeRoot(firstId);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-transform hover:scale-105"
                >
                  Відобразити родовід
                </button>
              )}
            </div>
          </div>
        )}

        {/* Mini-Map / Overview Navigator (Dynamically scales to tree content) */}
        {showMinimap && layout.nodes.length > 0 && (
          <div className="absolute bottom-16 left-4 z-20 p-2.5 rounded-xl bg-[#1a1e22]/95 backdrop-blur-md border border-[#323840] shadow-2xl">
            <div className="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-[#282d33]">
              <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-slate-300">
                <Compass className="w-3 h-3 text-emerald-400" />
                <span>Огляд дерева ({layout.nodes.length})</span>
              </div>
              <button
                onClick={() => setShowMinimap(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer p-0.5 rounded"
                title="Сховати міні-мапу"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            {/* Dynamic Miniature Canvas tightly mapped to actual treeBounds */}
            {(() => {
              const MINI_W = 180;
              const MINI_H = 120;
              const safeTreeW = Math.max(treeBounds.width, 100);
              const safeTreeH = Math.max(treeBounds.height, 100);

              const viewWorldLeft = -pan.x / scale;
              const viewWorldTop = -pan.y / scale;
              const viewWorldW = (containerDimensions.width || 1000) / scale;
              const viewWorldH = (containerDimensions.height || 700) / scale;

              const frameLeft = ((viewWorldLeft - treeBounds.minX) / safeTreeW) * MINI_W;
              const frameTop = ((viewWorldTop - treeBounds.minY) / safeTreeH) * MINI_H;
              const frameWidth = Math.max(6, (viewWorldW / safeTreeW) * MINI_W);
              const frameHeight = Math.max(6, (viewWorldH / safeTreeH) * MINI_H);

              return (
                <div
                  className="w-[180px] h-[120px] bg-[#121518] rounded-lg border border-[#262a30] relative overflow-hidden cursor-crosshair select-none"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const clickY = e.clientY - rect.top;
                    const normX = Math.max(0, Math.min(1, clickX / MINI_W));
                    const normY = Math.max(0, Math.min(1, clickY / MINI_H));

                    const targetWorldX = treeBounds.minX + normX * safeTreeW;
                    const targetWorldY = treeBounds.minY + normY * safeTreeH;

                    setPan({
                      x: Math.round((containerDimensions.width || 1000) / 2 - targetWorldX * scale),
                      y: Math.round((containerDimensions.height || 700) / 2 - targetWorldY * scale)
                    });
                  }}
                >
                  {/* Miniature Node dots */}
                  {layout.nodes.map((n) => {
                    const isMale = n.person.gender === 'male' || n.person.gender === 'M';
                    const isFemale = n.person.gender === 'female' || n.person.gender === 'F';
                    const isRoot = n.person.id === activePersonId;

                    const miniX = ((n.x - treeBounds.minX) / safeTreeW) * MINI_W;
                    const miniY = ((n.y - treeBounds.minY) / safeTreeH) * MINI_H;
                    const cardNodeW = n.width || CLASSIC_CARD_WIDTH;
                    const cardNodeH = n.height || CLASSIC_CARD_HEIGHT;
                    const dotW = Math.max(5, Math.min(12, (cardNodeW / safeTreeW) * MINI_W));
                    const dotH = Math.max(4, Math.min(9, (cardNodeH / safeTreeH) * MINI_H));

                    return (
                      <div
                        key={n.id}
                        style={{
                          left: `${miniX}px`,
                          top: `${miniY}px`,
                          width: `${dotW}px`,
                          height: `${dotH}px`
                        }}
                        className={`absolute rounded-xs transition-all ${
                          isRoot
                            ? 'bg-rose-500 ring-1 ring-white shadow-xs z-10'
                            : isMale
                            ? 'bg-sky-400'
                            : isFemale
                            ? 'bg-pink-400'
                            : 'bg-slate-400'
                        }`}
                        title={`${n.person.name?.given || ''} ${n.person.name?.surname || ''}`}
                      />
                    );
                  })}

                  {/* Viewport Camera Frame */}
                  <div
                    style={{
                      left: `${frameLeft}px`,
                      top: `${frameTop}px`,
                      width: `${frameWidth}px`,
                      height: `${frameHeight}px`
                    }}
                    className="absolute border-2 border-emerald-400 bg-emerald-400/15 pointer-events-none rounded-xs shadow-xs"
                  />
                </div>
              );
            })()}
          </div>
        )}

        {!showMinimap && (
          <button
            onClick={() => setShowMinimap(true)}
            className="absolute bottom-6 left-4 z-20 px-2.5 py-1.5 rounded-lg bg-[#1a1e22]/90 hover:bg-[#252a30] text-slate-300 text-xs font-medium border border-[#323840] shadow-lg flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Compass className="w-3.5 h-3.5 text-emerald-400" />
            <span>Міні-мапа</span>
          </button>
        )}

        {/* Sleek Fixed Bottom Horizontal Scrollbar */}
        {layout.nodes.length > 0 && (
          <div
            className={`absolute bottom-0 left-0 right-4 h-4 z-30 flex items-center select-none cursor-pointer border-t transition-colors shadow-xs ${
              canvasTheme === 'parchment' || canvasTheme === 'light'
                ? 'bg-[#e5dbc9] hover:bg-[#ded3bf] border-[#cfc2ad]'
                : 'bg-[#121518] hover:bg-[#161a1e] border-[#292f38]'
            }`}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const ratio = Math.max(0, Math.min(1, clickX / rect.width));
              const targetWorldX = treeBounds.minX + ratio * treeBounds.width;
              setPan((prev) => ({
                ...prev,
                x: Math.round(containerDimensions.width / 2 - targetWorldX * scale)
              }));
            }}
          >
            {(() => {
              const totalW = treeBounds.width;
              const viewW = (containerDimensions.width || 1200) / scale;
              const viewLeft = -pan.x / scale;
              const thumbWPct = Math.max(6, Math.min(100, (viewW / totalW) * 100));
              const thumbLeftPct = Math.max(0, Math.min(100 - thumbWPct, ((viewLeft - treeBounds.minX) / totalW) * 100));

              return (
                <div
                  style={{
                    left: `${thumbLeftPct}%`,
                    width: `${thumbWPct}%`
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    const startX = e.clientX;
                    const startPanX = pan.x;
                    const onMouseMove = (moveEvent: MouseEvent) => {
                      const deltaPixels = moveEvent.clientX - startX;
                      const barWidth = containerDimensions.width || 1200;
                      const worldDelta = (deltaPixels / barWidth) * treeBounds.width;
                      setPan((prev) => ({
                        ...prev,
                        x: Math.round(startPanX - worldDelta * scale)
                      }));
                    };
                    const onMouseUp = () => {
                      window.removeEventListener('mousemove', onMouseMove);
                      window.removeEventListener('mouseup', onMouseUp);
                    };
                    window.addEventListener('mousemove', onMouseMove);
                    window.addEventListener('mouseup', onMouseUp);
                  }}
                  className={`absolute top-0.5 bottom-0.5 rounded-full transition-all cursor-grab active:cursor-grabbing flex items-center justify-center ${
                    canvasTheme === 'parchment' || canvasTheme === 'light'
                      ? 'bg-stone-500/80 hover:bg-emerald-600 active:bg-emerald-700 shadow-sm'
                      : 'bg-slate-400/90 hover:bg-emerald-500 active:bg-emerald-400 shadow-sm'
                  }`}
                  title="Перетягніть для горизонтальної навігації деревом"
                >
                  <div className="w-4 h-1 rounded-full bg-white/40 pointer-events-none" />
                </div>
              );
            })()}
          </div>
        )}

        {/* Sleek Fixed Right Vertical Scrollbar */}
        {layout.nodes.length > 0 && (
          <div
            className={`absolute top-0 bottom-4 right-0 w-4 z-30 flex justify-center select-none cursor-pointer border-l transition-colors shadow-xs ${
              canvasTheme === 'parchment' || canvasTheme === 'light'
                ? 'bg-[#e5dbc9] hover:bg-[#ded3bf] border-[#cfc2ad]'
                : 'bg-[#121518] hover:bg-[#161a1e] border-[#292f38]'
            }`}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickY = e.clientY - rect.top;
              const ratio = Math.max(0, Math.min(1, clickY / rect.height));
              const targetWorldY = treeBounds.minY + ratio * treeBounds.height;
              setPan((prev) => ({
                ...prev,
                y: Math.round(containerDimensions.height / 2 - targetWorldY * scale)
              }));
            }}
          >
            {(() => {
              const totalH = treeBounds.height;
              const viewH = (containerDimensions.height || 800) / scale;
              const viewTop = -pan.y / scale;
              const thumbHPct = Math.max(6, Math.min(100, (viewH / totalH) * 100));
              const thumbTopPct = Math.max(0, Math.min(100 - thumbHPct, ((viewTop - treeBounds.minY) / totalH) * 100));

              return (
                <div
                  style={{
                    top: `${thumbTopPct}%`,
                    height: `${thumbHPct}%`
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    const startY = e.clientY;
                    const startPanY = pan.y;
                    const onMouseMove = (moveEvent: MouseEvent) => {
                      const deltaPixels = moveEvent.clientY - startY;
                      const barHeight = containerDimensions.height || 800;
                      const worldDelta = (deltaPixels / barHeight) * treeBounds.height;
                      setPan((prev) => ({
                        ...prev,
                        y: Math.round(startPanY - worldDelta * scale)
                      }));
                    };
                    const onMouseUp = () => {
                      window.removeEventListener('mousemove', onMouseMove);
                      window.removeEventListener('mouseup', onMouseUp);
                    };
                    window.addEventListener('mousemove', onMouseMove);
                    window.addEventListener('mouseup', onMouseUp);
                  }}
                  className={`absolute left-0.5 right-0.5 rounded-full transition-all cursor-grab active:cursor-grabbing flex items-center justify-center ${
                    canvasTheme === 'parchment' || canvasTheme === 'light'
                      ? 'bg-stone-500/80 hover:bg-emerald-600 active:bg-emerald-700 shadow-sm'
                      : 'bg-slate-400/90 hover:bg-emerald-500 active:bg-emerald-400 shadow-sm'
                  }`}
                  title="Перетягніть для вертикальної навігації деревом"
                >
                  <div className="h-4 w-1 rounded-full bg-white/40 pointer-events-none" />
                </div>
              );
            })()}
          </div>
        )}

        {/* Scrollbars Corner Intersection */}
        {layout.nodes.length > 0 && (
          <div
            className={`absolute bottom-0 right-0 w-4 h-4 z-30 border-t border-l ${
              canvasTheme === 'parchment' || canvasTheme === 'light'
                ? 'bg-[#d8ccb8] border-[#cfc2ad]'
                : 'bg-[#0f1215] border-[#292f38]'
            }`}
          />
        )}
      </div>
    </div>
  );
};
