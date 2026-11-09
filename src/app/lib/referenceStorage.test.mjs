import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureReferences, saveReferences, withReferences} from './referenceStorage.mjs';

function database() {
  const docs = {site_content: new Map([['profile_settings', {_id: 'profile_settings', referencesMode: 'carousel', referencesEnabled: true, name: {fullName: 'Owner'}}]]), references: new Map()};
  function matches(row, query) {
    return Object.entries(query).every(([key, value]) => {
      if (value?.$ne !== undefined) return row[key] !== value.$ne;
      if (value?.$nin) return !value.$nin.includes(row[key]);
      return row[key] === value;
    });
  }
  return {docs, collection(name) {return {
    async findOne(query) {return structuredClone([...docs[name].values()].find(row => matches(row, query)) || null);},
    find(query) {return {sort() {return {async toArray() {return structuredClone([...docs[name].values()].filter(row => matches(row, query)).sort((a, b) => a.order - b.order));}};}};},
    async updateOne(filter, update) {
      const row = docs[name].get(filter._id) || {_id: filter._id, ...structuredClone(update.$setOnInsert || {})};
      Object.assign(row, structuredClone(update.$set || {}));
      docs[name].set(filter._id, row);
    },
    async deleteMany(query) {for (const [id, row] of docs[name]) if (matches(row, query)) docs[name].delete(id);},
  };}};
}
const first = {id: 'a', name: 'First', quote: 'Original', sourceLanguage: 'en', translations: {de: {quote: 'Übersetzung'}}, photoUrl: 'https://example.com/photo.jpg'};
const second = {id: 'b', name: 'Second', quote: 'Another recommendation'};

test('each recommendation gets its own document and settings remain in site_content', async () => {
  const db = database();
  await saveReferences(db, {references: {mode: 'cards', items: [first, second]}}, {email: 'admin@example.com'});
  assert.equal(db.docs.references.size, 2);
  assert.equal(db.docs.references.get('reference:a').translations.de.quote, 'Übersetzung');
  assert.equal(db.docs.references.get('reference:a').photoUrl, first.photoUrl);
  assert.equal(db.docs.references.get('reference:a').order, 0);
  assert.equal(db.docs.references.get('reference:b').order, 1);
  const profile = db.docs.site_content.get('profile_settings');
  assert.equal(profile.referencesMode, 'cards');
  assert.equal(profile.referencesEnabled, true);
  assert.equal(profile.references, undefined);
  assert.deepEqual(profile.name, {fullName: 'Owner'});
  const stored = await ensureReferences(db);
  assert.equal(withReferences({}, stored).references.items.length, 2);
});

test('visibility changes do not rewrite recommendations; edit, reorder and delete operate on individual documents', async () => {
  const db = database();
  await saveReferences(db, {references: {mode: 'carousel', items: [first, second]}}, {});
  const before = structuredClone(db.docs.references);
  await saveReferences(db, {referencesEnabled: false}, {});
  assert.deepEqual(db.docs.references, before);
  assert.equal((await ensureReferences(db)).enabled, false);
  await saveReferences(db, {references: {mode: 'cards', items: [second, {...first, quote: 'Edited'}]}}, {});
  assert.deepEqual((await ensureReferences(db)).items.map(item => item.id), ['b', 'a']);
  assert.equal(db.docs.references.get('reference:a').quote, 'Edited');
  await saveReferences(db, {references: {mode: 'cards', items: [first]}}, {});
  assert.equal(db.docs.references.size, 1);
  assert.equal(db.docs.references.has('reference:b'), false);
  await saveReferences(db, {references: {mode: 'cards', items: []}}, {});
  assert.equal(db.docs.references.size, 0);
});

test('invalid saves leave the individual documents unchanged', async () => {
  const db = database();
  await saveReferences(db, {references: {mode: 'cards', items: [first]}}, {});
  const before = structuredClone(db.docs);
  await assert.rejects(saveReferences(db, {references: {mode: 'cards', items: [{id: 'a', name: 'Missing quote'}]}}, {}));
  assert.deepEqual(db.docs, before);
});
