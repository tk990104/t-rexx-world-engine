/** Preserve an async panel action's keyboard position without stealing later input. */
export function capturePanelOperationFocus(host) {
  const document = host.ownerDocument;
  const view = document.defaultView;
  const origin = document.activeElement;
  if (!origin || !host.contains(origin) || document.hidden || document.hasFocus?.() === false) return () => {};
  let released = false, finished = false;
  const release = () => { released = true; };
  const focusChanged = (event) => {
    if (event.target !== origin && event.target !== document.body) release();
  };
  const visibilityChanged = () => { if (document.hidden) release(); };
  document.addEventListener('focusin', focusChanged, true);
  document.addEventListener('keydown', release, true);
  document.addEventListener('pointerdown', release, true);
  document.addEventListener('visibilitychange', visibilityChanged);
  view.addEventListener('blur', release);
  return ({ preferred = [], fallback = [], cancel = false } = {}) => {
    if (finished) return;
    finished = true;
    document.removeEventListener('focusin', focusChanged, true);
    document.removeEventListener('keydown', release, true);
    document.removeEventListener('pointerdown', release, true);
    document.removeEventListener('visibilitychange', visibilityChanged);
    view.removeEventListener('blur', release);
    if (cancel || released || document.hidden || document.hasFocus?.() === false || !host.isConnected
      || (document.activeElement !== origin && document.activeElement !== document.body)) return;
    for (const target of [...preferred, origin, ...fallback]) {
      if (!target?.isConnected || !host.contains(target) || target.disabled
        || target.closest('[hidden], [inert]')) continue;
      const style = document.defaultView.getComputedStyle(target);
      if (style.visibility !== 'visible' || !target.getClientRects().length) continue;
      target.focus();
      if (document.activeElement === target) return;
    }
  };
}
