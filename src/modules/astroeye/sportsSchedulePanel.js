import { createSportsScheduleClient } from './sportsSchedule.js';
import { capturePanelOperationFocus } from './panelOperationFocus.js';

/** Read-only discovery; choosing a result prepares the event form, never saves. */
export function mountSportsSchedulePanel(host, { onSelect, client = createSportsScheduleClient(), focusHost = host }) {
  host.innerHTML = `
    <div class="astroeye-section-heading"><div><h3>NFL schedule</h3></div></div>
    <div class="astroeye-schedule-controls">
      <button type="button" data-schedule="next">Upcoming</button>
      <label>Schedule date (UTC)<input type="date" data-schedule="date" aria-label="Schedule date (UTC)" /></label>
      <button type="button" data-schedule="day">Find games</button>
    </div>
    <p class="astroeye-help">Schedule data from <a href="https://www.thesportsdb.com/" target="_blank" rel="noopener noreferrer">TheSportsDB</a>. Limited results; this is not a full league schedule.</p>
    <p class="astroeye-help" data-schedule="status" role="status">Choose upcoming games or a date.</p>
    <div class="astroeye-event-list" data-schedule="results"></div>`;
  const date = host.querySelector('[data-schedule="date"]');
  date.value = new Date().toISOString().slice(0, 10);
  const results = host.querySelector('[data-schedule="results"]');
  const status = host.querySelector('[data-schedule="status"]');
  let events = [];
  let request;
  let generation = 0;
  let destroyed = false, pendingFocus = null;

  function cancel() {
    generation += 1;
    pendingFocus?.({ cancel: true }); pendingFocus = null;
    request?.abort();
    request = null;
    host.querySelectorAll('button').forEach((button) => { button.disabled = false; });
  }

  async function click(event) {
    const button = event.target.closest('button');
    if (destroyed || !button || button.disabled) return;
    const action = button.dataset.schedule;
    if (!action && button.dataset.scheduleIndex == null) return;
    if (action === 'day' && !date.value) { status.textContent = 'Choose a date first.'; return; }
    cancel();
    // Capture only actions originating here; a wider host permits the reviewed
    // form handoff, but does not grant ownership of unrelated external focus.
    const restoreFocus = host.contains(host.ownerDocument.activeElement)
      ? capturePanelOperationFocus(focusHost) : () => {};
    pendingFocus = restoreFocus;
    let selectedTarget = null;
    const current = generation;
    request = new AbortController();
    const signal = request.signal;
    host.querySelectorAll('button').forEach((item) => { item.disabled = true; });
    try {
      if (action === 'next' || action === 'day') {
        status.textContent = 'Loading NFL schedule…';
        results.replaceChildren();
        const response = await client.schedule(action === 'day' ? date.value : null, signal);
        if (current !== generation) return;
        events = response.events;
        for (const [index, game] of events.entries()) {
          const item = document.createElement('button');
          item.type = 'button';
          item.dataset.scheduleIndex = String(index);
          const title = document.createElement('strong');
          const detail = document.createElement('span');
          title.textContent = game.title;
          detail.textContent = `${game.utcStart ? game.utcStart.replace('T', ' ').replace('.000Z', ' UTC') : 'Time needs review'} · ${game.venueName || 'Venue unavailable'} · ${game.status}`;
          item.append(title, detail);
          results.append(item);
        }
        status.textContent = `${events.length ? `${events.length} result(s)` : 'No games returned; coverage may be limited'}. ${response.access === 'free' ? 'Free tier: up to 1 upcoming or 3 date results. ' : ''}${response.skipped ? `${response.skipped} incomplete record(s) omitted. ` : ''}${response.cached ? 'Cached · ' : ''}Fetched ${new Date(response.retrievedAt).toLocaleString()}.`;
      } else {
        const game = events[Number(button.dataset.scheduleIndex)];
        if (!game) return;
        status.textContent = 'Loading venue details…';
        let venue = null;
        let missing = false;
        if (game.venueId) {
          try { venue = (await client.venue(game.venueId, signal)).venue; }
          catch (error) { if (signal.aborted) throw error; missing = true; }
        }
        if (current !== generation) return;
        // A callback may return a form control for a guarded focus handoff.
        selectedTarget = onSelect(game, venue);
        status.textContent = `Loaded into the form. ${missing ? 'Venue lookup unavailable; enter coordinates manually. ' : ''}${venue?.timeZoneHint ? `Provider zone hint: ${venue.timeZoneHint}. ` : ''}Choose the venue's IANA time zone and check the time and location before saving.`;
      }
    } catch (error) {
      if (current === generation && !signal.aborted) status.textContent = error.message || 'Schedules are unavailable. Enter an event manually.';
    } finally {
      if (current === generation) {
        host.querySelectorAll('button').forEach((item) => { item.disabled = false; });
        request = null;
      }
      restoreFocus({ preferred: [selectedTarget], cancel: destroyed || current !== generation });
      if (pendingFocus === restoreFocus) pendingFocus = null;
    }
  }
  host.addEventListener('click', click);
  return { cancel, destroy() { destroyed = true; cancel(); host.removeEventListener('click', click); } };
}
