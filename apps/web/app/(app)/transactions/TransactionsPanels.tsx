'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import {
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type PanelState,
  panelFromSearch,
  panelHref,
  panelOnlyChange,
  samePanel,
} from '../../../src/features/transactions/panelState';
import { ListKeys } from '../../../src/ui/ListKeys';
import { NEW_TRANSACTION_EVENT, wantsInstant } from '../../../src/ui/NewTransactionLink';
import { Panel } from '../../../src/ui/Panel';
import { type PanelNav, PanelNavContext } from '../../../src/ui/PanelNav';
import styles from './transactions.module.css';

/** `Panel`'s own exit: the panel leaves the DOM once it has played. */
const EXIT_MS = 150;

const NONE: PanelState = { kind: 'none' };

export interface DetailPanel {
  title: string;
  body: ReactNode;
}

interface Props {
  /** The list: the period, the search, the chips and the days. */
  children: ReactNode;
  /** The list's URL with no panel: its filters and its period. */
  baseHref: string;
  newTitle: string;
  editTitle: string;
  closeLabel: string;
  /** «Nuova transazione», rendered once by the server; every opening mounts a fresh copy. */
  newForm: ReactNode;
  /**
   * «Modifica transazione», only on a page loaded with `?t=…&edit`: the form needs the row's own
   * balances, so opening it is still a navigation, and the detail stays up while it loads.
   */
  edit: { id: string; form: ReactNode } | null;
  /** The detail of every row of the list, so a click opens one without asking the server. */
  details: Record<string, DetailPanel>;
  upcomingIds: string[];
  ids: string[];
  upcomingDisclosureId: string;
}

interface View {
  panel: PanelState;
  /** The exit is playing: the panel is still in the DOM, and the list already takes its room back. */
  closing: boolean;
  /** Opened or closed from the keyboard: no motion. */
  instant: boolean;
  /** How many times «Nuova» opened: the form's key, so each opening is a new draft. */
  opened: number;
}

/** The query of `href` as `useSearchParams().toString()` writes it. */
function searchOf(href: string): string {
  return new URL(href, 'http://panel.invalid').searchParams.toString();
}

/** The query of the address bar, written the same way. */
function locationQuery(): string {
  return new URLSearchParams(window.location.search).toString();
}

/** What the person sees: a panel that plays its exit is already closed. */
function shownOf(view: View): PanelState {
  return view.closing ? NONE : view.panel;
}

/**
 * The trailing panel of Transazioni (§17.1.7), in client state. The URL still says what is open, so
 * a reload, a link from Home and Back work, and without JavaScript every link is a page. A click
 * that only changes the panel changes it in the frame of the click, and the URL follows through
 * `history.pushState`, which Next syncs into `useSearchParams`. Anything else — a filter, the
 * period, a save, Back — is a navigation, and the panel follows the URL it brings.
 */
