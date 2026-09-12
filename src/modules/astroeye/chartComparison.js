const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

function longitude(value) {
  return Number.isFinite(value) && value >= 0 && value <= 360 ? value % 360 : null;
}

function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Comparison requires ${field}.`);
  return value;
}

/** Copy only comparison inputs; the pin never retains mutable live chart objects. */
export function captureComparison(event, chart) {
  if (typeof chart?.calculatedFor !== 'string' || !chart.calculatedFor.trim()) throw new Error('Comparison requires a valid chart time.');
  const time = new Date(chart?.calculatedFor);
  if (!Number.isFinite(time.getTime())) throw new Error('Comparison requires a valid chart time.');
  const values = Object.fromEntries(BODIES.map((body) => [body, longitude(chart.positions?.find((entry) => entry.body === body)?.longitude)]));
  values.Ascendant = longitude(chart.houses?.angles?.ascendant);
  values.Midheaven = longitude(chart.houses?.angles?.midheaven);
  return Object.freeze({ title: text(event?.title, 'an event title'), calculatedFor: time.toISOString(),
    engine: text(chart.engine?.id, 'an engine'), version: text(chart.engine?.version, 'an engine version'),
    zodiac: text(chart.options?.zodiac, 'a zodiac'), frame: text(chart.options?.referenceFrame, 'a reference frame'),
    houseSystem: text(chart.options?.houseSystem, 'a house system'), values: Object.freeze(values) });
}

export function compareCharts(pinned, current) {
  if (['engine', 'version', 'zodiac', 'frame'].some((key) => pinned[key] !== current[key])) {
    return { rows: [], warning: 'Calculation conventions or engine versions differ. Numeric comparison is unavailable.' };
  }
  return { warning: pinned.houseSystem === current.houseSystem ? '' : 'House systems differ. This compares longitudes, not house assignments.',
    rows: [...BODIES, 'Ascendant', 'Midheaven'].map((body) => {
      const left = pinned.values[body], right = current.values[body];
      const distance = left == null || right == null ? null : Math.abs(right - left);
      return { body, pinned: left, current: right, separation: distance == null ? null : Math.min(distance, 360 - distance) };
    }) };
}
