/** Match shortcut scrolling to whichever toolbar is actually sticky at this width. */
export function stickyWorkspaceInset(root) {
  const view = root.ownerDocument?.defaultView;
  if (!view?.getComputedStyle) return 0;
  let inset = 0;
  for (const selector of ['.astroeye-header', '.astroeye-quick-nav']) {
    const element = root.querySelector(selector);
    if (!element) continue;
    const style = view.getComputedStyle(element);
    if (style.display === 'none' || style.position !== 'sticky') continue;
    const top = Number.parseFloat(style.top);
    inset = Math.max(inset, (Number.isFinite(top) ? top : 0) + element.getBoundingClientRect().height);
  }
  return inset;
}

export function focusScrollAdjustment({ top, bottom }, visibleTop, visibleBottom) {
  if (![top, bottom, visibleTop, visibleBottom].every(Number.isFinite)
      || bottom < top || visibleBottom <= visibleTop) return 0;
  if (top < visibleTop) return top - visibleTop;
  // Large sections should not jump past their beginning to reveal their end.
  if (bottom - top > visibleBottom - visibleTop) return top > visibleBottom ? top - visibleTop : 0;
  return bottom > visibleBottom ? bottom - visibleBottom : 0;
}

function revealWorkspaceFocus(root, target) {
  const view = root.ownerDocument?.defaultView;
  if (!view?.getComputedStyle) return;
  // A sticky control (e.g. Close) is already in the reserved toolbar area.
  for (const selector of ['.astroeye-header', '.astroeye-quick-nav', '.astroeye-live-status']) {
    const bar = root.querySelector(selector);
    if (bar?.contains(target) && view.getComputedStyle(bar).position === 'sticky') return;
  }
  const bounds = root.getBoundingClientRect();
  const status = root.querySelector('.astroeye-live-status');
  const statusStyle = status && view.getComputedStyle(status);
  const footer = statusStyle?.position === 'sticky' && statusStyle.display !== 'none'
    ? status.getBoundingClientRect().height : 0;
  const delta = focusScrollAdjustment(target.getBoundingClientRect(),
    bounds.top + root.clientTop + stickyWorkspaceInset(root) + 8,
    bounds.top + root.clientTop + root.clientHeight - footer - 8);
  if (delta) root.scrollTop += delta;
}

/** One event-driven microtask, no frame loop; stale/closed focus cannot scroll. */
export function installWorkspaceFocusVisibility(root, { queue = queueMicrotask, reveal = revealWorkspaceFocus } = {}) {
  let disposed = false, revision = 0;
  const onFocus = ({ target }) => {
    const current = ++revision;
    queue(() => {
      if (disposed || current !== revision || root.hidden || root.isConnected === false
          || !root.contains(target) || root.ownerDocument.activeElement !== target) return;
      reveal(root, target);
    });
  };
  root.addEventListener('focusin', onFocus);
  return () => { disposed = true; revision++; root.removeEventListener('focusin', onFocus); };
}
