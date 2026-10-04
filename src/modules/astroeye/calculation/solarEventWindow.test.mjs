import assert from 'node:assert/strict';
import test from 'node:test';
import { compareSolarEventLists, collectSolarWindowEvents, compareSouthernMidnightWindow } from '../../../../scripts/astroeye-solar-event-window.mjs';
import { readSouthernTransitions } from '../../../../scripts/astroeye-southern-transitions.mjs';
import { calculatePlanetaryHour } from './planetaryHours.js';

const event = (kind, utcInstant) => ({ kind, utcInstant });
const iso = ms => new Date(ms).toISOString();

test('three-day comparison matches all five events once while retaining the daily disagreement', () => {
  const pack = readSouthernTransitions(), before = JSON.stringify(pack), report = compareSouthernMidnightWindow(pack);
  assert.equal(report.passed, true); assert.equal(report.sourceCount, 5); assert.equal(report.actualCount, 5);
  assert.equal(report.dailyClassificationAccepted, false);
  assert.equal(report.dailyResults[0].passed, false); assert.equal(report.dailyResults[1].passed, null);
  assert.deepEqual(report.pairs.map(pair => pair.kind), ['set', 'rise', 'set', 'rise', 'set']);
  assert.equal(report.pairs.filter(pair => pair.crossesUtcDate).length, 1);
  assert.equal(report.pairs[0].expected, '2024-01-25T00:00:00.000Z');
  assert.equal(report.pairs[0].actual.slice(0, 10), '2024-01-24');
  assert.equal(JSON.stringify(pack), before);
});

test('list comparison detects omitted, extra, reused, reordered, wrong-kind and out-of-tolerance roots', () => {
  const a = event('set', '2024-01-25T00:00:00.000Z'), b = event('rise', '2024-01-25T00:25:00.000Z');
  const source = [a, b], before = JSON.stringify(source);
  assert.equal(compareSolarEventLists(source, source).passed, true);
  assert.equal(compareSolarEventLists(source, [a]).passed, false);
  assert.equal(compareSolarEventLists([a], source).passed, false);
  assert.equal(compareSolarEventLists(source, [a, { ...b, kind: 'set' }]).passed, false);
  assert.throws(() => compareSolarEventLists(source, [a, a]), /Invalid solar/);
  assert.throws(() => compareSolarEventLists(source, [b, a]), /Invalid solar/);
  assert.equal(compareSolarEventLists([a], [{ ...a, utcInstant: iso(Date.parse(a.utcInstant) + 120000) }]).passed, true);
  assert.equal(compareSolarEventLists([a], [{ ...a, utcInstant: iso(Date.parse(a.utcInstant) + 120001) }]).passed, false);
  assert.equal(compareSolarEventLists([], []).passed, false, 'empty evidence is never acceptance');
  assert.equal(JSON.stringify(source), before);
});

test('invalid and out-of-window events fail rather than being filtered away', () => {
  for (const bad of [null, {}, event('rise', 'bad'), event('other', '2024-01-25T00:00:00.000Z'),
    event('rise', '2024-01-23T23:59:59.999Z'), event('rise', '2024-01-27T00:00:00.000Z')]) {
    assert.throws(() => compareSolarEventLists([bad], []), /Invalid solar/);
  }
  assert.throws(() => compareSolarEventLists(Array(17).fill({}), []), /Invalid solar/);
});

test('whole-window enumeration is bounded and rejects stalled or malformed search results', () => {
  assert.deepEqual(collectSolarWindowEvents(() => null), []);
  assert.deepEqual(collectSolarWindowEvents(() => ({ date: new Date('2024-01-27T00:00:00Z') })), []);
  assert.throws(() => collectSolarWindowEvents(() => ({ date: new Date('bad') })), /Invalid solar/);
  assert.throws(() => collectSolarWindowEvents(() => ({ date: new Date('2024-01-24T00:00:00Z') })), /Invalid solar/);
  assert.throws(() => collectSolarWindowEvents((_body, _observer, _direction, cursor) => ({ date: new Date(cursor.getTime() + 1000) })), /limit exceeded/);
  const rows = collectSolarWindowEvents();
  assert.equal(rows.length, 5);
  assert.equal(rows.filter(row => row.kind === 'set').length, 3);
});

test('the independently sourced resumed cycle now checks 24 well-separated planetary-hour midpoints', () => {
  const report = compareSouthernMidnightWindow(), points = report.reference;
  const [rise, set, nextRise] = [points[1], points[2], points[3]].map(row => Date.parse(row.utcInstant));
  const rulers = ['Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon', 'Saturn'];
  for (let i = 0; i < 24; i++) {
    const night = i >= 12, start = night ? set : rise, end = night ? nextRise : set;
    const length = (end - start) / 12, edge = start + (i % 12) * length, instant = edge + length / 2;
    assert.ok(length / 2 > report.toleranceSeconds * 1000);
    const hour = calculatePlanetaryHour({ utcInstant: iso(instant), latitude: -70, longitude: 0, timeZone: 'UTC' });
    assert.equal(hour.status, 'exact'); assert.equal(hour.hourNumber, i + 1);
    assert.equal(hour.period, night ? 'night' : 'day'); assert.equal(hour.dayRuler, 'Jupiter');
    assert.equal(hour.ruler, rulers[i % 7]);
    assert.ok(Date.parse(hour.start) <= instant && instant < Date.parse(hour.end));
    assert.ok(Math.abs(Date.parse(hour.start) - edge) <= 120000);
    assert.ok(Math.abs(Date.parse(hour.end) - edge - length) <= 120000);
  }
});

test('changing the multi-event source timing cannot pass merely because the daily case was unresolved', () => {
  const pack = readSouthernTransitions();
  pack.cases[1].response.properties.data.sundata.find(row => row.phen === 'Rise').time = '00:30';
  const report = compareSouthernMidnightWindow(pack);
  assert.equal(report.passed, false); assert.equal(report.pairs[1].passed, false);
});
