import assert from 'node:assert/strict';
import test from 'node:test';
import { MAP_STACKS, MapStackController } from './mapStackController.js';

test('OSM provider has linked on-screen attribution and is reused without a fetch', async () => {
  const controller = new MapStackController({});
  const stack = MAP_STACKS.find(({ id }) => id === 'osm');
  const provider = await controller._getImageryProvider(stack);
  assert.equal(provider.credit.showOnScreen, true);
  assert.match(provider.credit.html, /https:\/\/www\.openstreetmap\.org\/copyright/);
  assert.match(provider.credit.html, /OpenStreetMap<\/a> contributors/);
  assert.equal(await controller._getImageryProvider(stack), provider);
});
