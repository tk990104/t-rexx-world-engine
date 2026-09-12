import { captureComparison, compareCharts } from './chartComparison.js';
import { serializeComparisonReport, downloadComparisonReport } from './comparisonReport.js';

/** Session-only comparison UI: deliberately has no storage, clock or camera capabilities. */
export function mountChartComparison(host, { downloadReport = downloadComparisonReport } = {}) {
  host.innerHTML = `<h4>Chart comparison</h4>
    <p class="astroeye-help">Pin the displayed chart, including its current time preview. Then select another event or explore another time. Pinning does not change saved records or the globe.</p>
    <div class="astroeye-chart-actions"><button type="button" data-comparison="pin">Pin this chart</button><button type="button" data-comparison="clear" disabled>Clear pinned chart</button></div>
    <div class="astroeye-chart-actions"><button type="button" data-comparison="export" disabled>Download comparison report (.txt)</button></div>
    <p class="astroeye-help">The report includes these two event titles, chart times, calculation settings and comparison values. Review before sharing. It is not an event backup and cannot be imported.</p>
    <p class="astroeye-help" data-comparison="export-status" role="status"></p>
    <p class="astroeye-help" data-comparison="pinned" aria-live="polite"></p>
    <p class="astroeye-help" data-comparison="current"></p>
    <p class="astroeye-help" data-comparison="warning" role="status"></p>
    <table data-comparison="table" hidden><caption>Zodiac longitudes and shortest angular separation (0–180°)</caption><thead><tr><th scope="col">Point</th><th scope="col">Pinned</th><th scope="col">Current</th><th scope="col">Separation</th></tr></thead><tbody></tbody></table>
    <p class="astroeye-help">One snapshot, this session only. Not included in event backups, links or tours; cleared on reload. The separate report downloads only when requested. Angular differences are not sports predictions or evidence of astrological effects.</p>`;
  let pinned = null, current = null, error = '';
  const node = (name) => host.querySelector(`[data-comparison="${name}"]`);
  const describe = (value) => `${value.title} · ${value.calculatedFor} · ${value.houseSystem} houses · ${value.engine} ${value.version} · ${value.zodiac} · ${value.frame}`;
  const degrees = (value) => value == null ? 'Unavailable' : `${value.toFixed(2)}°`;
  function render() {
    node('pin').disabled = !current;
    node('pin').textContent = pinned ? 'Replace pinned chart' : 'Pin this chart';
    node('clear').disabled = !pinned;
    node('pinned').textContent = pinned ? `Pinned snapshot: ${describe(pinned)}` : 'No chart pinned.';
    node('current').textContent = pinned && current ? `Current chart: ${describe(current)}` : '';
    const result = pinned && current ? compareCharts(pinned, current) : { rows: [], warning: error };
    node('warning').textContent = result.warning;
    node('table').hidden = !result.rows.length;
    node('export').disabled = !result.rows.length;
    const body = host.querySelector('tbody');
    body.replaceChildren();
    for (const row of result.rows) {
      const tr = document.createElement('tr');
      const label = document.createElement('th'); label.scope = 'row'; label.textContent = row.body;
      tr.append(label);
      for (const value of [row.pinned, row.current, row.separation]) {
        const td = document.createElement('td'); td.textContent = degrees(value); tr.append(td);
      }
      body.append(tr);
    }
  }
  function click(event) {
    const action = event.target.closest('button')?.dataset.comparison;
    if (action === 'export') {
      try {
        downloadReport(serializeComparisonReport(pinned, current));
        node('export-status').textContent = 'Comparison report download requested. Saved events and pinned chart are unchanged.';
      } catch (cause) { node('export-status').textContent = cause.message || 'Could not download the comparison report.'; }
      return;
    }
    if (action === 'pin' && current) pinned = current;
    else if (action === 'clear') pinned = null;
    else return;
    node('export-status').textContent = '';
    render();
    if (action === 'clear') node('pin').focus();
  }
  host.addEventListener('click', click);
  render();
  return Object.freeze({
    update(event, chart) {
      current = null; error = '';
      node('export-status').textContent = '';
      if (event && chart) {
        try { current = captureComparison(event, chart); }
        catch (cause) { error = cause.message; }
      }
      render();
    },
    destroy() { pinned = null; current = null; host.removeEventListener('click', click); host.replaceChildren(); },
  });
}
