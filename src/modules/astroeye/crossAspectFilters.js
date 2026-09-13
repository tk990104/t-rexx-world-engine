import { MAJOR_ASPECTS } from './calculation/aspects.js';

export function normalizeCrossAspectFilters({ aspect = 'all', maxOrb = null } = {}) {
  if (aspect !== 'all' && !MAJOR_ASPECTS.some(({ id }) => id === aspect)) throw new RangeError('Unknown aspect filter.');
  if (maxOrb !== null && (!Number.isFinite(maxOrb) || maxOrb < 0 || maxOrb > 8)) throw new RangeError('Maximum orb must be between 0 and 8 degrees.');
  return Object.freeze({ aspect, maxOrb });
}

/** Narrow existing matches; filters never widen the calculation's per-aspect limits. */
export function filterCrossChartAspects(result, options) {
  const filters = normalizeCrossAspectFilters(options);
  return { ...result, filters, totalMatches: result.rows.length,
    rows: result.rows.filter((row) => (filters.aspect === 'all' || row.aspect === filters.aspect)
      && (filters.maxOrb === null || row.orb <= filters.maxOrb)) };
}

export function crossAspectFilterSummary(result) {
  const { aspect, maxOrb } = result.filters;
  return `Filters: ${aspect === 'all' ? 'all aspect types' : aspect}; ${maxOrb === null ? 'standard orb limits' : `maximum orb ${maxOrb}° (also within standard limits)`}. Showing ${result.rows.length} of ${result.totalMatches} matches.`;
}
