import assert from 'node:assert/strict';
import test from 'node:test';
import { createNotebookDraftDownload } from './notebookDraftDownload.js';

test('draft download preserves exact text, whitespace, Unicode and reference blocks without wrappers', () => {
  for (const text of ['  My notes\n\n', 'α 🌍 <script>literal</script>', '[AstroEye chart reference]\nEvent: "Sample"\n', ' ']) {
    const result = createNotebookDraftDownload(text);
    assert.deepEqual(result, { text, filename: 't-rexx-research-note-draft.txt', mimeType: 'text/plain;charset=utf-8' });
    assert.ok(Object.isFrozen(result));
    assert.deepEqual(result, createNotebookDraftDownload(text));
  }
});

test('empty, invalid and oversized downloads are refused rather than truncated', () => {
  for (const text of ['', null, undefined, {}, 42, 'x'.repeat(10001)]) assert.throws(() => createNotebookDraftDownload(text), /1 to 10,000/);
  assert.equal(createNotebookDraftDownload('x'.repeat(10000)).text.length, 10000);
});
