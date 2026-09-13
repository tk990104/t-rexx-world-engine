import { captureComparison } from './chartComparison.js';
import { MAX_RESEARCH_NOTE_LENGTH } from './researchNotebook.js';

const quote = (value) => JSON.stringify(value).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

/** Field-only static reference, not a link or complete reproducible chart backup. */
export function createNotebookChartReference(event, chart) {
  const snapshot = captureComparison(event, chart);
  return [
    '[AstroEye chart reference]',
    `Event: ${quote(snapshot.title)}`,
    `Chart time (UTC): ${snapshot.calculatedFor}`,
    `Engine: ${quote(snapshot.engine)}; version: ${quote(snapshot.version)}`,
    `Calculation model: ${snapshot.calculationVersion}`,
    `Zodiac: ${quote(snapshot.zodiac)}; reference frame: ${quote(snapshot.frame)}`,
    `House system: ${quote(snapshot.houseSystem)}`,
    'Static reference to the displayed chart (may be an unsaved time preview). Not a chart backup or live link.',
  ].join('\n');
}

export function appendNotebookChartReference(draft, reference) {
  if (typeof draft !== 'string' || typeof reference !== 'string' || !reference) throw new TypeError('A note draft and chart reference are required.');
  const next = `${draft}${draft ? '\n\n' : ''}${reference}\n`;
  if (next.length > MAX_RESEARCH_NOTE_LENGTH) throw new RangeError('The chart reference would exceed 10,000 characters. Shorten your draft first; nothing was appended.');
  return next;
}
