import test from 'node:test';
import assert from 'node:assert/strict';
import {industryDb} from './test-support/industryDb.mjs';
import {ensureIndustries, getIndustries, createIndustry, updateIndustry, normalizeIndustryEdit, deleteIndustry} from './industryStorage.mjs';
import {experienceSummary} from './experienceClassifications.mjs';

const legacy = {_id: 'translations', translations: {
  en: {skills: {industries: [{title: 'Automation', detail: 'Original English description', icon: 'automation'}]}},
  de: {skills: {industries: [{title: 'Automatisierung', detail: 'Original deutsche Beschreibung', icon: 'automation'}]}},
}};

test('unused industries can be deleted without being reseeded', async () => {
  const db = migratedDb();
  const item = (await getIndustries(db))[0];
  await deleteIndustry(db, item);
  assert.ok(!(await getIndustries(db)).some(row => row.id === item.id));
  assert.equal(db.collections.get('lead_industries').size, 2);
  await assert.rejects(deleteIndustry(db, item), {status: 409});
});

test('deletion rejects assigned industries, stale revisions and invalid requests', async () => {
  const db = migratedDb();
  const item = (await getIndustries(db))[0];
  await assert.rejects(deleteIndustry(db, {...item, revision: 99}), {status: 409});
  await assert.rejects(deleteIndustry(db, {id: item.id}), {status: 400});
  db.collections.set('cv_timeline', new Map([['role', {_id: 'role', classifications: {industries: [item.id]}, translations: {en: {company: 'Example', title: 'Director'}}}]]));
  await assert.rejects(deleteIndustry(db, item), error => error.status === 409 && error.message.includes('Example — Director'));
  assert.ok((await getIndustries(db)).some(row => row.id === item.id));
});
function migratedDb() {
  return industryDb({site_content: [legacy], lead_industries: [{_id: 'assigned-id', label: 'Automation'}, {_id: 'other-id', label: 'Other'}]});
}

test('migration preserves saved bilingual cards, icons, and CV identifiers without changing lead data', async () => {
  const db = migratedDb();
  const before = structuredClone(db.collections.get('lead_industries'));
  const items = await getIndustries(db);
  const industry = items.find(item => item.id === 'assigned-id');
  assert.equal(industry.translations.en.detail, 'Original English description');
  assert.equal(industry.translations.de.detail, 'Original deutsche Beschreibung');
  assert.equal(industry.icon, 'automation');
  assert.deepEqual(db.collections.get('site_content').get('translations'), legacy);
  assert.deepEqual(db.collections.get('lead_industries'), before);
  const entries = [{classifications: {industries: ['assigned-id']}}];
  const summary = experienceSummary(entries, {industries: items, competencies: []}, 'de');
  assert.deepEqual(summary.industries, [{id: 'assigned-id', label: 'Automatisierung', detail: 'Original deutsche Beschreibung', icon: 'automation'}]);
  assert.deepEqual(experienceSummary([], {industries: items, competencies: []}).industries, []);
});

test('migration retains unmatched cards for later assignment and seeds fresh installs only once', async () => {
  const db = industryDb();
  const first = await getIndustries(db);
  assert.equal(first.length, 6);
  assert.ok(first.every(item => item.translations.en.detail && item.translations.de.detail && item.icon));
  await db.collection('experience_industries').updateOne({_id: first[0].id}, {$set: {translations: {en: {label: 'Changed', detail: ''}}}});
  await ensureIndustries(db);
  assert.equal((await getIndustries(db))[0].translations.en.detail, '');
});

test('concurrent migration and retries preserve destination edits', async () => {
  const db = migratedDb();
  await db.collection('experience_industries').updateOne({_id: 'assigned-id'}, {$setOnInsert: {label: 'Edited', translations: {en: {label: 'Edited', detail: 'Keep me'}}, revision: 4}}, {upsert: true});
  await Promise.all([ensureIndustries(db), ensureIndustries(db)]);
  assert.equal((await getIndustries(db)).find(item => item.id === 'assigned-id').translations.en.detail, 'Keep me');
});

test('new industries need only a title, can be described later, and keep references through renames', async () => {
  const db = migratedDb();
  const [first, second] = await Promise.all([createIndustry(db, 'Medical devices'), createIndustry(db, 'medical devices')]);
  assert.equal(first.id, second.id);
  assert.equal(first.translations.en.detail, '');
  const input = {...first, translations: {en: {label: 'Medical technology', detail: 'My experience'}, de: {label: '', detail: ''}}};
  const saved = await updateIndustry(db, input, {email: 'editor@example.com'});
  assert.equal(saved.id, first.id);
  assert.equal(saved.revision, 1);
  assert.equal(saved.translations.en.detail, 'My experience');
  await assert.rejects(updateIndustry(db, input), {status: 409});
  assert.equal((await createIndustry(db, 'Medical technology')).id, first.id);
  assert.equal(db.collections.get('lead_industries').size, 2);
  const summary = experienceSummary([{classifications: {industries: [saved.id]}}], {industries: await getIndustries(db), competencies: []}, 'de');
  assert.equal(summary.industries[0].detail, 'My experience');
  assert.equal(summary.industries[0].label, 'Medical technology');
});

test('industry edits validate titles, descriptions, revisions and icons', () => {
  const input = {id: 'id', revision: 0, icon: '', translations: {en: {label: 'Industry', detail: ''}, de: {label: '', detail: ''}}};
  assert.doesNotThrow(() => normalizeIndustryEdit(input));
  for (const patch of [{revision: -1}, {icon: 'unknown'}, {translations: {en: {label: '', detail: ''}}}, {translations: {en: {label: 'Industry', detail: 'x'.repeat(4001)}}}]) assert.throws(() => normalizeIndustryEdit({...input, ...patch}));
});

test('custom icons persist and reach the localized executive summary', async () => {
  const db = migratedDb();
  const industry = await createIndustry(db, 'Telecommunication');
  const saved = await updateIndustry(db, {...industry, icon: 'telecommunications', translations: {
    en: {label: 'Telecommunication', detail: ''}, de: {label: 'Telekommunikation', detail: ''},
  }});
  const catalog = {industries: await getIndustries(db), competencies: []};
  const entries = [{classifications: {industries: [saved.id]}}];
  assert.equal(experienceSummary(entries, catalog, 'de').industries[0].icon, 'telecommunications');
  await updateIndustry(db, {...saved, icon: ''});
  catalog.industries = await getIndustries(db);
  assert.equal(experienceSummary(entries, catalog, 'de').industries[0].icon, 'telecommunications');
});
