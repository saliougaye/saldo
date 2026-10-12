/** A key typed into a field belongs to the field: Esc there clears or cancels, N there is a letter. */
export function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

/**
 * Where a letter or an arrow already means something: a dialog, a menu, a list of options, a form.
 * A `Panel` is a dialog too (D3, D13) but not one of these: ↑ ↓ and E keep walking the list behind
 * its detail. Its forms own the keys themselves (`form`, `data-owns-keys`).
 */
const OWNS_KEYS =
  '[role="dialog"]:not([data-panel]), [role="alertdialog"], [role="menu"], [role="listbox"], form';

/**
 * Open anywhere on the page, these own every single-key shortcut, wherever the focus is: a dialog
 * (a portal puts it outside the target's ancestors), and a form marked `data-owns-keys` — the
 * transaction form, whose draft N or an arrow would throw away with the focus left on the body.
 */
const OWNS_PAGE = '[role="dialog"]:not([data-panel]), [role="alertdialog"], form[data-owns-keys]';

/**
 * Whether a single-key shortcut (N, E, ↑ ↓) must leave this key alone: a modifier (⌘N is the
 * browser's), a key someone already handled, a field, anything that owns its own keys — or
 * something open on the page that owns them all (`OWNS_PAGE`). Open means on screen: Transazioni
 * keeps its new form in the DOM, hidden, until «Nuova» shows it.
 */
export function ignoresShortcut(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return true;
  if (event.repeat && event.key.length === 1) return true;
  if (isEditable(event.target)) return true;
  if (event.target instanceof Element && event.target.closest(OWNS_KEYS) !== null) return true;
  for (const owner of document.querySelectorAll(OWNS_PAGE)) {
    if (owner.getClientRects().length > 0) return true;
  }
  return false;
}
