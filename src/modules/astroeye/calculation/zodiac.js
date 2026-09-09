export const ZODIAC_SIGNS = Object.freeze([
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
]);

export function normalizeLongitude(value) {
  const longitude = Number(value);
  if (!Number.isFinite(longitude)) throw new TypeError('Longitude must be finite');
  return ((longitude % 360) + 360) % 360;
}

export function zodiacPosition(longitude) {
  const normalized = normalizeLongitude(longitude);
  const signIndex = Math.floor(normalized / 30);
  return Object.freeze({
    longitude: normalized,
    sign: ZODIAC_SIGNS[signIndex],
    signIndex,
    degree: normalized - signIndex * 30,
  });
}
