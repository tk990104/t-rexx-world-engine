// Conservative UI support boundary, not a physical polar-circle constant or accuracy claim.
export const ANGLE_CAUTION_LATITUDE = 66;
export const HIGH_LATITUDE_ANGLE_CAUTION = 'High-latitude chart: angles and houses are provisional. Legacy model 1 can select the western horizon intersection or become unstable near a polar boundary. Model 2 selects the eastern intersection and rejects unstable boundaries, but independent high-latitude validation remains incomplete.';

export function needsAngleCaution(chart) {
  const latitude = chart?.location?.latitude;
  return Number.isFinite(latitude) && Math.abs(latitude) >= ANGLE_CAUTION_LATITUDE && Math.abs(latitude) <= 90;
}

export function renderAngleCaution(node, chart) {
  const show = needsAngleCaution(chart);
  node.textContent = show ? HIGH_LATITUDE_ANGLE_CAUTION : '';
  node.hidden = !show;
}
