import { ASTROEYE_MANIFEST } from './manifest.js';

/** Headless AstroEye lifecycle; event/chart services arrive in the next slice. */
export function createAstroEyeModule() {
  let active = false;
  return {
    ...ASTROEYE_MANIFEST,
    async start({ eventBus }) {
      active = true;
      eventBus.emit('astroeye:status', { active: true });
    },
    async stop({ eventBus }) {
      active = false;
      eventBus.emit('astroeye:status', { active: false });
    },
    serializeState() {
      return { version: 1, active };
    },
  };
}
