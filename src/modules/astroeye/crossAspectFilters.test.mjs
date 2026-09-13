import assert from 'node:assert/strict';
import test from 'node:test';
import { filterCrossChartAspects, normalizeCrossAspectFilters, crossAspectFilterSummary } from './crossAspectFilters.js';
import { compareCrossChartAspects } from './crossChartAspects.js';

const result = { available: true, evaluatedPairs: 144, skippedPairs: 0, warning: '', rows: [
  { aspect: 'conjunction', orb: 0 }, { aspect: 'sextile', orb: 1 },
  { aspect: 'square', orb: 1.00001 }, { aspect: 'sextile', orb: 4 }, { aspect: 'opposition', orb: 8 },
] };

test('defaults preserve every match and combined filters preserve source ordering and inputs', () => {
  const before = JSON.stringify(result);
  assert.deepEqual(filterCrossChartAspects(result).rows, result.rows);
  const filtered = filterCrossChartAspects(result, { aspect: 'sextile', maxOrb: 2 });
  assert.deepEqual(filtered.rows, [result.rows[1]]);
  assert.equal(filtered.totalMatches, 5);
  assert.equal(filtered.evaluatedPairs, 144);
  assert.equal(filtered.skippedPairs, 0);
  assert.match(crossAspectFilterSummary(filtered), /Showing 1 of 5 matches/);
  assert.equal(JSON.stringify(result), before);
});

test('exact-only and inclusive orb filters use raw values, not rounded display values', () => {
  assert.deepEqual(filterCrossChartAspects(result, { maxOrb: 0 }).rows, [result.rows[0]]);
  assert.deepEqual(filterCrossChartAspects(result, { maxOrb: 1 }).rows, result.rows.slice(0, 2));
  assert.deepEqual(filterCrossChartAspects(result, { maxOrb: 8 }).rows, result.rows);
  assert.match(crossAspectFilterSummary(filterCrossChartAspects(result, { aspect: 'trine' })), /Showing 0 of 5 matches/);
});

test('invalid filters fail explicitly and valid settings are immutable copies', () => {
  for (const aspect of ['', 'unknown', null]) assert.throws(() => normalizeCrossAspectFilters({ aspect }), /Unknown aspect/);
  for (const maxOrb of [-1, 9, NaN, Infinity, '1']) assert.throws(() => normalizeCrossAspectFilters({ maxOrb }), /Maximum orb/);
  const input = { aspect: 'square', maxOrb: 1.5 };
  const normalized = normalizeCrossAspectFilters(input);
  input.maxOrb = 8;
  assert.equal(normalized.maxOrb, 1.5);
  assert.ok(Object.isFrozen(normalized));
});

test('filters cannot widen standard limits or make an unavailable comparison valid', () => {
  const left = { engine: 'test', version: '1', zodiac: 'tropical', frame: 'geocentric', houseSystem: 'equal', values: { Sun: 0 } };
  const right = { ...left, values: { Moon: 65 } };
  const filtered = filterCrossChartAspects(compareCrossChartAspects(left, right), { aspect: 'sextile', maxOrb: 8 });
  assert.equal(filtered.rows.length, 0); // A 5° sextile is beyond the standard 4° limit.
  const unavailable = filterCrossChartAspects(compareCrossChartAspects(left, { ...right, version: 'other' }));
  assert.equal(unavailable.available, false);
  assert.equal(unavailable.rows.length, 0);
  assert.match(unavailable.warning, /unavailable/);
});
