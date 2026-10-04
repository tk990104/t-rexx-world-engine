import * as Astronomy from 'astronomy-engine';
import { pathToFileURL } from 'node:url';
import { parseSunReference } from './astroeye-sun-references.mjs';
import { readSouthernTransitions, compareSouthernTransitions } from './astroeye-southern-transitions.mjs';

const START = '2024-01-24T00:00:00.000Z', END = '2024-01-27T00:00:00.000Z';
const TOLERANCE_SECONDS = 120;
const LIMIT = 16;
const instant = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString() === value;

/** Complete ordered lists, not nearest-neighbor matching that can reuse a root. */
export function compareSolarEventLists(reference, actual) {
  for (const list of [reference, actual]) {
    if (!Array.isArray(list) || list.length > LIMIT) throw new Error('Invalid solar event list');
    let previous = -Infinity;
    for (const event of list) {
      const ms = Date.parse(event?.utcInstant);
      if (!['rise', 'set'].includes(event?.kind) || !instant(event.utcInstant)
        || ms < Date.parse(START) || ms >= Date.parse(END) || ms <= previous) throw new Error('Invalid solar event list');
      previous = ms;
    }
  }
  const sameCount = reference.length === actual.length;
  const pairs = reference.map((source, index) => {
    const computed = actual[index];
    const errorSeconds = computed ? Math.abs(Date.parse(source.utcInstant) - Date.parse(computed.utcInstant)) / 1000 : null;
    return { kind: source.kind, expected: source.utcInstant, actual: computed?.utcInstant ?? null,
      actualKind: computed?.kind ?? null, errorSeconds,
      crossesUtcDate: computed ? source.utcInstant.slice(0, 10) !== computed.utcInstant.slice(0, 10) : false,
      passed: !!computed && computed.kind === source.kind && errorSeconds <= TOLERANCE_SECONDS };
  });
  return { passed: reference.length > 0 && sameCount && pairs.every(pair => pair.passed),
    sourceCount: reference.length, actualCount: actual.length, toleranceSeconds: TOLERANCE_SECONDS,
    unmatchedActual: actual.slice(reference.length), pairs };
}

/** Enumerate every root in the whole window, including any unexpected extras. */
export function collectSolarWindowEvents(search = Astronomy.SearchRiseSet) {
  const start = Date.parse(START), end = Date.parse(END), observer = new Astronomy.Observer(-70, 0, 0), events = [];
  for (const [kind, direction] of [['rise', 1], ['set', -1]]) {
    let cursor = start, ended = false;
    for (let attempt = 0; attempt <= LIMIT; attempt++) {
      const root = search(Astronomy.Body.Sun, observer, direction, new Date(cursor), (end - cursor) / 86400000);
      if (root === null) { ended = true; break; }
      const ms = root?.date?.getTime();
      if (!Number.isFinite(ms) || ms < cursor || ms > end) throw new Error('Invalid solar window search result');
      if (ms === end) { ended = true; break; } // Half-open window.
      if (attempt === LIMIT || events.length >= LIMIT) throw new Error('Solar window event limit exceeded');
      events.push({ kind, utcInstant: root.date.toISOString() });
      // Same one-second advance as the production stable-root collector; never
      // search from the user's chart instant. Root completeness is tested below.
      cursor = ms + 1000;
      if (cursor >= end) { ended = true; break; }
    }
    if (!ended) throw new Error('Solar window search did not finish');
  }
  return events.sort((a, b) => a.utcInstant.localeCompare(b.utcInstant));
}

export function compareSouthernMidnightWindow(pack = readSouthernTransitions()) {
  // Keep the stricter daily outcomes visible and validate the unchanged pack,
  // including metadata of the genuine two-set day, before window comparison.
  const daily = compareSouthernTransitions(pack).slice(0, 3);
  const reference = [];
  for (const row of pack.cases.slice(0, 3)) {
    for (const entry of row.response.properties.data.sundata) {
      if (!['Rise', 'Set'].includes(entry.phen)) continue;
      const isolated = structuredClone(row);
      isolated.response.properties.data.sundata = [entry];
      const parsed = parseSunReference(isolated, { allowPartial: true });
      reference.push({ kind: entry.phen === 'Rise' ? 'rise' : 'set', utcInstant: parsed.rise ?? parsed.set });
    }
  }
  reference.sort((a, b) => a.utcInstant.localeCompare(b.utcInstant));
  if (reference.length !== 5) throw new Error('Incomplete southern midnight source coverage');
  const actual = collectSolarWindowEvents();
  return { windowStart: START, windowEnd: END, ...compareSolarEventLists(reference, actual),
    dailyClassificationAccepted: false, dailyResults: daily,
    reference, actual, scope: 'Three-day event timing only; daily classifications and short-hour precision are not certified.' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = compareSouthernMidnightWindow();
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}
