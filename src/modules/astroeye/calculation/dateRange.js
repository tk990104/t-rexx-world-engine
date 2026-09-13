// Application policy primitive, not an ephemeris accuracy claim.
const UTC_INSTANT = /^(\d{4})-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.(\d{1,3}))?Z$/;

function canonicalInstant(value) {
  if (typeof value !== 'string') return null;
  const match = UTC_INSTANT.exec(value);
  if (!match) return null;
  const instant = new Date(value), epoch = instant.getTime();
  if (!Number.isFinite(epoch)) return null;
  const expected = value.slice(0, 19) + '.' + (match[2] || '').padEnd(3, '0') + 'Z';
  // Reject Date's rollover of impossible dates and 24:00, not just invalid parses.
  if (instant.toISOString() !== expected) return null;
  return { epoch, utcInstant: expected };
}

/** Inclusive UTC years with a shared [start, end) millisecond contract. */
export function createCalculationDateRange({ firstYear, lastYear } = {}) {
  if (!Number.isInteger(firstYear) || !Number.isInteger(lastYear)
    || firstYear < 100 || lastYear > 9999 || firstYear > lastYear) {
    throw new RangeError('Calculation range requires ordered integer years from 100 through 9999.');
  }
  const start = Date.UTC(firstYear, 0, 1), end = Date.UTC(lastYear + 1, 0, 1);
  const startInclusive = new Date(start).toISOString(), endExclusive = new Date(end).toISOString();
  const label = `${String(firstYear).padStart(4, '0')}–${String(lastYear).padStart(4, '0')} UTC (inclusive years)`;
  function assess(value) {
    const parsed = canonicalInstant(value);
    if (!parsed) return Object.freeze({ status: 'invalid', utcInstant: null });
    return Object.freeze({ status: parsed.epoch < start ? 'before-range' : parsed.epoch >= end ? 'after-range' : 'within-range',
      utcInstant: parsed.utcInstant });
  }
  function requireInstant(value) {
    const result = assess(value);
    if (result.status === 'invalid') throw new TypeError('Calculation time must be a valid explicit UTC instant.');
    if (result.status !== 'within-range') throw new RangeError(`Calculation time is outside ${label}.`);
    return result.utcInstant;
  }
  return Object.freeze({ firstYear, lastYear, startInclusive, endExclusive, label, assess, requireInstant });
}

// User-approved initial release target. This limits new app calculations, not
// record import/export or storage, and does not certify every date in the window.
export const ASTROEYE_DATE_RANGE = createCalculationDateRange({ firstYear: 1900, lastYear: 2100 });
export const ASTROEYE_DATE_RANGE_NOTICE = 'Calculation range: 1900–2100 UTC, inclusive. Validation is ongoing; this is not an accuracy guarantee.';

export function savedChartDateNotice(chart) {
  return ASTROEYE_DATE_RANGE.assess(chart?.calculatedFor).status === 'within-range'
    ? '' : 'Saved chart outside the supported 1900–2100 UTC calculation range. Stored values are unchanged; new calculations and view links are unavailable. Use a records export to preserve this chart.';
}
