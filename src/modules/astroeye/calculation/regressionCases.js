/**
 * Internal AstroEye regression fixtures.
 *
 * Expected values are snapshots produced by Astronomy Engine 2.1.19 and the
 * T-Rexx calculation pipeline. They detect accidental drift; they are not an
 * independent ephemeris validation dataset.
 */
const REGRESSION_EXPECTATIONS = Object.freeze({
  'new-york-standard': { sun: 295.873054, moon: 264.324506, ascendant: 147.593474, midheaven: 51.387785, aspectCount: 27, retrogradeBodies: ['Jupiter', 'Uranus'], planetaryHourStatus: 'exact', planetaryHourRuler: 'Jupiter' },
  'los-angeles-summer': { sun: 102.979098, moon: 338.633681, ascendant: 230.768679, midheaven: 148.836816, aspectCount: 15, retrogradeBodies: ['Mercury', 'Pluto'], planetaryHourStatus: 'exact', planetaryHourRuler: 'Jupiter' },
  'new-york-before-spring-forward': { sun: 347.6903, moon: 223.454496, ascendant: 259.027815, midheaven: 190.310875, aspectCount: 13, retrogradeBodies: ['Mercury', 'Jupiter'], planetaryHourStatus: 'exact', planetaryHourRuler: 'Mercury' },
  'new-york-after-spring-forward': { sun: 347.731971, moon: 223.958154, ascendant: 272.419494, midheaven: 206.432322, aspectCount: 13, retrogradeBodies: ['Mercury', 'Jupiter'], planetaryHourStatus: 'exact', planetaryHourRuler: 'Moon' },
  'new-york-fall-fold-first': { sun: 218.805829, moon: 120.702825, ascendant: 147.638761, midheaven: 51.444721, aspectCount: 13, retrogradeBodies: ['Mercury', 'Venus', 'Saturn', 'Uranus', 'Neptune'], planetaryHourStatus: 'exact', planetaryHourRuler: 'Venus' },
  'utc-leap-day': { sun: 340.427486, moon: 25.033836, ascendant: 100.232911, midheaven: 337.119183, aspectCount: 9, retrogradeBodies: ['Jupiter'], planetaryHourStatus: 'exact', planetaryHourRuler: 'Saturn' },
  'sydney-summer': { sun: 306.411863, moon: 38.699566, ascendant: 126.386128, midheaven: 54.251665, aspectCount: 19, retrogradeBodies: ['Jupiter', 'Uranus'], planetaryHourStatus: 'exact', planetaryHourRuler: 'Sun' },
  'johannesburg-winter': { sun: 115.933963, moon: 171.172905, ascendant: 262.272626, midheaven: 157.724909, aspectCount: 11, retrogradeBodies: ['Mercury', 'Neptune', 'Pluto'], planetaryHourStatus: 'exact', planetaryHourRuler: 'Mars' },
  'london-summer': { sun: 81.773477, moon: 47.880109, ascendant: 234.18617, midheaven: 166.079609, aspectCount: 11, retrogradeBodies: ['Pluto'], planetaryHourStatus: 'exact', planetaryHourRuler: 'Saturn' },
  'reykjavik-summer': { sun: 71.027025, moon: 263.538068, ascendant: 158.148569, midheaven: 54.176545, aspectCount: 9, retrogradeBodies: ['Pluto'], planetaryHourStatus: 'exact', planetaryHourRuler: 'Venus' },
  'longyearbyen-polar-day': { sun: 90.142499, moon: 175.217567, ascendant: 185.414412, midheaven: 104.13476, aspectCount: 15, retrogradeBodies: ['Pluto'], planetaryHourStatus: 'unavailable', planetaryHourRuler: null },
  'longyearbyen-polar-night': { sun: 269.667475, moon: 54.173732, ascendant: 155.442571, midheaven: 298.640716, aspectCount: 12, retrogradeBodies: ['Jupiter', 'Uranus'], planetaryHourStatus: 'unavailable', planetaryHourRuler: null },
  tokyo: { sun: 180.363006, moon: 320.341519, ascendant: 10.843975, midheaven: 276.316734, aspectCount: 14, retrogradeBodies: ['Saturn', 'Uranus', 'Neptune', 'Pluto'], planetaryHourStatus: 'exact', planetaryHourRuler: 'Sun' },
  singapore: { sun: 41.149511, moon: 218.876729, ascendant: 242.341369, midheaven: 148.624597, aspectCount: 12, retrogradeBodies: [], planetaryHourStatus: 'exact', planetaryHourRuler: 'Sun' },
  'kathmandu-quarter-offset': { sun: 196.889903, moon: 191.144426, ascendant: 249.815149, midheaven: 169.523322, aspectCount: 15, retrogradeBodies: ['Venus', 'Saturn', 'Uranus', 'Neptune', 'Pluto'], planetaryHourStatus: 'exact', planetaryHourRuler: 'Venus' },
  'buenos-aires': { sun: 145.093825, moon: 211.16982, ascendant: 358.317773, midheaven: 268.160198, aspectCount: 14, retrogradeBodies: ['Saturn', 'Neptune', 'Pluto'], planetaryHourStatus: 'exact', planetaryHourRuler: 'Moon' },
  honolulu: { sun: 320.296605, moon: 225.196653, ascendant: 102.218436, midheaven: 4.147514, aspectCount: 11, retrogradeBodies: ['Jupiter'], planetaryHourStatus: 'exact', planetaryHourRuler: 'Venus' },
  'phoenix-no-dst': { sun: 103.094951, moon: 340.163986, ascendant: 274.06156, midheaven: 202.720604, aspectCount: 14, retrogradeBodies: ['Mercury', 'Pluto'], planetaryHourStatus: 'exact', planetaryHourRuler: 'Venus' },
  anchorage: { sun: 26.091637, moon: 6.883324, ascendant: 174.261309, midheaven: 81.342069, aspectCount: 18, retrogradeBodies: [], planetaryHourStatus: 'exact', planetaryHourRuler: 'Saturn' },
  ushuaia: { sun: 238.273068, moon: 4.698341, ascendant: 317.275937, midheaven: 208.323633, aspectCount: 15, retrogradeBodies: ['Saturn', 'Uranus', 'Neptune'], planetaryHourStatus: 'exact', planetaryHourRuler: 'Jupiter' },
});

