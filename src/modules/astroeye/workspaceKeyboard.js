/** Claim an unhandled Escape, but leave composition and child-control handling alone. */
export function consumeWorkspaceEscape(event) {
  if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing || event.keyCode === 229) return false;
  event.preventDefault();
  event.stopPropagation();
  return true;
}
