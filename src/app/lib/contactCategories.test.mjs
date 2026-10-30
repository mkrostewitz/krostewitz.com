import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCategories, saveContactCategories} from './contactCategories.mjs';
import {researchCategories, normalizeResearch} from './contactResearch.mjs';
import {normalizeContact} from './leadOutreach.mjs';

test('category suggestions remove citations and unavailable facts', () => {
  const text = 'Company\nIndustries: Automation; Sensors [1]\nProducts: Not verified.\nPerson\nIdentity: Confirmed';
  const start = text.indexOf('[1]');
  const research = normalizeResearch({text, citations: [{start, end: start + 3, url: 'https://example.com'}]});
  assert.deepEqual(researchCategories(research), {industries: ['Automation', 'Sensors'], products: []});
  assert.deepEqual(normalizeCategories([' Sensors ', 'sensors', 'Automation', null]), ['Sensors', 'Automation']);
});

test('catalogs reuse canonical labels separately and survive clearing a contact', async () => {
  const collections = new Map();
  const db = {collection(name) {
    if (!collections.has(name)) collections.set(name, new Map());
    const docs = collections.get(name);
    return {
      async updateOne({_id}, update) { docs.set(_id, {...docs.get(_id), ...update.$set}); },
      async findOne({_id}) { return docs.get(_id); },
    };
  }};
  await saveContactCategories(db, {industries: ['Automation'], products: ['Sensors']});
  const next = await saveContactCategories(db, {industries: ['automation'], products: ['sensors', 'Software']});
  assert.deepEqual(next, {industries: ['Automation'], products: ['Sensors', 'Software']});
  await saveContactCategories(db, {industries: [], products: []});
  assert.equal(collections.get('contact_products').size, 2);
  const normalized = normalizeContact({firstName: 'Ada', ...next, research: null});
  assert.deepEqual(normalized.products, ['Sensors', 'Software']);
  assert.equal(Object.hasOwn(normalizeContact({firstName: 'Ada'}), 'industries'), false);
});

test('category casing capitalizes labels and preserves technical terms', () => {
  assert.deepEqual(normalizeCategories(['sensors and controls', 'automation systems', 'automation technology', 'IIoT hardware', 'IO-Link devices', 'industrial IoT', 'Sensors and controls']),
    ['Sensors and controls', 'Automation systems', 'Automation technology', 'IIoT hardware', 'IO-Link devices', 'Industrial IoT']);
});
