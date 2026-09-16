const TIME_FIELDS = ['localDate', 'localTime', 'timeZone', 'utcStart'];

/** Present a resolved draft or pending edit; never mutate values or move focus. */
export function renderDraftTimeFeedback(form, node, summary) {
  node.textContent = summary.text;
  node.dataset.state = summary.state;
  const invalid = summary.state === 'invalid' || summary.state === 'nonexistent'
    || summary.state === 'out-of-range';
  for (const name of TIME_FIELDS) {
    const input = form.elements.namedItem(name);
    if (!input) continue;
    const rejected = name === 'utcStart' ? summary.state === 'ambiguous' : invalid;
    if (rejected) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }
  return summary;
}
