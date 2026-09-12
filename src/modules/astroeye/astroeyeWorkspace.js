import './astroeyeWorkspace.css';

import { resolveZonedLocalTime } from '../../domain/events/eventSchema.js';
import { renderAstroEyeChartWheel } from './chartWheel.js';
import { mountSportsSchedulePanel } from './sportsSchedulePanel.js';
import { scheduleLocalTime } from './sportsSchedule.js';
import { createSharedViewUrl } from './shareView.js';

function requireController(controller) {
  const methods = ['saveDraft', 'selectEvent', 'deleteEvent', 'listEvents', 'serializeRecords', 'importRecords', 'previewTime', 'refocusSelected', 'shareSnapshot', 'restoreSharedView', 'saveSharedCopy'];
  if (!controller || methods.some((method) => typeof controller[method] !== 'function')) {
    throw new TypeError(`AstroEye workspace controller must provide ${methods.join(', ')}`);
  }
}

function field(form, name) {
  return form.elements.namedItem(name);
}

function bodyPosition(chart, body) {
  return chart.positions.find((position) => position.body === body);
}

function formatPosition(position) {
  if (!position) return '—';
  const motion = position.retrograde ? ' ℞' : '';
  return `${position.sign} ${position.degreeInSign.toFixed(2)}° · H${position.house}${motion}`;
}

function downloadJson(text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 't-rexx-world-records.json';
  anchor.click();
  URL.revokeObjectURL(url);
}

function defaultLocalValues(now = new Date()) {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}

