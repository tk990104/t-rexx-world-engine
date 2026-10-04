import assert from 'node:assert/strict';
import test from 'node:test';
import { planetaryHourPresentation, renderPlanetaryHour } from './planetaryHourPresentation.js';
import { createStablePlanetaryHourCalculator } from './calculation/stablePlanetaryHours.js';

const chart = (instant) => ({ calculatedFor: instant,
  planetaryHour: { status: 'exact', ruler: 'Sun', period: 'day', hourNumber: 1,
    start: '2024-01-01T06:00:00.000Z', end: '2024-01-01T07:00:00.000Z' } });

test('interior hour remains visible with an estimate notice and no record mutation', () => {
  const input = chart('2024-01-01T06:30:00.000Z'), before = JSON.stringify(input);
  assert.equal(planetaryHourPresentation(input).label, 'Sun · day 1');
  assert.equal(planetaryHourPresentation(input).uncertain, false);
  assert.match(planetaryHourPresentation(input).notice, /estimates/);
  assert.equal(JSON.stringify(input), before);
});

test('inclusive one-second edges and excluded interval ends suppress a definitive ruler', () => {
  for (const instant of ['05:59:59.000', '06:00:00.000', '06:00:01.000', '06:59:59.000', '07:00:00.000', '07:00:01.000']) {
    assert.equal(planetaryHourPresentation(chart('2024-01-01T' + instant + 'Z')).label, 'Boundary uncertain');
  }
  for (const instant of ['06:00:01.001', '06:59:58.999']) {
    assert.equal(planetaryHourPresentation(chart('2024-01-01T' + instant + 'Z')).uncertain, false);
  }
});

test('missing, malformed or reversed timing metadata cannot yield a confident label', () => {
  for (const mutate of [
    (c) => { c.calculatedFor = null; }, (c) => { c.planetaryHour.start = null; },
    (c) => { c.planetaryHour.end = 'invalid'; }, (c) => { c.planetaryHour.end = c.planetaryHour.start; },
    (c) => { c.planetaryHour.start = '2025-01-01T00:00:00Z'; },
    (c) => { c.calculatedFor = '2024-01-01T06:30:00'; },
  ]) {
    const input = chart('2024-01-01T06:30:00.000Z'); mutate(input);
    assert.equal(planetaryHourPresentation(input).uncertain, true);
  }
});

test('render clears stale notices and preserves unavailable reasons as literal text', () => {
  const label = { textContent: '' }, notice = { textContent: '', dataset: {} };
  renderPlanetaryHour(label, notice, chart('2024-01-01T07:00:00Z'));
  assert.equal(notice.dataset.uncertain, 'true');
  renderPlanetaryHour(label, notice, chart('2024-01-01T06:30:00Z'));
  assert.equal(notice.dataset.uncertain, 'false');
  assert.doesNotMatch(notice.textContent, /Boundary uncertain/);
  renderPlanetaryHour(label, notice, { planetaryHour: { status: 'unavailable', reason: '<not html>' } });
  assert.equal(label.textContent, 'Unavailable');
  assert.equal(notice.textContent, '<not html>');
});

test('short-hour display cutoff is inclusive, provisional, and does not mutate any model record', () => {
  for (const duration of [50000, 60000, 239999, 240000, 240001]) {
    for (const modelVersion of [1, 2, 3, 4]) {
      const input = chart('2024-01-01T06:00:25.000Z');
      input.calculationVersion = modelVersion;
      input.planetaryHour.end = new Date(Date.parse(input.planetaryHour.start) + duration).toISOString();
      const before = JSON.stringify(input);
      Object.freeze(input.planetaryHour); Object.freeze(input);
      const result = planetaryHourPresentation(input), short = duration <= 240000;
      assert.equal(result.label, short ? 'Sun · day 1 (provisional)' : 'Sun · day 1');
      assert.equal(result.uncertain, short);
      assert.match(result.notice, short ? /not an accuracy guarantee/ : /estimates/);
      assert.equal(JSON.stringify(input), before);
    }
  }
});

test('invalid timing and boundary uncertainty take precedence over the short-hour label', () => {
  for (const instant of ['05:59:59.000', '06:00:00.000', '06:00:01.000', '06:00:49.000', '06:00:50.000']) {
    const input = chart('2024-01-01T' + instant + 'Z');
    input.planetaryHour.end = '2024-01-01T06:00:50.000Z';
    const result = planetaryHourPresentation(input);
    assert.equal(result.label, 'Boundary uncertain');
    assert.doesNotMatch(result.notice, /Short calculated interval/);
  }
});

test('short-hour notices clear on transitions to ordinary, edge and unavailable results', () => {
  const label = { textContent: '' }, notice = { textContent: '', dataset: {} };
  const short = chart('2024-01-01T06:00:25.000Z');
  short.planetaryHour.end = '2024-01-01T06:00:50.000Z';
  for (const next of [chart('2024-01-01T06:30:00.000Z'), chart('2024-01-01T07:00:00Z'), null]) {
    renderPlanetaryHour(label, notice, short);
    assert.match(label.textContent, /provisional/);
    assert.equal(notice.dataset.uncertain, 'true');
    renderPlanetaryHour(label, notice, next);
    assert.deepEqual({ label: label.textContent, notice: notice.textContent, uncertain: notice.dataset.uncertain },
      { ...planetaryHourPresentation(next), uncertain: String(planetaryHourPresentation(next).uncertain) });
    assert.doesNotMatch(notice.textContent, /Short calculated interval/);
  }
});

test('known polar short-day and short-night calculations receive provisional display labels', () => {
  const calculate = createStablePlanetaryHourCalculator();
  for (const [utcInstant, period] of [['2025-01-16T12:10:00Z', 'day'], ['2024-05-16T00:01:50Z', 'night']]) {
    const hour = calculate({ utcInstant, latitude: 70, longitude: 0, timeZone: 'UTC' });
    assert.equal(hour.status, 'exact'); assert.equal(hour.period, period);
    // Check the calculated midpoint, not an independently certified instant.
    const midpoint = new Date((Date.parse(hour.start) + Date.parse(hour.end)) / 2).toISOString();
    const input = { calculatedFor: midpoint, planetaryHour: hour }, before = JSON.stringify(input);
    const result = planetaryHourPresentation(input);
    assert.equal(result.label, `${hour.ruler} · ${period} ${hour.hourNumber} (provisional)`);
    assert.equal(result.uncertain, true);
    assert.equal(JSON.stringify(input), before);
  }
});
