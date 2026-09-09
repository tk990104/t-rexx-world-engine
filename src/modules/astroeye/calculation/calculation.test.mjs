import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { calculateAstroEyeChart, serializeAstroEyeChart } from './chart.js';
import {
  ASTRONOMY_ENGINE_VERSION,
  ASTROEYE_BODIES,
  calculateAstronomyEnginePositions,
} from './astronomyEngineProvider.js';
import { normalizeLongitude, zodiacPosition } from './zodiac.js';

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

test('chart output records engine provenance and is byte-stable', () => {
  const first = calculateAstroEyeChart(EVENT);
  const second = calculateAstroEyeChart(EVENT);
  assert.equal(first.engine.id, 'astronomy-engine');
  assert.equal(first.engine.version, ASTRONOMY_ENGINE_VERSION);
  assert.equal(first.options.zodiac, 'tropical');
  assert.equal(first.options.houseSystem, null);
  assert.equal(serializeAstroEyeChart(first), serializeAstroEyeChart(second));
});
