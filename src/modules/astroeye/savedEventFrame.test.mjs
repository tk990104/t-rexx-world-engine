import assert from 'node:assert/strict';
import test from 'node:test';
import * as Cesium from 'cesium';
import { savedEventFrame, createSavedEventFramer } from './savedEventFrame.js';
import { runExplicitNavigation } from '../../navigationPolicy.js';

const point = (latitude, longitude) => ({ latitude, longitude });
test('one or overlapping venues receive a nonzero regional frame', () => {
  const frame = savedEventFrame([point(40, -74), point(40, -74)]);
  assert.equal(frame.mode, 'region');
  assert.ok(frame.west < -74 && frame.east > -74);
  assert.ok(frame.south < 40 && frame.north > 40);
});
test('date-line neighbors use the short interval, independent of input ordering', () => {
  const points = [point(-17, 179), point(-18, -179)];
  const frame = savedEventFrame(points);
  assert.equal(frame.mode, 'region');
  assert.ok(frame.west > frame.east);
  const rectangle = Cesium.Rectangle.fromDegrees(frame.west, frame.south, frame.east, frame.north);
  assert.ok(Cesium.Math.toDegrees(rectangle.width) < 3);
  assert.deepEqual(savedEventFrame([...points].reverse()), frame);
});
test('global and polar distributions produce finite bounded destinations', () => {
  assert.equal(savedEventFrame([point(0, 0), point(0, 180)]).mode, 'globe');
  const polar = savedEventFrame([point(90, 10), point(89, 12)]);
  assert.equal(polar.north, 90);
  assert.ok(polar.south >= -90);
});
test('empty, oversized and invalid inputs fail without a destination', () => {
  for (const input of [[], [point(NaN, 0)], [point(91, 0)], [point(0, 181)], Array.from({ length: 102 }, () => point(0, 0))]) assert.throws(() => savedEventFrame(input));
});
test('only an explicit permitted action reaches camera ownership and one flight', () => {
  let allowed = true, cockpit = false;
  const order = [], flights = [];
  const frame = createSavedEventFramer({ viewer: { camera: { cancelFlight: () => order.push('cancel'), flyTo: (options) => flights.push(options) } },
    getPoints: () => [point(40, -74)], canInteract: () => allowed,
    runNavigation: (_noun, navigate) => runExplicitNavigation({ cockpitActive: cockpit,
      stamp: () => order.push('stamp'), release: () => order.push('release'), navigate }) });
  assert.equal(flights.length, 0);
  allowed = false; assert.throws(frame, /Stop/); assert.deepEqual(order, []);
  allowed = true; cockpit = true; assert.throws(frame, /Exit/); assert.deepEqual(order, []);
  cockpit = false; assert.equal(frame().mode, 'region');
  assert.deepEqual(order, ['stamp', 'release', 'cancel']);
  assert.equal(flights.length, 1);
  assert.ok(flights[0].destination instanceof Cesium.Rectangle);
  assert.equal(flights[0].orientation.pitch, -Math.PI / 2);
});
test('global framing sends a globe-height destination, not an enclosing underground sphere', () => {
  let flight;
  const frame = createSavedEventFramer({ viewer: { camera: { cancelFlight() {}, flyTo: (options) => { flight = options; } } },
    getPoints: () => [point(0, 0), point(0, 180)], canInteract: () => true, runNavigation: (_noun, navigate) => navigate() });
  assert.equal(frame().mode, 'globe');
  const position = Cesium.Cartographic.fromCartesian(flight.destination);
  assert.ok(Math.abs(position.height - 18000000) < 1);
});
