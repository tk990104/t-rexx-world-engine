/** Sample the host preference per explicit navigation action; never persist it. */
export function motionDuration(seconds, host = globalThis.window) {
  try {
    if (host?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true) return 0;
  } catch { /* An unavailable preference retains the established animation. */ }
  return seconds;
}
