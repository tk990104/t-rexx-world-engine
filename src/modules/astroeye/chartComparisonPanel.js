import { captureComparison, compareCharts } from './chartComparison.js';
import { serializeComparisonReport, downloadComparisonReport } from './comparisonReport.js';
import { compareCrossChartAspects, crossAspectSummary, CROSS_ASPECT_RULES, CROSS_ASPECT_SCOPE } from './crossChartAspects.js';
import { filterCrossChartAspects, normalizeCrossAspectFilters, crossAspectFilterSummary } from './crossAspectFilters.js';

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
    <div class="astroeye-chart-actions"><button type="button" data-comparison="aspects-toggle" aria-pressed="false" disabled>Show cross-chart aspects</button></div>
    <section data-comparison="aspects" hidden aria-label="Cross-chart aspects">
      <div class="astroeye-aspect-filters">
        <label>Aspect type<select data-comparison="aspect-kind"><option value="all">All aspects</option><option value="conjunction">Conjunction</option><option value="sextile">Sextile</option><option value="square">Square</option><option value="trine">Trine</option><option value="opposition">Opposition</option></select></label>
        <label>Maximum orb<select data-comparison="aspect-orb"><option value="standard">Standard limits</option><option value="0">Exact only (0°)</option><option value="1">1°</option><option value="2">2°</option><option value="3">3°</option><option value="5">5°</option></select></label>
        <button type="button" data-comparison="reset-filters">Reset aspect filters</button>
      </div>
      <p class="astroeye-help">Filters narrow existing matches using unrounded values; they never widen the standard limits. The report includes only the filtered aspect rows. Same-point longitude rows are unchanged.</p>
      <p class="astroeye-help" data-comparison="filter-summary" role="status"></p>
      <p class="astroeye-help" data-comparison="aspect-rules"></p>
      <p class="astroeye-help" data-comparison="aspect-scope"></p>
      <p class="astroeye-help" data-comparison="aspect-summary" role="status"></p>
      <div class="astroeye-cross-aspects" role="region" aria-label="Cross-chart aspect matches" tabindex="0"><table data-comparison="aspect-table"><caption>Cross-chart matches (degrees)</caption><thead><tr><th scope="col">Pinned</th><th scope="col">Current</th><th scope="col">Aspect</th><th scope="col">Separation</th><th scope="col">Orb</th></tr></thead><tbody></tbody></table></div>
    </section>
    <p class="astroeye-help">Cross-chart aspects are optional and included in the report only while shown. These are geometric matches, not interpretations or predictions.</p>
    <p class="astroeye-help">One snapshot, this session only. Not included in event backups, links or tours; cleared on reload. The separate report downloads only when requested. Angular differences are not sports predictions or evidence of astrological effects.</p>`;
  let pinned = null, current = null, error = '', showAspects = false;
  let aspectFilters = normalizeCrossAspectFilters();
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
    node('aspects-toggle').disabled = !result.rows.length;
    node('aspects-toggle').setAttribute('aria-pressed', String(showAspects));
    node('aspects-toggle').textContent = showAspects ? 'Hide cross-chart aspects' : 'Show cross-chart aspects';
    node('aspects').hidden = !showAspects || !result.rows.length;
    const aspectBody = node('aspect-table').querySelector('tbody');
    aspectBody.replaceChildren();
    node('aspect-summary').textContent = '';
    node('filter-summary').textContent = '';
    node('aspect-kind').value = aspectFilters.aspect;
    node('aspect-orb').value = aspectFilters.maxOrb === null ? 'standard' : String(aspectFilters.maxOrb);
    if (showAspects && result.rows.length) {
      const allAspects = compareCrossChartAspects(pinned, current);
      const aspects = filterCrossChartAspects(allAspects, aspectFilters);
      node('aspect-rules').textContent = `Inclusive orb limits: ${CROSS_ASPECT_RULES}.`;
      node('aspect-scope').textContent = CROSS_ASPECT_SCOPE;
      node('aspect-summary').textContent = crossAspectSummary(allAspects);
      node('filter-summary').textContent = crossAspectFilterSummary(aspects);
      for (const row of aspects.rows) {
        const tr = document.createElement('tr');
        for (const value of [row.pinned, row.current, row.aspect, degrees(row.separation), degrees(row.orb)]) {
          const td = document.createElement('td'); td.textContent = value; tr.append(td);
        }
        aspectBody.append(tr);
      }
    }
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
        downloadReport(serializeComparisonReport(pinned, current, { includeAspects: showAspects, aspectFilters }));
        node('export-status').textContent = 'Comparison report download requested. Saved events and pinned chart are unchanged.';
      } catch (cause) { node('export-status').textContent = cause.message || 'Could not download the comparison report.'; }
      return;
    }
    if (action === 'pin' && current) pinned = current;
    else if (action === 'clear') { pinned = null; showAspects = false; aspectFilters = normalizeCrossAspectFilters(); }
    else if (action === 'reset-filters') aspectFilters = normalizeCrossAspectFilters();
    else if (action === 'aspects-toggle' && pinned && current && compareCharts(pinned, current).rows.length) showAspects = !showAspects;
    else return;
    node('export-status').textContent = '';
    render();
    if (action === 'clear') node('pin').focus();
    if (action === 'reset-filters') node('aspect-kind').focus();
  }
  function change(event) {
    if (!['aspect-kind', 'aspect-orb'].includes(event.target.dataset.comparison)) return;
    try {
      aspectFilters = normalizeCrossAspectFilters({ aspect: node('aspect-kind').value,
        maxOrb: node('aspect-orb').value === 'standard' ? null : Number(node('aspect-orb').value) });
      render();
      node('export-status').textContent = '';
    } catch (cause) { render(); node('export-status').textContent = cause.message; }
  }
  host.addEventListener('click', click);
  host.addEventListener('change', change);
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
    destroy() { pinned = null; current = null; host.removeEventListener('click', click); host.removeEventListener('change', change); host.replaceChildren(); },
  });
}
