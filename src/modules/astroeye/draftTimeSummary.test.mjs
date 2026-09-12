import assert from 'node:assert/strict';
import test from 'node:test';
import { describeDraftTime } from './draftTimeSummary.js';

test('incomplete drafts do not imply a UTC start', () => {
  for (const input of [{}, { localDate: '2026-09-12', localTime: '12:00', timeZone: ' ' }]) {
    const result = describeDraftTime(input);
    assert.equal(result.state, 'incomplete');
    assert.equal(result.utcStart, undefined);
  }
});

for (const [timeZone, localDate, localTime, utcStart, offset] of [
  ['America/New_York', '2026-01-12', '23:30:15', '2026-01-13T04:30:15.000Z', 'UTC-05:00'],
  ['America/New_York', '2026-07-12', '12:00', '2026-07-12T16:00:00.000Z', 'UTC-04:00'],
  ['Asia/Kathmandu', '2026-09-12', '00:15', '2026-09-11T18:30:00.000Z', 'UTC+05:45'],
  ['Australia/Adelaide', '2026-01-12', '12:00', '2026-01-12T01:30:00.000Z', 'UTC+10:30'],
  ['UTC', '2026-09-12', '00:00', '2026-09-12T00:00:00.000Z', 'UTC+00:00'],
]) {
  test(`exact draft summary handles ${timeZone} at ${localDate}`, () => {
    const result = describeDraftTime({ timeZone, localDate, localTime });
    assert.equal(result.state, 'ready');
    assert.equal(result.utcStart, utcStart);
    assert.ok(result.text.includes(offset));
    assert.ok(result.text.includes(utcStart.replace('T', ' ').replace('.000Z', ' UTC')));
  });
}

test('repeated hours require an exact valid choice and distinguish both offsets', () => {
  const input = { localDate: '2026-11-01', localTime: '01:30:15', timeZone: 'America/New_York' };
  assert.equal(describeDraftTime(input).state, 'ambiguous');
  assert.equal(describeDraftTime({ ...input, utcStart: '2026-11-01T07:30:15.000Z' }).state, 'ambiguous');
  const first = describeDraftTime({ ...input, utcStart: '2026-11-01T05:30:15.000Z' });
  const second = describeDraftTime({ ...input, utcStart: '2026-11-01T06:30:15.000Z' });
  assert.match(first.text, /First occurrence.*UTC-04:00/);
  assert.match(second.text, /Second occurrence.*UTC-05:00/);
});

test('gaps and invalid calendar/zone inputs have no resolved UTC start', () => {
  const input = { localDate: '2026-03-08', localTime: '02:30', timeZone: 'America/New_York' };
  assert.equal(describeDraftTime(input).state, 'nonexistent');
  for (const value of [input, { ...input, timeZone: 'Mars/Olympus' }, { ...input, localDate: '2026-02-30' }]) {
    const result = describeDraftTime(value);
    assert.notEqual(result.state, 'ready');
    assert.equal(result.utcStart, undefined);
  }
});
