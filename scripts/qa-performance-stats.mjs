/** Nearest-rank percentiles; timings are observations, not release acceptance. */
export function summarizeTimings(samples) {
  if (!Array.isArray(samples) || !samples.length || samples.some((n) => !Number.isFinite(n) || n < 0)) {
    throw new TypeError('Provide nonempty finite nonnegative timing samples');
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const round = (value) => Math.round(value * 1000) / 1000;
  return { samples: sorted.length, minMs: round(sorted[0]),
    medianMs: round(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2),
    p95Ms: round(sorted[Math.ceil(sorted.length * 0.95) - 1]), maxMs: round(sorted.at(-1)) };
}
