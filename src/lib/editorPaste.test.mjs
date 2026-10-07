import assert from 'node:assert/strict';
import {test} from 'node:test';
import {plainTextToArticleHtml, shouldFormatClipboardText} from './editorPaste.js';

test('formats Markdown and extracts only an explicit title', () => {
  const result = plainTextToArticleHtml('# Article\n\n**Lead**\n\n## Section\n\n> A quote\n\n- One\n- *Two*', {extractTitle: true});
  assert.equal(result.title, 'Article');
  for (const fragment of ['<strong>Lead</strong>', '<h2>Section</h2>', '<blockquote>', '<ul>', '<em>Two</em>']) {
    assert.ok(result.html.includes(fragment), fragment);
  }
  assert.equal(plainTextToArticleHtml('Short sentence\n\nAnother thought', {extractTitle: true}).title, '');
});

test('preserves compact line breaks and paragraph boundaries', () => {
  assert.equal(plainTextToArticleHtml('One\nTwo\n\nThree').html, '<p>One<br />Two</p>\n<p>Three</p>\n');
});

test('keeps a title in the body when the title field is already filled', () => {
  assert.equal(plainTextToArticleHtml('# Article').html, '<h2>Article</h2>\n');
});

test('supports nested lists, tables, links, and code without unsafe markup', () => {
  const {html} = plainTextToArticleHtml('1. One\n   - Nested\n\n| A | B |\n| - | - |\n| C | D |\n\n[Safe](https://example.com) [Unsafe](javascript:alert%281%29)\n\n`**literal**`\n\n<script>alert(1)</script><img src=x onerror=alert(1)>');
  for (const fragment of ['<ol>', '<ul>', '<table>', 'href="https://example.com"', '<code>**literal**</code>']) assert.ok(html.includes(fragment), fragment);
  assert.doesNotMatch(html, /javascript:|<script|<img|onerror/);
});

test('parses plain clipboard wrappers and preserves existing rich text', () => {
  assert.equal(shouldFormatClipboardText({text: '**Bold**', html: '<pre>**Bold**</pre>'}), true);
  assert.equal(shouldFormatClipboardText({text: 'Bold', html: '<p><strong>Bold</strong></p>'}), false);
  assert.equal(shouldFormatClipboardText({text: 'Text'}), true);
});
