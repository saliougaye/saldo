import { refresh } from 'next/cache';

/**
 * A Server Action's write that changed what the page shows. On success, `refresh()` makes the
 * action's response carry the page rendered again, and the client drops its back/forward cache, as
 * `router.refresh()` did. Unlike `router.refresh()`, it leaves the prefetch cache alone: the client
 * does not prefetch every visible link again after each save.
 *
 * Needed even when the form then navigates. A panel opened in place changes the URL with
 * `history.pushState`, and the router still holds the page that it rendered for the URL without
 * the panel. `router.replace` to that URL then reuses the old page and sends no request.
 *
 * A form that navigates after the action awaits `actionApplied()` first. Otherwise the navigation
 * discards this response, and Next runs `router.refresh()` itself.
 */
export function refreshAfterWrite<T extends { ok: boolean }>(result: T): T {
  if (result.ok) refresh();
  return result;
}
