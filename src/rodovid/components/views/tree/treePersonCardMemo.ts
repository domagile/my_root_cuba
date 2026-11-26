import type { Person } from '../../../types/genealogy';
import type { TreePersonCardProps } from './treePersonCardProps';

export function getSiblingBranchSide(
  { node, personSiblings, nodeByPersonId }: Pick<TreePersonCardProps, 'node' | 'personSiblings' | 'nodeByPersonId'>
): 'left' | 'right' {
  if (node.isSpouseNode) return 'right';
  if (node.spouseId) return 'left';
  return personSiblings.some(person => {
    const sibling = nodeByPersonId.get(person.id);
    return sibling && sibling.generation === node.generation && sibling.x < node.x;
  }) ? 'left' : 'right';
}

function samePeople(a: Person[], b: Person[]): boolean {
  return a === b || (a.length === b.length && a.every((person, index) => person === b[index]));
}

const contextualProps = new Set<keyof TreePersonCardProps>([
  'activePersonId', 'rootPersonId', 'focusPersonId', 'selectiveParentsMenuPersonId', 'selectiveMenuPersonId',
  'personSiblings', 'collateralSiblings', 'collapsedSiblings', 'nodeByPersonId'
]);

/** Skip camera-only renders while keeping every displayed field and action current. */
export function areTreePersonCardPropsEqual(prev: TreePersonCardProps, next: TreePersonCardProps): boolean {
  // A freshly calculated node may contain updated relationships or a versioned
  // in-place person edit. Reuse its DOM element, but always refresh its contents.
  if (prev.node !== next.node) return false;
  const keys = Object.keys(next) as (keyof TreePersonCardProps)[];
  if (Object.keys(prev).length !== keys.length) return false;
  for (const key of keys) {
    if (!contextualProps.has(key) && !Object.is(prev[key], next[key])) return false;
  }
  const personId = next.node.person.id;
  for (const key of ['activePersonId', 'rootPersonId', 'focusPersonId', 'selectiveParentsMenuPersonId', 'selectiveMenuPersonId'] as const) {
    if ((prev[key] === personId) !== (next[key] === personId)) return false;
  }
  if (!samePeople(prev.personSiblings, next.personSiblings) || !samePeople(prev.collateralSiblings, next.collateralSiblings)) return false;
  if (prev.collapsedSiblings !== next.collapsedSiblings) {
    const relevantIds = [personId, ...next.collateralSiblings.map(person => person.id)];
    if (relevantIds.some(id => prev.collapsedSiblings.has(id) !== next.collapsedSiblings.has(id))) return false;
  }
  if (prev.nodeByPersonId !== next.nodeByPersonId && getSiblingBranchSide(prev) !== getSiblingBranchSide(next)) return false;
  return true;
}
