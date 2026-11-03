import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCategories, saveContactCategories} from './contactCategories.mjs';
import {researchCategories, companyCategories, normalizeResearch} from './contactResearch.mjs';
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

test("applications normalize like products without adding missing fields to old contacts", async () => {
  const {normalizeContact} = await import("./leadOutreach.mjs");
  const contact = normalizeContact({firstName: "Test", products: ["Sensors"], applications: [" automation ", "Automation", "robotics"]});
  assert.deepEqual(contact.applications, ["Automation", "Robotics"]);
  assert.deepEqual(contact.products, ["Sensors"]);
  assert.equal(Object.hasOwn(normalizeContact({firstName: "Test"}), "applications"), false);
  assert.deepEqual(normalizeContact({firstName: "Test", applications: []}).applications, []);
});


test('research industries populate applications while preserving existing company selections', () => {
  const research = normalizeResearch({text: 'Company\nIndustries: Industrial automation; Sensors and controls\nProducts: Sensors\nPerson\nIdentity: Confirmed', citations: []});
  const contact = companyCategories({applications: ['Quality control'], products: ['Software']}, researchCategories(research));
  assert.deepEqual(contact.applications, ['Quality control', 'Industrial automation', 'Sensors and controls']);
  assert.deepEqual(contact.products, ['Software', 'Sensors']);
  assert.deepEqual(normalizeContact({firstName: "Ada", ...contact}).applications, contact.applications);
  assert.deepEqual(companyCategories(contact, researchCategories(research)), contact);
});

test('existing industry selections fill the combined field and cleared selections stay cleared', () => {
  assert.deepEqual(companyCategories({industries: ['Automation'], applications: []}).applications, ['Automation']);
  assert.deepEqual(companyCategories({industries: ['Automation'], applications: ['automation', 'Robotics']}).applications, ['Automation', 'Robotics']);
  assert.deepEqual(companyCategories({industries: [], applications: []}).applications, []);
});
