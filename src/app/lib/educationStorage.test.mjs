import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureEducation} from './educationStorage.mjs';
function database(legacy, destination) {
  const documents = {site_content: legacy, education: destination};
  return {documents, collection: name => ({
    findOne: async () => documents[name] ? structuredClone(documents[name]) : null,
    updateOne: async (filter, update) => {
      if (!documents[name]) documents[name] = {_id: filter._id, ...structuredClone(update.$setOnInsert)};
    },
  })};
}
test('migration preserves qualifications, language edits, revision and audit fields without changing legacy data', async () => {
  const legacy = {_id: 'education_settings', entries: [{id: 'qualification', published: false}], languages: [{code: 'zh'}], revision: 7, updatedAt: new Date(), updatedBy: 'admin'};
  const db = database(legacy);
  assert.deepEqual(await ensureEducation(db, () => {throw new Error('Must not reseed');}), legacy);
  assert.deepEqual(db.documents.site_content, legacy);
  db.documents.education.entries = [];
  db.documents.education.languages = [];
  db.documents.education.revision = 8;
  assert.deepEqual(await ensureEducation(db, () => {throw new Error('Must not reseed');}), db.documents.education);
});
test('fresh installations seed once and imported education wins over legacy data', async () => {
  const db = database(); let seeds = 0;
  const seed = async () => {seeds++; return [{code: 'en'}];};
  await ensureEducation(db, seed); await ensureEducation(db, seed);
  assert.equal(seeds, 1);
  assert.deepEqual(db.documents.education.entries, []);
  const imported = {_id: 'education_settings', languages: [], entries: [], revision: 42};
  assert.deepEqual(await ensureEducation(database({revision: 3}, imported), seed), imported);
});
test('concurrent initialization keeps the first destination document', async () => {
  const winner = {_id: 'education_settings', entries: [], languages: [], revision: 9};
  let reads = 0;
  const db = {collection: name => name === 'site_content' ? {findOne: async () => null} : {
    findOne: async () => ++reads === 1 ? null : winner,
    updateOne: async () => {throw Object.assign(new Error('Duplicate'), {code: 11000});},
  }};
  assert.deepEqual(await ensureEducation(db, async () => []), winner);
});
