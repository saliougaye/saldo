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

/** Where a letter or an arrow already means something: a dialog, a menu, a list of options, a form. */
const OWNS_KEYS = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], form';

/**
 * Whether a single-key shortcut (N, E, ↑ ↓) must leave this key alone: a modifier (⌘N is the
 * browser's), a key someone already handled, a field, anything that owns its own keys — or a
 * dialog open anywhere on the page, which a portal puts outside the target's ancestors.
 */
export function ignoresShortcut(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return true;
  if (event.repeat && event.key.length === 1) return true;
  if (isEditable(event.target)) return true;
  if (event.target instanceof Element && event.target.closest(OWNS_KEYS) !== null) return true;
  return document.querySelector('[role="dialog"], [role="alertdialog"]') !== null;
}
