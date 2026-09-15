import assert from 'node:assert/strict';
import test from 'node:test';
import { WorldClock } from './worldClock.js';
import { EventBus } from './eventBus.js';

const instant = '2026-09-15T12:00:00.000Z';
const invalidTimes = ['bad', NaN, Infinity, -Infinity, 1e20, -1e20, new Date(NaN)];

test('invalid event/replay transitions preserve the prior mode, time and notification count', () => {
  for (const prior of ['live', 'event', 'replay']) for (const next of ['event', 'replay']) {
    const bus = new EventBus(), seen = [];
    const clock = new WorldClock({ now: () => Date.parse(instant), eventBus: bus });
    clock.setMode(prior, { time: instant });
    bus.on('world-clock:changed', (snapshot) => seen.push(snapshot));
    const before = clock.snapshot();
    for (const time of invalidTimes) {
      assert.throws(() => clock.setMode(next, { time }));
      assert.deepEqual(clock.snapshot(), before);
      assert.deepEqual(seen, []);
    }
  }
});

test('invalid fixed-time updates and restores are atomic', () => {
  const bus = new EventBus(), seen = [];
  const clock = new WorldClock({ eventBus: bus });
  clock.setMode('replay', { time: instant });
  bus.on('world-clock:changed', (snapshot) => seen.push(snapshot));
  const before = clock.snapshot();
  for (const time of invalidTimes) {
    assert.throws(() => clock.setTime(time));
    assert.deepEqual(clock.snapshot(), before);
    assert.throws(() => clock.restore({ version: 1, mode: 'event', time }));
    assert.deepEqual(clock.snapshot(), before);
  }
  assert.throws(() => clock.restore({ version: 1, mode: 'invalid', time: instant }));
  assert.deepEqual(clock.snapshot(), before);
  assert.deepEqual(seen, []);
});

test('an invalid live source cannot displace a valid frozen clock', () => {
  let now = Date.parse(instant);
  const clock = new WorldClock({ now: () => now });
  clock.setMode('event', { time: instant });
  const before = clock.snapshot();
  for (now of [NaN, Infinity, 1e20]) {
    assert.throws(() => clock.setMode('live'));
    assert.deepEqual(clock.snapshot(), before);
  }
});

test('successful transitions emit a frozen committed snapshot and sample the live source once', () => {
  let reads = 0;
  const bus = new EventBus(), seen = [];
  const clock = new WorldClock({ now: () => { reads++; return Date.parse(instant); }, eventBus: bus });
  bus.on('world-clock:changed', (snapshot) => {
    assert.equal(clock.mode, snapshot.mode);
    assert.ok(Object.isFrozen(snapshot));
    seen.push(snapshot);
  });
  clock.setMode('event', { time: '1900-01-01T00:00:00Z' });
  assert.equal(reads, 0);
  clock.setMode('live');
  assert.equal(reads, 1);
  clock.setMode('replay', { time: '2100-12-31T23:59:59.999Z' });
  assert.equal(reads, 1);
  assert.deepEqual(seen.map(({ mode }) => mode), ['event', 'live', 'replay']);
  assert.equal(clock.snapshot().time, '2100-12-31T23:59:59.999Z');
});