export function TransactionsPanels(props: Props) {
  const { baseHref, details, edit, newForm } = props;
  const pathname = usePathname();
  const search = useSearchParams().toString();
  // The first state is the server's: the same query, read the same way, so hydration matches.
  const [view, setView] = useState<View>(() => ({
    panel: panelFromSearch(new URLSearchParams(search)),
    closing: false,
    instant: false,
    opened: 0,
  }));
  // The handlers below read the committed view; they are not new functions on every render.
  const viewRef = useRef(view);
  useLayoutEffect(() => {
    viewRef.current = view;
  });
  // The last query read from `useSearchParams`.
  const seen = useRef(search);
  // Where the focus was when the panel opened, and where it goes back to when the panel has left.
  const opener = useRef<Element | null>(null);
  const returnTo = useRef<Element | null>(null);

  /** Before the panel opens or closes: keep the focus's way back. */
  const track = useCallback((next: PanelState) => {
    const shown = shownOf(viewRef.current);
    if (shown.kind === 'none' && next.kind !== 'none') {
      const active = document.activeElement;
      opener.current = active === document.body ? null : active;
      returnTo.current = null;
    } else if (shown.kind !== 'none' && next.kind === 'none') {
      returnTo.current =
        opener.current?.isConnected === true
          ? opener.current
          : document.querySelector('#content a[aria-current="true"]');
      opener.current = null;
    }
  }, []);

  /** A URL this component did not write (a navigation, Back): the panel follows it, with no motion. */
  const follow = useCallback(
    (query: string) => {
      const next = panelFromSearch(new URLSearchParams(query));
      if (samePanel(next, shownOf(viewRef.current))) return;
      track(next);
      setView((current) =>
        samePanel(next, shownOf(current))
          ? current
          : { ...current, panel: next, closing: false, instant: true },
      );
    },
    [track],
  );

  // A new query in `useSearchParams`. Next writes a navigation's URL to the address bar before this
  // effect runs, and applies a URL that `go` pushed in a transition after the click. So a query
  // that is not the address bar's is one that `go` has already replaced: it is old, not a change.
  useLayoutEffect(() => {
    if (search === seen.current) return;
    seen.current = search;
    if (search !== locationQuery()) return;
    follow(search);
  }, [search, follow]);

  // Back before Next has synced a pushed URL: `useSearchParams` may never change, the address bar does.
  useEffect(() => {
    const onPopState = () => {
      if (window.location.pathname !== pathname) return;
      const query = locationQuery();
      seen.current = query;
      follow(query);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [follow, pathname]);

  const go = useCallback(
    (href: string, options: { replace?: boolean; instant?: boolean } = {}) => {
      const here = locationQuery();
      const next = panelOnlyChange({ pathname, search: new URLSearchParams(here) }, href);
      // The edit form is not on the page until the server renders it: that one stays a navigation.
      if (next === null || next.kind === 'edit') return false;
      const instant = options.instant === true;
      track(next);
      setView((current) => {
        if (next.kind === 'none') {
          return current.panel.kind === 'none' ? current : { ...current, closing: true, instant };
        }
        // «Nuova» again while its own exit plays takes the same draft back: the close is reversed.
        const opened =
          next.kind === 'new' && current.panel.kind !== 'new' ? current.opened + 1 : current.opened;
        return { panel: next, closing: false, instant, opened };
      });
      // The selected row clicked again: the same URL is not a second history entry.
      if (searchOf(href) !== here) {
        window.history[options.replace === true ? 'replaceState' : 'pushState'](null, '', href);
      }
      return true;
    },
    [pathname, track],
  );

  // The exit has played: the panel leaves the DOM, unless something opened again meanwhile.
  useEffect(() => {
    if (!view.closing) return;
    const closed = view.panel;
    const timer = setTimeout(
      () =>
        setView((current) =>
          current.closing && current.panel === closed
            ? { ...current, panel: NONE, closing: false }
            : current,
        ),
      view.instant ? 0 : EXIT_MS,
    );
    return () => clearTimeout(timer);
  }, [view.closing, view.panel, view.instant]);

  // The panel has left: the focus, which was in it, goes back where it came from. Not when the
  // person has put it somewhere else meanwhile.
  useEffect(() => {
    if (view.panel.kind !== 'none') return;
    const target = returnTo.current;
    returnTo.current = null;
    const active = document.activeElement;
    if (!(target instanceof HTMLElement) || !target.isConnected) return;
    if (active !== null && active !== document.body) return;
    target.focus();
  }, [view.panel]);

  // The top bar's button, the FAB and N: on this page they open the form here.
  useEffect(() => {
    const onNew = (event: Event) => {
      const current = viewRef.current;
      // Already open: N must not replace it, nor its prefill, with a navigation.
      if (current.panel.kind === 'new' && !current.closing) {
        event.preventDefault();
        return;
      }
      const href = panelHref(baseHref, { kind: 'new' });
      if (go(href, { instant: wantsInstant(event) })) event.preventDefault();
    };
    window.addEventListener(NEW_TRANSACTION_EVENT, onNew);
    return () => window.removeEventListener(NEW_TRANSACTION_EVENT, onNew);
  }, [go, baseHref]);

  const { panel } = view;
  // The row whose panel is in the DOM, and the selected row: none while the exit plays.
  const panelId = panel.kind === 'detail' || panel.kind === 'edit' ? panel.id : null;
  const selectedId = view.closing ? null : panelId;
  const nav = useMemo<PanelNav>(() => ({ selectedId, go }), [selectedId, go]);
  const detail = panelId === null ? undefined : details[panelId];
  const editing = panel.kind === 'edit' && edit?.id === panel.id ? edit : null;
  const motion = { closing: view.closing, instant: view.instant };

  // Stable across renders: `Panel` and `ListKeys` subscribe their keys through these.
  const closeToList = useCallback(() => go(baseHref), [go, baseHref]);
  const editCloseHref =
    editing === null ? baseHref : panelHref(baseHref, { kind: 'detail', id: editing.id });
  const closeToDetail = useCallback(() => go(editCloseHref), [go, editCloseHref]);
  const onSelect = useCallback(
    (id: string) =>
      go(panelHref(baseHref, { kind: 'detail', id }), { replace: true, instant: true }),
    [go, baseHref],
  );

  let content: ReactNode = null;
  if (panel.kind === 'new' && newForm !== null) {
    content = (
      <Panel
        key="form"
        sheet
        bare
        title={props.newTitle}
        closeHref={baseHref}
        closeLabel={props.closeLabel}
        onClose={closeToList}
        {...motion}
      >
        <Fragment key={view.opened}>{newForm}</Fragment>
      </Panel>
    );
  } else if (editing !== null) {
    content = (
      <Panel
        key="form"
        sheet
        bare
        title={props.editTitle}
        closeHref={editCloseHref}
        closeLabel={props.closeLabel}
        onClose={closeToDetail}
        {...motion}
      >
        {editing.form}
      </Panel>
    );
  } else if (detail !== undefined) {
    content = (
      <Panel
        key="detail"
        title={detail.title}
        closeHref={baseHref}
        closeLabel={props.closeLabel}
        onClose={closeToList}
        {...motion}
      >
        {detail.body}
      </Panel>
    );
  }

  const formOpen = panel.kind === 'new' || editing !== null;
  return (
    <PanelNavContext value={nav}>
      <div
        className={styles.layout}
        data-panel={content !== null && !view.closing ? '' : undefined}
        data-instant={view.instant ? '' : undefined}
      >
        <div className={styles.list}>{props.children}</div>
        <div className={styles.side}>{content}</div>
      </div>
      {/* ↑ ↓ and E belong to the list; while a form is open the keys are the form's. */}
      {formOpen ? null : (
        <ListKeys
          upcomingIds={props.upcomingIds}
          ids={props.ids}
          upcomingDisclosureId={props.upcomingDisclosureId}
          selectedId={selectedId}
          href={panelHref(baseHref, { kind: 'detail', id: '__ID__' })}
          editHref={panelHref(baseHref, { kind: 'edit', id: '__ID__' })}
          onSelect={onSelect}
        />
      )}
    </PanelNavContext>
  );
}
