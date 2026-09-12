import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeEvent } from '../../domain/events/eventSchema.js';
import { eventFromDraft } from './workspaceController.js';
import { eventTemplateDraft } from './eventTemplate.js';

const EVENT = { id: 'original', title: 'Away at Home', sport: 'Demo', competition: 'Cup',
  participants: { home: 'Home', away: 'Away' }, scheduledLocal: { date: '2026-11-01', time: '01:30:15', timeZone: 'America/New_York' },
  utcStart: '2026-11-01T06:30:15Z', durationMinutes: 120,
  venue: { name: 'Arena', latitude: 40.75, longitude: -73.99, coordinateSource: 'provider' },
  source: { kind: 'provider', provider: 'Example', sourceEventId: 'external-id', retrievedAt: '2026-09-12T00:00:00Z' } };

test('template preserves event inputs and house system without copying identity or provider provenance', () => {
  const before = JSON.stringify(EVENT);
  const draft = eventTemplateDraft(EVENT, 'equal');
  assert.equal(draft.title, EVENT.title);
  assert.equal(draft.venueName, EVENT.venue.name);
  assert.equal(draft.durationMinutes, 120);
  assert.equal(draft.houseSystem, 'equal');
  assert.equal(draft.id, undefined);
  assert.equal(draft.source, undefined);
  assert.equal(draft.coordinateSource, undefined);
  const event = eventFromDraft(draft, () => 'new-id');
  assert.equal(event.id, 'new-id');
  assert.equal(event.source.kind, 'manual');
  assert.equal(event.source.provider, null);
  assert.equal(event.source.sourceEventId, null);
  assert.equal(event.venue.coordinateSource, 'user-confirmed');
  assert.equal(JSON.stringify(EVENT), before);
  assert.ok(Object.isFrozen(draft));
});

test('both repeated-hour occurrences and seconds survive the draft round-trip', () => {
  for (const utcStart of ['2026-11-01T05:30:15Z', '2026-11-01T06:30:15Z']) {
    const event = normalizeEvent({ ...EVENT, utcStart });
    const copied = eventFromDraft(eventTemplateDraft(event), () => 'new-id');
    assert.equal(copied.utcStart, event.utcStart);
    assert.deepEqual(copied.scheduledLocal, event.scheduledLocal);
  }
});

test('optional duration remains empty while a zero duration is preserved', () => {
  assert.equal(eventTemplateDraft({ ...EVENT, durationMinutes: null }).durationMinutes, '');
  assert.equal(eventTemplateDraft({ ...EVENT, durationMinutes: 0 }).durationMinutes, 0);
});

test('invalid events and unsupported house systems fail before producing a draft', () => {
  assert.throws(() => eventTemplateDraft({ ...EVENT, venue: { ...EVENT.venue, latitude: 91 } }));
  assert.throws(() => eventTemplateDraft(EVENT, 'unsupported'), /house system/);
});
