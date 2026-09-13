import { MAX_RESEARCH_NOTE_LENGTH } from './researchNotebook.js';

export function createNotebookDraftDownload(text) {
  if (typeof text !== 'string' || !text.length || text.length > MAX_RESEARCH_NOTE_LENGTH) {
    throw new RangeError('A note draft of 1 to 10,000 characters is required.');
  }
  return Object.freeze({ text, filename: 't-rexx-research-note-draft.txt', mimeType: 'text/plain;charset=utf-8' });
}

export function downloadNotebookDraft(file) {
  const url = URL.createObjectURL(new Blob([file.text], { type: file.mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.filename;
  try { anchor.click(); }
  finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