const ASTROEYE_REGRESSION_INPUTS = Object.freeze([
  { id: 'new-york-standard', date: '2026-01-15', time: '19:30', timeZone: 'America/New_York', latitude: 40.7128, longitude: -74.006, expected: null },
  { id: 'los-angeles-summer', date: '2026-07-04', time: '16:05', timeZone: 'America/Los_Angeles', latitude: 34.0522, longitude: -118.2437, expected: null },
  { id: 'new-york-before-spring-forward', date: '2026-03-08', time: '01:30', timeZone: 'America/New_York', latitude: 40.7128, longitude: -74.006, expected: null },
  { id: 'new-york-after-spring-forward', date: '2026-03-08', time: '03:30', timeZone: 'America/New_York', latitude: 40.7128, longitude: -74.006, expected: null },
  { id: 'new-york-fall-fold-first', date: '2026-11-01', time: '01:30', timeZone: 'America/New_York', utcStart: '2026-11-01T05:30:00.000Z', latitude: 40.7128, longitude: -74.006, expected: null },
  { id: 'utc-leap-day', date: '2028-02-29', time: '12:00', timeZone: 'UTC', latitude: 51.4779, longitude: 0, expected: null },
  { id: 'sydney-summer', date: '2026-01-26', time: '20:00', timeZone: 'Australia/Sydney', latitude: -33.8688, longitude: 151.2093, expected: null },
  { id: 'johannesburg-winter', date: '2026-07-18', time: '15:00', timeZone: 'Africa/Johannesburg', latitude: -26.2041, longitude: 28.0473, expected: null },
  { id: 'london-summer', date: '2026-06-12', time: '18:45', timeZone: 'Europe/London', latitude: 51.5074, longitude: -0.1278, expected: null },
  { id: 'reykjavik-summer', date: '2026-06-01', time: '12:15', timeZone: 'Atlantic/Reykjavik', latitude: 64.1466, longitude: -21.9426, expected: null },
  { id: 'longyearbyen-polar-day', date: '2026-06-21', time: '14:00', timeZone: 'Arctic/Longyearbyen', latitude: 78.2232, longitude: 15.6469, expected: null },
  { id: 'longyearbyen-polar-night', date: '2026-12-21', time: '14:00', timeZone: 'Arctic/Longyearbyen', latitude: 78.2232, longitude: 15.6469, expected: null },
  { id: 'tokyo', date: '2026-09-23', time: '18:00', timeZone: 'Asia/Tokyo', latitude: 35.6762, longitude: 139.6503, expected: null },
  { id: 'singapore', date: '2026-05-01', time: '20:30', timeZone: 'Asia/Singapore', latitude: 1.3521, longitude: 103.8198, expected: null },
  { id: 'kathmandu-quarter-offset', date: '2026-10-10', time: '10:10', timeZone: 'Asia/Kathmandu', latitude: 27.7172, longitude: 85.324, expected: null },
  { id: 'buenos-aires', date: '2026-08-17', time: '21:00', timeZone: 'America/Argentina/Buenos_Aires', latitude: -34.6037, longitude: -58.3816, expected: null },
  { id: 'honolulu', date: '2026-02-08', time: '15:30', timeZone: 'Pacific/Honolulu', latitude: 21.3099, longitude: -157.8581, expected: null },
  { id: 'phoenix-no-dst', date: '2026-07-04', time: '19:00', timeZone: 'America/Phoenix', latitude: 33.4484, longitude: -112.074, expected: null },
  { id: 'anchorage', date: '2026-04-15', time: '17:45', timeZone: 'America/Anchorage', latitude: 61.2181, longitude: -149.9003, expected: null },
  { id: 'ushuaia', date: '2026-11-20', time: '11:20', timeZone: 'America/Argentina/Ushuaia', latitude: -54.8019, longitude: -68.303, expected: null },
]);

