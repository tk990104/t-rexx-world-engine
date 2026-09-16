import { createRenderCheck } from './renderCheck.js';

export function mountRenderCheckPanel({ host, postRender, readCounters }) {
  const document = host.ownerDocument;
  const panel = document.createElement('details');
  panel.className = 'astroeye-quick-start astroeye-render-check';
  panel.innerHTML = `<summary>10-second render check</summary>
    <p>Optional local diagnostic. Keep this tab visible and do not interact for 10 seconds.
    This counts existing scene renders; it does not force frames, change layers or access saved records.
    Existing map feeds continue normally. No diagnostic data is sent automatically.</p>
    <button type="button" data-check="start">Start 10-second check</button>
    <button type="button" data-check="cancel" hidden>Cancel check</button>
    <p data-check="status" role="status" aria-live="polite">Not run.</p>
    <label>Local report — select and copy to share if you choose
      <textarea data-check="report" rows="12" readonly spellcheck="false" aria-label="Local render check report" hidden></textarea>
    </label>
    <p>Few or zero frames can be normal when idle. This is not GPU timing, maximum FPS,
    chart calculation speed or proof that performance meets a release target.</p>`;
  const navigation = host.querySelector('.astroeye-quick-nav');
  if (navigation) navigation.after(panel);
  else host.append(panel);
  const start = panel.querySelector('[data-check="start"]'), cancel = panel.querySelector('[data-check="cancel"]');
  const status = panel.querySelector('[data-check="status"]'), report = panel.querySelector('[data-check="report"]');
  const check = createRenderCheck({ postRender, readCounters, document });
  let disposed = false;
  const run = async () => {
    start.disabled = true; cancel.hidden = false; report.hidden = true; report.value = '';
    status.textContent = 'Observing for 10 seconds. Keep this tab visible and do not interact.';
    try {
      const result = await check.start();
      if (disposed) return;
      report.value = JSON.stringify(result, null, 2); report.hidden = false;
      status.textContent = result.status === 'completed' ? 'Observation complete. No settings or records were changed.'
        : `Observation incomplete: ${result.reason}. You can retry when ready.`;
    } catch (error) { if (!disposed) status.textContent = error.message; }
    finally { if (!disposed) { start.disabled = false; cancel.hidden = true; } }
  };
  const stop = () => check.cancel();
  start.addEventListener('click', run); cancel.addEventListener('click', stop);
  return { destroy() { disposed = true; check.destroy(); start.removeEventListener('click', run); cancel.removeEventListener('click', stop); panel.remove(); } };
}
