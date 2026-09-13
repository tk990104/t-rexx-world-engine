import assert from 'node:assert/strict';
import test from 'node:test';
import { createCalculationDateRange } from './dateRange.js';
import { resolveZonedLocalTime } from '../../../domain/events/eventSchema.js';

test('range configuration is explicit, ordered and immutable without choosing a default policy', () => {
  for (const config of [undefined, {}, { firstYear: 2001, lastYear: 2000 }, { firstYear: 99, lastYear: 2000 },
    { firstYear: 2000, lastYear: 10000 }, { firstYear: '2000', lastYear: 2001 }, { firstYear: NaN, lastYear: 2001 },
    { firstYear: 2000, lastYear: 2001.5 }]) assert.throws(() => createCalculationDateRange(config), /integer years/);
  const config = { firstYear: 2000, lastYear: 2001 }, range = createCalculationDateRange(config);
  config.firstYear = 2020;
  assert.equal(range.firstYear, 2000);
  assert.equal(range.startInclusive, '2000-01-01T00:00:00.000Z');
  assert.equal(range.endExclusive, '2002-01-01T00:00:00.000Z');
  assert.ok(Object.isFrozen(range));
});

test('UTC range edges include the first millisecond and exclude the next year', () => {
  const range = createCalculationDateRange({ firstYear: 2000, lastYear: 2001 });
  for (const [instant, status] of [
    ['1999-12-31T23:59:59.999Z', 'before-range'], ['2000-01-01T00:00:00Z', 'within-range'],
    ['2001-12-31T23:59:59.999Z', 'within-range'], ['2002-01-01T00:00:00Z', 'after-range'],
  ]) {
    const result = range.assess(instant);
    assert.equal(result.status, status);
    assert.ok(Object.isFrozen(result));
    if (status === 'within-range') assert.equal(range.requireInstant(instant), new Date(instant).toISOString());
    else assert.throws(() => range.requireInstant(instant), /outside 2000–2001 UTC/);
  }
});

test('date assessment rejects coercion, implicit zones, rollovers and unsupported precision', () => {
  const range = createCalculationDateRange({ firstYear: 2000, lastYear: 2001 });
  for (const value of [null, undefined, 0, new Date(), {}, '', '2000-01-01', '2000-01-01T12:00:00',
    '2000-01-01T12:00:00+00:00', '2000-02-30T00:00:00Z', '2001-02-29T00:00:00Z',
    '2000-01-01T24:00:00Z', '2000-01-01T00:00:60Z', '2000-01-01T00:00:00.1234Z',
    ' 2000-01-01T00:00:00Z', '+002000-01-01T00:00:00Z']) {
    assert.deepEqual(range.assess(value), { status: 'invalid', utcInstant: null });
    assert.throws(() => range.requireInstant(value), /explicit UTC instant/);
  }
  assert.equal(range.requireInstant('2000-02-29T12:00:00.1Z'), '2000-02-29T12:00:00.100Z');
  assert.equal(range.requireInstant('2000-02-29T12:00:00.12Z'), '2000-02-29T12:00:00.120Z');
});

test('single-year and representational extremes avoid Date.UTC two-digit-year remapping', () => {
  const early = createCalculationDateRange({ firstYear: 100, lastYear: 100 });
  assert.equal(early.requireInstant('0100-01-01T00:00:00Z'), '0100-01-01T00:00:00.000Z');
  const late = createCalculationDateRange({ firstYear: 9999, lastYear: 9999 });
  assert.equal(late.endExclusive, '+010000-01-01T00:00:00.000Z');
  assert.equal(late.assess('9999-12-31T23:59:59.999Z').status, 'within-range');
});

test('resolved UTC date controls policy, not a venue-local year on either side of midnight', () => {
  const range = createCalculationDateRange({ firstYear: 2000, lastYear: 2001 });
  for (const [localDate, localTime, timeZone, expected] of [
    ['2000-01-01', '00:30', 'Pacific/Kiritimati', 'before-range'],
    ['1999-12-31', '23:30', 'America/New_York', 'within-range'],
    ['2002-01-01', '00:30', 'Pacific/Kiritimati', 'within-range'],
    ['2001-12-31', '23:30', 'America/New_York', 'after-range'],
  ]) {
    const resolved = resolveZonedLocalTime({ localDate, localTime, timeZone });
    assert.equal(resolved.status, 'exact');
    assert.equal(range.assess(resolved.candidates[0]).status, expected);
  }
});

test('preview instants must be assessed separately from in-range kickoff times', () => {
  const range = createCalculationDateRange({ firstYear: 2000, lastYear: 2001 });
  const kickoff = '2000-01-01T00:00:00.000Z';
  assert.equal(range.assess(kickoff).status, 'within-range');
  const preview = new Date(Date.parse(kickoff) - 60000).toISOString();
  assert.equal(range.assess(preview).status, 'before-range');
  assert.equal(kickoff, '2000-01-01T00:00:00.000Z');
});
