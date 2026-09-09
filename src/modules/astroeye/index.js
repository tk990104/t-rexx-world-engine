import { ASTROEYE_MANIFEST } from './manifest.js';
import { ASTRONOMY_ENGINE_SOURCE } from './calculation/astronomyEngineProvider.js';

/** AstroEye lifecycle for the first saved-event and world-presentation slice. */
export function createAstroEyeModule() {
  let active = false;
  return {
    ...ASTROEYE_MANIFEST,
    async start({ eventBus, sourceRegistry }) {
      if (!sourceRegistry.get(ASTRONOMY_ENGINE_SOURCE.id)) {
        sourceRegistry.register(ASTRONOMY_ENGINE_SOURCE);
      }
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
