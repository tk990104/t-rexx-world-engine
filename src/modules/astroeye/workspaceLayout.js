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
