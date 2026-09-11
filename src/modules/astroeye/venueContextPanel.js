import './venueContextPanel.css';
import { createVenueContextModel } from './venueContext.js';

/** Compact context panel and keyboard-accessible selected-event shortcut. */
export function mountVenueContextPanel({ getSelection, eventBus, onOpen, onClose, onChart, onVenue, canInteract = () => true, host = document.body }) {
  const root = document.createElement('aside');
  root.id = 'astroeye-venue-context';
  root.hidden = true;
  root.setAttribute('aria-labelledby', 'astroeye-venue-title');
  root.innerHTML = `
    <header><div><span>ASTROEYE · VENUE CONTEXT</span><h2 id="astroeye-venue-title"></h2></div>
    <button type="button" data-venue-action="close" aria-label="Close venue details">×</button></header>
    <p data-venue="summary"></p>
    <dl>
      <dt>Venue</dt><dd data-venue="venue"></dd>
      <dt>Coordinates</dt><dd data-venue="coordinates"></dd>
      <dt>Coordinate source</dt><dd data-venue="coordinateSource"></dd>
      <dt>Scheduled event start</dt><dd data-venue="eventTime"></dd>
      <dt>Current chart time</dt><dd data-venue="chartTime"></dd>
      <dt>Preview offset</dt><dd data-venue="mode"></dd>
      <dt>Chart method</dt><dd data-venue="method"></dd>
      <dt>Event source</dt><dd data-venue="source"></dd>
      <dt>Record status</dt><dd data-venue="storage"></dd>
    </dl>
    <p>Live map feeds and lighting are not historical replay. Source details are provided for review, not independently verified here.</p>
    <div class="astroeye-venue-actions"><button type="button" data-venue-action="chart">Open event chart</button><button type="button" data-venue-action="venue">View venue</button></div>
    <p data-venue-status role="status" aria-live="polite"></p>`;
  const launcher = document.createElement('button');
  launcher.id = 'astroeye-selected-event';
  launcher.type = 'button';
  launcher.hidden = true;
  launcher.setAttribute('aria-controls', root.id);
  launcher.setAttribute('aria-expanded', 'false');
  host.append(root, launcher);
  const status = root.querySelector('[data-venue-status]');
  let disposed = false;
  let busy = false;
  function render() {
    const model = createVenueContextModel(getSelection());
    launcher.hidden = !model;
    launcher.textContent = model ? `Selected event · ${model.title}` : '';
    launcher.setAttribute('aria-label', model ? `Open venue details for ${model.title}` : 'No selected event');
    root.querySelector('h2').textContent = model?.title || 'No event selected';
    for (const node of root.querySelectorAll('[data-venue]')) node.textContent = model?.[node.dataset.venue] || '';
    for (const button of root.querySelectorAll('.astroeye-venue-actions button')) button.disabled = !model;
  }
  async function action(callback) {
    if (busy || disposed || !canInteract()) return;
    busy = true; status.textContent = '';
    try { await callback(); }
    catch (error) { status.textContent = error.message || 'Could not open event details.'; }
    finally { busy = false; }
  }
  launcher.addEventListener('click', () => { void action(onOpen); });
  root.addEventListener('click', (event) => {
    const kind = event.target.closest('[data-venue-action]')?.dataset.venueAction;
    if (kind === 'close') void action(onClose);
    else if (kind === 'chart') void action(onChart);
    else if (kind === 'venue') void action(onVenue);
  });
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault(); event.stopPropagation();
    void action(onClose);
  });
  const subscriptions = ['astroeye:event-selected', 'astroeye:time-preview', 'astroeye:event-deleted'].map((type) => eventBus.on(type, render));
  render();
  return Object.freeze({
    root,
    open() { render(); root.hidden = false; launcher.setAttribute('aria-expanded', 'true'); root.querySelector('[data-venue-action="close"]').focus(); },
    close() { root.hidden = true; launcher.setAttribute('aria-expanded', 'false'); if (!launcher.hidden) launcher.focus(); },
    destroy() { disposed = true; subscriptions.forEach((unsubscribe) => unsubscribe()); root.remove(); launcher.remove(); },
  });
}