export const ASTROEYE_REGRESSION_CASES = Object.freeze(
  ASTROEYE_REGRESSION_INPUTS.map((regressionCase) => Object.freeze({
    ...regressionCase,
    expected: Object.freeze(REGRESSION_EXPECTATIONS[regressionCase.id]),
  })),
);

export function eventFromRegressionCase(regressionCase) {
  return {
    id: `regression-${regressionCase.id}`,
    title: `Regression fixture: ${regressionCase.id}`,
    sport: 'Regression',
    competition: 'AstroEye fixture pack',
    participants: { home: 'Reference home', away: 'Reference away' },
    scheduledLocal: {
      date: regressionCase.date,
      time: regressionCase.time,
      timeZone: regressionCase.timeZone,
    },
    ...(regressionCase.utcStart ? { utcStart: regressionCase.utcStart } : {}),
    venue: {
      name: regressionCase.id,
      latitude: regressionCase.latitude,
      longitude: regressionCase.longitude,
      coordinateSource: 'regression-fixture',
    },
    source: { kind: 'manual' },
  };
}

function rounded(value) {
  return Math.round(value * 1e6) / 1e6;
}

/** Compact, reviewable signature for pipeline regression tests. */
export function chartRegressionFingerprint(chart) {
  const byBody = Object.fromEntries(chart.positions.map((position) => [position.body, position]));
  return Object.freeze({
    sun: rounded(byBody.Sun.longitude),
    moon: rounded(byBody.Moon.longitude),
    ascendant: rounded(chart.houses.angles.ascendant),
    midheaven: rounded(chart.houses.angles.midheaven),
    aspectCount: chart.aspects.length,
    retrogradeBodies: chart.positions.filter((position) => position.retrograde).map((position) => position.body),
    planetaryHourStatus: chart.planetaryHour.status,
    planetaryHourRuler: chart.planetaryHour.ruler ?? null,
  });
}
