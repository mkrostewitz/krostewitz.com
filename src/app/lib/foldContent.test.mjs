import test from 'node:test';
import assert from 'node:assert/strict';
import {validateFoldCopy, validateFoldContent, exportFoldContent, importFoldContent} from './foldContent.mjs';
import {foldSeed, foldDestinations} from './foldSeed.mjs';
import {ensureFold, saveFold} from './foldStorage.mjs';

const source = foldSeed.translations.en;
test('bilingual seed has the requested positioning, accent phrases, and three cards', () => {
  assert.deepEqual(validateFoldContent(foldSeed), foldSeed);
  assert.equal(source.headline.map(s => s.text).join(''), 'Building industrial businesses. From ideas to execution.');
  assert.equal(foldSeed.translations.de.headline.map(s => s.text).join(''), 'Industrieunternehmen entwickeln. Ideen in die Tat umsetzen.');
  for (const copy of Object.values(foldSeed.translations)) {
    assert.equal(copy.headline[1].style, 'accent');
    assert.equal(copy.cards.length, 3);
    assert.doesNotMatch(copy.statement, /USP/);
  }
});
test('rejects markup, unsupported styles, missing languages and malformed cards', () => {
  for (const patch of [
    {subheadline: '<script>alert(1)</script>'}, {statement: ''}, {cards: []}, {cards: [null, null, null]},
    {headline: [{text: 'Hello', style: 'color:red', breakBefore: false}]},
    {headline: [{text: '<span>Hello</span>', style: 'accent', breakBefore: false}]},
  ]) assert.throws(() => validateFoldCopy({...source, ...patch}));
  assert.throws(() => validateFoldContent({...foldSeed, translations: {en: source}}), /German/);
});
test('translation keeps styles, line breaks, and segment count', () => {
  assert.deepEqual(validateFoldCopy(foldSeed.translations.de, source), foldSeed.translations.de);
  assert.throws(() => validateFoldCopy({...source, headline: [source.headline[0]]}, source), /structure/);
  assert.throws(() => validateFoldCopy({...source, headline: source.headline.map(s => ({...s, style: 'muted'}))}, source), /structure/);
});
test('portable JSON round-trips content without URLs, backups, or identity fields', () => {
  const exported = exportFoldContent({...foldSeed, destinations: foldDestinations, migration: {private: true}, _id: 'ignored'});
  assert.deepEqual(importFoldContent(JSON.parse(JSON.stringify(exported))), foldSeed);
  assert.equal(exported.content.destinations, undefined);
  assert.throws(() => importFoldContent({...exported, version: 99}), /version 1/);
});

function fakeDb(records) {
  return {collection: name => {
    assert.equal(name, 'site_content');
    return {
      findOne: async ({_id}) => structuredClone(records[_id] || null),
      updateOne: async ({_id}, update) => {
        if (update.$setOnInsert && !records[_id]) records[_id] = {_id, ...structuredClone(update.$setOnInsert)};
        if (Array.isArray(update)) {
          const previous = structuredClone(records[_id]);
          records[_id] = {...previous, previousContent: {showEyebrow: previous.showEyebrow, translations: previous.translations, updatedAt: previous.updatedAt},
            showEyebrow: update[0].$set.showEyebrow.$literal, translations: structuredClone(update[0].$set.translations.$literal)};
        }
      },
    };
  }};
}
test('migration is repeatable, backs up legacy text, preserves unrelated records and CTA labels', async () => {
  const records = {translations: {_id: 'translations', translations: {en: {offer: {title: 'Old headline'}, buttons: {booking: 'Existing booking'}}, de: {offer: {title: 'Alt'}}}}, profile_settings: {koalendar: {bookingUrl: 'https://koalendar.com/e/existing'}}};
  const before = structuredClone(records);
  const db = fakeDb(records);
  const first = await ensureFold(db);
  assert.equal(first.translations.en.ctaLabels.booking, 'Existing booking');
  assert.equal(first.migration.legacyOffers.en.title, 'Old headline');
  records['homepage-fold'].translations.en.statement = 'An editorial change';
  assert.equal((await ensureFold(db)).translations.en.statement, 'An editorial change');
  assert.deepEqual(records.translations, before.translations);
  assert.deepEqual(records.profile_settings, before.profile_settings);
});
test('production import preserves target destinations and snapshots the previous content', async () => {
  const records = {};
  const db = fakeDb(records);
  await ensureFold(db);
  records['homepage-fold'].destinations.linkedin.url = 'https://www.linkedin.com/in/production';
  const original = structuredClone(records['homepage-fold']);
  await saveFold(db, {...foldSeed, translations: {...foldSeed.translations, en: {...source, statement: 'Reviewed content'}}}, null);
  assert.equal(records['homepage-fold'].destinations.linkedin.url, original.destinations.linkedin.url);
  assert.deepEqual(records['homepage-fold'].previousContent.translations, original.translations);
  assert.equal(records['homepage-fold'].translations.en.statement, 'Reviewed content');
});
