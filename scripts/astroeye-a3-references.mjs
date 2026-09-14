import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { HORIZONS_TARGETS, POSITION_LIMIT_ARCSECONDS, MOTION_LIMIT_DEGREES_PER_DAY } from './astroeye-horizons.mjs';
import { compareUtcTtReference } from './astroeye-utc-tt-validation.mjs';
import { compareBoundaryReference } from './astroeye-boundary-references.mjs';
import { compareExtendedReference } from './astroeye-extended-boundaries.mjs';
import { ASTRONOMY_ENGINE_VERSION } from '../src/modules/astroeye/calculation/astronomyEngineProvider.js';
import { ASTROEYE_CALCULATION_VERSION } from '../src/modules/astroeye/calculation/modelVersion.js';
import { ASTROEYE_DATE_RANGE } from '../src/modules/astroeye/calculation/dateRange.js';
import { EPHEMERIS_TIME_POLICY } from '../src/modules/astroeye/calculation/ephemerisTime.js';

export const A3_PACKS = Object.freeze([
  ...Object.keys(HORIZONS_TARGETS).map((body) => ({ pack: 'horizons', body, positions: 15, motions: 5 })),
  ...Object.keys(HORIZONS_TARGETS).map((body) => ({ pack: 'horizons-range', body, positions: 9, motions: 3 })),
  { pack: 'horizons-boundary', body: 'Sun', positions: 9, motions: 3 },
  { pack: 'horizons-boundary', body: 'Mercury', positions: 18, motions: 6 },
  { pack: 'horizons-extended-boundary', body: 'Sun', positions: 12, motions: 4 },
  { pack: 'horizons-extended-boundary', body: 'Mercury', positions: 24, motions: 8 },
].map(Object.freeze));

// Scope is pinned: a missing pack cannot yield a green, smaller report.
export function summarizeA3References(results) {
  if (!Array.isArray(results) || results.length !== A3_PACKS.length) throw new Error('A3 pack coverage mismatch');
  const summaries = results.map((result, index) => {
    const scope = A3_PACKS[index];
    if (result?.pack !== scope.pack || result.body !== scope.body || result.samples?.length !== scope.positions
      || result.motions?.length !== scope.motions) throw new Error('A3 sample coverage mismatch');
    const samplesPass = result.samples.every((s) => Number.isFinite(s.longitudeErrorArcseconds) && s.longitudeErrorArcseconds >= 0
      && s.longitudeErrorArcseconds <= POSITION_LIMIT_ARCSECONDS && Number.isFinite(s.latitudeErrorArcseconds)
      && s.latitudeErrorArcseconds >= 0 && s.latitudeErrorArcseconds <= POSITION_LIMIT_ARCSECONDS
      && (!scope.pack.includes('boundary') || (typeof s.signDecisive === 'boolean' && typeof s.signMatches === 'boolean'))
      && (s.signDecisive !== true || s.signMatches === true));
    const motionsPass = result.motions.every((m) => Number.isFinite(m.errorDegreesPerDay) && m.errorDegreesPerDay >= 0
      && m.errorDegreesPerDay <= MOTION_LIMIT_DEGREES_PER_DAY && typeof m.decisive === 'boolean'
      && (!m.decisive || m.directionMatches === true));
    return { ...scope, maxLongitudeErrorArcseconds: Math.max(...result.samples.map((s) => s.longitudeErrorArcseconds)),
      maxLatitudeErrorArcseconds: Math.max(...result.samples.map((s) => s.latitudeErrorArcseconds)),
      maxMotionErrorDegreesPerDay: Math.max(...result.motions.map((m) => m.errorDegreesPerDay)),
      signChecks: result.samples.filter((s) => typeof s.signDecisive === 'boolean').length,
      inconclusiveSigns: result.samples.filter((s) => s.signDecisive === false).length,
      inconclusiveDirections: result.motions.filter((m) => !m.decisive).length,
      passed: result.passed === true && samplesPass && motionsPass };
  });
  return { scope: 'Offline sampled position references only; not whole-release certification.',
    calculationVersion: ASTROEYE_CALCULATION_VERSION, engineVersion: ASTRONOMY_ENGINE_VERSION,
    positionTimePolicy: EPHEMERIS_TIME_POLICY.id,
    supportedUtcInterval: [ASTROEYE_DATE_RANGE.startInclusive, ASTROEYE_DATE_RANGE.endExclusive],
    limits: { coordinateArcseconds: POSITION_LIMIT_ARCSECONDS, motionDegreesPerDay: MOTION_LIMIT_DEGREES_PER_DAY },
    packCount: summaries.length, positionCount: summaries.reduce((sum, s) => sum + s.positions, 0),
    coordinateCount: summaries.reduce((sum, s) => sum + s.positions * 2, 0),
    motionCount: summaries.reduce((sum, s) => sum + s.motions, 0),
    summaries, passed: summaries.every((s) => s.passed) };
}
export function evaluateA3References() {
  const digest = createHash('sha256');
  const results = A3_PACKS.map(({ pack, body }) => {
    digest.update(`${pack}/${body.toLowerCase()}.json\n`);
    // Normalize line endings so checkout settings do not change source identity.
    digest.update(readFileSync(new URL(`../src/modules/astroeye/calculation/fixtures/${pack}/${body.toLowerCase()}.json`, import.meta.url), 'utf8').replace(/\r\n/g, '\n'));
    const comparison = pack === 'horizons' ? compareUtcTtReference(body) : pack === 'horizons-range' ? compareUtcTtReference(body, { range: true })
      : pack === 'horizons-boundary' ? compareBoundaryReference(body) : compareExtendedReference(body);
    return { ...comparison, pack };
  });
  return { ...summarizeA3References(results), referenceSha256: digest.digest('hex') };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 2) throw new Error('Offline only: node scripts/astroeye-a3-references.mjs');
  const report = evaluateA3References();
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}
