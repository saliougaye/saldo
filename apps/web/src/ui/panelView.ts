/**
 * The three ways the view of an in-place panel changes (`usePanelController`), as pure functions.
 * The hook calls them in `setView` updaters, so each decision reads the latest state, not the
 * committed one.
 */

export interface PanelView<S> {
  panel: S;
  /** The exit is playing: the panel is still in the DOM, and the list already takes its room back. */
  closing: boolean;
  /** Opened or closed from the keyboard: no motion. */
  instant: boolean;
  /** How many times a panel was spent (`PanelRules.spends`): a key for what must start afresh. */
  epoch: number;
}

export interface PanelRules<S> {
  same: (a: S, b: S) => boolean;
  isNone: (state: S) => boolean;
  none: S;
  /**
   * `next` takes the place of `previous`, and what `previous` held is spent: `epoch` counts up.
   * Transazioni's new form is spent when it leaves the screen, so the next opening is a new draft.
   */
  spends?: (previous: S, next: S) => boolean;
}

/** What the person sees: a panel that plays its exit is already closed. */
export function shownOf<S>(view: PanelView<S>, rules: PanelRules<S>): S {
  return view.closing ? rules.none : view.panel;
}

function epochAfter<S>(view: PanelView<S>, next: S, rules: PanelRules<S>): number {
  return rules.spends?.(view.panel, next) === true ? view.epoch + 1 : view.epoch;
}

/** A URL the controller did not write (a navigation, Back) opens `next`, with no motion. */
export function followed<S>(view: PanelView<S>, next: S, rules: PanelRules<S>): PanelView<S> {
  if (rules.same(next, shownOf(view, rules))) return view;
  return { panel: next, closing: false, instant: true, epoch: epochAfter(view, next, rules) };
}

/** A click opens `next` in place, or closes the panel (`next` is none): the exit starts to play. */
export function went<S>(
  view: PanelView<S>,
  next: S,
  instant: boolean,
  rules: PanelRules<S>,
): PanelView<S> {
  if (rules.isNone(next)) {
    return rules.isNone(view.panel) ? view : { ...view, closing: true, instant };
  }
  // The same panel again while its own exit plays takes it back: the close is reversed.
  return { panel: next, closing: false, instant, epoch: epochAfter(view, next, rules) };
}

/** The exit of `closed` has played: the panel leaves, unless something opened again meanwhile. */
export function exited<S>(view: PanelView<S>, closed: S, rules: PanelRules<S>): PanelView<S> {
  if (!view.closing || view.panel !== closed) return view;
  return { ...view, panel: rules.none, closing: false, epoch: epochAfter(view, rules.none, rules) };
}
