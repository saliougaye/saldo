'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { Fragment, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
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
  // The last query read from `useSearchParams`, and the ones `go` pushed that it has not shown yet.
  // Next applies a pushed URL in a transition, after the render of the click that pushed it: until
  // then the hook still reads the old query, which is not a navigation.
  const [seen, setSeen] = useState(search);
  const [pushed, setPushed] = useState<readonly string[]>([]);
  const [view, setView] = useState<View>(() => ({
    panel: panelFromSearch(new URLSearchParams(search)),
    closing: false,
    instant: false,
    opened: 0,
  }));

  if (search !== seen) {
    setSeen(search);
    const mine = pushed.indexOf(search);
    if (mine !== -1) {
      // A URL `go` pushed: the panel is already the one it says.
      setPushed(pushed.slice(mine + 1));
    } else {
      // A URL this component did not write (a navigation, Back): the panel follows it in this render.
      setPushed([]);
      const next = panelFromSearch(new URLSearchParams(search));
      if (!samePanel(next, view.panel)) {
        setView((current) => ({ ...current, panel: next, closing: false, instant: true }));
      }
    }
  }

  const go = useCallback(
    (href: string, options: { replace?: boolean; instant?: boolean } = {}) => {
      const next = panelOnlyChange(
        { pathname, search: new URLSearchParams(window.location.search) },
        href,
      );
      // The edit form is not on the page until the server renders it: that one stays a navigation.
      if (next === null || next.kind === 'edit') return false;
      const instant = options.instant === true;
      setView((current) => {
        if (next.kind === 'none') {
          return current.panel.kind === 'none' ? current : { ...current, closing: true, instant };
        }
        // «Nuova» again while its own exit plays takes the same draft back: the close is reversed.
        const opened =
          next.kind === 'new' && current.panel.kind !== 'new' ? current.opened + 1 : current.opened;
        return { panel: next, closing: false, instant, opened };
      });
      const target = searchOf(href);
      if (target !== new URLSearchParams(window.location.search).toString()) {
        setPushed((current) => [...current, target]);
      }
      window.history[options.replace === true ? 'replaceState' : 'pushState'](null, '', href);
      return true;
    },
    [pathname],
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

  // The top bar's button, the FAB and N: on this page they open the form here.
  useEffect(() => {
    const onNew = (event: Event) => {
      const href = panelHref(baseHref, { kind: 'new' });
      if (go(href, { instant: wantsInstant(event) })) event.preventDefault();
    };
    window.addEventListener(NEW_TRANSACTION_EVENT, onNew);
    return () => window.removeEventListener(NEW_TRANSACTION_EVENT, onNew);
  }, [go, baseHref]);

  const { panel } = view;
  const selectedId = panel.kind === 'detail' || panel.kind === 'edit' ? panel.id : null;
  const nav = useMemo<PanelNav>(() => ({ selectedId, go }), [selectedId, go]);
  const detail = selectedId === null ? undefined : details[selectedId];
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
