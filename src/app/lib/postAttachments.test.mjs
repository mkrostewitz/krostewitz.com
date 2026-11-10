import test from 'node:test';
import assert from 'node:assert/strict';
import {documentMimeType, normalizeAttachments, MAX_DOCUMENT_BYTES} from './postAttachments.mjs';
const asset = {url: 'https://files.example.com/report.pdf', fileName: 'report.pdf', size: 1234, key: 'documents/report.pdf'};

test('old posts have no attachments and duplicates are removed', () => {
  assert.deepEqual(normalizeAttachments(undefined), []);
  const result = normalizeAttachments([asset, asset]);
  assert.equal(result.length, 1);
  assert.equal(result[0].fileName, 'report.pdf');
  assert.equal(result[0].mimeType, 'application/pdf');
});
test('rejects unsafe links, unsupported documents, and invalid sizes', () => {
  for (const patch of [{url: 'javascript:alert(1)'}, {url: 'data:text/html,hello'}, {url: 'https://user:pass@example.com/a'}, {fileName: 'script.html'}, {fileName: 'constructor'}, {size: 0}, {size: MAX_DOCUMENT_BYTES + 1}]) {
    assert.throws(() => normalizeAttachments([{...asset, ...patch}]));
  }
  assert.throws(() => normalizeAttachments({}));
});
test('supports document extensions regardless of case', () => {
  for (const extension of ['PDF', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv']) {
    assert.ok(documentMimeType(`file.${extension}`));
  }
  assert.equal(documentMimeType('file.exe'), null);
});
