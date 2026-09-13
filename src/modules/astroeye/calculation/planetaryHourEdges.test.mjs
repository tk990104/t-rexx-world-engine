import assert from 'node:assert/strict';
import test from 'node:test';
import * as Astronomy from 'astronomy-engine';
import { calculatePlanetaryHour } from './planetaryHours.js';
import { planetaryHourPresentation } from '../planetaryHourPresentation.js';

const location = { latitude: 40.7128, longitude: -74.006, timeZone: 'America/New_York' };
const at = (utcInstant) => calculatePlanetaryHour({ ...location, utcInstant });

// Deliberate characterization of defects in the preserved model-1/2 hour math.
// Passing these tests is NOT a passing exact-boundary acceptance gate.
test('legacy internal edge shifts when recalculated from a different instant', () => {
  const original = at('2024-03-10T16:00:00Z');
  const edge = original.end, recalculated = at(edge);
  assert.notEqual(recalculated.end, edge, 'known root-search anchor drift');
  assert.equal(recalculated.hourNumber, original.hourNumber, 'known old-hour assignment at displayed end');
  assert.ok(Math.abs(Date.parse(recalculated.end) - Date.parse(edge)) < 1000);
  assert.equal(planetaryHourPresentation({ calculatedFor: edge, planetaryHour: recalculated }).label, 'Boundary uncertain');
  assert.equal(at(new Date(Date.parse(edge) + 1000).toISOString()).hourNumber, original.hourNumber + 1);
});

for (const [name, direction, oldNumber, nextNumber] of [['sunrise', 1, 24, 1], ['sunset', -1, 12, 13]]) {
  test(`legacy ${name} can return a non-containing half-open interval; display refuses certainty`, () => {
    const observer = new Astronomy.Observer(location.latitude, location.longitude, 0);
    const edge = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, direction, new Date('2024-03-10T04:00:00Z'), 1).date;
    const hour = at(edge.toISOString());
    assert.equal(hour.hourNumber, oldNumber);
    assert.ok(Date.parse(hour.end) <= +edge, 'known defect: the returned interval has already ended');
    assert.equal(planetaryHourPresentation({ calculatedFor: edge.toISOString(), planetaryHour: hour }).uncertain, true);
    assert.equal(at(new Date(+edge - 1000).toISOString()).hourNumber, oldNumber);
    assert.equal(at(new Date(+edge + 1000).toISOString()).hourNumber, nextNumber);
  });
}
