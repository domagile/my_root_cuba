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
  Minus,
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
  Layers,
  Sparkles,
  Eye,
  EyeOff,
  Palette,
  Sun,
  Moon,
  Check,
  Shield,
  Lock,
  Pencil,
  Zap
} from 'lucide-react';
import {
  GenealogyDatabase,
  TreeLayoutType,
  Person
} from '../../types/genealogy';
import { TreeIcon, FanIcon } from '../../../components/common/GenealogyIcons';
import {
  calculateClassicFamilyTreeLayout,
  calculateAncestorsLayout,
  calculateDescendantsLayout,
  getGenealogyCode,
  formatLifespan,
  CLASSIC_CARD_WIDTH,
  CLASSIC_CARD_HEIGHT,
  getLineageColorMap,
  getPersonClanColor,
  getPersonRodName
} from '../../utils/treeLayout';
import { getFullName, sortPersonsBySurnameAndBirthDesc, findRootPersonId } from '../../utils/relationship';
import { getSavedUserTreeState, saveUserTreeState } from '../../../utils/userTreeState';
import { useUIStore } from '../../../stores/useUIStore';
import { useAuthStore } from '../../../stores/useAuthStore';
import { isPersonLiving, getPrivacySafePerson, getPrivacyLifespan, isUserWhitelisted } from '../../utils/privacy';
import { getThemeConfig } from '../../../utils/theme';
import { PersonReportModal } from '../../../components/common/PersonReportModal';
import {
  normalizeUkrainianSurnameGender,
  formatClanName,
  areSurnamesEquivalent
} from '../../../utils/ukrainianPhonetics';

