import { MAX_RESEARCH_NOTE_LENGTH } from './researchNotebook.js';
import { createNotebookChartReference, appendNotebookChartReference } from './notebookChartReference.js';
import { createNotebookDraftDownload, downloadNotebookDraft } from './notebookDraftDownload.js';
import { createUnsavedNotebookGuard } from './unsavedNotebookGuard.js';

export function mountResearchNotebook(host, { notebook, downloadDraft = downloadNotebookDraft, confirmDiscard = (message) => window.confirm(message) }) {
  host.innerHTML = `<h3 tabindex="-1">Research notebook</h3>
    <p class="astroeye-help">One notebook across events, saved only in this browser. It is not automatically linked to the current event or chart. Opening charts never adds or changes notes.</p>
    <p class="astroeye-help">Save notes explicitly. Saved notes are included in Export all backups, but excluded from matching-event exports, comparison reports, links and tours. Review backups before sharing; browser data can be cleared. Unsaved edits survive panel close/reopen, not page reload.</p>
    <p class="astroeye-help">While notes are unsaved, this page requests a browser warning before reload or leaving. Browsers may suppress it; crashes or forced app shutdown cannot be protected. Save notes or download a draft before leaving. Downloading does not mark the notebook saved.</p>
    <label>Research notes<textarea rows="8" maxlength="${MAX_RESEARCH_NOTE_LENGTH}" disabled></textarea></label>
    <div class="astroeye-chart-actions"><button type="button" data-note="append-reference" disabled>Append current chart reference</button></div>
    <p class="astroeye-help">Appends the displayed chart's event title, exact UTC time and calculation settings to this draft—not the pinned chart. No venue coordinates or saved-event collection are copied. Review the appended text, then Save notes to keep it. References do not update when charts change.</p>
    <p class="astroeye-help" data-note="reference-status"></p>
    <p class="astroeye-help" data-note="count"></p>
    <div class="astroeye-chart-actions"><button type="button" data-note="save" disabled>Save notes</button><button type="button" data-note="reload">Reload saved notes</button></div>
    <div class="astroeye-chart-actions"><button type="button" data-note="download" disabled>Download note draft (.txt)</button></div>
    <p class="astroeye-help">Downloads exactly the text in this editor, including unsaved edits. It does not save the notebook or resolve a save conflict. The text file is not an importable backup; copy its text back into the editor to recover it. No other saved records are included. Review private details before sharing.</p>
    <p class="astroeye-help" data-note="download-status" role="status"></p>
    <p class="astroeye-help" data-note="status" role="status">Open the notebook to load saved notes.</p>`;
  const textarea = host.querySelector('textarea');
  const node = (name) => host.querySelector(`[data-note="${name}"]`);
  let baseline = null, baselineText = '', loaded = false, pending = false, destroyed = false;
  let reference = null;
  const dirty = () => loaded && textarea.value !== baselineText;
  const leaveGuard = createUnsavedNotebookGuard(host.ownerDocument.defaultView);
  function render() {
    leaveGuard.setDirty(dirty());
    textarea.disabled = pending || !loaded;
    node('save').disabled = pending || !dirty();
    node('reload').disabled = pending;
    node('download').disabled = pending || !loaded || !textarea.value.length;
    node('append-reference').disabled = pending || !loaded || !reference;
    node('count').textContent = `${textarea.value.length.toLocaleString('en-US')} / 10,000 characters${dirty() ? ' · Unsaved changes' : ''}`;
  }
  async function load() {
    if (pending || destroyed) return;
    if (dirty() && !confirmDiscard('Discard unsaved notebook edits and reload saved notes?')) return;
    pending = true; render(); node('status').textContent = 'Loading saved notes…'; node('download-status').textContent = '';
    try {
      const record = await notebook.load();
      if (destroyed) return;
      baseline = record; loaded = true; textarea.value = record?.text ?? ''; baselineText = textarea.value;
      node('status').textContent = record ? 'Saved notes loaded.' : 'No saved notes yet. Write observations, then Save notes.';
    } catch (cause) { if (!destroyed) node('status').textContent = cause.message || 'Could not load notes. Your draft is unchanged.'; }
    finally { pending = false; if (!destroyed) render(); }
  }
  async function save() {
    if (pending || destroyed || !dirty()) return;
    const text = textarea.value;
    pending = true; render(); node('status').textContent = 'Saving notes…'; node('download-status').textContent = '';
    try {
      const record = await notebook.save(text, baseline);
      if (destroyed) return;
      baseline = record; baselineText = text; node('status').textContent = 'Notes saved in this browser. Use Export all for a backup.';
    } catch (cause) { if (!destroyed) node('status').textContent = cause.message || 'Could not save notes. Your draft is unchanged.'; }
    finally { pending = false; if (!destroyed) render(); }
  }
  function input() { render(); node('download-status').textContent = ''; node('status').textContent = dirty() ? 'Unsaved changes. Choose Save notes to keep them.' : 'No unsaved changes.'; }
  function click(event) {
    const action = event.target.closest('button')?.dataset.note;
    if (action === 'save') void save();
    if (action === 'reload') void load();
    if (action === 'download' && loaded && !pending && !destroyed && textarea.value.length) {
      try {
        downloadDraft(createNotebookDraftDownload(textarea.value));
        node('download-status').textContent = 'Draft download requested. Saved notes and unsaved edits are unchanged.';
      } catch (cause) { node('download-status').textContent = cause.message || 'Could not download the draft. Your notes are unchanged.'; }
    }
    if (action === 'append-reference' && loaded && !pending && reference && !destroyed) {
      try {
        textarea.value = appendNotebookChartReference(textarea.value, reference);
        node('download-status').textContent = '';
        render(); textarea.focus(); textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        node('status').textContent = 'Chart reference appended to the draft. Choose Save notes to keep it.';
      } catch (cause) { node('status').textContent = cause.message; }
    }
  }
  host.addEventListener('click', click); textarea.addEventListener('input', input); render();
  return Object.freeze({
    updateChart(event, chart) {
      if (destroyed) return;
      reference = null;
      node('reference-status').textContent = 'Open an event chart to append its reference.';
      if (event && chart) {
        try {
          reference = createNotebookChartReference(event, chart);
          node('reference-status').textContent = `Current chart: ${event.title} · ${new Date(chart.calculatedFor).toISOString()}`;
        } catch { node('reference-status').textContent = 'Current chart metadata is incomplete; no reference can be appended.'; }
      }
      render();
    },
    open() { host.hidden = false; if (!loaded) void load(); },
    destroy() { destroyed = true; leaveGuard.destroy(); host.removeEventListener('click', click); textarea.removeEventListener('input', input); host.replaceChildren(); },
  });
}
