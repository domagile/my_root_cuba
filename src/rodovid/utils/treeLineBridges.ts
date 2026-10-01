/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TreeLinkLayout } from './treeLayout';

export interface LineCrossingCutout {
  id: string;
  x: number;
  y: number;
  r: number;
}

export interface ProcessedTreeLinksResult {
  links: TreeLinkLayout[];
  cutouts: LineCrossingCutout[];
  hasCrossings: boolean;
  crossingCount: number;
}

interface Point {
  x: number;
  y: number;
}

interface Segment {
  linkId: string;
  familyId?: string;
  segIndex: number;
  p1: Point;
  p2: Point;
  isVertical: boolean;
  isHorizontal: boolean;
  x: number; // for vertical
  y: number; // for horizontal
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Parse an SVG orthogonal path (M/L/H/V commands) into sequential 2D points.
 */
function parsePathToPoints(d?: string): Point[] {
  if (!d) return [];
  const points: Point[] = [];
  const regex = /([MLHV])\s*([^MLHV]*)/gi;
  let match: RegExpExecArray | null;
  let curX = 0;
  let curY = 0;

  while ((match = regex.exec(d)) !== null) {
    const cmd = match[1].toUpperCase();
    const rawArgs = match[2].trim();
    const nums = rawArgs ? rawArgs.split(/[\s,]+/).map(Number).filter((n) => !isNaN(n)) : [];

    if (cmd === 'M' || cmd === 'L') {
      for (let i = 0; i < nums.length; i += 2) {
        if (i + 1 < nums.length) {
          curX = nums[i];
          curY = nums[i + 1];
          points.push({ x: curX, y: curY });
        }
      }
    } else if (cmd === 'H') {
      for (let i = 0; i < nums.length; i++) {
        curX = nums[i];
        points.push({ x: curX, y: curY });
      }
    } else if (cmd === 'V') {
      for (let i = 0; i < nums.length; i++) {
        curY = nums[i];
        points.push({ x: curX, y: curY });
      }
    }
  }

  return points;
}

/**
 * Automatically detects line intersections in genealogy tree layouts
 * and inserts smooth, semicircular bridge jump arcs (line hops)
 * so that crossing orthogonal lines NEVER intersect.
 */
export function applyBridgeJumpsToLinks(
  links: TreeLinkLayout[],
  options?: {
    bridgeRadius?: number;
    orientation?: 'vertical' | 'horizontal';
    enableBridges?: boolean;
  }
): ProcessedTreeLinksResult {
  const enableBridges = options?.enableBridges ?? true;
  if (!enableBridges || !links || links.length < 2) {
    return {
      links: links || [],
      cutouts: [],
      hasCrossings: false,
      crossingCount: 0
    };
  }

  const orientation = options?.orientation ?? 'vertical';
  const defaultRadius = options?.bridgeRadius ?? 5.5;

  // 1. Decompose all links into discrete orthogonal segments
  const allSegments: Segment[] = [];
  const linkPointsMap = new Map<string, Point[]>();

  links.forEach((link) => {
    let pts: Point[] = [];
    if (link.path) {
      pts = parsePathToPoints(link.path);
    }
    if (pts.length < 2) {
      pts = [
        { x: link.sourceX, y: link.sourceY },
        { x: link.targetX, y: link.targetY }
      ];
    }
    linkPointsMap.set(link.id, pts);

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dx = Math.abs(p2.x - p1.x);
      const dy = Math.abs(p2.y - p1.y);

      // Orthogonal tolerance check
      const isVertical = dx < 1.0;
      const isHorizontal = dy < 1.0;

      if (!isVertical && !isHorizontal) {
        // Diagonal or free line, preserve as is
        continue;
      }

      allSegments.push({
        linkId: link.id,
        familyId: link.familyId,
        segIndex: i,
        p1,
        p2,
        isVertical,
        isHorizontal,
        x: p1.x,
        y: p1.y,
        minX: Math.min(p1.x, p2.x),
        maxX: Math.max(p1.x, p2.x),
        minY: Math.min(p1.y, p2.y),
        maxY: Math.max(p1.y, p2.y)
      });
    }
  });