// Ukrainian generation declension helper
function getUkrainianGenerationLabel(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) {
    return `${n} поколінь`;
  }
  if (mod10 === 1) {
    return `${n} покоління`;
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return `${n} покоління`;
  }
  return `${n} поколінь`;
}

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

  const rootPersonId = useMemo(
    () => database.rootPersonId || findRootPersonId(database.persons),
    [database]
  );

  const initialUserState = useMemo(() => {
    if (isWhitelisted && currentUser?.email) {
      return getSavedUserTreeState(currentUser.email);
    }
    return null;
  }, [isWhitelisted, currentUser?.email]);

  const dropdownPersons = useMemo(() => {
    const rawList = Object.values(database.persons || {}) as Person[];
    const list = isWhitelisted ? rawList : rawList.map((p) => getPrivacySafePerson(p, false));
    const sorted = sortPersonsBySurnameAndBirthDesc(list);
    const rootP = sorted.find((p) => p.id === rootPersonId);
    if (rootP) {
      return [rootP, ...sorted.filter((p) => p.id !== rootPersonId)];
    }
    return sorted;
  }, [database.persons, isWhitelisted, rootPersonId]);

  const canvasTheme = useUIStore((s) => s.treeCanvasTheme);
  const setCanvasTheme = useUIStore((s) => s.setTreeCanvasTheme);

  const [layoutType, setLayoutType] = useState<TreeLayoutType>('ancestors');
  // Default to 0 = ALL generations (or restore saved user preference)
  const [generations, setGenerations] = useState<number>(() => {
    if (typeof initialUserState?.generations === 'number') {
      return initialUserState.generations;
    }
    return 0;
  });

  // Generation options list: 1 to 4 in dropdown, plus custom if selected
  const treeGenOptions = useMemo(() => {
    const base = [1, 2, 3, 4];
    if (generations > 4) {
      return [...base, generations];
    }
    return base;
  }, [generations]);

  const [isCustomGenOpen, setIsCustomGenOpen] = useState<boolean>(false);
  const [customGenInput, setCustomGenInput] = useState<string>('');

  const [scale, setScale] = useState<number>(() => {
    if (initialUserState?.scale && typeof initialUserState.scale === 'number') {
      return initialUserState.scale;
    }
    return 0.95;
  });
  const [pan, setPan] = useState<{ x: number; y: number }>(() => {
    if (initialUserState?.pan && typeof initialUserState.pan.x === 'number') {
      return initialUserState.pan;
    }
    return { x: 80, y: 80 };
  });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showMinimap, setShowMinimap] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      return false;
    }
    return true;
  });
  const [lodMode, setLodMode] = useState<'auto' | 'always' | 'never'>('auto');
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
  const [reportPersonId, setReportPersonId] = useState<string | null>(null);
  const [selectiveMenuPersonId, setSelectiveMenuPersonId] = useState<string | null>(null);
  const selectiveMenuRef = useRef<HTMLDivElement | null>(null);

  // Close selective sibling menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (selectiveMenuRef.current && !selectiveMenuRef.current.contains(e.target as Node)) {
        setSelectiveMenuPersonId(null);
      }
    };
    if (selectiveMenuPersonId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectiveMenuPersonId]);

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

  // Pre-calculate backbone line (ancestors, descendants) and spouses to cleanly handle branch collapses
  const { directBackboneSet, backboneSpouseSet } = useMemo(() => {
    const directSet = new Set<string>();
    const root = database.persons[activePersonId] || Object.values(database.persons)[0];
    if (!root) return { directBackboneSet: directSet, backboneSpouseSet: new Set<string>() };

    const collectAncestors = (pId: string) => {
      if (!pId || directSet.has(pId)) return;
      directSet.add(pId);
      const p = database.persons[pId];
      if (!p) return;
      let fId = p.fatherId || (p.parentFamilyId ? database.families[p.parentFamilyId]?.husbandId : undefined);
      let mId = p.motherId || (p.parentFamilyId ? database.families[p.parentFamilyId]?.wifeId : undefined);
      if (!fId && !mId && database.families) {
        const matchingFam = Object.values(database.families).find((fam) =>
          fam.children && fam.children.some((c: any) => (c.personId || c.id) === p.id)
        );
        if (matchingFam) {
          fId = matchingFam.husbandId;
          mId = matchingFam.wifeId;
        }
      }
      if (fId) collectAncestors(fId);
      if (mId) collectAncestors(mId);
    };
    collectAncestors(root.id);

    const collectDescendants = (pId: string) => {
      if (!pId) return;
      directSet.add(pId);
      const p = database.persons[pId];
      if (!p) return;
      const cIds = new Set<string>();
      if (p.childrenIds) p.childrenIds.forEach((c) => cIds.add(c));
      if (p.spouseFamilyIds) {
        p.spouseFamilyIds.forEach((fId) => {
          const fam = database.families[fId];
          if (fam?.children) fam.children.forEach((c: any) => cIds.add(c.personId || c.id));
        });
      }
      Object.values(database.persons).forEach((cand) => {
        if (cand.fatherId === pId || cand.motherId === pId) cIds.add(cand.id);
      });
      cIds.forEach((cId) => {
        if (!directSet.has(cId)) collectDescendants(cId);
      });
    };
    collectDescendants(root.id);

    const spouseSet = new Set<string>();
    directSet.forEach((pId) => {
      const p = database.persons[pId];
      if (p?.spouseIds) p.spouseIds.forEach((sId) => spouseSet.add(sId));
      if (p?.spouseFamilyIds) {
        p.spouseFamilyIds.forEach((fId) => {
          const fam = database.families[fId];
          if (fam) {
            if (fam.husbandId && fam.husbandId !== pId) spouseSet.add(fam.husbandId);
            if (fam.wifeId && fam.wifeId !== pId) spouseSet.add(fam.wifeId);
          }
        });
      }
    });

    return { directBackboneSet: directSet, backboneSpouseSet: spouseSet };
  }, [database, activePersonId]);

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

  // Helper to fetch all siblings for a person
  const getSiblingsOfPerson = useCallback((personId: string): Person[] => {
    const p = database.persons[personId];
    if (!p) return [];
    let fId = p?.fatherId || (p?.parentFamilyId ? database.families[p.parentFamilyId]?.husbandId : undefined);
    let mId = p?.motherId || (p?.parentFamilyId ? database.families[p.parentFamilyId]?.wifeId : undefined);

    if (!fId && !mId && database.families) {
      const matchingFam = Object.values(database.families).find(fam => 
        fam.children && fam.children.some((c: any) => (c.personId || c.id) === p.id)
      );
      if (matchingFam) {
        fId = matchingFam.husbandId;
        mId = matchingFam.wifeId;
      }
    }

    const siblingIds = new Set<string>();
    if (p.siblingIds) {
      p.siblingIds.forEach(id => {
        if (id !== personId) siblingIds.add(id);
      });
    }
    Object.values(database.persons).forEach((cand: any) => {
      if (cand.id === personId) return;
      const cF = cand.fatherId || (cand.parentFamilyId ? database.families[cand.parentFamilyId]?.husbandId : undefined);
      const cM = cand.motherId || (cand.parentFamilyId ? database.families[cand.parentFamilyId]?.wifeId : undefined);
      if ((fId && cF === fId) || (mId && cM === mId) || (cand.siblingIds && cand.siblingIds.includes(personId)) || (p.siblingIds && p.siblingIds.includes(cand.id))) {
        siblingIds.add(cand.id);
      }
    });

    if (database.families) {
      Object.values(database.families).forEach((fam) => {
        if (fam.children && fam.children.some((c: any) => (c.personId || c.id) === p.id)) {
          fam.children.forEach((c: any) => {
            const cId = c.personId || c.id;
            if (cId && cId !== personId) siblingIds.add(cId);
          });
        }
      });
    }

    return Array.from(siblingIds)
      .map(id => database.persons[id])
      .filter(Boolean) as Person[];
  }, [database.persons, database.families]);

  // Toggle all collateral siblings for this person's family branch (e.g. all on right for female line, all on left for male line)
  const toggleCollapseSiblings = useCallback((personId: string, isCurrentlyCollapsed?: boolean) => {
    setAnchorForPerson(personId);
    const sibs = getSiblingsOfPerson(personId);
    const collateralIds = sibs
      .filter(s => !directBackboneSet.has(s.id) && !backboneSpouseSet.has(s.id))
      .map(s => s.id);
    const allFamilySibs = [personId, ...sibs.map(s => s.id)];

    setCollapsedSiblings((prev) => {
      const next = new Set(prev);
      const targetIds = collateralIds.length > 0 ? collateralIds : sibs.map(s => s.id);
      const isCollapsed = isCurrentlyCollapsed !== undefined
        ? isCurrentlyCollapsed
        : (targetIds.length > 0 && targetIds.every(id => next.has(id)));
      const shouldCollapse = !isCollapsed;

      if (shouldCollapse) {
        // Collapse: hide all collateral siblings in this family branch
        targetIds.forEach((sId) => next.add(sId));
      } else {
        // Expand: unhide all siblings in this family branch
        allFamilySibs.forEach((sId) => next.delete(sId));
        if (!showSiblings) {
          setShowSiblings(true);
        }
      }
      return next;
    });
  }, [setAnchorForPerson, getSiblingsOfPerson, showSiblings, directBackboneSet, backboneSpouseSet]);

  // Selectively toggle a single sibling (show or hide just this one brother/sister)
  const toggleCollapseSingleSibling = useCallback((targetPersonId: string, anchorPersonId?: string) => {
    setAnchorForPerson(anchorPersonId || targetPersonId);
    setCollapsedSiblings((prev) => {
      const next = new Set(prev);
      if (next.has(targetPersonId)) {
        next.delete(targetPersonId);
        if (!showSiblings) {
          setShowSiblings(true);
        }
      } else {
        next.add(targetPersonId);
      }
      return next;
    });
  }, [setAnchorForPerson, showSiblings]);

  const collapseAllSiblingsOfPerson = useCallback((personId: string) => {
    setAnchorForPerson(personId);
    const sibs = getSiblingsOfPerson(personId);
    const collateralIds = sibs
      .filter(s => !directBackboneSet.has(s.id) && !backboneSpouseSet.has(s.id))
      .map(s => s.id);
    setCollapsedSiblings((prev) => {
      const next = new Set(prev);
      collateralIds.forEach(id => next.add(id));
      return next;
    });
  }, [setAnchorForPerson, getSiblingsOfPerson, directBackboneSet, backboneSpouseSet]);

  const expandAllSiblingsOfPerson = useCallback((personId: string) => {
    setAnchorForPerson(personId);
    const sibs = getSiblingsOfPerson(personId);
    const sibIds = sibs.map(s => s.id);
    setCollapsedSiblings((prev) => {
      const next = new Set(prev);
      sibIds.forEach(id => next.delete(id));
      next.delete(personId);
      return next;
    });
    if (!showSiblings) setShowSiblings(true);
  }, [setAnchorForPerson, getSiblingsOfPerson, showSiblings]);

  const toggleCollapseChildren = useCallback((personId: string, isCurrentlyCollapsed?: boolean) => {
    setAnchorForPerson(personId);
    setCollapsedChildren((prev) => {
      const next = new Set(prev);
      const shouldCollapse = isCurrentlyCollapsed !== undefined ? !isCurrentlyCollapsed : !next.has(personId);
      
      const relatedIds = new Set<string>([personId]);
      const person = database.persons[personId];
      if (person) {
        if (person.spouseIds) {
          person.spouseIds.forEach(sId => relatedIds.add(sId));
        }
        if (person.spouseFamilyIds && database.families) {
          person.spouseFamilyIds.forEach(fId => {
            const fam = database.families[fId];
            if (fam) {
              if (fam.husbandId) relatedIds.add(fam.husbandId);
              if (fam.wifeId) relatedIds.add(fam.wifeId);
            }
          });
        }
      }

      relatedIds.forEach(id => {
        if (shouldCollapse) {
          next.add(id);
        } else {
          next.delete(id);
        }
      });
      return next;
    });
    if (isCurrentlyCollapsed && !showDescendants) {
      setShowDescendants(true);
    }
  }, [setAnchorForPerson, database, showDescendants]);

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

  // Level of Detail (LOD) - 60 FPS optimization for large trees
  const isPillLOD = lodMode === 'always' || (lodMode === 'auto' && scale < 0.50);
  const isMicroLOD = lodMode === 'always' ? false : (lodMode === 'auto' && scale < 0.28);

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

  // Focus camera directly and smoothly onto a specific person card (defaulting to active / root person)
  const focusOnPerson = useCallback((personId?: string, preferredScale?: number) => {
    const targetId = personId || activePersonId;
    const targetNode = layout.nodes.find(n => n.person.id === targetId) || layout.nodes[0];
    if (!targetNode) {
      centerTree();
      return;
    }
    const container = containerRef.current;
    const cw = container ? container.clientWidth : (containerDimensions.width || 1200);
    const ch = container ? container.clientHeight : (containerDimensions.height || 800);

    const targetScale = preferredScale ?? (scale < 0.6 || scale > 1.3 ? 0.95 : scale);
    const nodeCenterX = targetNode.x + (targetNode.width || CLASSIC_CARD_WIDTH) / 2;
    const nodeCenterY = targetNode.y + (targetNode.height || CLASSIC_CARD_HEIGHT) / 2;

    setPan({
      x: Math.round(cw / 2 - nodeCenterX * targetScale),
      y: Math.round(ch / 2 - nodeCenterY * targetScale)
    });
    if (preferredScale !== undefined || targetScale !== scale) {
      setScale(targetScale);
    }
  }, [layout.nodes, activePersonId, containerDimensions, scale, centerTree]);

  const centerOnActive = useCallback(() => {
    focusOnPerson(activePersonId);
  }, [focusOnPerson, activePersonId]);

  // Quick Action: Return focus directly to the root person
  const handleFocusRootPerson = useCallback(() => {
    if (activePersonId !== rootPersonId) {
      onChangeRoot(rootPersonId);
    }
    setTimeout(() => {
      focusOnPerson(rootPersonId, 0.95);
    }, 40);
  }, [activePersonId, rootPersonId, onChangeRoot, focusOnPerson]);

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

  // Center tree on root person by default, or restore previous state if returning authorized user
  const isInitialMount = useRef<boolean>(true);
  const prevRootId = useRef<string>(activePersonId);
  const prevLayoutType = useRef<TreeLayoutType>(layoutType);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevRootId.current = activePersonId;
      prevLayoutType.current = layoutType;

      const timer = setTimeout(() => {
        if (isWhitelisted && currentUser?.email) {
          const saved = getSavedUserTreeState(currentUser.email);
          if (saved?.pan && typeof saved.scale === 'number') {
            setPan(saved.pan);
            setScale(saved.scale);
            return;
          }
        }
        // Default focus: center squarely on the root person (or active person)
        focusOnPerson(activePersonId, 0.95);
      }, 50);
      return () => clearTimeout(timer);
    }

    if (prevRootId.current !== activePersonId || prevLayoutType.current !== layoutType) {
      prevRootId.current = activePersonId;
      prevLayoutType.current = layoutType;
      const timer = setTimeout(() => {
        focusOnPerson(activePersonId);
      }, 40);
      return () => clearTimeout(timer);
    }
  }, [activePersonId, layoutType, isWhitelisted, currentUser?.email, focusOnPerson]);

  // Auto-save user tree viewport and active state for authorized users
  useEffect(() => {
    if (!isWhitelisted || !currentUser?.email) return;
    const timer = setTimeout(() => {
      saveUserTreeState(currentUser.email, {
        pan,
        scale,
        selectedPersonId: activePersonId,
        generations,
        showSiblings
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [pan, scale, activePersonId, generations, showSiblings, isWhitelisted, currentUser?.email]);

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
      {/* Top Toolbar: 2 rows on mobile, tablet & laptop (< 2xl), 1 row on large screen (>= 2xl) */}
      <div className="w-full bg-[#1e2226] border-b border-[#323840] px-2.5 sm:px-4 py-1.5 sm:py-2 flex flex-col 2xl:flex-row 2xl:items-center 2xl:justify-between gap-1.5 sm:gap-2 z-20 shrink-0 print:hidden shadow-md">
        {/* Row 1 (< 2xl) or Left Group (>= 2xl): Mode, Generations, Siblings, Clan Borders, Clan Legend, Theme, Export */}
        <div className="flex items-center justify-between 2xl:justify-start gap-1.5 sm:gap-2 w-full 2xl:w-auto min-w-0">
          <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 shrink-0 flex-wrap">
            {/* Layout & Mode Switch */}
            <div className="flex items-center bg-[#15181b] p-0.5 rounded-lg border border-[#2d3238] shrink-0 shadow-xs">
              <button
                type="button"
                onClick={() => setLayoutType('ancestors')}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 text-white shadow-xs cursor-pointer"
                title="Класична вертикальна структура родоводу (FamilySearch style)"
              >
                <TreeIcon className="w-4 h-4 text-emerald-100 shrink-0" />
                <span>Дерево</span>
              </button>

              {onSwitchToFan && (
                <button
                  type="button"
                  onClick={onSwitchToFan}
                  className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Перемкнути у віялову діаграму (Fan Chart)"
                >
                  <FanIcon className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="hidden sm:inline">Віяло</span>
                </button>
              )}
            </div>

            {/* Generations dropdown (компактно, 1-4 покоління, потім +) */}
            <div className="flex items-center gap-1 text-xs text-slate-300 bg-[#15181b] border border-[#2d3238] px-2 py-1.5 rounded-lg shadow-xs shrink-0">
              <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />

              {isCustomGenOpen ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const parsed = parseInt(customGenInput.trim(), 10);
                    if (!isNaN(parsed) && parsed > 0) {
                      setGenerations(parsed);
                    }
                    setIsCustomGenOpen(false);
                  }}
                  className="flex items-center gap-1"
                >
                  <input
                    type="number"
                    min={1}
                    max={99}
                    autoFocus
                    value={customGenInput}
                    onChange={(e) => setCustomGenInput(e.target.value)}
                    placeholder="№"
                    className="w-9 px-1 py-0.5 text-xs bg-[#22262a] border border-amber-500/70 rounded text-amber-300 text-center font-bold focus:outline-none"
                    title="Введіть кількість поколінь"
                  />
                  <button
                    type="submit"
                    className="px-1.5 py-0.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer transition-colors"
                    title="Застосувати"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCustomGenOpen(false)}
                    className="px-1 py-0.5 text-[11px] text-slate-400 hover:text-white rounded cursor-pointer transition-colors"
                    title="Скасувати"
                  >
                    ✕
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-1">
                  <select
                    value={generations}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'custom') {
                        setCustomGenInput(String(generations > 0 ? generations : 4));
                        setIsCustomGenOpen(true);
                      } else {
                        setGenerations(Number(val));
                      }
                    }}
                    className="bg-transparent text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer py-0.5"
                    title="Кількість поколінь родоводу"
                  >
                    <option value={0} className="bg-[#1b1f24] text-white">Всі</option>
                    {treeGenOptions.map((g) => (
                      <option key={g} value={g} className="bg-[#1b1f24] text-white">
                        {g} пок.
                      </option>
                    ))}
                    <option value="custom" className="bg-[#1b1f24] text-amber-400 font-semibold">
                      + пок.
                    </option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomGenInput(String(generations > 0 ? generations : 4));
                      setIsCustomGenOpen(true);
                    }}
                    className="w-5 h-5 flex items-center justify-center rounded bg-[#23282e] hover:bg-amber-600/80 text-amber-300 hover:text-white font-bold text-xs border border-[#383e46] transition-colors cursor-pointer shrink-0"
                    title="Ввести своє значення поколінь (+)"
                  >
                    +
                  </button>
                </div>
              )}
            </div>

            {/* Sibling Toggle: Всі родичі / Прямі */}
            <button
              type="button"
              onClick={() => {
                setShowSiblings((prev) => {
                  const next = !prev;
                  if (!next) {
                    setCollapsedSiblings(new Set());
                  }
                  return next;
                });
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer shadow-xs shrink-0 ${
                showSiblings
                  ? 'bg-sky-950/70 text-sky-300 border-sky-700/60 hover:bg-sky-900/80'
                  : 'bg-amber-950/70 text-amber-300 border-amber-700/60 hover:bg-amber-900/80'
              }`}
              title={showSiblings ? "Сховати братів та сестер (прямі)" : "Показати братів та сестер (всі родичі)"}
            >
              <Users className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>{showSiblings ? 'Всі родичі' : 'Прямі'}</span>
            </button>

            {/* Quick Unfold All Collapsed Branches Button */}
            {collapsedSiblings.size > 0 && (
              <button
                type="button"
                onClick={() => setCollapsedSiblings(new Set())}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold border bg-amber-950/80 text-amber-300 border-amber-600/70 hover:bg-amber-900 transition-all cursor-pointer shadow-xs shrink-0 animate-in fade-in"
                title="Розгорнути всі згорнуті бічні гілки"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5] text-amber-400" />
                <span>Розгорнути гілки ({collapsedSiblings.size})</span>
              </button>
            )}
          </div>

          {/* Right cluster of Row 1: Theme, Export, Person Report */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Canvas Theme Selector Dropdown */}
            <div className="relative shrink-0" ref={themeMenuRef}>
              <button
                type="button"
                onClick={() => setIsThemeMenuOpen((prev) => !prev)}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer shadow-xs ${
                  isThemeMenuOpen
                    ? 'bg-slate-700 text-white border-slate-600'
                    : 'bg-[#15181b] text-slate-300 hover:text-white hover:bg-slate-800 border-[#2d3238]'
                }`}
                title="Колірна тема фону дерева"
              >
                <Palette className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="hidden sm:inline">Фон</span>
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

            {/* Export Menu (Always visible on all screen sizes) */}
            <div className="relative shrink-0" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setIsExportOpen((prev) => !prev)}
                className={`flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer shadow-xs ${
                  isExportOpen
                    ? 'bg-slate-700 text-white border-slate-600 shadow-xs'
                    : 'bg-[#15181b] text-slate-300 hover:text-white hover:bg-slate-800 border-[#2d3238]'
                }`}
                title="Експорт та друк дерева (SVG / PDF)"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="hidden sm:inline">Експорт</span>
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
                  <button
                    onClick={() => {
                      setReportPersonId(activePersonId);
                      setIsExportOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-slate-200 hover:bg-[#252a30] hover:text-white transition-colors cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <div className="font-medium text-slate-200">Звіт про особу (PDF/TXT)</div>
                      <div className="text-[10px] text-slate-400">Повний родовідний звіт про вибрану людину</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2 (< 2xl) or Right Group (>= 2xl): Root Person Selector + Zoom Controls */}
        <div className="flex items-center justify-between 2xl:justify-end gap-1.5 sm:gap-2 w-full 2xl:w-auto min-w-0 pt-1 2xl:pt-0 border-t border-slate-700/30 2xl:border-t-0">
          {/* Root Person Selector */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1 2xl:flex-initial">
            <span className="text-xs text-slate-400 hidden sm:inline shrink-0 font-medium">Корінь:</span>
            <select
              value={activePersonId}
              onChange={(e) => onChangeRoot(e.target.value)}
              className="bg-[#15181b] text-slate-200 border border-[#2d3238] text-xs rounded-lg px-2 sm:px-2.5 py-1.5 focus:outline-hidden focus:border-emerald-500 max-w-[150px] sm:max-w-[210px] truncate cursor-pointer shadow-xs"
              title="Вибрати особу як корінь родоводу"
            >
              {dropdownPersons.map((p) => {
                const isLiving = isPersonLiving(database.persons[p.id]);
                const isMasked = !isWhitelisted && isLiving;
                const isRoot = p.id === rootPersonId;
                return (
                  <option key={p.id} value={p.id}>
                    {isRoot ? '👑 ' : ''}{isMasked ? '🔒 Скрито (Жива особа)' : `${getFullName(p)}${p.birthYear ? ` (${p.birthYear})` : ''}`}{isRoot ? ' (Корінь)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Zoom Controls + All Options button */}
          <div className="flex items-center gap-1 shrink-0">
            <div className="flex items-center gap-0.5 sm:gap-1 bg-[#15181b] border border-[#2d3238] p-1 rounded-lg shrink-0 shadow-xs">
              <button
                type="button"
                onClick={() => zoomAroundCenter(0.85)}
                className="p-1 sm:p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
                title="Зменшити масштаб (-)"
              >
                <ZoomOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              <button
                type="button"
                onClick={centerTree}
                className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                title="Вписати все дерево в екран"
              >
                Вписати
              </button>

              <button
                type="button"
                onClick={() => setScale(1.0)}
                className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-[11px] text-slate-300 hover:text-white font-bold rounded hover:bg-slate-800 transition-colors cursor-pointer"
                title="Скинути масштаб до 100%"
              >
                100%
              </button>

              <button
                type="button"
                onClick={() => zoomAroundCenter(1.18)}
                className="p-1 sm:p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
                title="Збільшити масштаб (+)"
              >
                <ZoomIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              <span className="text-[11px] text-slate-400 font-mono px-1 hidden md:inline min-w-[36px] text-right">
                {Math.round(scale * 100)}%
              </span>

              {/* LOD Mode Toggle & 60 FPS Status Indicator */}
              <button
                type="button"
                onClick={() => {
                  setLodMode((prev) => (prev === 'auto' ? 'never' : prev === 'never' ? 'always' : 'auto'));
                }}
                className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer border ${
                  isPillLOD
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80 hover:bg-emerald-900 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 border-transparent'
                }`}
                title={`Режим оптимізації LOD (Level of Detail):\n• Поточний стан: ${
                  lodMode === 'auto'
                    ? `Авто (активується при віддаленні < 50% — зараз ${isPillLOD ? '⚡ 60 FPS пігулки' : 'повні картки'})`
                    : lodMode === 'always'
                    ? 'Завжди компактні пігулки'
                    : 'Вимкнено (завжди повні картки)'
                }\n• Клікніть для перемикання (Авто / Завжди / Вимкнено)`}
              >
                <Zap className={`w-3 h-3 ${isPillLOD ? 'text-emerald-400 fill-emerald-400' : 'text-slate-500'}`} />
                <span className="hidden sm:inline">
                  {lodMode === 'auto' ? (isPillLOD ? 'LOD 60 FPS' : 'LOD: Авто') : lodMode === 'always' ? 'LOD: Пігулки' : 'LOD: Вимк'}
                </span>
              </button>
            </div>
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
            const isTreeRoot = p.id === rootPersonId;
            const isMale = p.gender === 'male' || p.gender === 'M';
            const isFemale = p.gender === 'female' || p.gender === 'F';
            const isLightCanvas = canvasTheme === 'parchment' || canvasTheme === 'light';

            const firstName = isMasked ? 'Скрито' : (p.name?.given || p.firstName || '—');
            const lastName = isMasked ? 'Скрито' : (p.name?.surname || p.lastName || '—');
            const lifespanStr = isMasked ? '🔒 Скрито (Жива особа)' : formatLifespan(p);
            const fsCode = isMasked ? '🔒 ЗАХИЩЕНО' : getGenealogyCode(p);

            // Clan / Rod color resolution matching Fan Chart
            const rawRod = getPersonRodName(p);
            const rawSurname = (p.name?.surname || p.lastName || p.name?.maidenName || p.maidenName || '').trim();
            const hasSurname = Boolean(rawSurname && rawSurname !== 'Рід');
            const canonicalRod = normalizeUkrainianSurnameGender(rawSurname) || rawRod;
            const cardBorderColor = isLightCanvas ? '#d8cfbe' : '#383e46';
            const isCardHovered = hoveredPersonId === p.id;

            // Compute collateral siblings and individual sibling status for this person
            const personSiblings = getSiblingsOfPerson(p.id);
            const collateralSiblings = personSiblings.filter(
              (s) => !directBackboneSet.has(s.id) && !backboneSpouseSet.has(s.id)
            );
            const isCollateralPerson = !directBackboneSet.has(p.id) && !backboneSpouseSet.has(p.id) && personSiblings.length > 0;

            // Clan / Rod color & compact lifespan resolution
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

            // LOD Tier 2: Ultra-distant zoom (< 28%) - Micro Marker Panorama
            if (isMicroLOD) {
              return (
                <div
                  key={node.id}
                  style={{
                    position: 'absolute',
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    width: `${node.width}px`,
                    height: `${node.height}px`,
                    contain: 'paint layout'
                  }}
                  className="relative select-none pointer-events-none"
                >
                  {/* Tree Link Connection Stems for seamless alignment */}
                  <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[2px] bg-slate-400/25 dark:bg-slate-700/40 pointer-events-none" />
                  <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-slate-400/20 dark:bg-slate-700/30 pointer-events-none" />

                  {/* Micro Pill Marker */}
                  <div
                    style={{
                      backgroundColor: clanColor || (isMale ? '#0284c7' : isFemale ? '#e11d48' : '#475569')
                    }}
                    onMouseEnter={() => setHoveredPersonId(p.id)}
                    onMouseLeave={() => setHoveredPersonId(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (p.id !== activePersonId) {
                        onChangeRoot(p.id);
                      }
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onSelectPerson(p.id);
                    }}
                    className={`pointer-events-auto absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[142px] h-[34px] rounded-full px-2.5 shadow-lg flex items-center justify-between gap-1 cursor-pointer transition-transform duration-100 hover:scale-110 hover:z-30 text-white border border-white/30 ${
                      isRoot ? 'ring-4 ring-amber-400 ring-offset-2 ring-offset-slate-900 shadow-amber-500/70' : ''
                    }`}
                    title={`${firstName} ${lastName} (${lifespanStr})\n• Клік: фокусувати дерево\n• Подвійний клік: відкрити картку`}
                  >
                    <div className="flex items-center gap-1 truncate min-w-0">
                      {isTreeRoot ? (
                        <span className="text-[11px] shrink-0">👑</span>
                      ) : isMasked ? (
                        <Lock className="w-2.5 h-2.5 text-emerald-200 shrink-0" />
                      ) : null}
                      <span className="font-black text-[11px] truncate tracking-tight">
                        {lastName}
                      </span>
                    </div>
                    {shortLifespan && (
                      <span className="text-[9px] font-mono opacity-85 shrink-0">
                        {shortLifespan}
                      </span>
                    )}
                  </div>
                </div>
              );
            }

            // LOD Tier 1: Distant zoom (28% - 50%) - Compact Colored Pill
            if (isPillLOD) {
              return (
                <div
                  key={node.id}
                  style={{
                    position: 'absolute',
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    width: `${node.width}px`,
                    height: `${node.height}px`,
                    contain: 'paint layout'
                  }}
                  className="relative group select-none pointer-events-none"
                >
                  {/* Tree Link Connection Stems for seamless alignment */}
                  <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[2px] bg-slate-400/30 dark:bg-slate-700/50 pointer-events-none" />
                  <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-slate-400/25 dark:bg-slate-700/40 pointer-events-none" />

                  {/* Compact Colored Capsule Card */}
                  <div
                    style={{
                      borderColor: isRoot ? '#f59e0b' : (isMale ? '#38bdf8' : isFemale ? '#f472b6' : cardBorderColor),
                      borderLeftWidth: '4px',
                      borderLeftColor: clanColor || (isMale ? '#0284c7' : '#e11d48')
                    }}
                    onMouseEnter={() => setHoveredPersonId(p.id)}
                    onMouseLeave={() => setHoveredPersonId(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (p.id !== activePersonId) {
                        onChangeRoot(p.id);
                      }
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onSelectPerson(p.id);
                    }}
                    className={`pointer-events-auto absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[172px] h-[58px] rounded-xl px-2.5 py-1.5 shadow-md hover:shadow-xl transition-all duration-100 hover:scale-105 hover:z-30 cursor-pointer flex flex-col justify-between overflow-hidden border ${
                      isLightCanvas
                        ? isMale
                          ? 'bg-gradient-to-r from-sky-50 to-blue-50/80 text-sky-950 hover:border-sky-500'
                          : isFemale
                          ? 'bg-gradient-to-r from-rose-50 to-pink-50/80 text-rose-950 hover:border-rose-500'
                          : 'bg-stone-50 text-stone-900 hover:border-stone-400'
                        : isMale
                        ? 'bg-gradient-to-r from-[#0c2e43] to-[#123e59] text-sky-100 hover:border-sky-400'
                        : isFemale
                        ? 'bg-gradient-to-r from-[#3e132c] to-[#541a3c] text-rose-100 hover:border-rose-400'
                        : 'bg-[#22262a] text-slate-100 hover:border-slate-400'
                    } ${
                      isRoot
                        ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900 shadow-amber-500/40 shadow-lg'
                        : ''
                    }`}
                    title={`${firstName} ${lastName} (${lifespanStr})\n• Клік: фокусувати дерево\n• Подвійний клік: відкрити картку`}
                  >
                    {/* Top row: Status/Crown + Name + Quick Edit */}
                    <div className="flex items-center justify-between gap-1 min-w-0">
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        {isTreeRoot ? (
                          <span className="text-[10px] shrink-0" title="Коренева особа">👑</span>
                        ) : isMasked ? (
                          <Lock className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                        ) : (
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isMale ? 'bg-sky-400' : isFemale ? 'bg-rose-400' : 'bg-slate-400'
                            }`}
                          />
                        )}
                        <span className="font-extrabold text-xs truncate leading-tight tracking-tight">
                          {lastName} {firstName !== '—' ? firstName : ''}
                        </span>
                      </div>

                      {!isMasked && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectPerson(p.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-black/20 dark:hover:bg-white/20 transition-opacity shrink-0 cursor-pointer"
                          title="Редагувати картку"
                        >
                          <Pencil className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>

                    {/* Bottom row: Lifespan + Clan/Rod pill */}
                    <div className="flex items-center justify-between gap-1 text-[10px] opacity-90 min-w-0">
                      <span className="truncate font-mono font-medium">
                        {shortLifespan || lifespanStr}
                      </span>
                      {canonicalRod && canonicalRod !== 'Рід' && (
                        <span
                          className="text-[9px] px-1 py-0.2 rounded font-bold truncate max-w-[65px]"
                          style={{
                            backgroundColor: clanColor ? `${clanColor}25` : 'rgba(0,0,0,0.2)',
                            color: clanColor || undefined
                          }}
                          title={`Рід: ${canonicalRod}`}
                        >
                          {canonicalRod}
                        </span>
                      )}
                    </div>
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
                  height: `${node.height}px`,
                  borderColor: cardBorderColor,
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
                onMouseEnter={() => setHoveredPersonId(p.id)}
                onMouseLeave={() => setHoveredPersonId(null)}
                className={`group rounded-xl transition-all cursor-pointer flex flex-col justify-between p-3 select-none relative shadow-xl ${
                  isLightCanvas
                    ? 'bg-white text-neutral-900 shadow-md hover:shadow-lg'
                    : 'bg-[#22262a] text-white shadow-black/40'
                } ${
                  isRoot
                    ? isFemale
                      ? 'ring-2 ring-rose-500/90 ring-offset-2 ring-offset-[#22262a] shadow-rose-950/50 shadow-2xl'
                      : 'ring-2 ring-sky-500/90 ring-offset-2 ring-offset-[#22262a] shadow-sky-950/50 shadow-2xl'
                    : ''
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (p.id !== activePersonId) {
                    onChangeRoot(p.id);
                  }
                }}
                title={p.id === activePersonId ? 'Поточна особа' : 'Зробити фокусом дерева'}
              >
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

                {/* Selective Single-Person Hide/Collapse Button (for collateral sibling cards) */}
                {!isTreeRoot && isCollateralPerson && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCollapseSingleSibling(p.id);
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

                {/* Top Collapse/Expand Parents Branch Badge ([-]/[+]) */}
                {node.hasParents && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCollapseParents(p.id, node.isParentsCollapsed);
                    }}
                    className={`absolute -top-2.5 left-1/2 -translate-x-1/2 z-10 h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center gap-0.5 shadow-md transition-all cursor-pointer border ${
                      node.isParentsCollapsed
                        ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-400 scale-105'
                        : isLightCanvas
                        ? 'bg-[#ece5d8] hover:bg-[#ded5c5] text-stone-900 border-[#cfc3af]'
                        : 'bg-[#1e2329] hover:bg-slate-700 text-slate-300 border-[#3b434d]'
                    }`}
                    title={node.isParentsCollapsed ? `Розгорнути предків (+${node.parentsCount})` : 'Сховати предків'}
                    aria-label="Перемикач предків"
                  >
                    {node.isParentsCollapsed ? (
                      <>
                        <Plus className="w-2.5 h-2.5 stroke-[3] text-white" />
                        <span className="text-[9px] leading-none">{node.parentsCount}</span>
                      </>
                    ) : (
                      <Minus className="w-2.5 h-2.5 stroke-[3] text-amber-500" />
                    )}
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

                  {/* Multiple Hashtags Pill List */}
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
                      {/* Person Card / Edit Badge (Pencil icon to open/edit person card) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPerson(p.id);
                        }}
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors cursor-pointer ${
                          isLightCanvas
                            ? 'bg-sky-50 hover:bg-sky-600 text-sky-800 hover:text-white border-sky-300'
                            : 'bg-[#0e7490]/30 hover:bg-sky-600 text-[#38bdf8] hover:text-white border-[#0e7490]/50'
                        }`}
                        title="Картка особи (редагування)"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>

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

                {/* Bottom Collapse/Expand Children Branch Badge ([-]/[+]) */}
                {node.hasChildren && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCollapseChildren(p.id, node.isChildrenCollapsed);
                    }}
                    className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-10 h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center gap-0.5 shadow-md transition-all cursor-pointer border ${
                      node.isChildrenCollapsed
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 scale-105'
                        : isLightCanvas
                        ? 'bg-[#ece5d8] hover:bg-[#ded5c5] text-stone-900 border-[#cfc3af]'
                        : 'bg-[#1e2329] hover:bg-slate-700 text-slate-300 border-[#3b434d]'
                    }`}
                    title={node.isChildrenCollapsed ? `Розгорнути нащадків (+${node.childrenCount})` : 'Сховати нащадків'}
                    aria-label="Перемикач нащадків"
                  >
                    {node.isChildrenCollapsed ? (
                      <>
                        <Plus className="w-2.5 h-2.5 stroke-[3] text-white" />
                        <span className="text-[9px] leading-none">{node.childrenCount}</span>
                      </>
                    ) : (
                      <Minus className="w-2.5 h-2.5 stroke-[3] text-emerald-500" />
                    )}
                  </button>
                )}

                {/* Dedicated Lateral / Sibling Branch Collapse/Expand Controller ([-]/[+] and Selective Menu) */}
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
                    const sibNodes = layout.nodes.filter(
                      (n) => n.id !== node.id && n.generation === node.generation && (
                        (p.fatherId && n.person.fatherId === p.fatherId) ||
                        (p.motherId && n.person.motherId === p.motherId) ||
                        (p.siblingIds && p.siblingIds.includes(n.id)) ||
                        (n.person.siblingIds && n.person.siblingIds.includes(p.id))
                      )
                    );
                    if (sibNodes.some((sn) => sn.x < node.x)) {
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

                  return (
                    <div
                      className={`absolute ${
                        siblingSide === 'left' ? '-left-3.5' : '-right-3.5'
                      } top-1/2 -translate-y-1/2 z-30 flex items-center shadow-md rounded-full`}
                    >
                      {/* Main Branch Toggle (Collapse all / Expand all) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isAllCollapsed) {
                            expandAllSiblingsOfPerson(p.id);
                          } else {
                            collapseAllSiblingsOfPerson(p.id);
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

                      {/* Selective Menu Trigger (Chevron button to open dropdown for selective picking) */}
                      {collateralSiblings.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectiveMenuPersonId(selectiveMenuPersonId === p.id ? null : p.id);
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

                      {/* Selective Popover Dropdown */}
                      {selectiveMenuPersonId === p.id && (
                        <div
                          ref={selectiveMenuRef}
                          onClick={(e) => e.stopPropagation()}
                          className={`absolute ${
                            siblingSide === 'left' ? 'right-full mr-2' : 'left-full ml-2'
                          } top-1/2 -translate-y-1/2 w-64 bg-[#1b1f24] border border-[#383e46] rounded-xl shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 select-none text-left`}
                        >
                          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[#2d3238]">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                              <Users className="w-3.5 h-3.5 text-amber-400" />
                              <span>Брати та сестри ({collateralSiblings.length})</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectiveMenuPersonId(null)}
                              className="text-slate-400 hover:text-white text-xs p-0.5 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="text-[10px] text-slate-400 mb-2 leading-tight">
                            Клікніть на особу, щоб вибірково сховати або показати її у дереві:
                          </div>

                          {/* Quick Batch Actions */}
                          <div className="flex items-center gap-1.5 mb-2">
                            <button
                              type="button"
                              onClick={() => collapseAllSiblingsOfPerson(p.id)}
                              className="flex-1 py-1 px-1.5 text-[10px] font-semibold rounded bg-[#252a30] hover:bg-rose-950/70 text-slate-300 hover:text-rose-300 border border-[#383e46] hover:border-rose-600 transition-colors cursor-pointer text-center"
                            >
                              Згорнути всіх
                            </button>
                            <button
                              type="button"
                              onClick={() => expandAllSiblingsOfPerson(p.id)}
                              className="flex-1 py-1 px-1.5 text-[10px] font-semibold rounded bg-[#252a30] hover:bg-emerald-950/70 text-slate-300 hover:text-emerald-300 border border-[#383e46] hover:border-emerald-600 transition-colors cursor-pointer text-center"
                            >
                              Розгорнути всіх
                            </button>
                          </div>

                          {/* Individual Siblings List */}
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {collateralSiblings.map((sib) => {
                              const isCollapsed = collapsedSiblings.has(sib.id) || !showSiblings;
                              const sibName = `${sib.firstName || ''} ${sib.lastName || ''}`.trim() || 'Без імені';
                              const relationLabel = sib.gender === 'female' ? 'сестра' : 'брат';
                              return (
                                <div
                                  key={sib.id}
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
                                    onClick={() => toggleCollapseSingleSibling(sib.id, p.id)}
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

        {/* Floating Canvas Navigation HUD (Quick 1-tap zoom, fit and root focus on mobile & tablet) */}
        <div className="absolute bottom-6 right-4 sm:bottom-7 sm:right-6 z-20 flex items-center gap-1 bg-[#1a1e22]/95 backdrop-blur-md border border-[#323840] p-1 rounded-xl shadow-2xl">
          <button
            type="button"
            onClick={() => zoomAroundCenter(1.2)}
            className="p-1.5 text-slate-200 hover:text-white hover:bg-slate-700/80 rounded-lg transition-colors cursor-pointer"
            title="Збільшити масштаб (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => zoomAroundCenter(0.83)}
            className="p-1.5 text-slate-200 hover:text-white hover:bg-slate-700/80 rounded-lg transition-colors cursor-pointer"
            title="Зменшити масштаб (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={centerTree}
            className="p-1.5 text-slate-200 hover:text-white hover:bg-slate-700/80 rounded-lg transition-colors cursor-pointer"
            title="Вписати все дерево в екран"
          >
            <Maximize2 className="w-4 h-4 text-emerald-400" />
          </button>
          <button
            type="button"
            onClick={() => setShowMinimap((prev) => !prev)}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              showMinimap ? 'bg-emerald-600/30 text-emerald-300' : 'text-slate-400 hover:text-white hover:bg-slate-700/80'
            }`}
            title={showMinimap ? 'Сховати міні-мапу' : 'Показати міні-мапу'}
          >
            <Compass className="w-4 h-4" />
          </button>
        </div>

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

      {/* Person Report Modal (PDF / TXT generator) */}
      {reportPersonId && (
        <PersonReportModal
          personId={reportPersonId}
          database={database}
          onClose={() => setReportPersonId(null)}
          onSelectPerson={(id) => {
            onSelectPerson(id);
            setReportPersonId(null);
          }}
        />
      )}
    </div>
  );
};
