import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAbout} from './aboutData.mjs';

const translations = {
  en: {headline: 'About', body: 'First paragraph\n\nSecond paragraph', highlights: ['One', 'Two']},
  de: {headline: 'Über mich', body: 'Beschreibung', highlights: []},
};

test('seeds existing localized copy without losing paragraphs', () => {
  const about = normalizeAbout({}, {translations});
  assert.deepEqual(about.translations, translations);
  assert.equal(about.photoUrl, '/about-me.jpg');
});

test('round trips uploaded photo and localized edits, preserving an empty highlight list', () => {
  const about = {photoUrl: 'https://example.fra1.digitaloceanspaces.com/site-assets/about/photo.jpg', photoAlt: 'Portrait', translations};
  assert.deepEqual(normalizeAbout(about, {}, {strict: true}), about);
});

test('rejects unsafe photo URLs and incomplete translations', () => {
  for (const photoUrl of ['javascript:alert(1)', 'data:image/svg+xml,test', '//example.com/photo.jpg', 'http://example.com/photo.jpg']) {
    assert.throws(() => normalizeAbout({photoUrl, translations}, {}, {strict: true}), /HTTPS/);
  }
  assert.throws(() => normalizeAbout({translations: {en: translations.en}}, {}, {strict: true}), /DE/);
});

test('removed portrait stays empty when normalized again with defaults', () => {
  const about = normalizeAbout({photoUrl: '', translations}, {}, {strict: true});
  assert.equal(about.photoUrl, '');
  assert.equal(normalizeAbout(about, {photoUrl: '/about-me.jpg'}).photoUrl, '');
});
