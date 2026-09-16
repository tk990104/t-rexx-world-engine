const count = (value) => Number.isSafeInteger(value) && value >= 0;
const retryAdvice = Object.freeze({
  interaction: 'Input interrupted the check. Retry and leave the tab untouched for 10 seconds.',
  'tab-hidden': 'The tab became hidden. Retry with the preview visible for 10 seconds.',
  cancelled: 'The check was cancelled. You can start again when ready.',
  disposed: 'The panel closed before completion. Reopen it to try again.',
  'timer-outside-window': 'The timer fell outside the allowed window. Retry when the browser is responsive.',
  'counter-read-failed': 'Diagnostic counters could not be read. This result cannot be interpreted.',
  'observer-unavailable': 'The scene observer was unavailable. This result cannot be interpreted.',
});

/** Local display text only; never infer a performance pass or echo unknown fields. */
export function summarizeRenderCheck(report) {
  if (report?.status !== 'completed' || report?.reason !== 'completed') {
    const advice = Object.hasOwn(retryAdvice, report?.reason) ? retryAdvice[report.reason]
      : 'The check did not complete. Try again when ready.';
    return `Observation incomplete. ${advice} No performance conclusion is available.`;
  }
  if (!count(report.renderedFrames) || !count(report.elapsedMs)
      || report.elapsedMs < 10000 || report.elapsedMs > 15000) {
    return 'Observation unavailable: missing or invalid timing data. No performance conclusion is available.';
  }
  const { before, after } = report;
  const parts = [`Observed ${report.renderedFrames} scene renders in ${(report.elapsedMs / 1000).toFixed(2)} seconds.`];
  if (report.renderedFrames === 0) parts.push('Zero renders can be normal for an idle scene.');
  const endpointsKnown = [before, after].every((value) => value
    && ['idle', 'continuous'].includes(value.governorMode) && count(value.continuousHolds)
    && typeof value.eventSkyEnabled === 'boolean');
  if (!endpointsKnown) parts.push('Some configuration counters are unavailable.');
  else if (['governorMode', 'continuousHolds', 'eventSkyEnabled'].some((key) => before[key] !== after[key])) {
    parts.push('Start and end configuration differed; do not treat this as a fixed-configuration sample.');
  } else {
    parts.push(`At both endpoints: ${after.governorMode} mode, ${after.continuousHolds} continuous-render holds, event sky ${after.eventSkyEnabled ? 'on' : 'off'}.`);
    parts.push('Matching endpoints do not prove the configuration stayed constant between them.');
  }
  parts.push(count(report.ephemerisUpdateDelta)
    ? `Ephemeris counter increased by ${report.ephemerisUpdateDelta}.`
    : 'Ephemeris change is unavailable (missing or reset counters).');
  parts.push('Observation only—not a frame-rate benchmark or release pass.');
  return parts.join(' ');
}
