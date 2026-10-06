// Shared allowlist: untrusted diagnostic strings never become log content.
const EVENTS = new Set([
  'controller.created', 'session.starting', 'session.token.ready', 'data_channel.open',
  'webrtc.offer.created', 'webrtc.answer.applied', 'session.start.abandoned',
  'webrtc.disconnected.grace', 'session.stop', 'server.event', 'client.event',
  'tool.call', 'tool.result', 'tool.call.skipped_superseded', 'tool.radio_handoff',
  'viewport_context.failed', 'client.send.failed', 'error', 'voice.cost',
  'voice.cost.cap', 'voice.cost.cap.tools_skipped', 'response.create.deferred_user_text',
  'response.create.skipped_active', 'response.create.skipped_user_turn',
  'viewport_delete.item_not_found', 'client.response_create.tool_followup',
]);
const STATUSES = new Set(['idle', 'connecting', 'listening', 'executing', 'error']);

export function voiceDiagnosticRecord(value) {
  if (!value || typeof value !== 'object' || !EVENTS.has(value.event)) return null;
  return { event: value.event, status: STATUSES.has(value.status) ? value.status : 'unknown' };
}
