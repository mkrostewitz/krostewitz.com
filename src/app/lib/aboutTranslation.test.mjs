import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAboutTranslation} from './aboutTranslation.mjs';

const source = {headline: 'About', body: 'First<br/><br/><strong>Second</strong>', highlights: ['One', 'Two']};
test('accepts translated content with preserved paragraphs and emphasis', () => {
  const translated = {headline: 'Über mich', body: 'Erstens<br/><br/><strong>Zweitens</strong>', highlights: ['Eins', 'Zwei']};
  assert.deepEqual(validateAboutTranslation(translated, source), translated);
  assert.deepEqual(validateAboutTranslation({...source, highlights: []}).highlights, []);
});
test('rejects missing content, overlong text and malformed highlights without truncating', () => {
  for (const patch of [{headline: ''}, {body: 'x'.repeat(20001)}, {highlights: 'One'}, {highlights: ['']}, {highlights: Array(31).fill('One')}, {highlights: ['x'.repeat(1001)]}]) {
    assert.throws(() => validateAboutTranslation({...source, ...patch}));
  }
});
test('rejects lost highlights and altered markup in model responses', () => {
  assert.throws(() => validateAboutTranslation({...source, highlights: ['One']}, source), /highlights/);
  assert.throws(() => validateAboutTranslation({...source, body: 'Plain text'}, source), /formatting/);
  assert.throws(() => validateAboutTranslation({...source, body: source.body.replace('<strong>', '<strong onclick="bad()">')}, source), /formatting/);
});
