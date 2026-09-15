import assert from 'node:assert/strict';
import test from 'node:test';
import { uncachedChartCases } from './qa-astroeye-uncached-cases.mjs';
import { calculateAstroEyeChart } from '../src/modules/astroeye/calculation/chart.js';

test('uncached pack covers six distinct hemisphere/zone/polar inputs with detached copies', () => {
  const cases = uncachedChartCases();
  assert.equal(cases.length, 6); assert.equal(new Set(cases.map(({ event }) => event.id)).size, 6);
  assert.equal(cases.filter(({ polar }) => polar).length, 2);
  assert.ok(cases.some(({ event }) => event.venue.latitude < 0));
  assert.ok(cases.some(({ event }) => event.scheduledLocal.timeZone === 'Asia/Kathmandu'));
  assert.throws(() => { cases[0].event.venue.name = 'caller edit'; }, TypeError);
  assert.notEqual(cases[0].event, uncachedChartCases()[0].event);
  assert.notEqual(uncachedChartCases()[0].event.venue.name, 'caller edit');
});
test('both fold fixtures keep identical local times and distinct UTC occurrences', () => {
  const [first, second] = uncachedChartCases();
  assert.deepEqual(first.event.scheduledLocal, second.event.scheduledLocal);
  assert.equal(first.event.utcStart, '2026-11-01T05:30:00.000Z');
  assert.equal(second.event.utcStart, '2026-11-01T06:30:00.000Z');
});
test('all twelve case/house combinations calculate current-model charts with explicit polar unavailability', () => {
  for (const entry of uncachedChartCases()) for (const houseSystem of ['whole-sign', 'equal']) {
    const chart = calculateAstroEyeChart(entry.event, { houseSystem });
    assert.equal(chart.calculationVersion, 4); assert.equal(chart.options.houseSystem, houseSystem);
    assert.equal(chart.positions.length, 10); assert.equal(chart.calculatedFor, entry.event.utcStart);
    assert.equal(chart.planetaryHour.status, entry.polar ? 'unavailable' : 'exact');
  }
});
