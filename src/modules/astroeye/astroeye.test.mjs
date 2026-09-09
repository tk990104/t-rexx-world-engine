import assert from 'node:assert/strict';
import test from 'node:test';

import { createWorldPlatform } from '../../core/platform.js';
import { createAstroEyeModule } from './index.js';

test('AstroEye is the first activatable module on the shared platform', async () => {
  const platform = createWorldPlatform();
  const events = [];
  platform.eventBus.on('astroeye:status', (event) => events.push(event));
  platform.moduleRegistry.register(createAstroEyeModule());

  await platform.moduleRegistry.activate('astroeye');
  assert.equal(platform.moduleRegistry.activeId, 'astroeye');
  assert.deepEqual(platform.moduleRegistry.snapshot(), {
    version: 1,
    activeModuleId: 'astroeye',
    moduleState: { version: 1, active: true },
  });

  await platform.moduleRegistry.deactivate();
  assert.deepEqual(events, [{ active: true }, { active: false }]);
});

test('AstroEye declares shared services instead of reaching into UI globals', () => {
  const astroEye = createAstroEyeModule();
  assert.deepEqual(astroEye.capabilitiesRequired, [
    'commandRegistry',
    'eventBus',
    'moduleState',
    'panelRegistry',
    'sourceRegistry',
    'worldClock',
  ]);
  assert.equal(astroEye.layers.length, 0);
  assert.equal(astroEye.panels.length, 0);
});
