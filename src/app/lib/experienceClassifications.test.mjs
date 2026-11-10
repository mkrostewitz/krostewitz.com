import test from 'node:test';
import assert from 'node:assert/strict';
import {skillAssignmentCoverage, resolveExperienceIndustry, normalizeClassifications, validateExperienceReferences, experienceSummary, countryOptions} from './experienceClassifications.mjs';
import {normalizeTimeline, timelineOperations, readTimeline} from './cvTimelineData.mjs';

import {industryDb} from './test-support/industryDb.mjs';
test('industry resolution preserves existing identifiers and spelling across case and whitespace; new values belong to the Experience catalog', async () => {
  const db = industryDb({site_content: [{_id: 'experience_industries_v1'}], experience_industries: [{_id: 'existing-id', label: 'Industrial Automation'}]});
  assert.deepEqual(await resolveExperienceIndustry(db, '  industrial   automation '), {id: 'existing-id', label: 'Industrial Automation'});
  const [a, b] = await Promise.all([resolveExperienceIndustry(db, 'Warehouse Automation'), resolveExperienceIndustry(db, 'warehouse automation')]);
  assert.deepEqual(a, b);
  assert.equal(db.collections.get('experience_industries').size, 2);
  assert.equal(db.collections.get('experience_industries').get('existing-id').label, 'Industrial Automation');
  await assert.rejects(resolveExperienceIndustry(db, ' '));
});
test('separate ID lists deduplicate and reject arbitrary country names and dangling references', () => {
  assert.equal(countryOptions().length, 249);
  const classifications = normalizeClassifications({industries: ['i', 'i'], countries: ['DE', 'US', 'DE']});
  assert.deepEqual(classifications, {industries: ['i'], competencies: [], countries: ['DE', 'US']});
  assert.throws(() => normalizeClassifications({countries: ['Germany']}));
  assert.throws(() => validateExperienceReferences([{classifications}], {industries: [], competencies: [], countries: countryOptions()}));
});
test('summary counts and drilldown use the same distinct saved records; removals preserve the catalog', () => {
  const catalog = {industries: [{id: 'i', label: 'Automation'}, {id: 'unused', label: 'Other'}], competencies: [{id: 's', label: 'Sales', translations: {de: {label: 'Vertrieb'}}}]};
  const entries = [{classifications: {industries: ['i'], competencies: ['s'], countries: ['DE']}}, {classifications: {industries: ['i'], countries: ['US', 'DE']}}];
  const summary = experienceSummary(entries, catalog, 'de');
  assert.equal(summary.industries.length, 1);
  assert.deepEqual(summary.countries.map(item => item.id).sort(), ['DE', 'US']);
  assert.equal(summary.competencies[0].label, 'Vertrieb');
  assert.deepEqual(experienceSummary([], catalog).industries, []);
  assert.equal(catalog.industries.length, 2);
});
test('assignments survive validation, writes, and reads and can be cleared independently of descriptions', async () => {
  const entry = {id: 'role', classifications: {industries: ['i', 'i'], competencies: ['s'], countries: ['DE']}, translations: {en: {title: 'Role', period: '2020', detail: 'Original description'}}};
  const normalized = normalizeTimeline([entry]);
  const write = timelineOperations(normalized)[0].updateOne;
  const db = {collection: name => name === 'site_content' ? {findOne: async () => ({revision: 1})} : {find: () => ({sort: () => ({toArray: async () => [{_id: 'role', ...write.update.$set}]})})}};
  const read = await readTimeline(db);
  assert.deepEqual(read.entries[0].classifications, normalized[0].classifications);
  assert.equal(read.entries[0].translations.en.detail, 'Original description');
  const cleared = normalizeTimeline([{...entry, classifications: {}}])[0];
  assert.deepEqual(timelineOperations([cleared])[0].updateOne.update.$set.classifications.industries, []);
});

const coverageNow = new Date('2026-11-10T12:00:00Z');
const role = (startDate, endDate, competencies = [], current = false) => ({startDate, endDate, current, classifications: {competencies}});
const coverage = entries => skillAssignmentCoverage(entries, [{id: 'market'}, {id: 'operations'}, {id: 'unused'}], coverageNow);

