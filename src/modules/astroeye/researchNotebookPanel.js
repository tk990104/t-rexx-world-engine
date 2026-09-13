import { MAX_RESEARCH_NOTE_LENGTH } from './researchNotebook.js';

export function mountResearchNotebook(host, { notebook, confirmDiscard = (message) => window.confirm(message) }) {
  host.innerHTML = `<h3 tabindex="-1">Research notebook</h3>
    <p class="astroeye-help">One notebook across events, saved only in this browser. It is not automatically linked to the current event or chart. Opening charts never adds or changes notes.</p>
    <p class="astroeye-help">Save notes explicitly. Saved notes are included in Export all backups, but excluded from matching-event exports, comparison reports, links and tours. Review backups before sharing; browser data can be cleared. Unsaved edits survive panel close/reopen, not page reload.</p>
    <label>Research notes<textarea rows="8" maxlength="${MAX_RESEARCH_NOTE_LENGTH}" disabled></textarea></label>
    <p class="astroeye-help" data-note="count"></p>
    <div class="astroeye-chart-actions"><button type="button" data-note="save" disabled>Save notes</button><button type="button" data-note="reload">Reload saved notes</button></div>
    <p class="astroeye-help" data-note="status" role="status">Open the notebook to load saved notes.</p>`;
  const textarea = host.querySelector('textarea');
  const node = (name) => host.querySelector(`[data-note="${name}"]`);
  let baseline = null, baselineText = '', loaded = false, pending = false, destroyed = false;
  const dirty = () => loaded && textarea.value !== baselineText;
  function render() {
    textarea.disabled = pending || !loaded;
    node('save').disabled = pending || !dirty();
    node('reload').disabled = pending;
    node('count').textContent = `${textarea.value.length.toLocaleString('en-US')} / 10,000 characters${dirty() ? ' · Unsaved changes' : ''}`;
  }
  async function load() {
    if (pending || destroyed) return;
    if (dirty() && !confirmDiscard('Discard unsaved notebook edits and reload saved notes?')) return;
    pending = true; render(); node('status').textContent = 'Loading saved notes…';
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
    pending = true; render(); node('status').textContent = 'Saving notes…';
    try {
      const record = await notebook.save(text, baseline);
      if (destroyed) return;
      baseline = record; baselineText = text; node('status').textContent = 'Notes saved in this browser. Use Export all for a backup.';
    } catch (cause) { if (!destroyed) node('status').textContent = cause.message || 'Could not save notes. Your draft is unchanged.'; }
    finally { pending = false; if (!destroyed) render(); }
  }
  function input() { render(); node('status').textContent = dirty() ? 'Unsaved changes. Choose Save notes to keep them.' : 'No unsaved changes.'; }
  function click(event) {
    const action = event.target.closest('button')?.dataset.note;
    if (action === 'save') void save();
    if (action === 'reload') void load();
  }
  host.addEventListener('click', click); textarea.addEventListener('input', input); render();
  return Object.freeze({
    open() { host.hidden = false; if (!loaded) void load(); },
    destroy() { destroyed = true; host.removeEventListener('click', click); textarea.removeEventListener('input', input); host.replaceChildren(); },
  });
}
