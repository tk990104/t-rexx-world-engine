import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { calculateAstroEyeChart, serializeAstroEyeChart } from './chart.js';
import { angularSeparation, calculateMajorAspects } from './aspects.js';
import {
  ASTRONOMY_ENGINE_VERSION,
  ASTROEYE_BODIES,
  calculateAstronomyEnginePositions,
} from './astronomyEngineProvider.js';
import { normalizeLongitude, zodiacPosition } from './zodiac.js';
import { calculateAngles, calculateHouses, houseForLongitude } from './houses.js';
import { calculatePlanetaryHour } from './planetaryHours.js';

const EVENT = {
  id: 'nfl-2026-week-1-example',
  title: 'Away Team at Home Team',
  sport: 'American Football',
  competition: 'NFL',
  participants: { home: 'Home Team', away: 'Away Team' },
  scheduledLocal: { date: '2026-09-09', time: '20:15', timeZone: 'America/New_York' },
  venue: {
    name: 'Example Stadium',
    latitude: 40.7505,
    longitude: -73.9934,
    coordinateSource: 'user-confirmed',
  },
  source: { kind: 'manual' },
};

test('pinned provider version matches the installed package', () => {
  const packageJson = JSON.parse(fs.readFileSync('node_modules/astronomy-engine/package.json', 'utf8'));
  assert.equal(packageJson.version, ASTRONOMY_ENGINE_VERSION);
  assert.equal(packageJson.license, 'MIT');
});

test('longitude normalization and tropical zodiac boundaries are stable', () => {
  assert.equal(normalizeLongitude(-1), 359);
  assert.deepEqual(zodiacPosition(0), { longitude: 0, sign: 'Aries', signIndex: 0, degree: 0 });
  assert.equal(zodiacPosition(29.999).sign, 'Aries');
  assert.equal(zodiacPosition(30).sign, 'Taurus');
  assert.equal(zodiacPosition(359.999).sign, 'Pisces');
});

test('provider returns the ten declared bodies with finite normalized positions', () => {
  const positions = calculateAstronomyEnginePositions('2026-09-10T00:15:00.000Z');
  assert.deepEqual(positions.map(({ body }) => body), ASTROEYE_BODIES);
  for (const position of positions) {
    assert.ok(position.longitude >= 0 && position.longitude < 360);
    assert.ok(Number.isFinite(position.latitude));
    assert.ok(Number.isFinite(position.motionDegPerDay));
  }
});

test('example date pins initial Sun and Moon longitudes within calculation tolerance', () => {
  const positions = calculateAstronomyEnginePositions('2026-09-10T00:15:00.000Z');
  const byBody = Object.fromEntries(positions.map((position) => [position.body, position]));
  assert.ok(Math.abs(byBody.Sun.longitude - 167.32947791) < 1e-7);
  assert.ok(Math.abs(byBody.Moon.longitude - 152.72442804) < 1e-7);
});

test('Whole Sign and Equal houses have explicit, stable cusp rules', () => {
  const input = {
    utcInstant: '2026-09-10T00:15:00.000Z', latitude: 40.7505, longitude: -73.9934,
  };
  const angles = calculateAngles(input.utcInstant, input.latitude, input.longitude);
  assert.ok(angles.ascendant >= 0 && angles.ascendant < 360);
  assert.ok(angles.midheaven >= 0 && angles.midheaven < 360);
  const whole = calculateHouses({ ...input, system: 'whole-sign' });
  const equal = calculateHouses({ ...input, system: 'equal' });
  assert.equal(whole.cusps[0].longitude % 30, 0);
  assert.ok(Math.abs(equal.cusps[0].longitude - angles.ascendant) < 1e-10);
  assert.equal(houseForLongitude(angles.ascendant, whole), 1);
  assert.equal(houseForLongitude(whole.cusps[6].longitude, whole), 7);
});

test('major aspects cross 0 degrees and label applying motion', () => {
  assert.equal(angularSeparation(359, 1), 2);
  const aspects = calculateMajorAspects([
    { body: 'Moon', longitude: 359, motionDegPerDay: 13 },
    { body: 'Sun', longitude: 2, motionDegPerDay: 1 },
    { body: 'Mars', longitude: 92, motionDegPerDay: 0.5 },
  ]);
  assert.equal(aspects[0].aspect, 'conjunction');
  assert.equal(aspects[0].phase, 'applying');
  assert.ok(aspects.some(({ aspect }) => aspect === 'square'));
});

test('planetary hour is bounded by real sunrise/sunset and has a ruler', () => {
  const hour = calculatePlanetaryHour({
    utcInstant: '2026-09-10T00:15:00.000Z',
    latitude: 40.7505,
    longitude: -73.9934,
    timeZone: 'America/New_York',
  });
  assert.equal(hour.status, 'exact');
  assert.ok(hour.hourNumber >= 1 && hour.hourNumber <= 24);
  assert.ok(new Date(hour.start) <= new Date('2026-09-10T00:15:00.000Z'));
  assert.ok(new Date(hour.end) > new Date('2026-09-10T00:15:00.000Z'));
  assert.ok(['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'].includes(hour.ruler));
});

test('planetary hours fail explicitly during polar day instead of inventing boundaries', () => {
  const hour = calculatePlanetaryHour({
    utcInstant: '2026-06-21T12:00:00.000Z',
    latitude: 78.2232,
    longitude: 15.6469,
    timeZone: 'Arctic/Longyearbyen',
  });
  assert.equal(hour.status, 'unavailable');
  assert.match(hour.reason, /No complete sunrise–sunset–sunrise interval/);
});

test('chart output records engine provenance and is byte-stable', () => {
  const first = calculateAstroEyeChart(EVENT);
  const second = calculateAstroEyeChart(EVENT);
  assert.equal(first.engine.id, 'astronomy-engine');
  assert.equal(first.engine.version, ASTRONOMY_ENGINE_VERSION);
  assert.equal(first.options.zodiac, 'tropical');
  assert.equal(first.options.houseSystem, 'whole-sign');
  assert.equal(first.houses.cusps.length, 12);
  assert.ok(first.positions.every(({ house }) => house >= 1 && house <= 12));
  assert.ok(Array.isArray(first.aspects));
  assert.equal(first.planetaryHour.status, 'exact');
  assert.equal(serializeAstroEyeChart(first), serializeAstroEyeChart(second));
});

test('chart identity changes when the selected house method changes', () => {
  const whole = calculateAstroEyeChart(EVENT, { houseSystem: 'whole-sign' });
  const equal = calculateAstroEyeChart(EVENT, { houseSystem: 'equal' });
  assert.notEqual(whole.chartId, equal.chartId);
  assert.notDeepEqual(whole.houses.cusps, equal.houses.cusps);
  assert.equal(equal.options.houseSystem, 'equal');
  assert.throws(() => calculateAstroEyeChart(EVENT, { houseSystem: 'placidus' }), /Unsupported/);
});
