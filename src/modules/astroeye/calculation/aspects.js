import { normalizeLongitude } from './zodiac.js';

export const MAJOR_ASPECTS = Object.freeze([
  Object.freeze({ id: 'conjunction', angle: 0, orb: 8 }),
  Object.freeze({ id: 'sextile', angle: 60, orb: 4 }),
  Object.freeze({ id: 'square', angle: 90, orb: 6 }),
  Object.freeze({ id: 'trine', angle: 120, orb: 6 }),
  Object.freeze({ id: 'opposition', angle: 180, orb: 8 }),
]);

export function angularSeparation(left, right) {
  const difference = Math.abs(normalizeLongitude(left) - normalizeLongitude(right));
  return Math.min(difference, 360 - difference);
}

function phaseFor(left, right, aspect, currentOrb) {
  if (currentOrb < 1e-8) return 'exact';
  const hoursAhead = 1;
  const futureLeft = left.longitude + left.motionDegPerDay * hoursAhead / 24;
  const futureRight = right.longitude + right.motionDegPerDay * hoursAhead / 24;
  const futureOrb = Math.abs(angularSeparation(futureLeft, futureRight) - aspect.angle);
  if (Math.abs(futureOrb - currentOrb) < 1e-8) return 'stationary';
  return futureOrb < currentOrb ? 'applying' : 'separating';
}

export function calculateMajorAspects(positions, definitions = MAJOR_ASPECTS) {
  if (!Array.isArray(positions)) throw new TypeError('positions must be an array');
  const aspects = [];
  for (let leftIndex = 0; leftIndex < positions.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < positions.length; rightIndex += 1) {
      const left = positions[leftIndex];
      const right = positions[rightIndex];
      const separation = angularSeparation(left.longitude, right.longitude);
      const matches = definitions
        .map((aspect) => ({ aspect, orb: Math.abs(separation - aspect.angle) }))
        .filter(({ aspect, orb }) => orb <= aspect.orb)
        .sort((a, b) => a.orb - b.orb || a.aspect.angle - b.aspect.angle);
      if (!matches.length) continue;
      const { aspect, orb } = matches[0];
      aspects.push(Object.freeze({
        left: left.body,
        right: right.body,
        aspect: aspect.id,
        angle: aspect.angle,
        separation: Math.round(separation * 1e8) / 1e8,
        orb: Math.round(orb * 1e8) / 1e8,
        phase: phaseFor(left, right, aspect, orb),
      }));
    }
  }
  return Object.freeze(aspects);
}
