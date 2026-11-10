import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeReferences, publicReferences} from './references.mjs';

const entry = {id: 'one', name: 'Jane Doe', company: 'Example', quote: 'A trusted colleague.\nA strong leader.', date: '2026-10-12'};
const settings = {mode: 'carousel', items: [entry]};

test('legacy profiles have no references and default to cards', () => {
  assert.deepEqual(normalizeReferences(), {mode: 'cards', items: []});
  assert.deepEqual(publicReferences({}), {mode: 'cards', items: []});
});

test('disabled references are excluded from public data without deleting stored entries', () => {
  const profile = {references: settings, referencesEnabled: false};
  assert.deepEqual(publicReferences(profile), {mode: 'carousel', items: []});
  assert.equal(profile.references.items.length, 1);
  assert.equal(publicReferences({...profile, referencesEnabled: true}).items[0].quote, entry.quote);
});

test('order, multiline recommendations, optional fields and selected layout survive normalization', () => {
  const result = normalizeReferences({mode: 'cards', items: [entry, {...entry, id: 'two', name: 'Other'}]}, {strict: true});
  assert.deepEqual(result.items.map(item => item.id), ['one', 'two']);
  assert.equal(result.items[0].quote, entry.quote);
  assert.equal(result.items[0].photoUrl, '');
});

test('rejects unsafe URLs and non-LinkedIn profile links', () => {
  for (const url of ['javascript:alert(1)', 'data:image/svg+xml,x', '//evil.example', 'https://user:pass@example.com']) {
    assert.throws(() => normalizeReferences({...settings, items: [{...entry, photoUrl: url}]}, {strict: true}));
  }
  for (const url of ['https://linkedin.com.evil.example/in/jane', 'https://example.com']) {
    assert.throws(() => normalizeReferences({...settings, items: [{...entry, linkedinUrl: url}]}, {strict: true}));
  }
  assert.equal(normalizeReferences({...settings, items: [{...entry, linkedinUrl: 'https://www.linkedin.com/in/jane'}]}, {strict: true}).items[0].linkedinUrl, 'https://www.linkedin.com/in/jane');
});

test('rejects incomplete, duplicate, excessive and malformed entries', () => {
  for (const data of [null, {}, {mode: 'unknown', items: []}, {...settings, items: [{...entry, name: ''}]}, {...settings, items: [{...entry, quote: ''}]}, {...settings, items: [entry, entry]}, {...settings, items: Array(51).fill(entry)}, {...settings, items: [{...entry, date: '2026-02-30'}]}, {...settings, items: [{...entry, quote: 'x'.repeat(10001)}]}]) {
    assert.throws(() => normalizeReferences(data, {strict: true}));
  }
});

test('translations preserve the original and shared identity fields', async () => {
  const {localizeReference} = await import('./references.mjs');
  const normalized = normalizeReferences({mode: 'cards', items: [{...entry, role: 'Director', sourceLanguage: 'en', translations: {de: {quote: 'Ein geschätzter Kollege.', role: 'Geschäftsführer', relationship: 'Im selben Team'}}}]}, {strict: true}).items[0];
  assert.equal(normalized.quote, entry.quote);
  assert.equal(localizeReference(normalized, 'de-DE').quote, 'Ein geschätzter Kollege.');
  assert.equal(localizeReference(normalized, 'de').name, entry.name);
  assert.equal(localizeReference(normalized, 'en').role, 'Director');
  assert.equal(localizeReference(normalized, 'fr').quote, entry.quote);
});

test('legacy entries and incomplete translations fall back to original text', async () => {
  const {localizeReference} = await import('./references.mjs');
  const legacy = normalizeReferences(settings).items[0];
  assert.equal(legacy.sourceLanguage, 'en');
  assert.equal(localizeReference(legacy, 'de').quote, entry.quote);
  const partial = {...legacy, role: 'Director', translations: {de: {role: 'Geschäftsführer', quote: ' '}}};
  assert.equal(localizeReference(partial, 'de').quote, entry.quote);
  assert.equal(localizeReference(partial, 'de').role, 'Geschäftsführer');
});

test('German originals can carry English translations and invalid translations are rejected', async () => {
  const {localizeReference} = await import('./references.mjs');
  const item = {...entry, sourceLanguage: 'de', quote: 'Sehr zuverlässig.', translations: {en: {quote: 'Very reliable.'}}};
  const normalized = normalizeReferences({mode: 'cards', items: [item]}, {strict: true}).items[0];
  assert.equal(localizeReference(normalized, 'en-US').quote, 'Very reliable.');
  assert.equal(localizeReference(normalized, 'de').quote, 'Sehr zuverlässig.');
  assert.throws(() => normalizeReferences({mode: 'cards', items: [{...item, translations: {en: {quote: 'x'.repeat(10001)}}}]}, {strict: true}));
  assert.throws(() => normalizeReferences({mode: 'cards', items: [{...item, translations: {en: null}}]}, {strict: true}));
});

test('display separates an embedded LinkedIn URL without mutating original or translated records', async () => {
  const {referencePresentation, localizeReference} = await import('./references.mjs');
  const link = 'https://www.linkedin.com/in/example/';
  const item = {...entry, role: `VP Operations${link}`, linkedinUrl: link, translations: {de: {role: `Vizepräsident${link}`}}};
  const before = structuredClone(item);
  assert.equal(referencePresentation(item).role, 'VP Operations');
  assert.equal(referencePresentation(localizeReference(item, 'de')).role, 'Vizepräsident');
  assert.equal(referencePresentation({...item, linkedinUrl: ''}).linkedinUrl, link);
  assert.equal(referencePresentation(item).quote, entry.quote);
  assert.deepEqual(item, before);
  assert.equal(referencePresentation({...item, role: 'https://linkedin.com.evil.test/in/x'}).role, 'https://linkedin.com.evil.test/in/x');
});
