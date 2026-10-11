'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/** `Panel`'s own exit: the panel leaves the screen once it has played. */
const EXIT_MS = 150;

export interface PanelConfig<S> {
  /** What a query opens. */
  parse: (search: URLSearchParams) => S;
  same: (a: S, b: S) => boolean;
  isNone: (state: S) => boolean;
  none: S;
  /**
   * The state `href` opens when only the panel changes, or null for a navigation (and for a form
   * the page cannot show in place).
   */
  onlyChange: (current: { pathname: string; search: URLSearchParams }, href: string) => S | null;
  /**
   * `next` takes the place of the panel `previous` on screen: an open, a switch, or the end of an
   * exit. Called in the same event as the change, so a state the page sets here renders with it.
   */
  onChange?: (previous: S, next: S) => void;
  exitMs?: number;
}

export interface PanelView<S> {
  panel: S;
  /** The exit is playing: the panel is still in the DOM, and the list already takes its room back. */
  closing: boolean;
  /** Opened or closed from the keyboard: no motion. */
  instant: boolean;
}

export type PanelGo = (href: string, options?: { replace?: boolean; instant?: boolean }) => boolean;

export interface PanelController<S> {
  view: PanelView<S>;
  /** The committed view, for handlers that must not be new functions on every render. */
  viewRef: RefObject<PanelView<S>>;
  /** Opens what `href` opens, in place, when only the panel changes. False: the caller navigates. */
  go: PanelGo;
  /** What the person sees: a panel that plays its exit is already closed. */
  shown: S;
  /** The panel's column: a focus left in it is in a panel that is gone or hidden. */
  side: RefObject<HTMLDivElement | null>;
}

/** The query of `href` as `useSearchParams().toString()` writes it. */
function searchOf(href: string): string {
  return new URL(href, 'http://panel.invalid').searchParams.toString();
}

/** The query of the address bar, written the same way. */
function locationQuery(): string {
  return new URLSearchParams(window.location.search).toString();
}

/**
 * A trailing panel (§17.1.7) in client state. The URL still says what is open, so a reload, a link
 * from another page and Back work, and without JavaScript every link is a page. A click that only
 * changes the panel changes it in the frame of the click, and the URL follows through
 * `history.pushState`, which Next syncs into `useSearchParams`. Anything else — a filter, the
 * period, a save, Back — is a navigation, and the panel follows the URL it brings.
 */
