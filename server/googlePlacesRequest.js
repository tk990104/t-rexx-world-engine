const DECIMAL = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

/** Validate before key lookup or provider work; preserve normal radius clamping. */
export function parseGooglePlacesQuery(url, textSearch = false) {
  try {
    const params = new URL(url || '/', 'http://localhost').searchParams;
    const allowed = textSearch ? ['lat', 'lon', 'radiusM', 'q'] : ['lat', 'lon', 'radiusM'];
    for (const key of params.keys()) {
      if (!allowed.includes(key) || params.getAll(key).length !== 1) return null;
    }
    const number = key => {
      const raw = params.get(key)?.trim();
      return raw && raw.length <= 32 && DECIMAL.test(raw) ? Number(raw) : NaN;
    };
    const latitude = number('lat'), longitude = number('lon');
    if (!Number.isFinite(latitude) || Math.abs(latitude) > 90
      || !Number.isFinite(longitude) || Math.abs(longitude) > 180) return null;
    const radius = params.has('radiusM') ? number('radiusM') : (textSearch ? 4000 : 250);
    if (!Number.isFinite(radius) || radius <= 0) return null;
    const textQuery = textSearch ? params.get('q')?.trim() : undefined;
    if (textSearch && (!textQuery || textQuery.length > 500)) return null;
    return { latitude, longitude, textQuery,
      radiusM: Math.max(textSearch ? 50 : 25, Math.min(textSearch ? 50000 : 5000, radius)) };
  } catch { return null; }
}
