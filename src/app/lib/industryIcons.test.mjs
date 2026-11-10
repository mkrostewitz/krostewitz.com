import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveIndustryIcon} from './industryIcons.mjs';

test('automatic icons cover the current industries and remain stable across languages', () => {
  const examples = {
    Automotive: 'automotive', 'Electronics Manufacturing': 'electronics',
    Advertisement: 'advertisement', 'Industrial automation': 'automation',
    Mobility: 'mobility', 'Process automation': 'process',
    'Rides & Attractions': 'attractions', Telecommunication: 'telecommunications',
    'Traffic & transportation': 'infrastructure', 'Warehouse automation': 'intralogistics',
  };
  for (const [label, expected] of Object.entries(examples)) {
    assert.equal(resolveIndustryIcon({label}), expected);
    assert.equal(resolveIndustryIcon({label: 'Translated title', translations: {en: {label}}}), expected);
  }
  assert.equal(resolveIndustryIcon({label: 'Automotive', icon: 'mobility'}), 'mobility');
  assert.equal(resolveIndustryIcon({label: 'New industry', icon: 'unknown'}), 'factory');
});
