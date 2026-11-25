import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { executeGlobalTreeSearch, clearGlobalSearchCache, type SearchCategory } from '../src/utils/globalTreeSearch';
import { searchPersons, searchResultView } from './fixtures/searchPersons';

// These are recorded compatibility results from the preceding commit, not Jira requirements.
const baseline = JSON.parse(readFileSync(new URL('./fixtures/searchBaseline.json', import.meta.url), 'utf8'));
for (const fixture of baseline.cases) {
  test(`search compatibility: ${fixture.title}`, () => {
    clearGlobalSearchCache();
    const result = executeGlobalTreeSearch(searchPersons, fixture.query, fixture.category as SearchCategory, fixture.options);
    assert.deepEqual(searchResultView(result), fixture.expected);
    for (const id of fixture.requiredIds || []) assert.ok(result.some(item => item.person.id === id), id);
    assert.ok(result.every(item => !item.person.isDeleted));
  });
}

test('a subsequent query and immutable person edit cannot reuse a previous query’s word comparisons', () => {
  clearGlobalSearchCache();
  const initial = executeGlobalTreeSearch(searchPersons, 'позначка', 'note');
  const edited = searchPersons.map(person => person.id === 'multi' ? { ...person, customFields: { archive: 'changed' } } : person);
  const after = executeGlobalTreeSearch(edited, 'позначка', 'note');
  assert.ok(initial.some(item => item.person.id === 'multi'));
  assert.ok(!after.some(item => item.person.id === 'multi'));
  assert.ok(executeGlobalTreeSearch(edited, 'Ганна', 'name').some(item => item.person.id === 'variant'));
});
