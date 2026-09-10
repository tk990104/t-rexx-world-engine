import * as Astronomy from 'astronomy-engine';

/** Chart ECT directions -> true equator of date -> Earth-fixed (no observer parallax). */
export function eventSkyDirections(chart) {
  const date = new Date(chart?.calculatedFor);
  if (!Number.isFinite(date.getTime())) throw new Error('A valid chart time is required for the event sky.');
  const rotation = Astronomy.Rotation_ECT_EQD(date);
  const theta = Astronomy.SiderealTime(date) * Math.PI / 12;
  const directions = {};
  for (const body of ['Sun', 'Moon']) {
    const position = chart.positions?.find((entry) => entry.body === body);
    if (!position || !Number.isFinite(position.longitude) || !Number.isFinite(position.latitude)
      || Math.abs(position.latitude) > 90) throw new Error(`Missing valid ${body} chart position.`);
    const lon = position.longitude * Math.PI / 180;
    const lat = position.latitude * Math.PI / 180;
    const vector = new Astronomy.Vector(Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat), date);
    const equator = Astronomy.RotateVector(rotation, vector);
    directions[body.toLowerCase()] = Object.freeze({
      x: Math.cos(theta) * equator.x + Math.sin(theta) * equator.y,
      y: -Math.sin(theta) * equator.x + Math.cos(theta) * equator.y,
      z: equator.z,
    });
  }
  return Object.freeze({ ...directions, time: date.toISOString(), owner: 'astroeye' });
}

/** Small adapter: the ring owns drawing; AstroEye supplies cached chart directions. */
export function createEventSky({ ring, setRingEnabled } = {}) {
  let chart = null;
  let previousEnabled = false;
  const isEnabled = () => ring.getDirectionSnapshot()?.owner === 'astroeye';
  function disable() {
    if (!isEnabled()) return;
    ring.setDirectionSnapshot(null);
    setRingEnabled(previousEnabled, { focus: false, syncShare: true });
  }
  return Object.freeze({
    isEnabled,
    update(nextChart) {
      chart = nextChart;
      if (!chart) disable();
      else if (isEnabled()) ring.setDirectionSnapshot(eventSkyDirections(chart));
    },
    setEnabled(enabled, { focus = true } = {}) {
      if (!enabled) { disable(); return; }
      if (!chart) throw new Error('Choose an event before showing its sky.');
      const snapshot = eventSkyDirections(chart);
      const wasActive = isEnabled();
      const wasEnabled = ring.enabled;
      const result = setRingEnabled(true, { focus, syncShare: true });
      if (!result.ok) throw new Error(result.error || 'The event sky could not be enabled.');
      if (!wasActive) previousEnabled = wasEnabled;
      ring.setDirectionSnapshot(snapshot);
    },
    destroy: disable,
  });
}
