export interface SavedTreeViewport {
  version: 1;
  personId: string;
  pan: { x: number; y: number };
  scale: number;
}

function camera(value: any, personId: string): SavedTreeViewport | null {
  if (!value || typeof value.scale !== 'number' || !Number.isFinite(value.scale)
    || value.scale < 0.2 || value.scale > 2.5) return null;
  const pan = value.pan;
  if (!pan || typeof pan.x !== 'number' || typeof pan.y !== 'number'
    || !Number.isSafeInteger(Math.round(pan.x)) || !Number.isSafeInteger(Math.round(pan.y))) return null;
  return { version: 1, personId, pan: { x: pan.x, y: pan.y }, scale: value.scale };
}

/** Legacy camera fields remain readable; a versioned camera keeps its own owner. */
export function readSavedTreeViewport(state: unknown, activePersonId: string): SavedTreeViewport | null {
  if (!state || typeof state !== 'object' || !activePersonId) return null;
  const saved = state as Record<string, any>;
  if ('viewport' in saved) {
    if (saved.viewport?.version !== 1 || saved.viewport?.personId !== activePersonId) return null;
    return camera(saved.viewport, activePersonId);
  }
  if (saved.selectedPersonId !== activePersonId) return null;
  // These values were placeholders in the old, unversioned format.
  if (saved.pan && ((saved.pan.x === 0 && saved.pan.y === 0) || (saved.pan.x === 80 && saved.pan.y === 80))) return null;
  return camera(saved, activePersonId);
}

/** A changed tree/window should not reopen to a completely empty viewport. */
export function treeViewportHasVisibleNode(
  viewport: SavedTreeViewport,
  nodes: readonly { x: number; y: number; width: number; height: number }[],
  size: { width: number; height: number }
): boolean {
  return nodes.some(node => {
    const x = node.x * viewport.scale + viewport.pan.x;
    const y = node.y * viewport.scale + viewport.pan.y;
    return x + node.width * viewport.scale > 0 && x < size.width
      && y + node.height * viewport.scale > 0 && y < size.height;
  });
}
