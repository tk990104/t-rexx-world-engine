// Conservative display guard, not an astronomical error bound.
export const PLANETARY_HOUR_EDGE_NOTICE_MS = 1000;
// Display policy: a <=4-minute hour cannot have a midpoint more than the
// reference checks' 120-second screen from both edges. Not an error bound,
// and longer intervals are not automatically certified by this policy.
export const PLANETARY_HOUR_SHORT_INTERVAL_MS = 240000;
export const PLANETARY_HOUR_ESTIMATE_NOTICE = 'Calculated from sunrise and sunset; times are estimates, not observed boundaries.';
export const PLANETARY_HOUR_BOUNDARY_NOTICE = 'Boundary uncertain: this instant is near a calculated hour edge. Astronomical timing precision is limited; legacy models also have boundary-assignment defects. Saved results have not been changed.';
export const PLANETARY_HOUR_SHORT_NOTICE = 'Short calculated interval (4 minutes or less): treat this hour assignment as provisional. Our minute-rounded reference checks do not resolve every short hour. Longer intervals are still estimates; this cutoff is not an accuracy guarantee. Saved results have not been changed.';

export function planetaryHourPresentation(chart) {
  const hour = chart?.planetaryHour;
  if (!hour || hour.status !== 'exact') {
    return { label: 'Unavailable', notice: hour?.reason || 'Planetary-hour boundaries are unavailable.', uncertain: false };
  }
  const parse = (v) => typeof v === 'string' && v.endsWith('Z') ? Date.parse(v) : NaN;
  const instant = parse(chart.calculatedFor), start = parse(hour.start), end = parse(hour.end);
  const valid = [instant, start, end].every(Number.isFinite) && end > start;
  const boundaryUncertain = !valid || instant < start || instant >= end
    || Math.min(Math.abs(instant - start), Math.abs(end - instant)) <= PLANETARY_HOUR_EDGE_NOTICE_MS;
  const shortInterval = valid && end - start <= PLANETARY_HOUR_SHORT_INTERVAL_MS;
  const hourLabel = `${hour.ruler} · ${hour.period} ${hour.hourNumber}`;
  return {
    label: boundaryUncertain ? 'Boundary uncertain' : shortInterval ? `${hourLabel} (provisional)` : hourLabel,
    notice: !valid || instant < start || instant >= end
      ? 'Planetary-hour timing is incomplete or does not contain this instant. No definite hour is shown; saved results have not been changed.'
      : boundaryUncertain ? PLANETARY_HOUR_BOUNDARY_NOTICE : shortInterval ? PLANETARY_HOUR_SHORT_NOTICE : PLANETARY_HOUR_ESTIMATE_NOTICE,
    uncertain: boundaryUncertain || shortInterval,
  };
}

export function renderPlanetaryHour(labelNode, noticeNode, chart) {
  const presentation = planetaryHourPresentation(chart);
  labelNode.textContent = presentation.label;
  noticeNode.textContent = presentation.notice;
  noticeNode.dataset.uncertain = String(presentation.uncertain);
}
