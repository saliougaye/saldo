/**
 * The page's View Transitions (2026-10-07 plan, decision 5). The browser draws the movement from
 * two snapshots, so the page lays itself out once, not on every frame. While it plays, the
 * transition's overlay takes the pointer: a click waits for the end.
 *
 * `<html>` carries the caller's class while the transition runs. The caller's CSS Module names the
 * parts and styles the pseudo-elements under that class: CSS Modules scope a
 * `view-transition-name` and the pseudo-elements' names together, and a module's selector needs
 * a class of its own.
 */

/** The transition that plays, its class, and its update while the browser has not called it yet. */
let running: { transition: ViewTransition; className: string } | null = null;
let pending: (() => void) | null = null;

/** Whether this browser draws View Transitions. */
export function viewTransitionsWork(): boolean {
  return 'startViewTransition' in document;
}

/**
 * Runs `update` inside a View Transition, with `className` on `<html>` until it ends. With no
 * class, or in a browser with no View Transitions, it runs `update` at once. The browser calls
 * `update` a frame later, after the old snapshot: `update` must change the DOM before it returns
 * (`flushSync` for React state).
 *
 * A later call finishes an earlier one first. An update that has not run yet runs at once, so the
 * states follow the order of the inputs. A transition that plays stops, so a change without
 * motion (a key) shows on the next frame and not after the animation.
 */
export function withViewTransition(update: () => void, className: string | null): void {
  const root = document.documentElement;
  const earlier = pending;
  pending = null;
  earlier?.();
  if (running !== null) {
    running.transition.skipTransition();
    root.classList.remove(running.className);
    running = null;
  }
  if (className === null || !viewTransitionsWork()) {
    update();
    return;
  }
  let done = false;
  const once = () => {
    if (done) return;
    done = true;
    if (pending === once) pending = null;
    update();
  };
  pending = once;
  root.classList.add(className);
  const transition = document.startViewTransition(once);
  const current = { transition, className };
  running = current;
  const end = () => {
    if (running !== current) return;
    running = null;
    root.classList.remove(className);
  };
  transition.finished.then(end, end);
}