  const horizontalSegments = allSegments.filter((s) => s.isHorizontal);
  const verticalSegments = allSegments.filter((s) => s.isVertical);

  // Crossings mapping: key = linkId:segIndex -> list of crossing coordinates
  const crossingMap = new Map<string, number[]>();
  const cutouts: LineCrossingCutout[] = [];
  const seenCutouts = new Set<string>();

  // Margin to exclude T-junction connections and card terminals (5px)
  const TERMINAL_MARGIN = 5.0;

  if (orientation === 'vertical') {
    // In vertical mode: Vertical drop/stem lines jump OVER horizontal bus/marriage lines
    verticalSegments.forEach((vSeg) => {
      horizontalSegments.forEach((hSeg) => {
        // Don't cross segments of same link or same family T-junction
        if (vSeg.linkId === hSeg.linkId) return;
        if (vSeg.familyId && hSeg.familyId && vSeg.familyId === hSeg.familyId) return;

        const crossX = vSeg.x;
        const crossY = hSeg.y;

        const isStrictlyInsideH = crossX > hSeg.minX + TERMINAL_MARGIN && crossX < hSeg.maxX - TERMINAL_MARGIN;
        const isStrictlyInsideV = crossY > vSeg.minY + TERMINAL_MARGIN && crossY < vSeg.maxY - TERMINAL_MARGIN;

        if (isStrictlyInsideH && isStrictlyInsideV) {
          const key = `${vSeg.linkId}:${vSeg.segIndex}`;
          if (!crossingMap.has(key)) crossingMap.set(key, []);
          crossingMap.get(key)!.push(crossY);

          const cutoutKey = `${Math.round(crossX)}_${Math.round(crossY)}`;
          if (!seenCutouts.has(cutoutKey)) {
            seenCutouts.add(cutoutKey);
            cutouts.push({
              id: cutoutKey,
              x: crossX,
              y: crossY,
              r: defaultRadius - 1.5
            });
          }
        }
      });
    });
  } else {
    // In horizontal mode: Horizontal drop/stem lines jump OVER vertical bus lines
    horizontalSegments.forEach((hSeg) => {
      verticalSegments.forEach((vSeg) => {
        if (hSeg.linkId === vSeg.linkId) return;
        if (hSeg.familyId && vSeg.familyId && hSeg.familyId === vSeg.familyId) return;

        const crossX = vSeg.x;
        const crossY = hSeg.y;

        const isStrictlyInsideH = crossX > hSeg.minX + TERMINAL_MARGIN && crossX < hSeg.maxX - TERMINAL_MARGIN;
        const isStrictlyInsideV = crossY > vSeg.minY + TERMINAL_MARGIN && crossY < vSeg.maxY - TERMINAL_MARGIN;

        if (isStrictlyInsideH && isStrictlyInsideV) {
          const key = `${hSeg.linkId}:${hSeg.segIndex}`;
          if (!crossingMap.has(key)) crossingMap.set(key, []);
          crossingMap.get(key)!.push(crossX);

          const cutoutKey = `${Math.round(crossX)}_${Math.round(crossY)}`;
          if (!seenCutouts.has(cutoutKey)) {
            seenCutouts.add(cutoutKey);
            cutouts.push({
              id: cutoutKey,
              x: crossX,
              y: crossY,
              r: defaultRadius - 1.5
            });
          }
        }
      });
    });
  }

  let totalCrossings = 0;
  crossingMap.forEach((crossings) => {
    totalCrossings += crossings.length;
  });

  if (totalCrossings === 0) {
    return {
      links,
      cutouts: [],
      hasCrossings: false,
      crossingCount: 0
    };
  }

