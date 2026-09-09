/** Public identity and capability declaration for the first T-Rexx module. */
export const ASTROEYE_MANIFEST = Object.freeze({
  id: 'astroeye',
  title: 'AstroEye',
  version: '0.1.0',
  icon: 'planet',
  status: 'foundation',
  tagline: 'Event charts synchronized with the living Earth.',
  capabilitiesRequired: Object.freeze([
    'commandRegistry',
    'eventBus',
    'sourceRegistry',
    'worldClock',
  ]),
  layers: Object.freeze([]),
  panels: Object.freeze([]),
  commands: Object.freeze([]),
  sceneRecipes: Object.freeze([]),
  credits: Object.freeze([]),
});
