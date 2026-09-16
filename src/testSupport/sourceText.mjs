import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

// Source assertions use canonical LF, regardless of Git's checkout line endings.
// Deliberately preserve all other bytes/whitespace, including lone carriage returns.
export function normalizeSourceText(text) {
  return text.replace(/\r\n/g, '\n');
}

export function readSourceSync(path) {
  return normalizeSourceText(readFileSync(path, 'utf8'));
}

export async function readSource(path) {
  return normalizeSourceText(await readFile(path, 'utf8'));
}
