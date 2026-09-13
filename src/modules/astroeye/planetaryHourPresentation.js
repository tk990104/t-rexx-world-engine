// Conservative display guard, not an astronomical error bound.
export const PLANETARY_HOUR_EDGE_NOTICE_MS = 1000;
export const PLANETARY_HOUR_ESTIMATE_NOTICE = 'Calculated from sunrise and sunset; times are estimates, not observed boundaries.';
export const PLANETARY_HOUR_BOUNDARY_NOTICE = 'Boundary uncertain: this instant is near a calculated hour edge. Astronomical timing precision is limited; legacy models also have boundary-assignment defects. Saved results have not been changed.';

export function planetaryHourPresentation(chart) {
  const hour = chart?.planetaryHour;
  if (!hour || hour.status !== 'exact') {
    return { label: 'Unavailable', notice: hour?.reason || 'Planetary-hour boundaries are unavailable.', uncertain: false };
  }
  const parse = (v) => typeof v === 'string' && v.endsWith('Z') ? Date.parse(v) : NaN;
  const instant = parse(chart.calculatedFor), start = parse(hour.start), end = parse(hour.end);
  const valid = [instant, start, end].every(Number.isFinite) && end > start;
  const uncertain = !valid || instant < start || instant >= end
    || Math.min(Math.abs(instant - start), Math.abs(end - instant)) <= PLANETARY_HOUR_EDGE_NOTICE_MS;
  return {
    label: uncertain ? 'Boundary uncertain' : `${hour.ruler} · ${hour.period} ${hour.hourNumber}`,
    notice: !valid || instant < start || instant >= end
      ? 'Planetary-hour timing is incomplete or does not contain this instant. No definite hour is shown; saved results have not been changed.'
      : uncertain ? PLANETARY_HOUR_BOUNDARY_NOTICE : PLANETARY_HOUR_ESTIMATE_NOTICE,
    uncertain,
  };
}

export function renderPlanetaryHour(labelNode, noticeNode, chart) {
  const presentation = planetaryHourPresentation(chart);
  labelNode.textContent = presentation.label;
  noticeNode.textContent = presentation.notice;
  noticeNode.dataset.uncertain = String(presentation.uncertain);
}
