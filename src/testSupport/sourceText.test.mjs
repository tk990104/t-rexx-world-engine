import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { normalizeSourceText, readSourceSync, readSource } from './sourceText.mjs';

test('source normalization treats LF, CRLF and mixed checkouts identically', () => {
  const lf = 'const tools = [\n  "one",\n];\n';
  const crlf = lf.replace(/\n/g, '\r\n');
  const mixed = lf.replace('\n', '\r\n');
  const hash = (text) => createHash('sha256').update(text).digest('hex');
  for (const source of [lf, crlf, mixed]) {
    assert.equal(normalizeSourceText(source), lf);
    assert.equal(hash(normalizeSourceText(source)), hash(lf));
  }
});

test('normalization preserves meaningful content and does not conceal schema changes', () => {
  assert.equal(normalizeSourceText('\ufeff  x\t \r\ny\r'), '\ufeff  x\t \ny\r');
  assert.equal(normalizeSourceText(''), '');
  assert.notEqual(normalizeSourceText('one\r\n'), normalizeSourceText('two\r\n'));
  assert.notEqual(normalizeSourceText('x \r\n'), normalizeSourceText('x\n'));
  assert.notEqual(normalizeSourceText('x\r\n'), normalizeSourceText('x'));
});

test('sync and async source readers support URLs and paths without changing the file', async () => {
  const url = new URL('./sourceText.mjs', import.meta.url);
  const before = readFileSync(url);
  const expected = normalizeSourceText(before.toString('utf8'));
  for (const path of [url, fileURLToPath(url)]) {
    assert.equal(readSourceSync(path), expected);
    assert.equal(await readSource(path), expected);
  }
  assert.deepEqual(readFileSync(url), before);
});

test('source readers propagate missing-file errors instead of empty passing fixtures', async () => {
  const missing = new URL('./sourceText.deliberately-missing', import.meta.url);
  assert.throws(() => readSourceSync(missing), { code: 'ENOENT' });
  await assert.rejects(readSource(missing), { code: 'ENOENT' });
});
