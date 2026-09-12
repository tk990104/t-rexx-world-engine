import * as Cesium from 'cesium';

const wrap = (value) => ((value + 180) % 360 + 360) % 360 - 180;

/** Shortest longitude interval keeps venues across the date line together. */
export function savedEventFrame(points) {
  if (!Array.isArray(points) || !points.length || points.length > 101) throw new Error('Show matching saved-event markers before framing them.');
  for (const { latitude, longitude } of points) {
    if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) throw new Error('Marker coordinates are invalid.');
  }
  const longitudes = points.map((point) => (point.longitude + 360) % 360).sort((a, b) => a - b);
  let gap = -1, start = 0;
  for (let i = 0; i < longitudes.length; i++) {
    const next = longitudes[(i + 1) % longitudes.length] + (i === longitudes.length - 1 ? 360 : 0);
    if (next - longitudes[i] > gap) { gap = next - longitudes[i]; start = next % 360; }
  }
  const span = 360 - gap;
  const south = Math.min(...points.map((point) => point.latitude));
  const north = Math.max(...points.map((point) => point.latitude));
  const longitude = wrap(start + span / 2), latitude = (south + north) / 2;
  if (span >= 120 || north - south >= 100) return { mode: 'globe', latitude, longitude, count: points.length };
  const lonPad = Math.max(.03, span * .15), latPad = Math.max(.03, (north - south) * .15);
  return { mode: 'region', west: wrap(start - lonPad), east: wrap(start + span + lonPad),
    south: Math.max(-90, south - latPad), north: Math.min(90, north + latPad), count: points.length };
}

/** Explicit camera route only; callers retain ownership of records and chart time. */
export function createSavedEventFramer({ viewer, getPoints, canInteract, runNavigation }) {
  return () => {
    if (!canInteract()) throw new Error('Stop the current preview before viewing matching markers.');
    const frame = savedEventFrame(getPoints());
    const result = runNavigation('saved-event markers', () => {
      const destination = frame.mode === 'globe'
        ? Cesium.Cartesian3.fromDegrees(frame.longitude, frame.latitude, 18000000)
        : Cesium.Rectangle.fromDegrees(frame.west, frame.south, frame.east, frame.north);
      viewer.camera.cancelFlight();
      viewer.camera.flyTo({ destination, duration: 1.8,
        orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 }, endTransform: Cesium.Matrix4.IDENTITY });
      return frame;
    });
    if (result === false) throw new Error('Exit the current camera mode before viewing matching markers.');
    return result;
  };
}
