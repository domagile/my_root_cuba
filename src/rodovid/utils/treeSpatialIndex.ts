/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TreeNodeLayout, TreeLinkLayout } from './treeLayout';

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const DEFAULT_CELL_SIZE = 320;

/**
 * High-performance 2D Spatial Grid Index for fast O(visible) viewport culling
 * and geometric intersection queries on massive trees (up to 10,000+ persons).
 */
export class SpatialTreeIndex {
  private cellSize: number;
  private nodeCells: Map<string, TreeNodeLayout[]> = new Map();
  private linkCells: Map<string, TreeLinkLayout[]> = new Map();
  private allNodes: TreeNodeLayout[] = [];
  private allLinks: TreeLinkLayout[] = [];

  constructor(cellSize: number = DEFAULT_CELL_SIZE) {
    this.cellSize = cellSize;
  }

  private cellKey(col: number, row: number): string {
    return `${col}:${row}`;
  }

  private getCellRange(minX: number, maxX: number, minY: number, maxY: number): {
    minCol: number;
    maxCol: number;
    minRow: number;
    maxRow: number;
  } {
    return {
      minCol: Math.floor(minX / this.cellSize),
      maxCol: Math.floor(maxX / this.cellSize),
      minRow: Math.floor(minY / this.cellSize),
      maxRow: Math.floor(maxY / this.cellSize)
    };
  }

  /**
   * Bulk insert all computed nodes into the spatial grid
   */
  public insertNodes(nodes: TreeNodeLayout[]): void {
    this.allNodes = nodes;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const w = node.width || 176;
      const h = node.height || 192;
      const minX = node.x;
      const maxX = node.x + w;
      const minY = node.y;
      const maxY = node.y + h;

      const { minCol, maxCol, minRow, maxRow } = this.getCellRange(minX, maxX, minY, maxY);

      for (let c = minCol; c <= maxCol; c++) {
        for (let r = minRow; r <= maxRow; r++) {
          const key = this.cellKey(c, r);
          let cell = this.nodeCells.get(key);
          if (!cell) {
            cell = [];
            this.nodeCells.set(key, cell);
          }
          cell.push(node);
        }
      }
    }
  }

  /**
   * Bulk insert all computed links into the spatial grid
   */
  public insertLinks(links: TreeLinkLayout[]): void {
    this.allLinks = links;
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const minX = Math.min(link.sourceX, link.targetX) - 30;
      const maxX = Math.max(link.sourceX, link.targetX) + 30;
      const minY = Math.min(link.sourceY, link.targetY) - 30;
      const maxY = Math.max(link.sourceY, link.targetY) + 30;

      const { minCol, maxCol, minRow, maxRow } = this.getCellRange(minX, maxX, minY, maxY);

      for (let c = minCol; c <= maxCol; c++) {
        for (let r = minRow; r <= maxRow; r++) {
          const key = this.cellKey(c, r);
          let cell = this.linkCells.get(key);
          if (!cell) {
            cell = [];
            this.linkCells.set(key, cell);
          }
          cell.push(link);
        }
      }
    }
  }

  /**
   * Fast O(visible) query for nodes intersecting the viewport bounding box
   */
  public queryVisibleNodes(bounds: BoundingBox): TreeNodeLayout[] {
    if (this.allNodes.length < 25) {
      return this.allNodes;
    }

    const { minCol, maxCol, minRow, maxRow } = this.getCellRange(
      bounds.minX,
      bounds.maxX,
      bounds.minY,
      bounds.maxY
    );

    const seenIds = new Set<string>();
    const result: TreeNodeLayout[] = [];

    for (let c = minCol; c <= maxCol; c++) {
      for (let r = minRow; r <= maxRow; r++) {
        const cell = this.nodeCells.get(this.cellKey(c, r));
        if (!cell) continue;

        for (let i = 0; i < cell.length; i++) {
          const node = cell[i];
          if (seenIds.has(node.id)) continue;

          const nw = node.width || 176;
          const nh = node.height || 192;
          const nRight = node.x + nw;
          const nBottom = node.y + nh;

          // Precise AABB intersection
          if (
            nRight >= bounds.minX &&
            node.x <= bounds.maxX &&
            nBottom >= bounds.minY &&
            node.y <= bounds.maxY
          ) {
            seenIds.add(node.id);
            result.push(node);
          }
        }
      }
    }

    return result;
  }

  /**
   * Fast O(visible) query for links intersecting the viewport bounding box
   */
  public queryVisibleLinks(bounds: BoundingBox): TreeLinkLayout[] {
    if (this.allLinks.length < 25) {
      return this.allLinks;
    }

    const { minCol, maxCol, minRow, maxRow } = this.getCellRange(
      bounds.minX,
      bounds.maxX,
      bounds.minY,
      bounds.maxY
    );

    const seenIds = new Set<string>();
    const result: TreeLinkLayout[] = [];

    for (let c = minCol; c <= maxCol; c++) {
      for (let r = minRow; r <= maxRow; r++) {
        const cell = this.linkCells.get(this.cellKey(c, r));
        if (!cell) continue;

        for (let i = 0; i < cell.length; i++) {
          const link = cell[i];
          if (seenIds.has(link.id)) continue;

          const minX = Math.min(link.sourceX, link.targetX) - 30;
          const maxX = Math.max(link.sourceX, link.targetX) + 30;
          const minY = Math.min(link.sourceY, link.targetY) - 30;
          const maxY = Math.max(link.sourceY, link.targetY) + 30;

          if (
            maxX >= bounds.minX &&
            minX <= bounds.maxX &&
            maxY >= bounds.minY &&
            minY <= bounds.maxY
          ) {
            seenIds.add(link.id);
            result.push(link);
          }
        }
      }
    }

    return result;
  }
}
