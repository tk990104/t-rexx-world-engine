import assert from 'node:assert/strict';
import test from 'node:test';

import { ASTROEYE_EVENT_ENTITY_ID, createAstroEyeWorldPresenter } from './worldPresenter.js';

const EVENT = {
  id: 'event-1',
  title: 'Away at Home',
  utcStart: '2026-09-10T00:15:00.000Z',
  scheduledLocal: { date: '2026-09-09', time: '20:15:00', timeZone: 'America/New_York' },
  venue: { latitude: 40.7505, longitude: -73.9934 },
};

test('world presenter replaces one venue marker and navigates to exact coordinates', async () => {
  const added = [];
  const removed = [];
  const navigation = [];
  let renders = 0;
  const viewer = {
    entities: {
      add: (definition) => { added.push(definition); return definition; },
      removeById: (id) => { removed.push(id); return true; },
    },
    scene: { requestRender: () => { renders += 1; } },
  };
  const present = createAstroEyeWorldPresenter({
    viewer,
    navigate: (_viewer, latitude, longitude, options) => navigation.push({ latitude, longitude, options }),
  });

  await present(EVENT, { chartId: 'chart-1' });
  assert.deepEqual(removed, [ASTROEYE_EVENT_ENTITY_ID]);
  assert.equal(added[0].id, ASTROEYE_EVENT_ENTITY_ID);
  assert.equal(added[0].properties.eventId, EVENT.id);
  assert.equal(navigation[0].latitude, EVENT.venue.latitude);
  assert.equal(navigation[0].longitude, EVENT.venue.longitude);
  assert.equal(renders, 1);

  await present(null, null);
  assert.deepEqual(removed, [ASTROEYE_EVENT_ENTITY_ID, ASTROEYE_EVENT_ENTITY_ID]);
  assert.equal(renders, 2);
});