test('duration outweighs number of positions and unclassified time stays in the denominator', () => {
  const result = coverage([
    role('2020-01', '2023-12', ['market', 'market']),
    role('2024-01', '2024-06', ['operations']),
    role('2024-07', '2024-12', ['operations']),
    role('2025-01', '2025-12'),
  ]);
  assert.equal(result[0].days, 1461);
  assert.equal(result[1].days, 366);
  assert.equal(result[0].totalDays, 2192);
  assert.ok(result[0].percentage > result[1].percentage);
  assert.equal(result[2].percentage, 0);
  assert.equal(result[0].years, 1461 / 365.2425);
});

test('overlapping roles count once per expertise and across total experience', () => {
  const result = coverage([
    role('2024-01', '2024-06', ['market']),
    role('2024-04', '2024-12', ['market', 'operations']),
  ]);
  assert.equal(result[0].days, 366);
  assert.equal(result[0].totalDays, 366);
  assert.equal(result[0].percentage, 100);
  assert.equal(result[1].days, 275);
});

test('current roles run through today; future dates are capped and exact dates are inclusive', () => {
  assert.equal(coverage([role('2026-11-01', '', ['market'], true)])[0].days, 10);
  assert.equal(coverage([role('2026-11-01', '2027-12', ['market'])])[0].days, 10);
  assert.equal(coverage([role('2024-02-29', '2024-02-29', ['market'])])[0].days, 1);
  assert.equal(coverage([role('2027-01', '', ['market'], true)])[0].days, 0);
});

test('legacy explicit months are supported; missing, invalid and reversed dates are excluded', () => {
  const result = coverage([
    {translations: {en: {period: 'Jan 2024 — Feb 2024'}}, classifications: {competencies: ['market']}},
    {},
    role('2024-02-30', '2024-12', ['market']),
    role('2025-01', '2024-01', ['market']),
  ]);
  assert.equal(result[0].days, 60);
  assert.equal(result[0].percentage, 100);
  assert.deepEqual(coverage([])[0], {id: 'market', days: 0, totalDays: 0, years: 0, percentage: 0, engagementPercentage: 0, companies: []});
  assert.deepEqual(skillAssignmentCoverage([], [], coverageNow), []);
});

test('tooltip counts engagements separately from duration and deduplicates localized companies', () => {
  const entries = [
    {...role('2020-01', '2023-12', ['market']), translations: {en: {company: 'Acme'}, de: {company: 'Acme DE'}}},
    {...role('2024-01', '2024-12', ['market']), translations: {en: {company: 'Acme'}, de: {company: 'Acme DE'}}},
    {...role('2025-01', '2025-12'), translations: {en: {company: 'Other'}}},
    {classifications: {competencies: ['market']}, translations: {en: {company: 'Beta'}}},
  ];
  const result = skillAssignmentCoverage(entries, [{id: 'market'}], coverageNow, 'de')[0];
  assert.equal(result.engagementPercentage, 75);
  assert.deepEqual(result.companies, ['Acme DE', 'Beta']);
  assert.notEqual(result.percentage, result.engagementPercentage);
});

test('industries rank by duration with overlapping roles counted once and catalog order breaking ties', () => {
  const catalog = {industries: ['short', 'long', 'overlap', 'tie', 'unused'].map(id => ({id, label: id})), competencies: []};
  const industryRole = (startDate, endDate, industries) => ({startDate, endDate, classifications: {industries}});
  const entries = [
    industryRole('2020-01', '2023-12', ['long']),
    industryRole('2024-01', '2024-06', ['short', 'tie']),
    industryRole('2024-07', '2024-12', ['short', 'tie']),
    industryRole('2024-01', '2024-08', ['overlap']),
    industryRole('2024-01', '2024-08', ['overlap']),
  ];
  assert.deepEqual(experienceSummary(entries, catalog).industries.map(item => item.id), ['long', 'short', 'tie', 'overlap']);
  assert.deepEqual(catalog.industries.map(item => item.id), ['short', 'long', 'overlap', 'tie', 'unused']);
});
