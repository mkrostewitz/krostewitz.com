import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeTimelineHtml, timelineHtmlText, timelineEditorHtml} from './timelineRichText.mjs';
import {normalizeTimeline, localizeTimeline, timelineOperations} from './cvTimelineData.mjs';

test('legacy text is escaped without interpreting markup', () => {
  assert.equal(timelineEditorHtml({detail: 'A < B\nNext'}, 'detail'), '<p>A &lt; B<br>Next</p>');
  assert.equal(timelineEditorHtml({highlights: ['A & B']}, 'highlights'), '<ul><li><p>A &amp; B</p></li></ul>');
});
test('rich text persists through normalization, storage and localization with plain previews', () => {
  const entries = normalizeTimeline([{id:'role', translations:{de:{title:'Leitung', period:'2026', detailHtml:'<h3>Aufgaben</h3><p><strong>Team</strong> &amp; Kunden</p>', highlightsHtml:'<ol><li><p>Erfolg eins</p></li><li><p><em>Erfolg zwei</em></p></li></ol>'}}}]);
  const localized = localizeTimeline(entries, 'de')[0];
  assert.equal(localized.detail, 'Aufgaben\nTeam & Kunden');
  assert.deepEqual(localized.highlights, ['Erfolg eins', 'Erfolg zwei']);
  assert.match(timelineOperations(entries)[0].updateOne.update.$set.translations.de.detailHtml, /<strong>Team<\/strong>/);
  assert.equal(localizeTimeline(entries, 'en')[0].detailHtml, localized.detailHtml);
});
test('unsafe rich markup is removed and clearing rich content clears legacy text', () => {
  assert.equal(sanitizeTimelineHtml('<p onclick="evil()">Safe<script>evil()</script><img src=x onerror=evil()><a href="javascript:evil()">link</a></p>'), '<p>Safe<a>link</a></p>');
  const entry = normalizeTimeline([{id:'role',translations:{en:{title:'Role',period:'2026',detail:'Old',highlights:['Old'],detailHtml:'<p></p>',highlightsHtml:''}}}])[0];
  assert.equal(entry.translations.en.detail, '');
  assert.deepEqual(entry.translations.en.highlights, []);
  assert.equal(timelineHtmlText('<p>&lt;script&gt;</p>'), '<script>');
  assert.throws(() => normalizeTimeline([{id:'role',translations:{en:{title:'Role',period:'2026',detailHtml:'x'.repeat(50001)}}}]));
});
