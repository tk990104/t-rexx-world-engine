/** Request the browser's standard leave warning only while a notebook draft is dirty. */
export function createUnsavedNotebookGuard(target) {
  let active = false, destroyed = false;
  function beforeUnload(event) {
    if (!active) return;
    event.preventDefault();
    event.returnValue = '';
  }
  function setDirty(value) {
    if (destroyed) return;
    const next = value === true;
    if (active === next) return;
    active = next;
    if (active) target.addEventListener('beforeunload', beforeUnload);
    else target.removeEventListener('beforeunload', beforeUnload);
  }
  return Object.freeze({
    setDirty,
    destroy() { setDirty(false); destroyed = true; },
  });
}
