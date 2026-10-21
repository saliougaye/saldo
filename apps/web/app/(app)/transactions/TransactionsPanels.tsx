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

interface Props {
  /** The list: the period, the search, the filters and the days. */
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
   * «Modifica transazione», only on a page loaded with `?t=…`: the form needs the row's own
   * balances, so a row opens it with a navigation (W3).
   */
  edit: { id: string; form: ReactNode } | null;
}

/** `next` takes the place of `previous`: a new form that leaves is spent, and the next one is a new draft. */
function spendsDraft(previous: PanelState, next: PanelState): boolean {
  return previous.kind === 'new' && next.kind !== 'new';
}

/**
 * The dialog of Transazioni (W1, W3), in client state (`usePanelController`). The new form is on
 * the page from the start; the edit form comes with the page that `?t=…` loads.
 */
export function TransactionsPanels(props: Props) {
  const { baseHref, edit, newForm } = props;
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
  // The row whose form is on screen: none while the exit plays.
  const panelId = panel.kind === 'edit' ? panel.id : null;
  const selectedId = view.closing ? null : panelId;
  const nav = useMemo<PanelNav>(() => ({ selectedId, go }), [selectedId, go]);
  const editing = panelId !== null && edit?.id === panelId ? edit : null;

  // Stable across renders: `Panel` subscribes Esc through it. Esc closes with no motion; the ✕
  // and the scrim play the exit.
  const closeToList = useCallback(
    (from: CloseFrom) => go(baseHref, { instant: from === 'key' }),
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
          form
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

  // W3: the row opens the form at once. The form comes with a navigation, which the controller
  // follows with no motion; the dialog still plays its entrance, and only Esc closes it with none.
  const editPanel =
    editing === null ? null : (
      <Panel
        key="form"
        form
        bare
        title={props.editTitle}
        closeHref={baseHref}
        closeLabel={props.closeLabel}
        onClose={closeToList}
        closing={view.closing}
        instant={view.closing && view.instant}
      >
        {editing.form}
      </Panel>
    );

  const formOpen = creating || editing !== null;
  return (
    <PanelNavContext value={nav}>
      <div className={styles.layout}>
        <div className={styles.list}>{props.children}</div>
        <div className={styles.side} ref={side}>
          {newPanel}
          {editPanel}
        </div>
      </div>
      {/* ↑ ↓ belong to the list; while a form is open the keys are the form's. */}
      {formOpen ? null : <ListKeys />}
    </PanelNavContext>
  );
}
