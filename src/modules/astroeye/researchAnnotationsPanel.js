import { MAX_RESEARCH_ANNOTATIONS, MAX_ANNOTATION_NOTE_LENGTH, validateResearchAnnotation } from './researchAnnotations.js';
import { createUnsavedNotebookGuard } from './unsavedNotebookGuard.js';
import { downloadNotebookDraft } from './notebookDraftDownload.js';

/** Local event notes; host controls suspension without discarding the draft. */
export function mountResearchAnnotations(host, { annotations,
  noteLayer = null,
  canInteract = () => true,
  confirmDiscard = (message) => host.ownerDocument.defaultView.confirm(message),
  downloadDraft = downloadNotebookDraft,
} = {}) {
  host.innerHTML = `<h3 tabindex="-1">Event research notes</h3>
    <p class="astroeye-help">Separate from the notebook and session callouts. New note captures the selected saved chart's UTC time and venue coordinates. Switching charts never changes a draft. Opening a note does not move the globe or select a chart.</p>
    <p class="astroeye-help">Local browser storage only; use Export all for a private backup. Review backups before sharing. Save or download unsaved text before leaving; browser warnings cannot protect against crashes.</p>
    <section data-annotation="map-controls" hidden><button type="button" data-annotation="map-toggle" aria-pressed="false">Show note markers</button><button type="button" data-annotation="map-refresh" disabled>Refresh note markers</button>
      <p class="astroeye-help">Opt-in amber markers show saved captured locations and UTC times, not private note text. Read-only: clicking does not open notes. Notes with identical coordinates share one count-and-time label; First/Last show the earliest/latest captures, not every capture time. Nearby labels may still overlap. Open saved notes here for individual details. Close AstroEye to see the globe; showing markers does not move the camera. They turn off for playback/shared previews and are not saved in links or tours.</p>
      <p class="astroeye-help" data-annotation="map-status" role="status"></p></section>
    <p data-annotation="current" class="astroeye-help"></p>
    <div class="astroeye-chart-actions"><button type="button" data-annotation="new" disabled>New note from selected chart</button><button type="button" data-annotation="reload">Reload saved event notes</button></div>
    <label>Saved event notes<select data-annotation="list" disabled></select></label>
    <p data-annotation="capture" class="astroeye-help"></p>
    <p data-annotation="source" class="astroeye-help" role="status"></p>
    <label>Event note text<textarea rows="6" maxlength="${MAX_ANNOTATION_NOTE_LENGTH}" disabled></textarea></label>
    <p data-annotation="count" class="astroeye-help"></p>
    <div class="astroeye-chart-actions"><button type="button" data-annotation="save" disabled>Save event note</button><button type="button" data-annotation="delete" disabled>Delete event note</button><button type="button" data-annotation="download" disabled>Download draft text</button></div>
    <button type="button" data-annotation="undo" disabled>Undo last note deletion</button>
    <p class="astroeye-help">Undo restores only the last deleted saved note in this session, not unsaved edits. Reloading the page loses undo. Export all is a private backup of the whole note collection; an acknowledged import can replace that entire collection. Draft downloads contain only this editor's text, not an importable backup or the captured location/time.</p>
    <p data-annotation="status" class="astroeye-help" role="status">Open event notes to load this browser's collection.</p>`;
  const node = (name) => host.querySelector(`[data-annotation="${name}"]`);
  const editor = host.querySelector('textarea'), list = node('list');
  const guard = createUnsavedNotebookGuard(host.ownerDocument.defaultView);
  function renderMap() {
    if (!noteLayer) return;
    const state = noteLayer.state();
    node('map-controls').hidden = false;
    node('map-toggle').disabled = !allowed() || (!state.enabled && !state.available);
    node('map-toggle').textContent = state.enabled ? 'Hide note markers' : 'Show note markers';
    node('map-toggle').setAttribute('aria-pressed', String(state.enabled));
    node('map-refresh').disabled = !allowed() || !state.enabled || state.loading;
    node('map-status').textContent = state.error || (!state.available ? 'Note markers are unavailable during playback or an unsaved shared view.' : state.loading ? 'Loading saved note markers…' : `${state.shown} / ${state.limit} note markers shown · ${state.enabled ? 'On for this session' : 'Off'}`);
  }
  let baseline = null, loaded = false, pending = false, destroyed = false;
  let opened = false, suspended = false, suspensionVersion = 0;
  const allowed = () => !suspended && canInteract();
  let current = null, capture = null, editingId = '', savedText = '', sourceVersion = 0, deleted = null;
  const dirty = () => !!capture && editor.value !== savedText;
  const count = () => baseline?.annotations.length ?? 0;
  function render() {
    guard.setDirty(dirty());
    const blocked = pending || !allowed();
    host.hidden = !opened || !allowed();
    editor.disabled = blocked || !capture;
    list.disabled = blocked || !loaded;
    node('new').disabled = blocked || !loaded || !current || count() >= MAX_RESEARCH_ANNOTATIONS;
    node('reload').disabled = blocked;
    node('save').disabled = blocked || !capture || !editor.value.trim() || !dirty();
    node('delete').disabled = blocked || !editingId;
    node('undo').disabled = blocked || !loaded || !deleted;
    node('download').disabled = blocked || !capture || !editor.value.length;
    node('count').textContent = `${editor.value.length} / ${MAX_ANNOTATION_NOTE_LENGTH} characters · ${count()} / ${MAX_RESEARCH_ANNOTATIONS} saved notes${dirty() ? ' · Unsaved changes' : ''}`;
    renderMap();
  }
  function refreshList() {
    list.replaceChildren();
    const add = (value, text) => {
      const option = host.ownerDocument.createElement('option'); option.value = value; option.textContent = text; list.append(option);
    };
    add('', 'Choose a saved note');
    for (const entry of baseline?.annotations ?? []) add(entry.id, `${entry.chartTimeUtc} · ${entry.note.slice(0, 60)}`);
    list.value = editingId;
  }
  function discard() { return !dirty() || confirmDiscard('Discard unsaved event-note text? Download or copy the draft first if you need it.'); }
  async function sourceStatus(entry) {
    const version = ++sourceVersion;
    node('source').textContent = 'Checking source event…';
    try {
      const state = await annotations.sourceState(entry);
      if (destroyed || version !== sourceVersion) return;
      node('source').textContent = state === 'source-present'
        ? 'Source event found at this check. Captured time and coordinates stay unchanged.'
        : 'Source event missing. This note and its captured time/location remain available.';
    } catch {
      if (!destroyed && version === sourceVersion) node('source').textContent = 'Source status unavailable. The note is unchanged.';
    }
  }
  function show(entry, id = '', text = '') {
    sourceVersion++; capture = entry; editingId = id; savedText = text; editor.value = text;
    list.value = id;
    node('capture').textContent = entry
      ? `Captured: ${entry.chartTimeUtc} · ${entry.latitude}, ${entry.longitude} · Source: ${entry.eventId}` : 'Choose a saved note or start a new one.';
    node('source').textContent = '';
    if (entry) void sourceStatus(entry);
    render();
  }
  async function run(action) {
    if (pending || destroyed || !allowed()) return;
    pending = true; render();
    try { await action(); }
    catch (cause) { if (!destroyed) node('status').textContent = `${cause.message || 'Operation failed.'} Draft unchanged; copy or download it before reloading.`; }
    finally { pending = false; if (!destroyed) render(); }
  }
  function load() {
    if (pending || destroyed || !discard()) return;
    return run(async () => {
      const record = await annotations.load();
      if (destroyed) return;
      baseline = record; loaded = true; editingId = ''; refreshList(); show(null);
      void noteLayer?.refresh();
      node('status').textContent = 'Saved event notes loaded. Opening notes never changes the globe or current chart.';
    });
  }
  function newNote() {
    if (pending || destroyed || !loaded || !current || count() >= MAX_RESEARCH_ANNOTATIONS || !discard()) return;
    const snapshot = structuredClone(current);
    const version = suspensionVersion;
    return run(async () => {
      if (await annotations.sourceState(snapshot) !== 'source-present') throw new Error('Save the source event in this browser before starting a note.');
      if (destroyed || !allowed() || version !== suspensionVersion) return;
      show(snapshot);
      node('status').textContent = 'New draft captured. Write text, then Save event note. No record has been written yet.';
    }).then(() => { if (!destroyed && capture === snapshot) editor.focus(); });
  }
  function save() {
    if (pending || destroyed || !capture || !dirty() || !editor.value.trim()) return;
    const text = editor.value, snapshot = structuredClone(capture), id = editingId;
    return run(async () => {
      const next = id ? await annotations.edit(id, text, baseline)
        : await annotations.add({ event: { id: snapshot.eventId, venue: { latitude: snapshot.latitude, longitude: snapshot.longitude } },
          chart: { eventId: snapshot.eventId, calculatedFor: snapshot.chartTimeUtc } }, text, baseline);
      if (destroyed) return;
      const entry = id ? next.annotations.find((item) => item.id === id)
        : next.annotations.find((item) => !(baseline?.annotations ?? []).some((old) => old.id === item.id));
      baseline = next; refreshList(); show(entry, entry.id, entry.note);
      void noteLayer?.refresh();
      node('status').textContent = 'Event note saved locally. Export all includes it in your private backup.';
    });
  }
  function remove() {
    if (pending || destroyed || !editingId) return;
    if (!confirmDiscard('Delete this saved event note and any unsaved edits? Only the last saved note can be restored with Undo during this session; unsaved text cannot. Export a backup or download draft text first.')) return;
    const id = editingId;
    const removed = structuredClone(baseline.annotations.find((entry) => entry.id === id));
    return run(async () => {
      const next = await annotations.remove(id, baseline);
      if (destroyed) return;
      deleted = removed; baseline = next; editingId = ''; refreshList(); show(null);
      void noteLayer?.refresh();
      node('status').textContent = 'Event note deleted. Undo last note deletion is available this session. Source events, charts and the notebook are unchanged.';
    });
  }
  function undo() {
    if (pending || destroyed || !loaded || !deleted || !discard()) return;
    const entry = structuredClone(deleted);
    return run(async () => {
      const next = await annotations.restore(entry, baseline);
      if (destroyed) return;
      baseline = next; deleted = null; refreshList(); show(entry, entry.id, entry.note);
      void noteLayer?.refresh();
      node('status').textContent = 'Deleted saved note restored with its original ID, time and location. Unsaved edits were not recovered.';
    });
  }
  function choose() {
    if (pending || destroyed || !allowed() || !loaded || !discard()) { list.value = editingId; return; }
    const entry = baseline?.annotations.find((item) => item.id === list.value);
    show(entry ?? null, entry?.id ?? '', entry?.note ?? '');
    node('status').textContent = entry ? 'Saved note opened. Captured details are read-only.' : 'Choose a saved note or start a new one.';
  }
  function input() { render(); node('status').textContent = dirty() ? 'Unsaved changes. Save event note to keep them.' : 'No unsaved changes.'; }
  function click(event) {
    if (!allowed()) return;
    const action = event.target.closest('button')?.dataset.annotation;
    if (action === 'new') void newNote();
    if (action === 'reload') void load();
    if (action === 'save') void save();
    if (action === 'delete') void remove();
    if (action === 'undo') void undo();
    if (action === 'map-toggle' && noteLayer) void noteLayer.setEnabled(!noteLayer.state().enabled);
    if (action === 'map-refresh' && noteLayer) void noteLayer.refresh();
    if (action === 'download' && !pending && !destroyed && capture && editor.value.length) {
      try {
        downloadDraft({ text: editor.value, filename: 't-rexx-event-note-draft.txt', mimeType: 'text/plain;charset=utf-8' });
        node('status').textContent = 'Draft text download requested. Nothing was saved or marked clean.';
      } catch { node('status').textContent = 'Draft download failed. Text is unchanged; copy it before leaving.'; }
    }
  }
  host.addEventListener('click', click); editor.addEventListener('input', input); list.addEventListener('change', choose);
  refreshList(); render();
  const unsubscribeMap = noteLayer?.subscribe(renderMap);
  return Object.freeze({
    updateSelection(selection) {
      if (destroyed) return;
      current = null;
      if (selection && !selection.isShared) {
        try {
          if (selection.chart?.eventId !== selection.event?.id) throw new Error('Mismatched chart');
          current = validateResearchAnnotation({ id: 'astroeye-note:preview', schemaVersion: 1,
            eventId: selection.event.id, chartTimeUtc: selection.chart.calculatedFor,
            latitude: selection.event.venue?.latitude, longitude: selection.event.venue?.longitude, note: '-' });
        } catch { current = null; }
      }
      node('current').textContent = current ? `Selected chart: ${current.chartTimeUtc}. New note captures this chart.` : 'Select a saved event chart to start a note. Unsaved shared views cannot be captured.';
      render();
    },
    open() { if (destroyed || !allowed()) return false; opened = true; render(); if (!loaded) void load(); return true; },
    setSuspended(value) { if (destroyed) return; if (value === true && !suspended) suspensionVersion++; suspended = value === true; render(); },
    destroy() { destroyed = true; sourceVersion++; unsubscribeMap?.(); guard.destroy(); host.removeEventListener('click', click); editor.removeEventListener('input', input); list.removeEventListener('change', choose); host.replaceChildren(); },
  });
}
