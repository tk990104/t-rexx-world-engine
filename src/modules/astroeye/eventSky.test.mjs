import test from 'node:test';
import assert from 'node:assert/strict';
import * as Astronomy from 'astronomy-engine';
import * as Cesium from 'cesium';
import { CelestialRing } from '../../celestialRing.js';
import { eventSkyDirections, createEventSky } from './eventSky.js';
import { eventFromDraft } from './workspaceController.js';
import { calculateAstroEyeChart } from './calculation/chart.js';
import { calculateTimePreview } from './timeExplorer.js';
import { createSharedView, encodeSharedView, decodeSharedView } from './shareView.js';

const event = eventFromDraft({ title: 'Test sky', sport: 'Football', competition: 'Demo', home: 'Home', away: 'Away',
  localDate: '2026-09-10', localTime: '12:00', timeZone: 'UTC', latitude: 40, longitude: -74, venueName: 'Test venue' }, () => 'sky-test');
const chart = calculateAstroEyeChart(event);
const close = (left, right) => assert.ok(Math.abs(left - right) < 1e-10, `${left} != ${right}`);

test('event sky rotates the equinox basis by negative Greenwich apparent sidereal angle', () => {
  const directions = eventSkyDirections({ calculatedFor: chart.calculatedFor, positions: [
    { body: 'Sun', longitude: 0, latitude: 0 }, { body: 'Moon', longitude: 180, latitude: 0 },
  ] });
  const theta = Astronomy.SiderealTime(new Date(chart.calculatedFor)) * Math.PI / 12;
  close(directions.sun.x, Math.cos(theta)); close(directions.sun.y, -Math.sin(theta)); close(directions.sun.z, 0);
  close(directions.moon.x, -directions.sun.x); close(directions.moon.y, -directions.sun.y);
});

test('chart sky directions are deterministic unit vectors and follow preview time', () => {
  const before = JSON.stringify(chart);
  const sky = eventSkyDirections(chart);
  for (const body of ['sun', 'moon']) close(Math.hypot(sky[body].x, sky[body].y, sky[body].z), 1);
  assert.deepEqual(eventSkyDirections(chart), sky);
  const later = eventSkyDirections(calculateTimePreview(event, 360));
  assert.notDeepEqual(later.sun, sky.sun); assert.notDeepEqual(later.moon, sky.moon);
  assert.equal(later.time, '2026-09-10T18:00:00.000Z');
  assert.equal(JSON.stringify(chart), before);
  assert.throws(() => eventSkyDirections({ calculatedFor: 'bad' }), /valid chart time/);
  assert.throws(() => eventSkyDirections({ calculatedFor: chart.calculatedFor, positions: [] }), /Sun/);
});

test('ring snapshot validates atomically, uses cached directions and clears back to live', (t) => {
  const sun = t.mock.method(Cesium.Simon1994PlanetaryPositions, 'computeSunPositionInEarthInertialFrame', () => assert.fail('Unexpected live Sun calculation'));
  const moon = t.mock.method(Cesium.Simon1994PlanetaryPositions, 'computeMoonPositionInEarthInertialFrame', () => assert.fail('Unexpected live Moon calculation'));
  const ring = Object.create(CelestialRing.prototype);
  Object.assign(ring, { _directionSnapshot: null, _sunFixed: new Cesium.Cartesian3(), _moonFixed: new Cesium.Cartesian3(),
    _timeLabel: {}, _root: { dataset: {} }, _ephemerisUpdateCount: 0 });
  const snapshot = eventSkyDirections(chart);
  ring.setDirectionSnapshot(snapshot);
  const start = Cesium.JulianDate.fromIso8601(chart.calculatedFor);
  for (let index = 0; index < 120; index++) {
    assert.equal(ring._updateEphemeris(Cesium.JulianDate.addSeconds(start, index * 60, new Cesium.JulianDate())), true);
  }
  assert.equal(sun.mock.callCount(), 0); assert.equal(moon.mock.callCount(), 0);
  assert.equal(ring._ephemerisUpdateCount, 1);
  assert.match(ring._timeLabel.textContent, /2026-09-10 12:00:00 UTC/);
  assert.throws(() => ring.setDirectionSnapshot({ ...snapshot, moon: { x: NaN, y: 1, z: 2 } }), /Invalid/);
  assert.equal(ring.getDirectionSnapshot().time, snapshot.time);
  const copy = ring.getDirectionSnapshot(); copy.sun.x = 100;
  assert.notEqual(ring.getDirectionSnapshot().sun.x, 100);
  const next = eventSkyDirections(calculateTimePreview(event, 60));
  ring.setDirectionSnapshot(next);
  assert.equal(ring._ephemerisUpdateCount, 2, 'Only an explicit chart update replaces cached directions');
  const updated = ring.getDirectionSnapshot();
  assert.equal(updated.time, next.time); assert.equal(updated.owner, next.owner);
  for (const body of ['sun', 'moon']) for (const axis of ['x', 'y', 'z']) close(updated[body][axis], next[body][axis]);
  ring.setDirectionSnapshot(null);
  assert.equal(ring.getDirectionSnapshot(), null); assert.equal(ring._ephemerisDirty, true);
  assert.equal(ring._timeLabel.hidden, true);
});

test('event sky adapter updates on charts, respects style rejection and restores prior ring preference', () => {
  let snapshot = null;
  let allowed = true;
  const calls = [];
  const ring = { enabled: false, getDirectionSnapshot: () => snapshot, setDirectionSnapshot: (next) => { snapshot = next; } };
  const sky = createEventSky({ ring, setRingEnabled: (enabled, options) => {
    calls.push({ enabled, options });
    if (enabled && !allowed) return { ok: false, error: 'Normal style required' };
    ring.enabled = enabled; return { ok: true };
  } });
  assert.throws(() => sky.setEnabled(true), /Choose an event/);
  sky.update(chart); assert.equal(snapshot, null);
  allowed = false; assert.throws(() => sky.setEnabled(true), /Normal style/); assert.equal(snapshot, null);
  allowed = true; sky.setEnabled(true); assert.equal(sky.isEnabled(), true);
  assert.equal(calls.at(-1).options.focus, true);
  sky.update(calculateTimePreview(event, 60)); assert.equal(snapshot.time, '2026-09-10T13:00:00.000Z');
  sky.setEnabled(false); assert.equal(ring.enabled, false); assert.equal(snapshot, null);
  ring.enabled = true; sky.setEnabled(true, { focus: false }); sky.destroy();
  assert.equal(ring.enabled, true); assert.equal(snapshot, null);
});

test('shared event sky is opt-in and legacy AstroEye links default to no override', () => {
  const snapshot = createSharedView(event);
  assert.equal(decodeSharedView(encodeSharedView(snapshot)).skyEnabled, undefined);
  assert.equal(decodeSharedView(encodeSharedView({ ...snapshot, skyEnabled: true })).skyEnabled, true);
  assert.throws(() => encodeSharedView({ ...snapshot, skyEnabled: 'yes' }), /Invalid shared/);
});
