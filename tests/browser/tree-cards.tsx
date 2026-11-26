import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { TreePersonCard } from '../../src/rodovid/components/views/tree/TreePersonCard';
import { useTreeCardActions, type TreeCardActions } from '../../src/rodovid/components/views/tree/useTreeCardActions';
import { cardNode, cardProps } from '../fixtures/treeCardProps';
import '../../src/index.css';

const log: any[] = [];
let render!: (patch: Record<string, any>) => void;
const nodes = Array.from({ length: 40 }, (_, index) => ({ ...cardNode(`p${index}`), x: 350 + (index % 5) * 220, y: 280 + Math.floor(index / 5) * 260 }));
const siblingA = cardNode('sibling-a').person, siblingB = cardNode('sibling-b').person;
const base = cardProps(nodes[0]);
const defaults = { x: 350, y: 280, parentsVersion: 0, siblingsVersion: 0, revision: 0, tick: 0,
  menu: 'parents', collapsed: false, optionalActions: false, lod: 'full' };

function Fixture() {
  const [state, setState] = useState(defaults);
  render = patch => setState(previous => ({ ...previous, ...patch }));
  const node = useMemo(() => ({ ...nodes[0], x: state.x, y: state.y, hasParents: true, hasSiblings: true }), [state.x,state.y]);
  const father = useMemo(() => ({ ...cardNode('father').person, firstName: state.parentsVersion ? 'Новий батько' : 'Старий батько' }), [state.parentsVersion]);
  const siblings = useMemo(() => [{ ...siblingA, firstName: state.siblingsVersion ? 'Нова сестра' : 'Стара сестра' }, siblingB], [state.siblingsVersion]);
  const actionKeys = Object.keys(base).filter(key => key.startsWith('on'));
  const actions = Object.fromEntries(actionKeys.map(key => [key, (...args: any[]) => {
    log.push({ action: key, revision: state.revision, args: args.filter(arg => typeof arg === 'string' || arg === null) });
    if (key === 'onSetSelectiveParentsMenuPersonId') setState(previous => ({ ...previous, menu: args[0] ? 'parents' : '' }));
    if (key === 'onSetSelectiveMenuPersonId') setState(previous => ({ ...previous, menu: args[0] ? 'siblings' : '' }));
  }])) as TreeCardActions;
  if (!state.optionalActions) { actions.onEditPerson = undefined; actions.onOpenRelationManager = undefined; }
  const stableActions = useTreeCardActions(actions);
  return <>
    <div style={{position:'fixed',left:12,top:12,zIndex:10000,fontFamily:'sans-serif'}}>Synthetic data · no cloud · revision {state.revision}</div>
    <div data-testid="canvas" style={{ transform: `translate(${state.tick % 2}px,0)` }}>
      {nodes.map((item, index) => <TreePersonCard key={item.id} {...base} {...stableActions}
        node={index === 0 ? node : item} father={index === 0 ? father : null}
        personSiblings={index === 0 ? siblings : []} collateralSiblings={index === 0 ? siblings.filter(Boolean) : []}
        collapsedSiblings={new Set(state.collapsed ? ['sibling-a'] : [])}
        selectiveParentsMenuPersonId={state.menu === 'parents' ? 'p0' : null}
        selectiveMenuPersonId={state.menu === 'siblings' ? 'p0' : null}
        isMicroLOD={state.lod === 'micro'} isPillLOD={state.lod === 'pill'} />)}
    </div>
  </>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
(window as any).treeHarness = {
  patch: (patch: Record<string, any>) => flushSync(() => render(patch)),
  log, defaults,
  cameraTicks: (count: number) => {
    const started = performance.now();
    for (let tick = 1; tick <= count; tick++) flushSync(() => render({ tick }));
    return performance.now() - started;
  }
};
