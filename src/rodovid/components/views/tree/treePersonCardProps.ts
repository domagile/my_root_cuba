import type React from 'react';
import type { Person } from '../../../types/genealogy';
import type { DuplicatePair } from '../../../../types';
import type { TreeNodeLayout } from '../../../utils/treeLayout';

export interface TreePersonCardProps {
  node: TreeNodeLayout;
  activePersonId: string;
  rootPersonId: string;
  isLightCanvas: boolean;
  isWhitelisted: boolean;
  isCardHovered: boolean;
  isMicroLOD: boolean;
  isPillLOD: boolean;
  isCompact: boolean;
  isReadOnly: boolean;
  orientation: 'vertical' | 'horizontal';

  // Bloodline highlights
  isNodeInBloodline: boolean;
  isHoveredTarget: boolean;
  isAncestorOfHovered: boolean;
  isDescendantOfHovered: boolean;
  bloodlineColor: string;
  bloodlineActive: boolean;

  // Focus Highlights
  isNodeFocused: boolean;
  isDimmed: boolean;
  focusType: string;
  focusColor: string;
  focusTitle: string;
  focusPersonId: string;
  selectedClanId: string | null;

  // Duplicate pair
  matchedDuplicate?: DuplicatePair;

  // Collateral siblings data
  collateralSiblings: Person[];
  isCollateralPerson: boolean;
  personSiblings: Person[];
  collapsedSiblings: Set<string>;
  showSiblings: boolean;

  // Parents data
  father?: Person | null;
  mother?: Person | null;

  // Selective popover state
  selectiveParentsMenuPersonId: string | null;
  selectiveMenuPersonId: string | null;
  selectiveParentsMenuRef?: React.Ref<HTMLDivElement>;
  selectiveMenuRef?: React.Ref<HTMLDivElement>;

  // Node position index for lateral detection
  nodeByPersonId: Map<string, TreeNodeLayout>;

  // Callback handlers (stable references)
  onCardMouseEnter: (id: string) => void;
  onCardMouseLeave: () => void;
  onSelectPerson: (id: string) => void;
  onEditPerson?: (id: string) => void;
  onChangeRoot: (id: string) => void;
  onOpenRelationManager?: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  onOpenContextMenuAtButton: (e: React.MouseEvent, id: string) => void;
  onSetActiveMergePair: (pair: DuplicatePair) => void;

  // Toggles
  onToggleCollapseParents: (personId: string, isCurrentlyCollapsed?: boolean) => void;
  onToggleCollapseParentBranch: (personId: string, branch: 'paternal' | 'maternal', isCurrentlyCollapsed?: boolean) => void;
  onToggleCollapseChildren: (personId: string, isCurrentlyCollapsed?: boolean) => void;
  onToggleCollapseSingleSibling: (siblingId: string, anchorPersonId?: string) => void;
  onCollapseAllSiblingsOfPerson: (personId: string) => void;
  onExpandAllSiblingsOfPerson: (personId: string) => void;
  onSetSelectiveParentsMenuPersonId: (personId: string | null) => void;
  onSetSelectiveMenuPersonId: (personId: string | null) => void;

  // Focus toggles
  onToggleClanFocus: (clanId: string) => void;
  onToggleDirectAncestorsFocus: (personId: string) => void;
}
