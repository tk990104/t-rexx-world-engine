import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateAstroEyeChart } from './calculation/chart.js';
import { createChartWheelModel } from './chartWheel.js';

const EVENT = {
  id: 'wheel-event', title: 'Away at Home', sport: 'Football', competition: 'Test League',
  participants: { away: 'Away', home: 'Home' },
  scheduledLocal: { date: '2026-09-09', time: '20:15', timeZone: 'America/New_York' },
  venue: { name: 'Test Stadium', latitude: 40.7505, longitude: -73.9934, coordinateSource: 'user-confirmed' },
  source: { kind: 'manual' },
};

test('chart wheel model contains all signs, houses, bodies, and linked aspects', () => {
  const chart = calculateAstroEyeChart(EVENT);
  const wheel = createChartWheelModel(chart);
  assert.equal(wheel.zodiac.length, 12);
  assert.equal(wheel.houses.length, 12);
  assert.equal(wheel.bodies.length, 10);
  assert.equal(wheel.aspects.length, chart.aspects.length);
  assert.ok(wheel.bodies.every(({ point }) => Number.isFinite(point.x) && Number.isFinite(point.y)));
});

test('ascendant is oriented to the left edge and close bodies are staggered', () => {
  const chart = calculateAstroEyeChart(EVENT);
  const wheel = createChartWheelModel(chart);
  assert.ok(wheel.angles.ascendant.outer.x < 20);
  const closePair = {
    ...chart,
    positions: [
      { body: 'Sun', longitude: 10, retrograde: false },
      { body: 'Moon', longitude: 12, retrograde: false },
    ],
    aspects: [],
  };
  const staggered = createChartWheelModel(closePair);
  assert.notEqual(staggered.bodies[0].radius, staggered.bodies[1].radius);
});

test('chart wheel rejects incomplete geometry instead of drawing fiction', () => {
  assert.throws(() => createChartWheelModel({}), /ascendant/);
  const chart = calculateAstroEyeChart(EVENT);
  assert.throws(() => createChartWheelModel({ ...chart, houses: { ...chart.houses, cusps: [] } }), /twelve/);
});
