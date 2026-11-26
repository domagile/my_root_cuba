import type { BoundingBox } from './treeSpatialIndex';

const OVERSCAN_PX = 550;
const WORLD_BUCKET_SIZE = 512;

/**
 * Convert the actual camera to world coordinates before rounding outwards.
 * Rounding scale first makes the error grow with distance from the world origin.
 * World buckets keep nearby camera updates on the same culling bounds.
 */
export function getTreeViewportBounds(
  pan: { x: number; y: number }, scale: number,
  viewport: { width: number; height: number }
): BoundingBox {
  return {
    minX: Math.floor(((-pan.x - OVERSCAN_PX) / scale) / WORLD_BUCKET_SIZE) * WORLD_BUCKET_SIZE,
    maxX: Math.ceil(((viewport.width - pan.x + OVERSCAN_PX) / scale) / WORLD_BUCKET_SIZE) * WORLD_BUCKET_SIZE,
    minY: Math.floor(((-pan.y - OVERSCAN_PX) / scale) / WORLD_BUCKET_SIZE) * WORLD_BUCKET_SIZE,
    maxY: Math.ceil(((viewport.height - pan.y + OVERSCAN_PX) / scale) / WORLD_BUCKET_SIZE) * WORLD_BUCKET_SIZE
  };
}