export function usePanelController<S>(config: PanelConfig<S>): PanelController<S> {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  // The page gives a new config on every render; the handlers below read the last committed one.
  const configRef = useRef(config);
  useLayoutEffect(() => {
    configRef.current = config;
  });
  // The first state is the server's: the same query, read the same way, so hydration matches.
  const [view, setView] = useState<PanelView<S>>(() => ({
    panel: config.parse(new URLSearchParams(search)),
    closing: false,
    instant: false,
  }));
  // The handlers below read the committed view; they are not new functions on every render.
  const viewRef = useRef(view);
  useLayoutEffect(() => {
    viewRef.current = view;
  });
  // The last query read from `useSearchParams`, and the queries `go` wrote that it has not shown yet.
  // Next applies a URL that `go` pushed in a transition, after the click: when two pushes are
  // quicker than that, the first one shows up after the second one has already moved the panel.
  const seen = useRef(search);
  const written = useRef<string[]>([]);
  // Where the focus was when the panel opened, and where it goes back to when the panel has left.
  const opener = useRef<Element | null>(null);
  const returnTo = useRef<Element | null>(null);
  // The panel's column: a focus left in it is in a panel that is gone or hidden.
  const side = useRef<HTMLDivElement>(null);

  /** What the person sees: a panel that plays its exit is already closed. */
  const shownOf = useCallback(
    (current: PanelView<S>): S => (current.closing ? configRef.current.none : current.panel),
    [],
  );

  /** Before the panel opens or closes: keep the focus's way back. */
  const track = useCallback(
    (next: S) => {
      const { isNone } = configRef.current;
      const shown = shownOf(viewRef.current);
      if (isNone(shown) && !isNone(next)) {
        const active = document.activeElement;
        opener.current = active === document.body ? null : active;
        returnTo.current = null;
      } else if (!isNone(shown) && isNone(next)) {
        returnTo.current =
          opener.current?.isConnected === true
            ? opener.current
            : document.querySelector('#content a[aria-current="true"]');
        opener.current = null;
      }
    },
    [shownOf],
  );

  /** A URL this component did not write (a navigation, Back): the panel follows it, with no motion. */
  const follow = useCallback(
    (query: string) => {
      const { parse, same, onChange } = configRef.current;
      const next = parse(new URLSearchParams(query));
      if (same(next, shownOf(viewRef.current))) return;
      track(next);
      onChange?.(viewRef.current.panel, next);
      setView((current) =>
        same(next, shownOf(current)) ? current : { panel: next, closing: false, instant: true },
      );
    },
    [track, shownOf],
  );

  // A new query in `useSearchParams`. One that `go` wrote and has since replaced is old: the panel
  // is already past it. The last one `go` wrote is the panel on screen. Any other is a navigation.
  useLayoutEffect(() => {
    if (search === seen.current) return;
    seen.current = search;
    const mine = written.current.lastIndexOf(search);
    if (mine === -1) {
      written.current = [];
      follow(search);
    } else if (mine === written.current.length - 1) {
      written.current = [];
    } else {
      written.current = written.current.slice(mine + 1);
    }
  }, [search, follow]);

  // Back before Next has synced a pushed URL: `useSearchParams` may never change, the address bar does.
  useEffect(() => {
    const onPopState = () => {
      if (window.location.pathname !== pathname) return;
      const query = locationQuery();
      seen.current = query;
      written.current = [];
      follow(query);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [follow, pathname]);

  const go = useCallback<PanelGo>(
    (href, options = {}) => {
      const { onlyChange, isNone, onChange } = configRef.current;
      const here = locationQuery();
      const next = onlyChange({ pathname, search: new URLSearchParams(here) }, href);
      if (next === null) return false;
      const instant = options.instant === true;
      track(next);
      if (!isNone(next)) onChange?.(viewRef.current.panel, next);
      setView((current) => {
        if (isNone(next)) {
          return isNone(current.panel) ? current : { ...current, closing: true, instant };
        }
        // The same panel again while its own exit plays takes it back: the close is reversed.
        return { panel: next, closing: false, instant };
      });
      // The selected row clicked again: the same URL is not a second history entry.
      const target = searchOf(href);
      if (target !== here) {
        // Back where `useSearchParams` already is: Next may never report the round trip.
        written.current = target === seen.current ? [] : [...written.current, target];
        window.history[options.replace === true ? 'replaceState' : 'pushState'](null, '', href);
      }
      return true;
    },
    [pathname, track],
  );

  // The exit has played: the panel leaves the screen, unless something opened again meanwhile.
  useEffect(() => {
    if (!view.closing) return;
    const closed = view.panel;
    const timer = setTimeout(
      () => {
        const { none, onChange } = configRef.current;
        const current = viewRef.current;
        if (current.closing && current.panel === closed) onChange?.(closed, none);
        setView((latest) =>
          latest.closing && latest.panel === closed
            ? { ...latest, panel: none, closing: false }
            : latest,
        );
      },
      view.instant ? 0 : (configRef.current.exitMs ?? EXIT_MS),
    );
    return () => clearTimeout(timer);
  }, [view.closing, view.panel, view.instant]);

  // The panel has left: the focus, which was in it, goes back where it came from. Not when the
  // person has put it somewhere else meanwhile. A focus still in the side counts as lost: React
  // hides a panel kept in `<Activity>` in a deferred (Offscreen) render, so in this commit the old
  // form, with its focused input, is still in the DOM. The browser may also not have moved the
  // focus out of a `display: none` input yet.
  useEffect(() => {
    if (!configRef.current.isNone(view.panel)) return;
    const target = returnTo.current;
    returnTo.current = null;
    const active = document.activeElement;
    // Never leave the focus on a hidden input, even with nowhere to send it back.
    if (active instanceof HTMLElement && side.current?.contains(active) === true) active.blur();
    if (!(target instanceof HTMLElement) || !target.isConnected) return;
    if (active !== null && active !== document.body && side.current?.contains(active) !== true)
      return;
    target.focus();
  }, [view.panel]);

  return { view, viewRef, go, shown: shownOf(view), side };
}
