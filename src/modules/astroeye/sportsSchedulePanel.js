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
      <button type="button" data-schedule="cancel" hidden>Cancel lookup</button>
    </div>
    <p class="astroeye-help">Schedule data from <a href="https://www.thesportsdb.com/" target="_blank" rel="noopener noreferrer">TheSportsDB</a>. Limited results; this is not a full league schedule.</p>
    <p class="astroeye-help">Changing the date does not start a search. Choose Find games; existing results keep their original search label.</p>
    <p class="astroeye-help" data-schedule="status" role="status">Choose upcoming games or a date.</p>
    <p class="astroeye-help" data-schedule="scope" hidden></p>
    <div class="astroeye-event-list" data-schedule="results" role="group" aria-label="NFL schedule results"></div>`;
  const date = host.querySelector('[data-schedule="date"]');
  date.value = new Date().toISOString().slice(0, 10);
  const results = host.querySelector('[data-schedule="results"]');
  const status = host.querySelector('[data-schedule="status"]');
  const scope = host.querySelector('[data-schedule="scope"]');
  const cancelButton = host.querySelector('[data-schedule="cancel"]');
  const upcoming = host.querySelector('[data-schedule="next"]');
  let events = [];
  let request;
  let requestKind = null;
  let pendingDate = null;
  let generation = 0;
  let destroyed = false, pendingFocus = null;

  function setBusy(busy) {
    host.querySelectorAll('button').forEach((button) => { button.disabled = busy && button !== cancelButton; });
    cancelButton.hidden = !busy;
  }

  function cancel({ announce = true } = {}) {
    const kind = requestKind;
    generation += 1;
    pendingFocus?.({ cancel: true }); pendingFocus = null;
    request?.abort();
    request = null;
    requestKind = null;
    pendingDate = null;
    setBusy(false);
    if (announce && kind && !destroyed) status.textContent = kind === 'selection'
      ? 'Venue lookup cancelled. The event form is unchanged. Select a game to try again.'
      : 'Schedule lookup cancelled. Choose upcoming games or a date to try again.';
  }

  function cancelChangedDate() {
    if (destroyed || requestKind !== 'schedule' || pendingDate === null || date.value === pendingDate) return false;
    cancel({ announce: false });
    status.textContent = 'Schedule date changed. Previous lookup cancelled. Choose Find games to search again.';
    return true;
  }
  const dateEdited = (event) => { if (event.target === date) cancelChangedDate(); };

  async function click(event) {
    const button = event.target.closest('button');
    if (destroyed || !button || button.disabled) return;
    const action = button.dataset.schedule;
    if (action === 'cancel') {
      if (!request) return;
      const restore = host.contains(host.ownerDocument.activeElement) ? capturePanelOperationFocus(focusHost) : () => {};
      cancel(); restore({ fallback: [upcoming, date] });
      return;
    }
    if (!action && button.dataset.scheduleIndex == null) return;
    if (action === 'day' && !date.value) { status.textContent = 'Choose a date first.'; return; }
    const requestedDate = action === 'day' ? date.value : null;
    const queryLabel = requestedDate === null ? 'Upcoming NFL games' : `NFL games for ${requestedDate} (UTC)`;
    cancel({ announce: false });
    // Capture only actions originating here; a wider host permits the reviewed
    // form handoff, but does not grant ownership of unrelated external focus.
    const restoreFocus = host.contains(host.ownerDocument.activeElement)
      ? capturePanelOperationFocus(focusHost) : () => {};
    pendingFocus = restoreFocus;
    let selectedTarget = null;
    const current = generation;
    request = new AbortController();
    requestKind = action === 'next' || action === 'day' ? 'schedule' : 'selection';
    pendingDate = requestedDate;
    const signal = request.signal;
    setBusy(true);
    try {
      if (action === 'next' || action === 'day') {
        status.textContent = `Loading ${queryLabel}…`;
        results.replaceChildren();
        scope.textContent = ''; scope.hidden = true;
        results.setAttribute('aria-label', 'NFL schedule results');
        const response = await client.schedule(requestedDate, signal);
        if (current !== generation || cancelChangedDate()) return;
        events = response.events;
        scope.textContent = queryLabel; scope.hidden = false;
        results.setAttribute('aria-label', queryLabel);
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
        status.textContent = `${queryLabel}: ${events.length ? `${events.length} result(s)` : 'No games returned; coverage may be limited'}. ${response.access === 'free' ? 'Free tier: up to 1 upcoming or 3 date results. ' : ''}${response.skipped ? `${response.skipped} incomplete record(s) omitted. ` : ''}${response.cached ? 'Cached · ' : ''}Fetched ${new Date(response.retrievedAt).toLocaleString()}.`;
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
        // Completion may hide Cancel while the user is focused on it.
        const restoreCancel = host.ownerDocument.activeElement === cancelButton
          ? capturePanelOperationFocus(focusHost) : () => {};
        setBusy(false);
        request = null;
        requestKind = null;
        pendingDate = null;
        restoreCancel({ fallback: [button, upcoming, date] });
      }
      restoreFocus({ preferred: [selectedTarget], cancel: destroyed || current !== generation });
      if (pendingFocus === restoreFocus) pendingFocus = null;
    }
  }
  host.addEventListener('click', click);
  host.addEventListener('input', dateEdited);
  host.addEventListener('change', dateEdited);
  return { cancel,
    cancelSelection() {
      if (destroyed || requestKind !== 'selection') return false;
      cancel({ announce: false });
      status.textContent = 'Venue lookup cancelled to preserve your form edits. Select the game again when you are ready to replace the draft.';
      return true;
    },
    destroy() {
      destroyed = true; cancel({ announce: false }); host.removeEventListener('click', click);
      host.removeEventListener('input', dateEdited); host.removeEventListener('change', dateEdited);
    },
  };
}
