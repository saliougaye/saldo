'use client';

import { Fragment, type ReactNode, useCallback, useMemo } from 'react';
import { type CloseFrom, Panel } from './Panel';
import { type PanelNav, PanelNavContext } from './PanelNav';
import styles from './PanelSwitch.module.css';
import { type PanelParams, panelHrefFor, panelKeyFromSearch, panelOnlyChange } from './panelUrl';
import { usePanelController } from './usePanelController';

export interface PanelSpec {
  title: string;
  body: ReactNode;
  /** Below the breakpoint, a bottom sheet (a form) and not the whole screen. */
  sheet?: boolean;
  /** The body carries its own heading. */
  bare?: boolean;
  /** Where ✕ and Esc go from this panel, as a key. Default: no panel. */
  closeTo?: string | null;
}

interface Props {
  /** The page's URL with no panel: its own path and filters. */
  baseHref: string;
  params: PanelParams;
  /** Every panel the page can show, by key. A key with no entry opens nothing, and its link navigates. */
  panels: Record<string, PanelSpec>;
  closeLabel: string;
  /** The page's list: the rows' links are `PanelLink`s, which read the controller. */
  children?: ReactNode;
  /**
   * `slot`: the page is a section of a `SubnavLayout`, and the panel takes the layout's trailing
   * column. `PanelSwitch` must then be the page's root, the direct child of the section. Otherwise
   * the panel renders in place, after `children`.
   */
  slot?: boolean;
}

/**
 * One panel at a time, chosen by the query, changed in the frame of the click
 * (`usePanelController`). The server renders the body of every panel; a click only chooses the one
 * to show. A key that is in the URL on the first render opens with the page. Rows must be
 * `PanelLink`s with a `selectId` equal to their whole key (`tag:ID`), so `a:ID` and `g:ID` differ.
 */
export function PanelSwitch({
  baseHref,
  params,
  panels,
  closeLabel,
  children,
  slot = false,
}: Props) {
  const known = (key: string | null): string | null =>
    key !== null && panels[key] !== undefined ? key : null;
  const { view, go, shown, side } = usePanelController<string | null>({
    parse: (query) => known(panelKeyFromSearch(query, params)),
    same: (a, b) => a === b,
    isNone: (key) => key === null,
    none: null,
    onlyChange: (current, href) => {
      const next = panelOnlyChange(current, href, params);
      // A close is `{ state: null }`; null is a navigation.
      return next === null || (next.key !== null && known(next.key) === null)
        ? null
        : { state: next.key };
    },
  });

  // A refresh can drop the open key from `panels` (a deleted row) while the URL keeps it: then
  // nothing shows, and no row is selected.
  const key = known(view.panel);
  const spec = key === null ? undefined : panels[key];
  const selectedId = known(shown);
  const nav = useMemo<PanelNav>(() => ({ selectedId, go }), [selectedId, go]);
  const closeHref = panelHrefFor(baseHref, spec?.closeTo ?? null, params);
  // Stable across renders: `Panel` subscribes Esc through it. Esc closes with no motion; the ✕
  // and the scrim play the exit.
  const onClose = useCallback(
    (from: CloseFrom) => go(closeHref, { instant: from === 'key' }),
    [go, closeHref],
  );

  // The panel stays put while the selection moves between rows (2026-10-07 spec): its key is its
  // shape only, as on Transazioni, where a form and a detail are different panels. The body's key is
  // the panel key: a switch from one key to another is a new form, with no state from the last one.
  const panel =
    key === null || spec === undefined ? null : (
      <Panel
        key={spec.sheet === true ? 'form' : 'detail'}
        title={spec.title}
        sheet={spec.sheet}
        bare={spec.bare}
        closeHref={closeHref}
        closeLabel={closeLabel}
        onClose={onClose}
        closing={view.closing}
        instant={view.instant}
      >
        <Fragment key={key}>{spec.body}</Fragment>
      </Panel>
    );

  // In a `SubnavLayout`, the section lets these two take its column and the slot's (`:has`), so the
  // server renders the panel beside the list: a load of `?tag=ID` paints it, also with JavaScript off.
  return (
    <PanelNavContext value={nav}>
      {slot ? (
        <>
          <div className={styles.list} data-panel-switch="">
            {children}
          </div>
          <div className={styles.side} ref={side}>
            {panel}
          </div>
        </>
      ) : (
        <>
          {children}
          {panel}
        </>
      )}
    </PanelNavContext>
  );
}
