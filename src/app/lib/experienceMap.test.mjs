import test from 'node:test';
import assert from 'node:assert/strict';
import {experienceMapData} from './experienceMap.mjs';
const feature = (id, iso3, coordinates) => ({properties: {iso_3166_1: id, iso_3166_1_alpha_3: iso3}, geometry: {type: 'Polygon', coordinates: [coordinates]}});
const regions = [{iso3: 'AAA', status: 'lived', center: [-90, 30]}, {iso3: 'BBB', status: 'worked', center: [120, -20]}];
const features = [feature('AA', 'AAA', [[-110, 20], [-80, 40]]), feature('BB', 'BBB', [[110, -40], [140, 10]]), feature('CC', 'CCC', [[10, 30], [20, 50]])];
test('bounds include both hemispheres without wrapping across the Pacific; membership is database-driven', () => {
  const countries = [{id: 'AA', label: 'A'}, {id: 'BB', label: 'B'}, {id: 'CC', label: 'C'}];
  const before = structuredClone(countries);
  const data = experienceMapData(countries, features, regions);
  assert.deepEqual(data.bounds, [[-110, -40], [140, 50]]);
  assert.deepEqual(data.lived, ['AA']);
  assert.deepEqual(data.worked, ['BB']);
  assert.equal(data.labels.features.length, 3);
  assert.deepEqual(countries, before);
  const removed = experienceMapData([{id: 'CC', label: 'C'}], features, regions);
  assert.deepEqual(removed.lived, []);
  assert.deepEqual(removed.worked, []);
  assert.deepEqual(removed.bounds, [[10, 30], [20, 50]]);
});
test('missing or dateline-spanning geometry uses a global overview', () => {
  for (const [countries, geometry] of [[[], []], [[{id: 'ZZ'}], features], [[{id: 'AA'}], [feature('AA', 'AAA', [[-179, 10], [179, 70]])]]]) {
    assert.deepEqual(experienceMapData(countries, geometry, regions).bounds, [[-180, -60], [180, 85]]);
  }
});

test('latest CV country uses dates, not display order, and ignores future roles', async () => {
  const {latestExperienceCountry} = await import('./experienceMap.mjs');
  const role = (country, startDate, endDate, current = false) => ({startDate, endDate, current, classifications: {countries: [country]}});
  const entries = [role('AA', '2020-01', '2024-01'), role('BB', '2022-01', '2027-01'), role('CC', '2027-01', '2028-01')];
  const before = structuredClone(entries);
  assert.equal(latestExperienceCountry(entries, new Date('2026-11-10')), 'BB');
  assert.equal(latestExperienceCountry([...entries].reverse(), new Date('2026-11-10')), 'BB');
  assert.equal(latestExperienceCountry([role('AA', '2020-01', '', true), role('BB', '2023-01', '', true)], new Date('2026-11-10')), 'BB');
  assert.deepEqual(entries, before);
  assert.equal(latestExperienceCountry([]), null);
  assert.equal(latestExperienceCountry([{...entries[1], classifications: {countries: ['AA', 'BB']}}], new Date('2026-11-10')), null);
});

test('initial country center comes from matching map geometry, with a safe fallback', () => {
  const countries = [{id: 'AA'}, {id: 'CC'}];
  assert.deepEqual(experienceMapData(countries, features, regions, 'AA').initialCenter, [-90, 30]);
  assert.deepEqual(experienceMapData(countries, features, regions, 'CC').initialCenter, [15, 40]);
  assert.equal(experienceMapData(countries, features, regions, 'BB').initialCenter, null);
});
