import { normalizeSharedView } from './shareView.js';
import { BLOOM_SCALE_VERSION } from '../../bloom.js';

export const ASTROEYE_TOUR_RECIPE_ID = 'astroeye-event-tour';

/** Calculation inputs only; tours leave event sky off while approaching the venue. */
export function normalizeAstroEyeSceneView(input) {
  const { skyEnabled: _sky, ...view } = normalizeSharedView(input);
  return view;
}

/** Same event/view and scene ID always produce the same three shots. */
export function createAstroEyeTour(input, { id = `astroeye-tour-${crypto.randomUUID()}` } = {}) {
  const view = normalizeAstroEyeSceneView(input);
  const { latitude: lat, longitude: lon } = view.event.venue;
  const instant = new Date(Date.parse(view.event.utcStart) + view.offsetMinutes * 60000).toISOString();
  const timeLabel = instant.replace('T', ' ').replace('.000Z', ' UTC');
  const poses = [
    { title: 'World', alt: 18000000, durationSec: 3, holdSec: 2 },
    { title: 'Region', alt: 250000, durationSec: 4, holdSec: 2 },
    { title: 'Venue', alt: 12000, durationSec: 4, holdSec: 3 },
  ];
  return {
    id, title: `AstroEye · ${view.event.title}`,
    shots: poses.map((pose, index) => ({
      id: `${id}-${index + 1}`, title: `${pose.title} · ${timeLabel}`,
      durationSec: pose.durationSec, holdSec: pose.holdSec,
      camera: { lat, lon, alt: pose.alt, heading: 0, pitch: -90, roll: 0 },
      visual: { style: 'normal', bloom: { enabled: false, intensity: 0, version: BLOOM_SCALE_VERSION },
        sharpen: { enabled: true, intensity: 49 }, hud: { visible: true, variant: 'tactical' },
        detection: { mode: 'OFF', density: 35 } },
      // Undeclared live layers remain under the user's control.
      layers: {}, modules: { astroeye: structuredClone(view) },
    })),
  };
}
