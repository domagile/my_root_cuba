import { test } from 'node:test';
import assert from 'node:assert/strict';
import { areTreePersonCardPropsEqual as same, getSiblingBranchSide } from '../src/rodovid/components/views/tree/treePersonCardMemo';
import { cardNode, cardProps } from './fixtures/treeCardProps';

test('camera-only render and recreated sibling arrays retain unchanged cards', () => {
  const props = cardProps();
  assert.equal(same(props, { ...props, personSiblings: [], collateralSiblings: [] }), true);
});

for (const key of ['father', 'mother'] as const) {
  test(`${key} edits and removal refresh the existing child card`, () => {
    const previous = { ...cardProps(), [key]: cardNode(key).person };
    assert.equal(same(previous, { ...previous, [key]: { ...previous[key], firstName: 'Edited parent' } }), false);
    assert.equal(same(previous, { ...previous, [key]: null }), false);
  });
}

test('renaming a sibling or changing sibling order refreshes its menu', () => {
  const a = cardNode('a').person, b = cardNode('b').person;
  const props = { ...cardProps(), personSiblings: [a,b], collateralSiblings: [a,b] };
  assert.equal(same(props, { ...props, personSiblings: [a,b], collateralSiblings: [a,b] }), true);
  assert.equal(same(props, { ...props, collateralSiblings: [{ ...a, firstName: 'Edited sibling' },b] }), false);
  assert.equal(same(props, { ...props, personSiblings: [b,a] }), false);
});

test('collapsing an actual sibling refreshes its counter, while unrelated collapses do not', () => {
  const sibling = cardNode('sibling').person;
  const props = { ...cardProps(), collateralSiblings: [sibling] };
  assert.equal(same(props, { ...props, collapsedSiblings: new Set(['unrelated']) }), true);
  assert.equal(same(props, { ...props, collapsedSiblings: new Set(['sibling']) }), false);
});

test('sibling branch side responds to relevant geometry changes only', () => {
  const sibling = cardNode('sibling');
  const node = cardNode();
  const props = { ...cardProps(node), personSiblings: [sibling.person], nodeByPersonId: new Map([['sibling', { ...sibling, x: node.x + 300 }]]) };
  assert.equal(getSiblingBranchSide(props), 'right');
  const after = { ...props, nodeByPersonId: new Map([['sibling', { ...sibling, x: node.x - 300 }]]) };
  assert.equal(getSiblingBranchSide(after), 'left');
  assert.equal(same(props, after), false);
  assert.equal(same(props, { ...props, nodeByPersonId: new Map(props.nodeByPersonId) }), true);
});

test('fresh layout nodes refresh parent counts and marriage status even with unchanged coordinates', () => {
  const props = cardProps();
  assert.equal(same(props, { ...props, node: { ...props.node, parentsCount: 2 } }), false);
  assert.equal(same(props, { ...props, node: { ...props.node, marriageStatus: 'Divorced' } }), false);
});

test('updated callbacks and optional button availability cannot leave stale click handlers', () => {
  const props = cardProps();
  assert.equal(same(props, { ...props, onSelectPerson: () => {} }), false);
  assert.equal(same(props, { ...props, onEditPerson: () => {} }), false);
  assert.equal(same(props, { ...props, onOpenRelationManager: () => {} }), false);
});

for (const key of ['activePersonId', 'rootPersonId', 'focusPersonId', 'selectiveParentsMenuPersonId', 'selectiveMenuPersonId'] as const) {
  test(`${key} changes refresh affected cards and skip unrelated cards`, () => {
    const props = cardProps();
    assert.equal(same(props, { ...props, [key]: 'unrelated' }), true);
    assert.equal(same(props, { ...props, [key]: props.node.person.id }), false);
  });
}

test('privacy, read-only and level-of-detail changes always refresh the card', () => {
  const props = cardProps();
  for (const key of ['isWhitelisted','isReadOnly','isMicroLOD','isPillLOD','isLightCanvas','isCollateralPerson'] as const) {
    assert.equal(same(props, { ...props, [key]: !props[key] }), false, key);
  }
});
