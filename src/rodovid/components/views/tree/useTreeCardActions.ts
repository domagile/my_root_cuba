import { useLayoutEffect, useMemo, useRef } from 'react';
import type { TreePersonCardProps } from './treePersonCardProps';

type ActionKeys = { [Key in keyof TreePersonCardProps]-?:
  NonNullable<TreePersonCardProps[Key]> extends (...args: any[]) => any ? Key : never
}[keyof TreePersonCardProps];
export type TreeCardActions = Pick<TreePersonCardProps, ActionKeys>;

/** Stable event functions always call the latest committed handlers. */
export function useTreeCardActions(actions: TreeCardActions): TreeCardActions {
  const latest = useRef(actions);
  useLayoutEffect(() => { latest.current = actions; });
  const forwarders = useMemo(() => Object.fromEntries(Object.keys(actions).map(key => [key, (...args: any[]) => {
    const action = latest.current[key as ActionKeys] as ((...args: any[]) => any) | undefined;
    return action?.(...args);
  }])) as TreeCardActions, []);
  // Preserve optional callbacks so buttons retain their fallback behavior.
  return useMemo(() => ({ ...forwarders,
    onEditPerson: actions.onEditPerson ? forwarders.onEditPerson : undefined,
    onOpenRelationManager: actions.onOpenRelationManager ? forwarders.onOpenRelationManager : undefined
  }), [forwarders, Boolean(actions.onEditPerson), Boolean(actions.onOpenRelationManager)]);
}
