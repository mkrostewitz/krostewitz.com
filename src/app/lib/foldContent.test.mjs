import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateFoldCopy, validateFoldTranslations} from './foldContent.mjs';

const source = {title: 'Build <span>growth</span>', subtitle: 'International markets', usp: '15 years of experience', points: ['<strong>Sales</strong><br/>Systems', 'Operations']};
test('accepts both existing homepage languages and limits edits to visible fold fields', () => {
  for (const language of ['en', 'de']) {
    const defaults = JSON.parse(readFileSync(new URL(`../../locales/${language}/translation.json`, import.meta.url), 'utf8'));
    const copy = validateFoldCopy(defaults.offer);
    assert.equal(copy.title, defaults.offer.title);
    assert.deepEqual(Object.keys(copy), ['title', 'subtitle', 'usp', 'points']);
  }
});
test('validates both languages and identifies the language with missing content', () => {
  assert.deepEqual(validateFoldTranslations({en: source, de: source}), {en: source, de: source});
  assert.throws(() => validateFoldTranslations({en: source, de: {...source, title: ''}}), /German/);
  assert.throws(() => validateFoldTranslations({en: source}), /German/);
});
test('rejects invalid arrays, oversized text, active HTML, and incomplete markup', () => {
  for (const patch of [
    {title: ' '}, {title: 'x'.repeat(501)}, {subtitle: 'x'.repeat(3001)}, {usp: null},
    {points: []}, {points: ['']}, {points: Array(13).fill('Point')}, {points: ['x'.repeat(2001)]},
    {title: '<img src=x onerror=alert(1)>'}, {title: '<span onclick="alert(1)">Text</span>'},
    {title: '<script'}, {points: ['<a href="javascript:alert(1)">Click</a>']},
  ]) assert.throws(() => validateFoldCopy({...source, ...patch}));
});
test('translation preserves emphasis and all offering points', () => {
  const translated = {title: 'Baue <span>Wachstum</span>', subtitle: 'Internationale Märkte', usp: '15 Jahre Erfahrung', points: ['<strong>Vertrieb</strong><br/>Systeme', 'Betrieb']};
  assert.deepEqual(validateFoldCopy(translated, source), translated);
  assert.throws(() => validateFoldCopy({...translated, points: ['Betrieb']}, source), /offering points/);
  assert.throws(() => validateFoldCopy({...translated, title: 'Wachstum'}, source), /formatting/);
});

test('accepts visual editor formatting and rejects visually empty content', () => {
  const formatted = {...source, subtitle: '<em>International</em> <u>markets</u>', usp: '<s>Old</s><br>New'};
  assert.deepEqual(validateFoldCopy(formatted), formatted);
  for (const title of ['<strong></strong>', '<br>', '<span>&nbsp;</span>', '<em> </em>']) {
    assert.throws(() => validateFoldCopy({...source, title}), /Enter text/);
  }
});

test('editor paragraphs round-trip as inline hero text with line breaks and highlights', async () => {
  const {foldInlineHtml, foldEditorHtml} = await import('./foldContent.mjs');
  const inline = 'Build <span>growth</span><br><strong>Worldwide</strong>';
  assert.equal(foldInlineHtml('<p>Build <span>growth</span></p><p><strong>Worldwide</strong></p>'), inline);
  assert.equal(foldInlineHtml(foldEditorHtml(inline)), inline);
  assert.equal(foldInlineHtml('One<br/>Two<br />Three'), 'One<br>Two<br>Three');
  assert.equal(foldInlineHtml('<p>One</p><p></p><p>Two</p>'), 'One<br><br>Two');
});
