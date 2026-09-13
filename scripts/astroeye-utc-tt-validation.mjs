import { pathToFileURL } from 'node:url';
import { readReference, HORIZONS_TARGETS, POSITION_LIMIT_ARCSECONDS, MOTION_LIMIT_DEGREES_PER_DAY, signedDelta } from './astroeye-horizons.mjs';
import { readRangeReference, RANGE_BODIES } from './astroeye-range-references.mjs';
import { calculateUtcTtPositions } from '../src/modules/astroeye/calculation/utcTtPositions.js';

export function compareUtcTtReference(body, { range = false } = {}) {
  const { rows } = range ? readRangeReference(body) : readReference(body);
  const samples = rows.map((row) => {
    const actual = calculateUtcTtPositions(row.instant).positions.find((p) => p.body === body);
    return { instant: row.instant, longitudeErrorArcseconds: Math.abs(signedDelta(row.longitude, actual.longitude)) * 3600,
      latitudeErrorArcseconds: Math.abs(row.latitude - actual.latitude) * 3600 };
  });
  const motions = rows.filter((_, i) => i % 3 === 1).map((row, i) => {
    const expected = signedDelta(rows[i * 3].longitude, rows[i * 3 + 2].longitude) * 2;
    const actual = calculateUtcTtPositions(row.instant).positions.find((p) => p.body === body);
    return { instant: row.instant, errorDegreesPerDay: Math.abs(expected - actual.motionDegPerDay),
      directionMatches: (expected < 0) === actual.retrograde, decisive: Math.abs(expected) > MOTION_LIMIT_DEGREES_PER_DAY };
  });
  return { body, range, samples, motions,
    passed: samples.every((s) => s.longitudeErrorArcseconds <= POSITION_LIMIT_ARCSECONDS && s.latitudeErrorArcseconds <= POSITION_LIMIT_ARCSECONDS)
      && motions.every((m) => m.errorDegreesPerDay <= MOTION_LIMIT_DEGREES_PER_DAY && (!m.decisive || m.directionMatches)) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 2) throw new Error('Offline only: node scripts/astroeye-utc-tt-validation.mjs');
  const results = [...Object.keys(HORIZONS_TARGETS).map((body) => compareUtcTtReference(body)),
    ...RANGE_BODIES.map((body) => compareUtcTtReference(body, { range: true }))];
  console.log(JSON.stringify({ candidateOnly: true, summaries: results.map((r) => ({ body: r.body, range: r.range,
    positionCount: r.samples.length, motionCount: r.motions.length,
    maxLongitudeErrorArcseconds: Math.max(...r.samples.map((s) => s.longitudeErrorArcseconds)),
    maxLatitudeErrorArcseconds: Math.max(...r.samples.map((s) => s.latitudeErrorArcseconds)),
    maxMotionErrorDegreesPerDay: Math.max(...r.motions.map((m) => m.errorDegreesPerDay)), passed: r.passed })) }, null, 2));
  if (results.some((r) => !r.passed)) process.exitCode = 1;
}
