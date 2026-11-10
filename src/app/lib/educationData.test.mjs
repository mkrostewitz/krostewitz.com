import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeEducationLanguages, seedEducationLanguages, localizeEducationLanguages} from './educationData.mjs';
const translations = Object.fromEntries(await Promise.all(['en', 'de'].map(async code => [code, JSON.parse(await readFile(new URL(`../../locales/${code}/translation.json`, import.meta.url)))])));
test('education migration preserves current language cards in both languages', () => {
  const languages = seedEducationLanguages(translations);
  for (const code of ['en', 'de']) assert.deepEqual(localizeEducationLanguages(languages, code), translations[code].executiveSummary.languages.list);
});
test('education is authoritative for edits, removals, and empty language lists', () => {
  const languages = seedEducationLanguages(translations);
  languages[0].translations.en.level = 'Updated proficiency';
  const edited = normalizeEducationLanguages(languages.slice(0, 1));
  assert.equal(localizeEducationLanguages(edited, 'en')[0].level, 'Updated proficiency');
  assert.equal(edited.length, 1);
  assert.deepEqual(normalizeEducationLanguages([]), []);
  assert.throws(() => normalizeEducationLanguages([languages[0], {...languages[0], code: languages[0].code.toUpperCase()}]));
  assert.throws(() => normalizeEducationLanguages([{...languages[0], code: 'xx'}]));
});

const {normalizeEducationEntries, publicEducationEntries} = await import('./educationData.mjs');
const qualification = (overrides = {}) => ({id: 'professional-certificate', type: 'certificate', published: true, year: '2024', url: 'https://example.org/credential', translations: {en: {title: 'Professional certificate', institution: 'Training institute', detail: 'Completed professional training.'}, de: {title: '', institution: '', detail: ''}}, ...overrides});
test('qualifications are optional and do not require school credentials', () => {
  assert.deepEqual(normalizeEducationEntries(), []);
  const [entry] = normalizeEducationEntries([qualification()]);
  assert.equal(entry.type, 'certificate');
  assert.equal(entry.year, '2024');
  assert.equal(normalizeEducationEntries([qualification({type: 'school'})])[0].type, 'school');
});
test('public education excludes private entries and preserves ordering and language fallback', () => {
  const entries = normalizeEducationEntries([
    qualification({id: 'private', published: false}),
    qualification({id: 'second'}),
    qualification({id: 'first', translations: {en: {title: 'English title'}, de: {title: 'Deutscher Titel', institution: 'Institut'}}}),
  ]);
  const publicEntries = publicEducationEntries(entries, 'de');
  assert.deepEqual(publicEntries.map(row => row.id), ['second', 'first']);
  assert.equal(publicEntries[0].title, 'Professional certificate');
  assert.equal(publicEntries[1].title, 'Deutscher Titel');
  assert.equal(JSON.stringify(publicEntries).includes('private'), false);
  assert.equal(Object.hasOwn(publicEntries[0], 'translations'), false);
});
test('qualification validation rejects unsafe links, duplicate IDs, malformed types and missing titles', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'https://user:password@example.org']) assert.throws(() => normalizeEducationEntries([qualification({url})]));
  assert.throws(() => normalizeEducationEntries([qualification(), qualification()]));
  for (const overrides of [{type: 'unknown'}, {type: 'toString'}, {published: 'yes'}, {year: '20'}, {translations: {}}, {id: '../invalid'}]) assert.throws(() => normalizeEducationEntries([qualification(overrides)]));
  assert.equal(normalizeEducationEntries([qualification({year: '', url: ''})])[0].year, '');
});
