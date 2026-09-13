import { calculatePositionSet } from './astronomyEngineProvider.js';
import { ephemerisTimeInfo, makePositionEphemerisTime, EPHEMERIS_TIME_POLICY } from './ephemerisTime.js';

/** Explicit opt-in candidate. The chart/controller still uses calculation model 3. */
export function calculateUtcTtPositions(utcInstant) {
  const time = ephemerisTimeInfo(utcInstant);
  const epoch = Date.parse(time.inputInstant);
  const before = new Date(epoch - 6 * 3600000).toISOString();
  const after = new Date(epoch + 6 * 3600000).toISOString();
  return Object.freeze({ policy: EPHEMERIS_TIME_POLICY.id, time,
    positions: Object.freeze(calculatePositionSet(makePositionEphemerisTime(time.inputInstant),
      makePositionEphemerisTime(before), makePositionEphemerisTime(after))) });
}
