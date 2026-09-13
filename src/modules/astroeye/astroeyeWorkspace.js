import './astroeyeWorkspace.css';

import { describeDraftTime } from './draftTimeSummary.js';
import { renderAstroEyeChartWheel } from './chartWheel.js';
import { mountSportsSchedulePanel } from './sportsSchedulePanel.js';
import { scheduleLocalTime } from './sportsSchedule.js';
import { createSharedViewUrl } from './shareView.js';
import { filterSavedEvents, normalizeSavedEventFilters, sortSavedEvents, pageSavedEvents } from './savedEventFilters.js';
import { MAX_IMPORT_FILE_BYTES } from './recordImportReview.js';
import { eventTemplateDraft } from './eventTemplate.js';
import { mountChartComparison } from './chartComparisonPanel.js';
import { mountResearchNotebook } from './researchNotebookPanel.js';
import { renderAngleCaution } from './angleCaution.js';
import { chartCalculationVersion } from './calculation/modelVersion.js';
import { renderPlanetaryHour } from './planetaryHourPresentation.js';

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

function downloadJson(text, filename = 't-rexx-world-records.json') {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
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
  researchNotebook = null,
  host = document.body,
  onOpen = async () => {},
  onRequestClose = null,
  createWorldLink = null,
  eventSky = null,
  onCreateTour = null,
  onPreviewTour = null,
  onVenueContext = null,
  savedEventLayer = null,
  onViewSavedEvents = null,
  downloadRecords = downloadJson,
  downloadComparison,
  downloadNotebookDraft,
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
    <nav class="astroeye-quick-nav" aria-label="AstroEye shortcuts">
      <button type="button" data-action="compare-charts">Compare charts</button>
      <button type="button" data-action="find-saved-events">Saved events</button>
      <button type="button" data-action="research-notes">Research notes</button>
    </nav>
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
          <p class="astroeye-help astroeye-span-2" data-role="draft-time-summary" role="status" aria-live="polite"></p>
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
        <div class="astroeye-empty" tabindex="-1">To compare charts, first save an event or choose one from Saved events. Then use Compare charts → Pin this chart, and select another event or change the Time explorer. Nothing is pinned automatically.</div>
        <div class="astroeye-chart" hidden>
          <div class="astroeye-chart-title"><strong data-chart="title"></strong><span data-chart="time"></span></div>
          <p class="astroeye-help" data-chart="angle-caution" role="status" hidden></p>
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
          <p class="astroeye-help" data-chart="planetary-hour-notice" role="status"></p>
          <div class="astroeye-position-grid" data-chart="positions"></div>
          <div class="astroeye-aspects"><span>MAJOR ASPECTS</span><p data-chart="aspects"></p></div>
          <div class="astroeye-chart-actions">
            <button type="button" data-action="refocus">View venue</button>
            <button type="button" data-action="use-template">Use as template</button>
            <button type="button" data-action="venue-context">Venue details</button>
            <button type="button" class="danger" data-action="delete">Delete event</button>
            <button type="button" data-action="save-shared" hidden>Save a copy</button>
          </div>
          <p class="astroeye-help">Use as template replaces unsaved form entries with the event’s original start and venue details. It does not change saved records until you review and save a new event.</p>
          <section class="astroeye-comparison" data-role="chart-comparison" aria-label="Chart comparison" tabindex="-1"></section>
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
        <section class="astroeye-research-notebook" data-role="research-notebook" aria-label="Research notebook" tabindex="-1" hidden></section>
        <div class="astroeye-saved-header"><h3 data-role="saved-events-heading" tabindex="-1">Saved events</h3><div><button type="button" data-action="export">Export all</button><button type="button" data-action="import">Import</button></div></div>
        <section class="astroeye-deletion-undo" data-role="deletion-undo" aria-label="Recover last deleted event" hidden>
          <p data-role="deletion-undo-description" class="astroeye-help"></p>
          <button type="button" data-action="undo-delete">Undo last deletion</button>
          <p class="astroeye-help">Restores the event and its stored charts without changing the camera or selected chart. Only the most recent deletion can be undone, until this page reloads. Newer records will never be overwritten. Keep a full export for longer-term recovery.</p>
        </section>
        <form class="astroeye-event-filters" aria-label="Filter saved events">
          <label>Search saved events<input name="query" type="search" maxlength="100" placeholder="Event, team, sport, competition or venue" /></label>
          <div class="astroeye-filter-dates">
            <label>From date<input name="dateFrom" type="date" /></label>
            <label>Through date<input name="dateTo" type="date" /></label>
          </div>
          <p class="astroeye-help">Dates use each venue’s local event date, including both endpoints. Apply filters to update the list and cyan map markers. The selected purple marker and chart stay unchanged, even outside the filters.</p>
          <label>Sort by event start (UTC)<select name="sort"><option value="newest">Newest start first</option><option value="oldest">Oldest start first</option></select></label>
          <div class="astroeye-chart-actions"><button type="submit">Apply filters</button><button type="button" data-filter-reset>Clear filters</button></div>
          <p class="astroeye-help" data-role="filter-status" role="status" aria-live="polite"></p>
          <button type="button" data-action="export-matching" disabled>Export matching events</button>
          <p class="astroeye-help">Matching export uses applied filters across all pages, beyond the map limit. Includes saved event details, venue coordinates and their stored charts; excludes research workspaces and on-screen previews. Review the file before sharing. Export all remains a complete backup.</p>
        </form>
        <section class="astroeye-saved-map" aria-label="Saved-event map" hidden>
          <button type="button" data-action="saved-map" aria-pressed="false">Show saved events on map</button>
          <button type="button" data-action="frame-saved-map" disabled>View matching markers</button>
          <p class="astroeye-help">View matching markers closes this panel and moves the camera to the displayed matches (up to 100 cyan markers plus a matching selected event). Widely spread events use a globe overview; rotate it to see the far side.</p>
          <p class="astroeye-help" data-role="saved-map-status" role="status"></p>
          <p class="astroeye-help">Cyan = saved events; purple = selected event. Click a marker to open its chart without moving the camera. Overlapping venues can be chosen from the list below. Shows up to 100 additional matches in the applied sort order, regardless of list page. Local session only; not included in links or tours. Hidden during Director playback.</p>
        </section>
        <input type="file" data-role="import-file" accept="application/json,.json" hidden />
        <section class="astroeye-import-review" data-role="import-review" aria-labelledby="astroeye-import-title" hidden>
          <h4 id="astroeye-import-title" tabindex="-1">Review import</h4>
          <p class="astroeye-help" data-role="import-filename"></p>
          <div data-role="import-summary" aria-live="polite"></div>
          <p class="astroeye-help">Nothing has been imported yet. Identical records are skipped. Changed records with matching IDs will be overwritten only after acknowledgment; other records remain. Only import files you trust. The current chart preview stays unchanged; reopen an event to view its imported chart.</p>
          <label data-role="import-overwrite" hidden><input type="checkbox" data-role="import-overwrite-check" /> I approve overwriting the changed saved records.</label>
          <div class="astroeye-chart-actions"><button type="button" data-action="confirm-import">Confirm merge</button><button type="button" data-action="cancel-import">Cancel</button></div>
        </section>
        <div id="astroeye-saved-event-list" class="astroeye-event-list" data-role="event-list"></div>
        <nav class="astroeye-event-pages" aria-label="Saved event pages" hidden>
          <p class="astroeye-help" data-role="page-status" role="status" aria-live="polite"></p>
          <div class="astroeye-chart-actions"><button type="button" data-event-page="previous" aria-controls="astroeye-saved-event-list">Previous page</button><button type="button" data-event-page="next" aria-controls="astroeye-saved-event-list">Next page</button></div>
        </nav>
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
    root.querySelector('[data-action="frame-saved-map"]').disabled = !onViewSavedEvents || !state.frameable;
    root.querySelector('[data-role="saved-map-status"]').textContent = state.error || (state.loading ? 'Reading saved events…' : !state.enabled ? 'Saved-event map is off.' : state.suspended ? 'Saved-event map paused for Director.' : `${state.shown} additional markers · ${state.matched} matching / ${state.total} saved events. Selected event stays purple.`);
  });

  const form = root.querySelector('.astroeye-form');
  const empty = root.querySelector('.astroeye-empty');
  const chartRoot = root.querySelector('.astroeye-chart');
  const status = root.querySelector('.astroeye-live-status');
  const eventList = root.querySelector('[data-role="event-list"]');
  const filterForm = root.querySelector('.astroeye-event-filters');
  let eventFilters = normalizeSavedEventFilters();
  let savedEvents = [], eventRefresh = 0, eventPage = 0;
  function applyFilters(input) {
    if (root.dataset.busy) return;
    try {
      const normalized = normalizeSavedEventFilters(input);
      savedEventLayer?.setFilters(normalized);
      eventFilters = normalized;
      eventPage = 0;
      renderEvents();
    } catch (error) {
      root.querySelector('[data-role="filter-status"]').textContent = `${error.message} Previous filters are still applied.`;
    }
  }
  filterForm.addEventListener('submit', (event) => {
    event.preventDefault();
    applyFilters(Object.fromEntries(new FormData(filterForm).entries()));
  });
  filterForm.querySelector('[data-filter-reset]').addEventListener('click', () => {
    if (root.dataset.busy) return;
    filterForm.reset();
    applyFilters({});
  });
  root.querySelector('.astroeye-event-pages').addEventListener('click', (event) => {
    const direction = event.target.closest('[data-event-page]')?.dataset.eventPage;
    if (!direction || root.dataset.busy) return;
    eventPage += direction === 'next' ? 1 : -1;
    renderEvents();
    eventList.querySelector('button')?.focus();
  });
  const importFile = root.querySelector('[data-role="import-file"]');
  const importReview = root.querySelector('[data-role="import-review"]');
  let importReadGeneration = 0;
  let importHasChanges = false;
  let importHasOverwrites = false;
  const overwriteCheck = root.querySelector('[data-role="import-overwrite-check"]');
  function updateImportConfirmation() {
    root.querySelector('[data-action="confirm-import"]').disabled = !importHasChanges || (importHasOverwrites && !overwriteCheck.checked);
  }
  overwriteCheck.addEventListener('change', updateImportConfirmation);
  root.querySelector('[data-action="import"]').disabled = typeof controller.prepareImportRecords !== 'function';

  function resetImportReview() {
    importReadGeneration++;
    controller.cancelImportReview?.();
    importReview.hidden = true;
    importHasChanges = false;
    importHasOverwrites = false;
    overwriteCheck.checked = false;
    root.querySelector('[data-role="import-overwrite"]').hidden = true;
    updateImportConfirmation();
    root.querySelector('[data-role="import-summary"]').replaceChildren();
    root.querySelector('[data-role="import-filename"]').textContent = '';
  }
  const initial = defaultLocalValues();
  field(form, 'localDate').value = initial.date;
  field(form, 'localTime').value = initial.time;
  field(form, 'timeZone').value = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  let selected = null;
  const comparison = mountChartComparison(root.querySelector('[data-role="chart-comparison"]'), { downloadReport: downloadComparison });
  const notebookHost = root.querySelector('[data-role="research-notebook"]');
  const notebookPanel = researchNotebook ? mountResearchNotebook(notebookHost, { notebook: researchNotebook, downloadDraft: downloadNotebookDraft }) : null;
  notebookPanel?.updateChart(null, null);
  root.querySelector('[data-action="research-notes"]').hidden = !notebookPanel;
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

  function refreshDraftTimeSummary() {
    const summary = describeDraftTime(Object.fromEntries(['localDate', 'localTime', 'timeZone', 'utcStart'].map((name) => [name, field(form, name).value])));
    const node = root.querySelector('[data-role="draft-time-summary"]');
    node.textContent = summary.text;
    node.dataset.state = summary.state;
    return summary;
  }

  function refreshTimeResolution() {
    const choice = root.querySelector('[data-role="utc-choice"]');
    const select = field(form, 'utcStart');
    const previousChoice = select.value;
    const summary = refreshDraftTimeSummary();
    choice.hidden = true;
    select.required = false;
    select.replaceChildren();
    if (summary.state === 'incomplete') return true;
    try {
      const resolution = summary.resolution;
      if (!resolution) { setStatus(summary.text, 'error'); return false; }
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
      refreshDraftTimeSummary();
    });
  }
  field(form, 'utcStart').addEventListener('change', refreshDraftTimeSummary);
  form.addEventListener('input', (event) => {
    if (event.target.name !== 'scheduleReviewed') field(form, 'scheduleReviewed').checked = false;
    if (['localDate', 'localTime', 'timeZone', 'utcStart'].includes(event.target.name)) {
      const node = root.querySelector('[data-role="draft-time-summary"]');
      node.textContent = 'Time fields edited. Finish editing to check the updated draft start.';
      node.dataset.state = 'pending';
    }
  });
  refreshDraftTimeSummary();

  function renderChart(event, chart, offsetMinutes = 0, isShared = false) {
    eventSky?.update(chart);
    selected = { event, chart, offsetMinutes, isShared };
    comparison.update(event, chart);
    notebookPanel?.updateChart(event, chart);
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
    renderAngleCaution(root.querySelector('[data-chart="angle-caution"]'), chart);
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
    renderPlanetaryHour(root.querySelector('[data-chart="planetary-hour"]'),
      root.querySelector('[data-chart="planetary-hour-notice"]'), chart);
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
    root.querySelector('[data-chart="provenance"]').textContent += ` · calculation model ${chartCalculationVersion(chart)}${chart.calculationVersion === undefined ? ' (legacy untagged chart)' : ''}`;
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

  function refreshDeletionUndo() {
    const state = controller.deletionUndoState?.();
    root.querySelector('[data-role="deletion-undo"]').hidden = !state;
    root.querySelector('[data-role="deletion-undo-description"]').textContent = state ? `Deleted: ${state.title} · ${state.charts} stored charts available to restore.` : '';
  }

  async function refreshEvents() {
    refreshDeletionUndo();
    const request = ++eventRefresh;
    const events = await controller.listEvents();
    if (request !== eventRefresh) return;
    savedEvents = [...events];
    renderEvents();
  }

  function renderEvents() {
    const events = sortSavedEvents(filterSavedEvents(savedEvents, eventFilters), eventFilters.sort);
    const page = pageSavedEvents(events, eventPage);
    eventPage = page.page;
    root.querySelector('.astroeye-event-pages').hidden = page.pageCount <= 1;
    root.querySelector('[data-event-page="previous"]').disabled = page.page === 0;
    root.querySelector('[data-event-page="next"]').disabled = page.page === page.pageCount - 1;
    root.querySelector('[data-role="page-status"]').textContent = `${page.from}–${page.to} of ${page.total} matching events · Page ${page.page + 1} of ${page.pageCount}. The map does not change when paging.`;
    root.querySelector('[data-role="filter-status"]').textContent = `${events.length} of ${savedEvents.length} saved events match the applied filters.`;
    const matchingExport = root.querySelector('[data-action="export-matching"]');
    matchingExport.disabled = !events.length || typeof controller.serializeMatchingRecords !== 'function';
    matchingExport.textContent = `Export matching events (${events.length})`;
    eventList.replaceChildren();
    if (!events.length) {
      const message = document.createElement('p');
      message.className = 'astroeye-event-list-empty';
      message.textContent = savedEvents.length ? 'No events match. Change or clear the filters.' : 'No saved events yet.';
      eventList.append(message);
      return;
    }
    for (const event of page.items) {
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

  function focusWorkspaceSection(target) {
    // Expand only the panel, as Full chart does; do not alter event sky or globe state.
    delete root.dataset.skyCompact;
    target.focus({ preventScroll: true });
    const navigationHeight = root.querySelector('.astroeye-quick-nav').getBoundingClientRect().height;
    root.scrollTop += target.getBoundingClientRect().top - root.getBoundingClientRect().top - navigationHeight - 12;
  }

  root.addEventListener('click', async (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'close') resetImportReview();
    if (action === 'compare-charts') {
      focusWorkspaceSection(selected ? root.querySelector('[data-role="chart-comparison"]') : empty);
    } else if (action === 'research-notes' && notebookPanel) {
      notebookPanel.open();
      focusWorkspaceSection(notebookHost);
    } else if (action === 'find-saved-events') {
      focusWorkspaceSection(root.querySelector('[data-role="saved-events-heading"]'));
    } else if (action === 'saved-map' && savedEventLayer && !root.dataset.busy) {
      await savedEventLayer.setEnabled(!savedEventLayer.state().enabled);
    } else if (action === 'frame-saved-map' && onViewSavedEvents && !root.dataset.busy) {
      try {
        onViewSavedEvents();
        resetImportReview();
        if (onRequestClose) await onRequestClose();
        else { root.hidden = true; previouslyFocused?.focus?.(); }
      } catch (error) { setStatus(error.message || 'Could not frame these markers.', 'error'); }
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
    } else if (action === 'use-template' && selected && !root.dataset.busy) {
      try {
        const draft = eventTemplateDraft(selected.event, selected.chart.options.houseSystem);
        schedulePanel.cancel();
        scheduleSelection = null;
        form.reset();
        for (const [name, value] of Object.entries(draft)) {
          if (name !== 'utcStart') field(form, name).value = value;
        }
        field(form, 'scheduleReviewed').required = true;
        field(form, 'scheduleReviewed').checked = false;
        scheduleReview.hidden = false;
        root.querySelector('[data-role="schedule-origin"]').textContent = 'New manual draft from the selected event. Uses the original event start, not the time-explorer preview. Review all details before saving; the original saved event stays unchanged.';
        refreshTimeResolution();
        if (!root.querySelector('[data-role="utc-choice"]').hidden) field(form, 'utcStart').value = draft.utcStart;
        refreshDraftTimeSummary();
        field(form, 'title').focus();
        setStatus('Template copied into the event form, replacing unsaved entries. Review and edit it, then Save to create a new event. No records or globe view were changed.');
      } catch (error) { setStatus(error.message || 'Could not prepare an event template.', 'error'); }
    } else if (action === 'new') {
      schedulePanel.cancel();
      scheduleSelection = null;
      scheduleReview.hidden = true;
      field(form, 'scheduleReviewed').required = false;
      form.reset();
      field(form, 'localDate').value = defaultLocalValues().date;
      field(form, 'localTime').value = defaultLocalValues().time;
      field(form, 'timeZone').value = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      field(form, 'sport').value = 'American Football';
      field(form, 'competition').value = 'NFL';
      refreshTimeResolution();
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
    } else if (action === 'delete' && selected && !selected.isShared && !root.dataset.busy) {
      if (!globalThis.confirm(`Delete “${selected.event.title}” and its saved charts? Only the most recent deletion can be undone until this page reloads.`)) return;
      const eventId = selected.event.id;
      const removed = await busy(() => controller.deleteEvent(eventId), 'Event deleted. Undo last deletion is available in Saved events for this session.');
      refreshDeletionUndo();
      if (!removed) return;
      selected = null;
      comparison.update(null, null);
      notebookPanel?.updateChart(null, null);
      eventSky?.update(null);
      chartRoot.hidden = true;
      empty.hidden = false;
      await refreshEvents();
    } else if (action === 'undo-delete') {
      const result = await busy(() => controller.undoDeleteEvent(), 'Deleted event and stored charts restored. Choose it from Saved events; current filters and globe view are unchanged.');
      refreshDeletionUndo();
      if (result) {
        await refreshEvents();
        const restoredButton = [...eventList.querySelectorAll('[data-event-id]')].find((button) => button.dataset.eventId === result.eventId);
        (restoredButton || root.querySelector('[data-action="export"]')).focus();
      }
    } else if (action === 'export-matching') {
      const applied = normalizeSavedEventFilters(eventFilters);
      await busy(async () => {
        const json = await controller.serializeMatchingRecords(applied);
        downloadRecords(json, 't-rexx-matching-events.json');
      }, 'Matching events and stored charts exported. Research workspaces were excluded.');
    } else if (action === 'export') {
      const json = await busy(() => controller.serializeRecords(), 'World records exported.');
      if (json) downloadRecords(json);
    } else if (action === 'confirm-import' && !root.dataset.busy && !importReview.hidden) {
      importReview.hidden = true;
      const allowOverwrite = overwriteCheck.checked;
      const result = await busy(() => controller.confirmImportRecords({ allowOverwrite }), 'Changed and new records imported. Identical records were skipped. Reopen an event to view its imported chart.');
      resetImportReview();
      if (result) await refreshEvents();
      root.querySelector('[data-action="import"]').focus();
    } else if (action === 'cancel-import') {
      resetImportReview();
      setStatus('Import canceled. No records were changed.');
      root.querySelector('[data-action="import"]').focus();
    } else if (action === 'import' && !root.dataset.busy) {
      resetImportReview();
      importFile.click();
    }
  });

  importFile.addEventListener('change', async () => {
    const file = importFile.files?.[0];
    importFile.value = '';
    if (!file || root.dataset.busy) return;
    resetImportReview();
    const generation = importReadGeneration;
    const result = await busy(
      async () => {
        if (file.size > MAX_IMPORT_FILE_BYTES) throw new Error('Import files must be 10 MiB or smaller. Nothing was imported.');
        const text = await file.text();
        if (generation !== importReadGeneration) return null;
        return controller.prepareImportRecords(text);
      },
      'File reviewed. Confirm merge to import, or Cancel to leave saved records unchanged.',
    );
    if (generation !== importReadGeneration) {
      setStatus('Import review canceled. No records were changed.');
      return;
    }
    if (!result) return;
    root.querySelector('[data-role="import-filename"]').textContent = file.name;
    const summary = root.querySelector('[data-role="import-summary"]');
    for (const [key, label] of [['events', 'Events'], ['charts', 'Charts'], ['workspaces', 'Research workspaces']]) {
      const row = document.createElement('p');
      row.textContent = `${label}: ${result[key].added} to add · ${result[key].overwrite} to overwrite · ${result[key].unchanged} unchanged (skipped)`;
      summary.append(row);
    }
    importHasChanges = Object.values(result).some((entry) => entry.added || entry.overwrite);
    importHasOverwrites = Object.values(result).some((entry) => entry.overwrite);
    root.querySelector('[data-role="import-overwrite"]').hidden = !importHasOverwrites;
    updateImportConfirmation();
    if (!importHasChanges) setStatus('All records already match. Nothing needs to be imported.');
    importReview.hidden = false;
    root.querySelector('#astroeye-import-title').focus();
  });

  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    resetImportReview();
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
      resetImportReview();
      eventSky?.setEnabled(false);
      delete root.dataset.skyCompact;
      schedulePanel.cancel();
      root.hidden = true;
      previouslyFocused?.focus?.();
    },
    destroy() {
      resetImportReview();
      comparison.destroy();
      notebookPanel?.destroy();
      eventRefresh++;
      unsubscribeSavedMap?.();
      eventSky?.destroy();
      schedulePanel.destroy();
      root.remove();
    },
  });
}
