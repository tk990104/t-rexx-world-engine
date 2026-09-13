import { compareCharts } from './chartComparison.js';
import { compareCrossChartAspects, crossAspectSummary, CROSS_ASPECT_RULES, CROSS_ASPECT_SCOPE } from './crossChartAspects.js';
import { filterCrossChartAspects, crossAspectFilterSummary } from './crossAspectFilters.js';

// Quote free text so embedded line breaks cannot masquerade as report structure.
const quote = (value) => JSON.stringify(value).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const degrees = (value) => value == null ? 'Unavailable' : `${value.toFixed(2)}°`;

export function serializeComparisonReport(pinned, current, { includeAspects = false, aspectFilters } = {}) {
  if (!pinned || !current) throw new Error('Pin a chart and open a current chart before exporting a comparison.');
  const result = compareCharts(pinned, current);
  if (!result.rows.length) throw new Error(result.warning);
  const allAspects = includeAspects === true ? compareCrossChartAspects(pinned, current) : null;
  const aspects = allAspects ? filterCrossChartAspects(allAspects, aspectFilters) : null;
  const describe = (label, chart) => [
    label,
    `Event title: ${quote(chart.title)}`,
    `Chart time (UTC): ${chart.calculatedFor}`,
    `Engine: ${quote(chart.engine)}; version: ${quote(chart.version)}`,
    `Zodiac: ${quote(chart.zodiac)}; reference frame: ${quote(chart.frame)}`,
    `House system: ${quote(chart.houseSystem)}`,
    '',
  ];
  return [
    'T-REXX WORLD ENGINE — ASTROEYE COMPARISON REPORT',
    'Report format: 3',
    'Read-only snapshot report. Not an event backup; cannot be imported into AstroEye.',
    '',
    ...describe('PINNED SNAPSHOT', pinned),
    ...describe('CURRENT CHART', current),
    ...(result.warning ? [`Note: ${result.warning}`, ''] : []),
    'ZODIAC LONGITUDES',
    'Point | Pinned | Current | Shortest separation',
    ...result.rows.map((row) => `${row.body} | ${degrees(row.pinned)} | ${degrees(row.current)} | ${degrees(row.separation)}`),
    '',
    ...(aspects ? [
      'CROSS-CHART ASPECTS',
      `Inclusive orb limits: ${CROSS_ASPECT_RULES}.`,
      CROSS_ASPECT_SCOPE,
      crossAspectSummary(allAspects),
      crossAspectFilterSummary(aspects),
      'Pinned point | Current point | Aspect | Separation | Orb',
      ...aspects.rows.map((row) => `${row.pinned} | ${row.current} | ${row.aspect} | ${degrees(row.separation)} | ${degrees(row.orb)}`),
      '',
    ] : ['Cross-chart aspects were not included (view not enabled).', '']),
    'Units: degrees. Separation is unsigned, from 0 to 180 degrees.',
    'Values are rounded to two decimals for display; separation is computed before rounding.',
    'Unavailable means a missing or invalid value, not zero.',
    'Chart times may be unsaved time-explorer previews, not the original event start.',
    'Only the two displayed snapshots are included; no saved-event collection, research workspaces, venue coordinates or camera state.',
    'Angular differences are not sports predictions or evidence of astrological effects.',
    'Review event titles and chart times before sharing this report.',
    '',
  ].join('\n');
}

export function downloadComparisonReport(report) {
  const url = URL.createObjectURL(new Blob([report], { type: 'text/plain;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 't-rexx-chart-comparison.txt';
  try { anchor.click(); }
  finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
