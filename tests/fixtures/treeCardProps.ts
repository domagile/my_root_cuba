import type { TreePersonCardProps } from '../../src/rodovid/components/views/tree/treePersonCardProps';
import type { TreeNodeLayout } from '../../src/rodovid/utils/treeLayout';

const noop = () => {};
export function cardNode(id = 'person'): TreeNodeLayout {
  return { id, person: { id, firstName: 'Марія', lastName: 'Тестова', gender: 'F', birthYear: 1850, deathYear: 1910, isLiving: false },
    x: 300, y: 260, width: 176, height: 192, generation: 0 };
}
export function cardProps(node = cardNode()): TreePersonCardProps {
  return {
    node, activePersonId: 'other', rootPersonId: 'other', isLightCanvas: false, isWhitelisted: true,
    isCardHovered: false, isMicroLOD: false, isPillLOD: false, isCompact: false, isReadOnly: false,
    orientation: 'vertical', isNodeInBloodline: false, isHoveredTarget: false, isAncestorOfHovered: false,
    isDescendantOfHovered: false, bloodlineColor: '#f59e0b', bloodlineActive: false,
    isNodeFocused: true, isDimmed: false, focusType: 'none', focusColor: '#f59e0b', focusTitle: '',
    focusPersonId: '', selectedClanId: null, collateralSiblings: [], isCollateralPerson: false,
    personSiblings: [], collapsedSiblings: new Set(), showSiblings: true,
    father: null, mother: null, selectiveParentsMenuPersonId: null, selectiveMenuPersonId: null,
    nodeByPersonId: new Map([[node.person.id, node]]),
    onCardMouseEnter: noop, onCardMouseLeave: noop, onSelectPerson: noop, onChangeRoot: noop,
    onContextMenu: noop, onOpenContextMenuAtButton: noop, onSetActiveMergePair: noop,
    onToggleCollapseParents: noop, onToggleCollapseParentBranch: noop, onToggleCollapseChildren: noop,
    onToggleCollapseSingleSibling: noop, onCollapseAllSiblingsOfPerson: noop, onExpandAllSiblingsOfPerson: noop,
    onSetSelectiveParentsMenuPersonId: noop, onSetSelectiveMenuPersonId: noop,
    onToggleClanFocus: noop, onToggleDirectAncestorsFocus: noop,
    onEditPerson: undefined, onOpenRelationManager: undefined
  };
}
