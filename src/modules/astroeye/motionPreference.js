/** Read the current host preference at each explicit action, without listeners or storage. */
export function astroEyeMotionDuration(seconds, host = globalThis.window) {
  try {
    if (host?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true) return 0;
  } catch { /* An unavailable browser preference retains the established animation. */ }
  return seconds;
}

/** Shared by normal venue navigation and the guarded venue command. */
export function astroEyeVenueOptions(durationFor = astroEyeMotionDuration) {
  return { range: 12000, pitch: -42, heading: 12, buildingHeight: 0, duration: durationFor(2.4) };
}
