import assert from 'node:assert/strict';
import test from 'node:test';
import { planetaryHourPresentation, renderPlanetaryHour } from './planetaryHourPresentation.js';

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
