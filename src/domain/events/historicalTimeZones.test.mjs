import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolveZonedLocalTime, normalizeEvent, serializeEvent, parseEventJson } from './eventSchema.js';
import { describeDraftTime } from '../../modules/astroeye/draftTimeSummary.js';
import { calculateTimePreview } from '../../modules/astroeye/timeExplorer.js';
import { createSharedView, encodeSharedView, decodeSharedView } from '../../modules/astroeye/shareView.js';

const pack = JSON.parse(readFileSync(new URL('./fixtures/historical-time-zones.json', import.meta.url), 'utf8'));
const eventInput = (row, utcStart) => ({ id: row.id, title: 'Synthetic historical-zone test', sport: 'Demo', competition: 'QA',
  participants: { home: 'A', away: 'B' }, scheduledLocal: { date: row.localDate, time: row.localTime, timeZone: row.timeZone },
  venue: { name: 'Synthetic', latitude: 10, longitude: 0 }, ...(utcStart ? { utcStart } : {}) });

test('historical-zone reference provenance and case count remain explicit', () => {
  assert.equal(pack.schemaVersion, 1);
  assert.equal(pack.source.id, 'iana-tzdb');
  assert.equal(pack.source.version, '2026d');
  assert.equal(pack.source.retrievedOn, '2026-09-13');
  assert.equal(pack.cases.length, 16);
  assert.equal(new Set(pack.cases.map((r) => r.id)).size, 16);
  assert.equal(pack.source.excerpts.length, 2);
  assert.ok(pack.source.excerpts.every((r) => r.url.startsWith('https://data.iana.org/time-zones/tzdb/') && r.lines.length));
});

for (const row of pack.cases) {
  test(`IANA-derived historical conversion: ${row.id}`, () => {
    const untouched = JSON.stringify(row), resolved = resolveZonedLocalTime(row);
    assert.equal(resolved.status, row.status);
    assert.deepEqual(resolved.candidates, row.candidates);
    assert.equal(row.offsets.length, row.candidates.length);
    const summary = describeDraftTime(row);
    if (row.status === 'nonexistent') {
      assert.equal(summary.state, 'nonexistent');
      assert.throws(() => normalizeEvent(eventInput(row)), /does not exist/);
    } else {
      if (row.status === 'ambiguous') {
        assert.equal(summary.state, 'ambiguous');
        assert.throws(() => normalizeEvent(eventInput(row)), /ambiguous/);
        assert.throws(() => normalizeEvent(eventInput(row, '2000-01-01T00:00:00.000Z')), /does not match either/);
      }
      for (const [index, utcStart] of row.candidates.entries()) {
        const event = normalizeEvent(eventInput(row, utcStart));
        assert.equal(event.utcStart, utcStart);
        assert.equal(serializeEvent(parseEventJson(serializeEvent(event))), serializeEvent(event));
        const chosen = describeDraftTime({ ...row, utcStart });
        if (row.id === 'kathmandu-range-edge') assert.equal(chosen.state, 'out-of-range');
        else {
          assert.equal(chosen.state, 'ready');
          assert.ok(chosen.text.includes(row.offsets[index]), chosen.text);
          const shared = createSharedView(event);
          assert.deepEqual(decodeSharedView(encodeSharedView(shared)), shared);
        }
      }
    }
    assert.equal(JSON.stringify(row), untouched);
  });
}

test('historical folds retain non-hour occurrence separation', () => {
  for (const [id, seconds] of [['kathmandu-fold-start', 676], ['kwajalein-long-fold', 23 * 3600]]) {
    const row = pack.cases.find((r) => r.id === id), result = resolveZonedLocalTime(row);
    assert.equal((Date.parse(result.candidates[1]) - Date.parse(result.candidates[0])) / 1000, seconds);
  }
});

test('time previews cross a skipped civil day and a quarter-hour jump without editing source events', () => {
  for (const [id, expectedUtc, localDate, localTime] of [
    ['apia-before-skip', '2011-12-30T10:00:59.000Z', '2011-12-31', '00:00:59'],
    ['kathmandu-before-gap', '1985-12-31T18:30:59.000Z', '1986-01-01', '00:15:59'],
  ]) {
    const row = pack.cases.find((r) => r.id === id), event = normalizeEvent(eventInput(row));
    const untouched = serializeEvent(event), chart = calculateTimePreview(event, 1);
    assert.equal(chart.calculatedFor, expectedUtc);
    const local = resolveZonedLocalTime({ timeZone: row.timeZone, localDate, localTime });
    assert.deepEqual(local.candidates, [chart.calculatedFor]);
    assert.equal(serializeEvent(event), untouched);
  }
});