/** Mount the first non-technical AstroEye event workspace. */
export function mountAstroEyeWorkspace({
  controller,
  host = document.body,
  onOpen = async () => {},
  onRequestClose = null,
  createWorldLink = null,
  eventSky = null,
  onCreateTour = null,
  onPreviewTour = null,
  onVenueContext = null,
  savedEventLayer = null,
} = {}) {
  requireController(controller);
  if (!host?.append) throw new TypeError('AstroEye workspace host must be a DOM element');
  if (typeof onOpen !== 'function') throw new TypeError('onOpen must be a function');
  if (onRequestClose != null && typeof onRequestClose !== 'function') throw new TypeError('onRequestClose must be a function');

  const root = document.createElement('aside');
  root.id = 'astroeye-workspace';
  root.className = 'astroeye-workspace';
  root.hidden = true;
  root.setAttribute('aria-label', 'AstroEye event workspace');
  root.innerHTML = `
    <header class="astroeye-header">
      <div>
        <span class="astroeye-kicker">T-REXX WORLD ENGINE</span>
        <h2>AstroEye</h2>
        <p>Build a verified event chart and place it on the living Earth.</p>
      </div>
      <button class="astroeye-icon-button" type="button" data-action="close" aria-label="Close AstroEye">×</button>
    </header>
    <div class="astroeye-body">
      <section class="astroeye-entry" aria-labelledby="astroeye-event-heading">
        <div class="astroeye-schedule" data-role="schedule"></div>
        <div class="astroeye-section-heading">
          <div><span>01</span><h3 id="astroeye-event-heading">Event details</h3></div>
          <button type="button" class="astroeye-text-button" data-action="new">Clear form</button>
        </div>
        <form class="astroeye-form">
          <label class="astroeye-span-2">Event name<input name="title" required placeholder="Giants at Eagles" autocomplete="off" /></label>
          <label>Sport<input name="sport" required value="American Football" autocomplete="off" /></label>
          <label>Competition<input name="competition" required value="NFL" autocomplete="off" /></label>
          <label>Away team<input name="away" required autocomplete="off" /></label>
          <label>Home team<input name="home" required autocomplete="off" /></label>
          <label>Local date<input name="localDate" type="date" required /></label>
          <label>Local start time<input name="localTime" type="time" step="1" required /></label>
          <label class="astroeye-span-2">Venue time zone<input name="timeZone" required list="astroeye-time-zones" placeholder="America/New_York" autocomplete="off" /></label>
          <datalist id="astroeye-time-zones">
            <option value="America/New_York"></option><option value="America/Chicago"></option>
            <option value="America/Denver"></option><option value="America/Los_Angeles"></option>
            <option value="Europe/London"></option><option value="Australia/Sydney"></option>
            <option value="Australia/Melbourne"></option><option value="Europe/Berlin"></option>
            <option value="Europe/Madrid"></option><option value="America/Phoenix"></option>
          </datalist>
          <label class="astroeye-span-2 astroeye-utc-choice" data-role="utc-choice" hidden>Repeated-hour choice<select name="utcStart"></select></label>
          <label class="astroeye-span-2">Venue name<input name="venueName" required placeholder="Stadium or arena" autocomplete="off" /></label>
          <label>Latitude<input name="latitude" type="number" min="-90" max="90" step="any" required placeholder="40.7505" /></label>
          <label>Longitude<input name="longitude" type="number" min="-180" max="180" step="any" required placeholder="-73.9934" /></label>
          <label>Duration, minutes<input name="durationMinutes" type="number" min="0" step="1" placeholder="Optional" /></label>
          <label>House system<select name="houseSystem"><option value="whole-sign">Whole Sign</option><option value="equal">Equal House</option></select></label>
          <div class="astroeye-span-2 astroeye-schedule-review" data-role="schedule-review" hidden>
            <p class="astroeye-help" data-role="schedule-origin"></p>
            <label><input type="checkbox" name="scheduleReviewed" />I checked the event time, venue and coordinates.</label>
          </div>
          <button class="astroeye-primary astroeye-span-2" type="submit">Save and view on globe</button>
        </form>
        <p class="astroeye-help">Use the venue’s local time and IANA time zone. Ambiguous daylight-saving times will ask for correction rather than guessing.</p>
      </section>
      <section class="astroeye-results" aria-labelledby="astroeye-chart-heading">
        <p class="astroeye-share-notice" data-role="share-notice" role="status" hidden></p>
        <div class="astroeye-section-heading">
          <div><span>02</span><h3 id="astroeye-chart-heading">Event chart</h3></div>
          <span class="astroeye-status-dot">READY</span>
        </div>
        <div class="astroeye-empty">Save an event or choose one below to calculate its chart.</div>
        <div class="astroeye-chart" hidden>
          <div class="astroeye-chart-title"><strong data-chart="title"></strong><span data-chart="time"></span></div>
          <section class="astroeye-time-explorer" aria-labelledby="astroeye-time-heading">
            <div class="astroeye-time-heading"><h4 id="astroeye-time-heading">Time explorer</h4><span data-time="mode">EVENT START</span></div>
            <p data-time="instant"></p>
            <label for="astroeye-time-offset">Minutes from event start</label>
            <input id="astroeye-time-offset" type="range" min="-360" max="360" step="1" value="0" aria-describedby="astroeye-time-help" />
            <div class="astroeye-time-scale"><span>−6 hours</span><output for="astroeye-time-offset" data-time="offset">Event start</output><span>+6 hours</span></div>
            <div class="astroeye-time-actions"><button type="button" data-action="time-back">−15 min</button><button type="button" data-action="time-reset">Event start</button><button type="button" data-action="time-forward">+15 min</button></div>
            <p id="astroeye-time-help">Release the slider to update the chart. Preview only: saved records stay unchanged; live map feeds are not replayed.</p>
            <div class="astroeye-time-actions"><button type="button" data-action="event-sky">Show event sky</button><button type="button" data-action="live-sky">Leave event sky</button><button type="button" data-action="full-chart">Full chart</button></div>
            <p>Event sky shows Sun and Moon directions in Normal style at full-globe zoom. Closing AstroEye or zooming back in leaves event-sky mode.</p>
          </section>
          <div class="astroeye-wheel" data-chart="wheel"></div>
          <div class="astroeye-angle-grid">
            <div><span>ASCENDANT</span><strong data-chart="ascendant"></strong></div>
            <div><span>MIDHEAVEN</span><strong data-chart="midheaven"></strong></div>
            <div><span>PLANETARY HOUR</span><strong data-chart="planetary-hour"></strong></div>
          </div>
          <div class="astroeye-position-grid" data-chart="positions"></div>
          <div class="astroeye-aspects"><span>MAJOR ASPECTS</span><p data-chart="aspects"></p></div>
          <div class="astroeye-chart-actions">
            <button type="button" data-action="refocus">View venue</button>
            <button type="button" data-action="venue-context">Venue details</button>
            <button type="button" class="danger" data-action="delete">Delete event</button>
            <button type="button" data-action="save-shared" hidden>Save a copy</button>
          </div>
          <section class="astroeye-tour-controls" aria-label="AstroEye Director tour">
            <h4>Event tour</h4>
            <p class="astroeye-help">World → region → venue at this chart time. Adds three editable shots to Director without replacing existing scenes. Preview only: no video is recorded; live feeds stay live.</p>
            <p class="astroeye-help">Scene storage and exports include this event’s details and venue coordinates. Review before sharing.</p>
            <div class="astroeye-chart-actions"><button type="button" data-action="create-tour">Add event tour</button><button type="button" data-action="preview-tour" hidden>Preview saved tour</button></div>
            <p class="astroeye-help" data-role="tour-result"></p>
          </section>
          <section class="astroeye-share-controls" aria-label="Share AstroEye view">
            <p class="astroeye-help">A view link includes this event’s details, venue coordinates and preview time. Anyone with it can read them. Only share information you intend to disclose.</p>
            <button type="button" data-action="share-view">Create view link</button>
            <div data-role="share-output" hidden>
              <label for="astroeye-view-link">View link (snapshot at creation)</label>
              <textarea id="astroeye-view-link" readonly rows="3"></textarea>
              <button type="button" data-action="copy-view">Copy link</button>
              <p class="astroeye-help" data-role="share-host-note"></p>
            </div>
          </section>
          <p class="astroeye-provenance" data-chart="provenance"></p>
        </div>
        <div class="astroeye-saved-header"><h3>Saved events</h3><div><button type="button" data-action="export">Export</button><button type="button" data-action="import">Import</button></div></div>
        <section class="astroeye-saved-map" aria-label="Saved-event map" hidden>
          <button type="button" data-action="saved-map" aria-pressed="false">Show saved events on map</button>
          <p class="astroeye-help" data-role="saved-map-status" role="status"></p>
          <p class="astroeye-help">Cyan = saved events; purple = selected event. Click a marker to open its chart without moving the camera. Overlapping venues can be chosen from the list below. Shows up to 100 additional events, newest first. Local session only; not included in links or tours. Hidden during Director playback.</p>
        </section>
        <input type="file" data-role="import-file" accept="application/json,.json" hidden />
        <div class="astroeye-event-list" data-role="event-list"></div>
      </section>
    </div>
    <div class="astroeye-live-status" role="status" aria-live="polite">AstroEye ready.</div>
  `;
  host.append(root);
  root.querySelector('.astroeye-saved-map').hidden = !savedEventLayer;
  const unsubscribeSavedMap = savedEventLayer?.subscribe((state) => {
    const button = root.querySelector('[data-action="saved-map"]');
    button.textContent = state.enabled ? 'Hide saved events from map' : 'Show saved events on map';
    button.setAttribute('aria-pressed', String(state.enabled));
    root.querySelector('[data-role="saved-map-status"]').textContent = state.error || (state.loading ? 'Reading saved events…' : !state.enabled ? 'Saved-event map is off.' : state.suspended ? 'Saved-event map paused for Director.' : `${state.shown} additional markers · ${state.total} saved events. Selected event stays purple.`);
  });

  const form = root.querySelector('.astroeye-form');
  const empty = root.querySelector('.astroeye-empty');
  const chartRoot = root.querySelector('.astroeye-chart');
  const status = root.querySelector('.astroeye-live-status');
  const eventList = root.querySelector('[data-role="event-list"]');
  const importFile = root.querySelector('[data-role="import-file"]');
  const initial = defaultLocalValues();
  field(form, 'localDate').value = initial.date;
  field(form, 'localTime').value = initial.time;
  field(form, 'timeZone').value = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  let selected = null;
  let userInteracted = false;
  root.addEventListener('pointerdown', () => { userInteracted = true; });
  root.addEventListener('keydown', () => { userInteracted = true; });
  let previouslyFocused = null;
  let lastTourId = null;
  let scheduleSelection = null;
  const scheduleReview = root.querySelector('[data-role="schedule-review"]');
  const schedulePanel = mountSportsSchedulePanel(root.querySelector('[data-role="schedule"]'), {
    onSelect(game, venue) {
      scheduleSelection = game;
      form.reset();
      for (const name of ['title', 'sport', 'competition', 'home', 'away']) field(form, name).value = game[name];
      field(form, 'venueName').value = venue?.name || game.venueName;
      field(form, 'latitude').value = venue?.coordinates?.latitude ?? '';
      field(form, 'longitude').value = venue?.coordinates?.longitude ?? '';
      for (const name of ['localDate', 'localTime', 'timeZone']) field(form, name).value = '';
      field(form, 'scheduleReviewed').required = true;
      scheduleReview.hidden = false;
      root.querySelector('[data-role="schedule-origin"]').textContent = `TheSportsDB · ${game.city || game.country || game.venueName} · ${game.utcStart ? `Source time ${game.utcStart.replace('T', ' ').replace('.000Z', ' UTC')}. Choosing a venue time zone converts this time.` : game.timeNote}`;
      refreshTimeResolution();
      field(form, 'timeZone').focus();
      setStatus('Schedule loaded. Choose the venue time zone and review the event details.');
    },
  });

  function setStatus(message, tone = 'normal') {
    status.textContent = message;
    status.dataset.tone = tone;
  }

  function refreshTimeResolution() {
    const choice = root.querySelector('[data-role="utc-choice"]');
    const select = field(form, 'utcStart');
    const previousChoice = select.value;
    choice.hidden = true;
    select.required = false;
    select.replaceChildren();
    const localDate = field(form, 'localDate').value;
    const localTime = field(form, 'localTime').value;
    const timeZone = field(form, 'timeZone').value.trim();
    if (!localDate || !localTime || !timeZone) return true;
    try {
      const resolution = resolveZonedLocalTime({ localDate, localTime, timeZone });
      if (resolution.status === 'nonexistent') {
        setStatus('That local time is skipped by daylight saving. Choose a different start time.', 'error');
        return false;
      }
      if (resolution.status === 'ambiguous') {
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Choose an occurrence';
        select.append(placeholder);
        for (const [index, instant] of resolution.candidates.entries()) {
          const option = document.createElement('option');
          option.value = instant;
          option.textContent = `${index === 0 ? 'First' : 'Second'} occurrence · ${instant}`;
          select.append(option);
        }
        choice.hidden = false;
        select.required = true;
        if (resolution.candidates.includes(previousChoice)) select.value = previousChoice;
        setStatus('This hour occurs twice. Choose the first or second occurrence.');
      }
      return true;
    } catch (error) {
      setStatus(error?.message || 'Check the date, time, and venue time zone.', 'error');
      return false;
    }
  }

  for (const name of ['localDate', 'localTime', 'timeZone']) {
    field(form, name).addEventListener('change', () => {
      let converted;
      if (name === 'timeZone' && scheduleSelection?.utcStart) {
        try {
          converted = scheduleLocalTime(scheduleSelection.utcStart, field(form, 'timeZone').value.trim());
          field(form, 'localDate').value = converted.localDate;
          field(form, 'localTime').value = converted.localTime;
        } catch { /* Existing resolution check reports the invalid zone. */ }
      }
      refreshTimeResolution();
      if (converted && !root.querySelector('[data-role="utc-choice"]').hidden) field(form, 'utcStart').value = converted.utcStart;
    });
  }
  form.addEventListener('input', (event) => {
    if (event.target.name !== 'scheduleReviewed') field(form, 'scheduleReviewed').checked = false;
  });

  function renderChart(event, chart, offsetMinutes = 0, isShared = false) {
    eventSky?.update(chart);
    selected = { event, chart, offsetMinutes, isShared };
    root.querySelector('[data-action="delete"]').hidden = isShared;
    root.querySelector('[data-action="save-shared"]').hidden = !isShared;
    root.querySelector('[data-action="share-view"]').disabled = typeof createWorldLink !== 'function';
    root.querySelector('[data-action="create-tour"]').disabled = typeof onCreateTour !== 'function';
    root.querySelector('[data-action="venue-context"]').disabled = typeof onVenueContext !== 'function';
    root.querySelector('[data-role="share-output"]').hidden = true;
    root.querySelector('#astroeye-view-link').value = '';
    const notice = root.querySelector('[data-role="share-notice"]');
    notice.hidden = !isShared;
    notice.textContent = isShared ? `Shared event · not saved on this device. Venue: ${event.venue.name} (${event.venue.latitude}, ${event.venue.longitude}). Review the source details before saving a copy. Live layers show current data, not historical replay.` : '';
    empty.hidden = true;
    chartRoot.hidden = false;
    root.querySelector('[data-chart="title"]').textContent = event.title;
    root.querySelector('[data-chart="time"]').textContent = `${event.scheduledLocal.date} · ${event.scheduledLocal.time.slice(0, 5)} · ${event.scheduledLocal.timeZone}`;
    const slider = root.querySelector('#astroeye-time-offset');
    slider.value = offsetMinutes;
    const offsetLabel = offsetMinutes === 0 ? 'Event start' : `${offsetMinutes > 0 ? '+' : '−'}${Math.abs(offsetMinutes)} min`;
    slider.setAttribute('aria-valuetext', offsetLabel);
    root.querySelector('[data-time="offset"]').textContent = offsetLabel;
    root.querySelector('[data-time="mode"]').textContent = offsetMinutes === 0 ? 'EVENT START' : 'UNSAVED PREVIEW';
    root.querySelector('.astroeye-time-explorer').dataset.preview = String(offsetMinutes !== 0);
    const local = new Intl.DateTimeFormat('en-US', {
      timeZone: event.scheduledLocal.timeZone, dateStyle: 'medium', timeStyle: 'long', hourCycle: 'h23',
    }).format(new Date(chart.calculatedFor));
    root.querySelector('[data-time="instant"]').textContent = `${local} · ${event.scheduledLocal.timeZone}\n${chart.calculatedFor.replace('T', ' ').replace('.000Z', ' UTC')}`;
    root.querySelector('[data-action="time-back"]').disabled = offsetMinutes <= -360;
    root.querySelector('[data-action="time-forward"]').disabled = offsetMinutes >= 360;
    renderAstroEyeChartWheel(root.querySelector('[data-chart="wheel"]'), chart);
    const asc = chart.houses.angles.ascendant;
    const mc = chart.houses.angles.midheaven;
    root.querySelector('[data-chart="ascendant"]').textContent = `${asc.toFixed(2)}°`;
    root.querySelector('[data-chart="midheaven"]').textContent = `${mc.toFixed(2)}°`;
    root.querySelector('[data-chart="planetary-hour"]').textContent = chart.planetaryHour.status === 'exact'
      ? `${chart.planetaryHour.ruler} · ${chart.planetaryHour.period} ${chart.planetaryHour.hourNumber}`
      : 'Unavailable at this latitude';
    const positions = root.querySelector('[data-chart="positions"]');
    positions.replaceChildren();
    for (const body of ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']) {
      const row = document.createElement('div');
      const name = document.createElement('span');
      const value = document.createElement('strong');
      name.textContent = body.toUpperCase();
      value.textContent = formatPosition(bodyPosition(chart, body));
      row.append(name, value);
      positions.append(row);
    }
    root.querySelector('[data-chart="aspects"]').textContent = chart.aspects.length
      ? chart.aspects.slice(0, 8).map((aspect) => `${aspect.left} ${aspect.aspect} ${aspect.right} (${aspect.orb.toFixed(2)}° ${aspect.phase})`).join(' · ')
      : 'No major aspects within the current orbs.';
    root.querySelector('[data-chart="provenance"]').textContent = `${chart.engine.id} ${chart.engine.version} · ${chart.options.zodiac} zodiac · ${chart.options.houseSystem} houses · calculated for ${chart.calculatedFor}${offsetMinutes ? ` · unsaved preview; original event ${event.utcStart}` : ''}${event.source.kind === 'provider' ? ` · ${event.source.provider} event ${event.source.sourceEventId} · fetched ${event.source.retrievedAt}` : ''}`;
  }

  function previewTime(offsetMinutes) {
    if (!selected || root.dataset.busy) return;
    try {
      const result = controller.previewTime(offsetMinutes);
      renderChart(result.event, result.chart, result.offsetMinutes, result.isShared);
      setStatus(offsetMinutes === 0 ? 'Original event chart restored.' : 'Time preview updated. Your saved event is unchanged.');
    } catch (error) {
      renderChart(selected.event, selected.chart, selected.offsetMinutes, selected.isShared);
      setStatus(error?.message || 'Could not preview this time.', 'error');
    }
  }

  root.querySelector('#astroeye-time-offset').addEventListener('input', (event) => {
    const offset = Number(event.target.value);
    const label = `${offset > 0 ? '+' : ''}${offset} min (release to update)`;
    root.querySelector('[data-time="offset"]').textContent = label;
    event.target.setAttribute('aria-valuetext', label);
  });
  root.querySelector('#astroeye-time-offset').addEventListener('change', (event) => previewTime(Number(event.target.value)));

  async function refreshEvents() {
    const events = await controller.listEvents();
    events.sort((left, right) => right.utcStart.localeCompare(left.utcStart));
    eventList.replaceChildren();
    if (!events.length) {
      const message = document.createElement('p');
      message.className = 'astroeye-event-list-empty';
      message.textContent = 'No saved events yet.';
      eventList.append(message);
      return;
    }
    for (const event of events) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.eventId = event.id;
      if (!selected?.isShared && selected?.event.id === event.id) button.classList.add('active');
      const title = document.createElement('strong');
      const detail = document.createElement('span');
      title.textContent = event.title;
      detail.textContent = `${event.scheduledLocal.date} · ${event.venue.name}`;
      button.append(title, detail);
      eventList.append(button);
    }
  }

  async function busy(action, successMessage) {
    if (root.dataset.busy) return null;
    root.dataset.busy = 'true';
    root.querySelector('#astroeye-time-offset').disabled = true;
    setStatus('Working…');
    try {
      const result = await action();
      setStatus(successMessage);
      return result;
    } catch (error) {
      setStatus(error?.message || 'AstroEye could not complete that action.', 'error');
      return null;
    } finally {
      delete root.dataset.busy;
      root.querySelector('#astroeye-time-offset').disabled = false;
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (!refreshTimeResolution()) return;
    if (!form.reportValidity()) return;
    const draft = Object.fromEntries(new FormData(form).entries());
    if (scheduleSelection) {
      draft.source = scheduleSelection.source;
      draft.scheduleReviewed = field(form, 'scheduleReviewed').checked;
      draft.coordinateSource = 'user-reviewed';
    }
    const result = await busy(() => controller.saveDraft(draft), 'Event saved and synchronized with the globe.');
    if (!result) return;
    renderChart(result.event, result.chart);
    await refreshEvents();
  });

  async function selectSavedEvent(eventId, options = {}) {
    const houseSystem = field(form, 'houseSystem').value;
    const result = await busy(
      () => controller.selectEvent(eventId, { houseSystem, ...options }),
      'Saved event synchronized with the globe.',
    );
    if (!result) return false;
    renderChart(result.event, result.chart);
    await refreshEvents();
    return true;
  }
  eventList.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-event-id]');
    if (button) await selectSavedEvent(button.dataset.eventId);
  });

  root.addEventListener('click', async (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'saved-map' && savedEventLayer && !root.dataset.busy) {
      await savedEventLayer.setEnabled(!savedEventLayer.state().enabled);
    } else if (action === 'venue-context' && selected && onVenueContext) {
      try { await onVenueContext(); }
      catch (error) { setStatus(error.message || 'Could not open venue details.', 'error'); }
    } else if (action === 'create-tour' && selected && onCreateTour) {
      const result = await busy(() => onCreateTour(controller.shareSnapshot()), 'Event tour added.');
      if (!result) return;
      lastTourId = result.id;
      root.querySelector('[data-action="preview-tour"]').hidden = typeof onPreviewTour !== 'function';
      root.querySelector('[data-role="tour-result"]').textContent = `${selected.event.title} · ${selected.chart.calculatedFor} · ${result.persisted ? 'Saved in Director.' : 'Session only — browser storage unavailable.'} Use Preview saved tour; Stop or Escape ends playback.`;
      if (!result.persisted) setStatus('Tour added for this session only. Browser storage is unavailable.', 'error');
    } else if (action === 'preview-tour' && lastTourId && onPreviewTour) {
      const result = await busy(() => onPreviewTour(lastTourId), 'Tour preview finished.');
      if (result?.started === false || result?.error) setStatus(result.reason || result.error, 'error');
      else if (result?.cancelled) setStatus('Tour stopped. You can replay it from Director.');
    } else if (action === 'event-sky' && selected) {
      try {
        eventSky?.setEnabled(true);
        root.dataset.skyCompact = 'true';
        setStatus('Event sky follows the chart time. Use Full chart to return to chart details.');
      } catch (error) { setStatus(error.message, 'error'); }
    } else if (action === 'live-sky') {
      eventSky?.setEnabled(false);
      delete root.dataset.skyCompact;
      setStatus('Event-sky mode ended. The chart and live feeds are unchanged.');
    } else if (action === 'full-chart') {
      delete root.dataset.skyCompact;
    } else if (action === 'close') {
      schedulePanel.cancel();
      if (onRequestClose) await onRequestClose();
      else {
        root.hidden = true;
        previouslyFocused?.focus?.();
      }
    } else if (action === 'new') {
      schedulePanel.cancel();
      scheduleSelection = null;
      scheduleReview.hidden = true;
      field(form, 'scheduleReviewed').required = false;
      form.reset();
      refreshTimeResolution();
      field(form, 'localDate').value = defaultLocalValues().date;
      field(form, 'localTime').value = defaultLocalValues().time;
      field(form, 'timeZone').value = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      field(form, 'sport').value = 'American Football';
      field(form, 'competition').value = 'NFL';
      field(form, 'title').focus();
    } else if (action === 'refocus' && selected) {
      await busy(
        () => controller.refocusSelected(),
        'Venue centered on the globe.',
      );
    } else if (action.startsWith('time-') && selected) {
      previewTime(action === 'time-reset' ? 0 : Math.max(-360, Math.min(360,
        selected.offsetMinutes + (action === 'time-back' ? -15 : 15))));
    } else if (action === 'share-view' && selected && !root.dataset.busy) {
      try {
        const url = createSharedViewUrl(createWorldLink(), { ...controller.shareSnapshot(), ...(eventSky?.isEnabled() ? { skyEnabled: true } : {}) });
        root.querySelector('#astroeye-view-link').value = url;
        root.querySelector('[data-role="share-output"]').hidden = false;
        const hostname = new URL(url).hostname;
        root.querySelector('[data-role="share-host-note"]').textContent = 'Open in a new tab to restore. ' + (['localhost', '127.0.0.1', '[::1]'].includes(hostname)
          ? 'Local preview address: this link only works on a device running this app at the same address. Public sharing requires a deployed app.'
          : 'The recipient needs access to this app address. Map or live-data availability may differ on their device.');
        setStatus('View link created. Review it, then copy when ready.');
      } catch (error) { setStatus(error.message || 'Could not create a view link.', 'error'); }
    } else if (action === 'copy-view') {
      const input = root.querySelector('#astroeye-view-link');
      if (!input.value) return;
      try {
        await navigator.clipboard.writeText(input.value);
        setStatus('AstroEye view link copied.');
      } catch {
        input.focus(); input.select();
        setStatus('Clipboard unavailable. The link is selected; copy it manually.');
      }
    } else if (action === 'save-shared' && selected?.isShared) {
      const result = await busy(() => controller.saveSharedCopy(), 'Shared event saved as a new local copy.');
      if (result) {
        renderChart(result.event, result.chart, result.offsetMinutes, result.isShared);
        await refreshEvents();
      }
    } else if (action === 'delete' && selected && !selected.isShared) {
      if (!globalThis.confirm(`Delete “${selected.event.title}” and its saved charts?`)) return;
      const eventId = selected.event.id;
      const removed = await busy(() => controller.deleteEvent(eventId), 'Event deleted.');
      if (!removed) return;
      selected = null;
      eventSky?.update(null);
      chartRoot.hidden = true;
      empty.hidden = false;
      await refreshEvents();
    } else if (action === 'export') {
      const json = await busy(() => controller.serializeRecords(), 'World records exported.');
      if (json) downloadJson(json);
    } else if (action === 'import') {
      importFile.click();
    }
  });

  importFile.addEventListener('change', async () => {
    const file = importFile.files?.[0];
    importFile.value = '';
    if (!file) return;
    const result = await busy(
      async () => controller.importRecords(await file.text(), { mode: 'merge' }),
      'World records imported.',
    );
    if (result) await refreshEvents();
  });

  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    schedulePanel.cancel();
    if (onRequestClose) void onRequestClose();
    else {
      root.hidden = true;
      previouslyFocused?.focus?.();
    }
  });

  return Object.freeze({
    root,
    selectSavedEvent,
    focusChart() {
      const title = root.querySelector('[data-chart="title"]');
      title.tabIndex = -1;
      title.scrollIntoView({ block: 'start' });
      title.focus({ preventScroll: true });
    },
    sceneSnapshot() { return selected ? controller.shareSnapshot() : null; },
    async applySceneView(snapshot, { isCurrent = () => true } = {}) {
      if (!isCurrent()) return false;
      const result = await controller.restoreSharedView(snapshot, { isCurrent });
      if (!result || !isCurrent()) return false;
      eventSky?.setEnabled(false);
      delete root.dataset.skyCompact;
      renderChart(result.event, result.chart, result.offsetMinutes, result.isShared);
      root.querySelector('[data-role="share-notice"]').textContent = 'Scene preview · calculation inputs restored without changing saved event records. Live feeds remain current.';
      return true;
    },
    canRestoreSharedView() { return !userInteracted && !selected; },
    async restoreSharedView(incoming) {
      // A newer deliberate interaction wins over delayed startup restoration.
      if (userInteracted || selected) return false;
      if (incoming.status === 'invalid') {
        const notice = root.querySelector('[data-role="share-notice"]');
        notice.hidden = false; notice.textContent = incoming.message;
        setStatus('AstroEye link rejected. No saved records were changed.', 'error');
        return false;
      }
      if (incoming.status !== 'ready') return false;
      const result = await busy(() => controller.restoreSharedView(incoming.snapshot), 'Shared chart and time restored as an unsaved preview. Live map availability may differ.');
      if (!result) return false;
      renderChart(result.event, result.chart, result.offsetMinutes, result.isShared);
      if (incoming.snapshot.skyEnabled) {
        try { eventSky?.setEnabled(true, { focus: false }); root.dataset.skyCompact = 'true'; }
        catch (error) { setStatus(`Chart restored; event sky unavailable: ${error.message}`, 'error'); }
      }
      await refreshEvents();
      return true;
    },
    async open(trigger = document.activeElement) {
      previouslyFocused = trigger;
      const opened = await busy(onOpen, 'AstroEye ready.');
      if (opened === null) return false;
      root.hidden = false;
      await refreshEvents();
      field(form, 'title').focus();
      return true;
    },
    close() {
      eventSky?.setEnabled(false);
      delete root.dataset.skyCompact;
      schedulePanel.cancel();
      root.hidden = true;
      previouslyFocused?.focus?.();
    },
    destroy() {
      unsubscribeSavedMap?.();
      eventSky?.destroy();
      schedulePanel.destroy();
      root.remove();
    },
  });
}
