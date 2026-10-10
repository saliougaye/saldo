'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { ignoresShortcut } from './isEditable';
import { useNavTransition } from './NavPending';

/** What `href` and `editHref` carry in place of a row's id. */
const ID = '__ID__';

interface Props {
  /** The rows behind the «In arrivo» disclosure, in the order they are rendered. */
  upcomingIds: readonly string[];
  /** The rest of the list, in the order it is rendered: after the upcoming ones on screen. */
  ids: readonly string[];
  /** The DOM id of the `<details>` that holds the upcoming rows: closed, they are not in the walk. */
  upcomingDisclosureId: string;
  selectedId: string | null;
  /** The selected row's page, with `__ID__` for its id. */
  href: string;
  /** The row's edit form, with `__ID__` for its id. */
  editHref: string;
  /**
   * The page moves the selection itself (Transazioni, whose panel is client state). It answers
   * false when the move has to be a navigation; the selection then moves through `href`.
   */
  onSelect?: (id: string) => boolean;
}

/**
 * Transazioni's keys (§17.1.7): ↑ ↓ move the selection through the rows as they are on screen, `E`
 * edits the selected one. The selection is the URL, so a move replaces it — in
 * place when the page owns the panel (`onSelect`), else with `router.replace` — Back leaves the
 * page rather than walking back through every row it passed. At either end of the list an arrow does
 * nothing; with nothing selected ↓ takes the first row and ↑ the last.
 */
export function ListKeys({
  upcomingIds,
  ids,
  upcomingDisclosureId,
  selectedId,
  href,
  editHref,
  onSelect,
}: Props) {
  const router = useRouter();
  const startNav = useNavTransition();
  const moved = useRef(false);

  // `scroll: false` keeps the page still, so the row an arrow reached is brought into view here —
  // only as far as it takes, and only after a move, not when a link opened the row.
  useEffect(() => {
    if (!moved.current || selectedId === null) return;
    moved.current = false;
    document.querySelector('#content a[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const { key } = event;
      const arrow = key === 'ArrowDown' || key === 'ArrowUp';
      const edit = key === 'e' || key === 'E';
      if (!arrow && !edit) return;
      if (ignoresShortcut(event) || (arrow && event.shiftKey)) return;
      if (edit) {
        if (selectedId === null) return;
        event.preventDefault();
        startNav(() => router.push(editHref.replace(ID, encodeURIComponent(selectedId))));
        return;
      }
      const disclosure = document.getElementById(upcomingDisclosureId);
      const upcomingOpen = disclosure instanceof HTMLDetailsElement && disclosure.open;
      // A selected upcoming row is in the walk even when its disclosure was closed after it.
      const walk =
        upcomingOpen || (selectedId !== null && upcomingIds.includes(selectedId))
          ? [...upcomingIds, ...ids]
          : ids;
      if (walk.length === 0) return;
      const index = selectedId === null ? -1 : walk.indexOf(selectedId);
      const next =
        index === -1
          ? key === 'ArrowDown'
            ? walk[0]
            : walk[walk.length - 1]
          : walk[key === 'ArrowDown' ? index + 1 : index - 1];
      if (next === undefined) return;
      event.preventDefault();
      moved.current = true;
      if (onSelect?.(next) === true) return;
      startNav(() => router.replace(href.replace(ID, encodeURIComponent(next)), { scroll: false }));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    router,
    startNav,
    upcomingIds,
    ids,
    upcomingDisclosureId,
    selectedId,
    href,
    editHref,
    onSelect,
  ]);
  return null;
}
