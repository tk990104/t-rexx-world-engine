import { motionDuration as astroEyeMotionDuration } from '../../core/motionPreference.js';
export { astroEyeMotionDuration };

/** Shared by normal venue navigation and the guarded venue command. */
export function astroEyeVenueOptions(durationFor = astroEyeMotionDuration) {
  return { range: 12000, pitch: -42, heading: 12, buildingHeight: 0, duration: durationFor(2.4) };
}
