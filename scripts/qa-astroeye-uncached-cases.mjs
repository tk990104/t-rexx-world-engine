import { normalizeEvent } from '../src/domain/events/eventSchema.js';
import { ASTROEYE_REGRESSION_CASES, eventFromRegressionCase } from '../src/modules/astroeye/calculation/regressionCases.js';

const batches = Object.freeze({
  fold: Object.freeze(['new-york-fall-fold-first', 'new-york-fall-fold-second']),
  offsets: Object.freeze(['sydney-summer', 'kathmandu-quarter-offset']),
  polar: Object.freeze(['longyearbyen-polar-day', 'longyearbyen-polar-night']),
});

// Validate before launching a browser; return a copy so callers cannot alter coverage.
export function uncachedBatchIds(batch) {
  if (!Object.hasOwn(batches, batch)) throw new Error('Uncached batch must be fold, offsets or polar');
  return [...batches[batch]];
}

// Reuse input locations/times only, never the legacy ephemeris snapshots.
export function uncachedChartCases() {
  const ids = ['new-york-fall-fold-first', 'sydney-summer', 'kathmandu-quarter-offset',
    'longyearbyen-polar-day', 'longyearbyen-polar-night'];
  const inputs = ids.map((id) => {
    const value = ASTROEYE_REGRESSION_CASES.find((entry) => entry.id === id);
    if (!value) throw new Error(`Missing uncached fixture: ${id}`);
    return value;
  });
  inputs.splice(1, 0, { ...inputs[0], id: 'new-york-fall-fold-second', utcStart: '2026-11-01T06:30:00.000Z' });
  return inputs.map((input) => ({ id: input.id, polar: input.id.startsWith('longyearbyen-'),
    event: normalizeEvent({ ...eventFromRegressionCase(input), id: `qa-uncached-${input.id}` }) }));
}
