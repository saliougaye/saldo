'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import {
  Activity,
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
import { type CloseFrom, Panel } from '../../../src/ui/Panel';
import { type PanelNav, PanelNavContext } from '../../../src/ui/PanelNav';
import styles from './transactions.module.css';

/** `Panel`'s own exit: the panel leaves the screen once it has played. */
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
  /**
   * «Nuova transazione», rendered once by the server. It waits hidden in `<Activity>`, and a new
   * draft takes its place in the background each time it leaves the screen.
   */
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
  /**
   * The new form's key. It changes when the form leaves the screen, so the next opening is a new
   * draft, which React renders hidden in the background meanwhile.
   */
  draft: number;
}

/** The query of `href` as `useSearchParams().toString()` writes it. */
function searchOf(href: string): string {
  return new URL(href, 'http://panel.invalid').searchParams.toString();
}

/** The query of the address bar, written the same way. */
function locationQuery(): string {
  return new URLSearchParams(window.location.search).toString();
}

/** The new form's key once `to` takes the place of the current panel: a form that leaves is spent. */
function draftAfter(current: View, to: PanelState): number {
  return current.panel.kind === 'new' && to.kind !== 'new' ? current.draft + 1 : current.draft;
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
    draft: 0,
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
          : { panel: next, closing: false, instant: true, draft: draftAfter(current, next) },
      );
    },
    [track],
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
        return { panel: next, closing: false, instant, draft: draftAfter(current, next) };
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
      () =>
        setView((current) =>
          current.closing && current.panel === closed
            ? { ...current, panel: NONE, closing: false, draft: draftAfter(current, NONE) }
            : current,
        ),
      view.instant ? 0 : EXIT_MS,
    );
    return () => clearTimeout(timer);
  }, [view.closing, view.panel, view.instant]);

  // The panel has left: the focus, which was in it, goes back where it came from. Not when the
  // person has put it somewhere else meanwhile. A focus still in the side counts as lost: React
  // hides the new form in a deferred (Offscreen) render, so in this commit the old form, with its
  // focused input, is still in the DOM. The browser may also not have moved the focus out of a
  // `display: none` input yet.
  useEffect(() => {
    if (view.panel.kind !== 'none') return;
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
  // The row whose panel is on screen, and the selected row: none while the exit plays.
  const panelId = panel.kind === 'detail' || panel.kind === 'edit' ? panel.id : null;
  const selectedId = view.closing ? null : panelId;
  const nav = useMemo<PanelNav>(() => ({ selectedId, go }), [selectedId, go]);
  const detail = panelId === null ? undefined : details[panelId];
  const editing = panel.kind === 'edit' && edit?.id === panel.id ? edit : null;
  const motion = { closing: view.closing, instant: view.instant };

  // Stable across renders: `Panel` and `ListKeys` subscribe their keys through these. Esc closes
  // with no motion (decision 6); the ✕ and the scrim play the exit.
  const closeToList = useCallback(
    (from: CloseFrom) => go(baseHref, { instant: from === 'key' }),
    [go, baseHref],
  );
  const editCloseHref =
    editing === null ? baseHref : panelHref(baseHref, { kind: 'detail', id: editing.id });
  const closeToDetail = useCallback(
    (from: CloseFrom) => go(editCloseHref, { instant: from === 'key' }),
    [go, editCloseHref],
  );
  const onSelect = useCallback(
    (id: string) =>
      go(panelHref(baseHref, { kind: 'detail', id }), { replace: true, instant: true }),
    [go, baseHref],
  );

  // Decision 9: the new form waits hidden, so «Nuova» only shows it. `<Activity>` renders it in the
  // background, keeps it out of the layout with `display: none`, and runs its effects (Esc, the
  // focus) only while it shows. Shown again, the panel plays its entrance from the start.
  const creating = panel.kind === 'new';
  const newPanel =
    newForm === null ? null : (
      <Activity mode={creating ? 'visible' : 'hidden'}>
        <Panel
          sheet
          bare
          title={props.newTitle}
          closeHref={baseHref}
          closeLabel={props.closeLabel}
          onClose={closeToList}
          closing={creating && view.closing}
          instant={view.instant}
        >
          <Fragment key={view.draft}>{newForm}</Fragment>
        </Panel>
      </Activity>
    );

  let content: ReactNode = null;
  if (editing !== null) {
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

  const formOpen = creating || editing !== null;
  const open = (creating && newPanel !== null) || content !== null;
  return (
    <PanelNavContext value={nav}>
      <div
        className={styles.layout}
        data-panel={open && !view.closing ? '' : undefined}
        data-instant={view.instant ? '' : undefined}
      >
        <div className={styles.list}>{props.children}</div>
        <div className={styles.side} ref={side}>
          {newPanel}
          {content}
        </div>
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