  // 2. Reconstruct SVG paths for links with bridge arcs
  const processedLinks: TreeLinkLayout[] = links.map((link) => {
    const pts = linkPointsMap.get(link.id);
    if (!pts || pts.length < 2) return link;

    let hasLinkCrossings = false;
    for (let i = 0; i < pts.length - 1; i++) {
      if (crossingMap.has(`${link.id}:${i}`)) {
        hasLinkCrossings = true;
        break;
      }
    }

    if (!hasLinkCrossings) return link;

    let newPath = `M ${pts[0].x} ${pts[0].y}`;

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const crossings = crossingMap.get(`${link.id}:${i}`);

      if (!crossings || crossings.length === 0) {
        newPath += ` L ${p2.x} ${p2.y}`;
        continue;
      }

      if (orientation === 'vertical') {
        const isDownward = p2.y >= p1.y;
        // Sort along travel direction
        const sortedY = [...new Set(crossings)].sort((a, b) => (isDownward ? a - b : b - a));

        let currentY = p1.y;
        const lineX = p1.x;

        for (let cIdx = 0; cIdx < sortedY.length; cIdx++) {
          const crossY = sortedY[cIdx];
          const distToNext = cIdx < sortedY.length - 1 ? Math.abs(sortedY[cIdx + 1] - crossY) : 999;
          const radius = Math.min(defaultRadius, Math.max(3.0, (distToNext - 2) / 2));

          if (isDownward) {
            const startArcY = crossY - radius;
            const endArcY = crossY + radius;
            if (startArcY > currentY) {
              newPath += ` L ${lineX} ${startArcY}`;
            }
            // Semicircular bridge arc hopping to the right (sweep-flag = 1)
            newPath += ` A ${radius} ${radius} 0 0 1 ${lineX} ${endArcY}`;
            currentY = endArcY;
          } else {
            const startArcY = crossY + radius;
            const endArcY = crossY - radius;
            if (startArcY < currentY) {
              newPath += ` L ${lineX} ${startArcY}`;
            }
            // Semicircular bridge arc hopping to the right (sweep-flag = 0)
            newPath += ` A ${radius} ${radius} 0 0 0 ${lineX} ${endArcY}`;
            currentY = endArcY;
          }
        }

        newPath += ` L ${p2.x} ${p2.y}`;
      } else {
        // Horizontal orientation: horizontal lines jump over vertical lines
        const isRightward = p2.x >= p1.x;
        const sortedX = [...new Set(crossings)].sort((a, b) => (isRightward ? a - b : b - a));

        let currentX = p1.x;
        const lineY = p1.y;

        for (let cIdx = 0; cIdx < sortedX.length; cIdx++) {
          const crossX = sortedX[cIdx];
          const distToNext = cIdx < sortedX.length - 1 ? Math.abs(sortedX[cIdx + 1] - crossX) : 999;
          const radius = Math.min(defaultRadius, Math.max(3.0, (distToNext - 2) / 2));

          if (isRightward) {
            const startArcX = crossX - radius;
            const endArcX = crossX + radius;
            if (startArcX > currentX) {
              newPath += ` L ${startArcX} ${lineY}`;
            }
            // Semicircular bridge arc hopping upwards (sweep-flag = 0)
            newPath += ` A ${radius} ${radius} 0 0 0 ${endArcX} ${lineY}`;
            currentX = endArcX;
          } else {
            const startArcX = crossX + radius;
            const endArcX = crossX - radius;
            if (startArcX < currentX) {
              newPath += ` L ${startArcX} ${lineY}`;
            }
            newPath += ` A ${radius} ${radius} 0 0 1 ${endArcX} ${lineY}`;
            currentX = endArcX;
          }
        }

        newPath += ` L ${p2.x} ${p2.y}`;
      }
    }

    return {
      ...link,
      path: newPath
    };
  });

  return {
    links: processedLinks,
    cutouts,
    hasCrossings: true,
    crossingCount: totalCrossings
  };
}
