import { summarizeTimings } from './qa-performance-stats.mjs';

// Local acceptance ceilings chosen before the new full-app measurements.
// Historical 1000-event samples reached 652 ms. These are responsive completion
// ceilings, not FPS, physical-input latency or guarantees for arbitrary hardware.
export const PERFORMANCE_BUDGET = Object.freeze({ medianMs: 500, maxMs: 2000 });
export function reviewPerformanceSamples(samples) {
  if (!Array.isArray(samples) || samples.length < 3 || samples.some(n => !Number.isFinite(n) || n < 0)) {
    throw new TypeError('Need at least three nonnegative finite timings');
  }
  const summary = summarizeTimings(samples), maximumMs = Math.max(...samples);
  const sorted = [...samples].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return { ...summary, maximumMs, rawMs: samples,
    accepted: median <= PERFORMANCE_BUDGET.medianMs && maximumMs <= PERFORMANCE_BUDGET.maxMs };
}
