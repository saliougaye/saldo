'use client';

import { Activity, Fragment, type ReactNode, useCallback, useEffect, useMemo } from 'react';
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
import { usePanelController } from '../../../src/ui/usePanelController';
import styles from './transactions.module.css';

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

/** `next` takes the place of `previous`: a new form that leaves is spent, and the next one is a new draft. */
function spendsDraft(previous: PanelState, next: PanelState): boolean {
  return previous.kind === 'new' && next.kind !== 'new';
}

/**
 * The trailing panel of Transazioni (§17.1.7), in client state (`usePanelController`). The server
 * renders the detail of every row and the new form, so a click only chooses the one to show.
 */
export function TransactionsPanels(props: Props) {
  const { baseHref, details, edit, newForm } = props;
  const { view, viewRef, go, side } = usePanelController<PanelState>({
    parse: panelFromSearch,
    same: samePanel,
    isNone: (state) => state.kind === 'none',
    none: NONE,
    onlyChange: (current, href) => {
      const next = panelOnlyChange(current, href);
      // The edit form is not on the page until the server renders it: that one stays a navigation.
      return next === null || next.kind === 'edit' ? null : { state: next };
    },
    spends: spendsDraft,
  });

  // The top bar's button, the FAB and N: on this page they open the form here.
  useEffect(() => {
    const onNew = (event: Event) => {
      // No form to show here (the URL holds a deletion notice or a prefill): the link navigates.
      if (newForm === null) return;
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
  }, [go, viewRef, baseHref, newForm]);

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
          {/* The new form's key changes when the form leaves the screen, so the next opening is a
              new draft, which React renders hidden in the background meanwhile. */}
          <Fragment key={view.epoch}>{newForm}</Fragment>
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
