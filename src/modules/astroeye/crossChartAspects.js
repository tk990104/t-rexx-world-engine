import { compareCharts } from './chartComparison.js';
import { angularSeparation, MAJOR_ASPECTS } from './calculation/aspects.js';

export const CROSS_ASPECT_RULES = MAJOR_ASPECTS.map(({ id, angle, orb }) => `${id} ${angle}° ±${orb}°`).join('; ');
export const CROSS_ASPECT_SCOPE = 'Pinned-to-current pairs, including same-named points. Orb is distance from the exact aspect angle; matches use unrounded values. No applying/separating phase is inferred across snapshot times.';

/** A bounded 12 × 12 snapshot comparison, without motion or interpretation claims. */
export function compareCrossChartAspects(pinned, current) {
  const comparison = compareCharts(pinned, current);
  if (!comparison.rows.length) return { available: false, rows: [], evaluatedPairs: 0, skippedPairs: 0, warning: comparison.warning };
  const valid = (value) => Number.isFinite(value) && value >= 0 && value <= 360;
  const rows = [];
  let evaluatedPairs = 0, skippedPairs = 0;
  for (const left of comparison.rows) {
    for (const right of comparison.rows) {
      if (!valid(left.pinned) || !valid(right.current)) { skippedPairs += 1; continue; }
      evaluatedPairs += 1;
      const separation = angularSeparation(left.pinned, right.current);
      const matches = MAJOR_ASPECTS.map((aspect) => ({ aspect, orb: Math.abs(separation - aspect.angle) }))
        .filter(({ aspect, orb }) => orb <= aspect.orb)
        .sort((a, b) => a.orb - b.orb || a.aspect.angle - b.aspect.angle);
      if (!matches.length) continue;
      const { aspect, orb } = matches[0];
      rows.push({ pinned: left.body, current: right.body, aspect: aspect.id, angle: aspect.angle, separation, orb });
    }
  }
  // Stable ties retain the table's fixed point order on each side.
  rows.sort((a, b) => a.orb - b.orb);
  return { available: true, rows, evaluatedPairs, skippedPairs, warning: comparison.warning };
}

export function crossAspectSummary(result) {
  return `${result.rows.length} matches from ${result.evaluatedPairs} valid pairs; ${result.skippedPairs} pairs skipped for unavailable values. Sorted by smallest orb, not significance.`;
}
