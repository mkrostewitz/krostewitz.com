import test from 'node:test';
import assert from 'node:assert/strict';
import {taxonomyOptionsEqual, taxonomyOptionLabel, isTaxonomyOption} from './taxonomyOptions.mjs';

test('highlighting a suggestion with an empty multiple selection does not crash or match', () => {
  const option = {id: 'US', label: 'United States'};
  const selected = [];
  assert.equal(taxonomyOptionsEqual(option, selected[0]), false);
  assert.equal(taxonomyOptionsEqual(undefined, option), false);
  assert.equal(taxonomyOptionsEqual(undefined, undefined), false);
  assert.equal(taxonomyOptionsEqual(null, option), false);
});
test('equality uses persistent IDs, never missing IDs or object reference', () => {
  assert.equal(taxonomyOptionsEqual({id: 'US', label: 'United States'}, {id: 'US', label: 'USA'}), true);
  assert.equal(taxonomyOptionsEqual({id: 'US', label: 'Country'}, {id: 'CA', label: 'Country'}), false);
  assert.equal(taxonomyOptionsEqual('Automotive', 'Automotive'), false);
  assert.equal(taxonomyOptionsEqual({}, {}), false);
});
test('free-solo labels render safely but unresolved creation results are not valid selections', () => {
  assert.equal(taxonomyOptionLabel('New industry'), 'New industry');
  assert.equal(taxonomyOptionLabel({id: 'a', label: 'Automotive'}), 'Automotive');
  for (const invalid of [undefined, null, {}, {id: 'a'}, {label: 'Automotive'}]) {
    assert.equal(taxonomyOptionLabel(invalid), '');
    assert.equal(isTaxonomyOption(invalid), false);
  }
});
