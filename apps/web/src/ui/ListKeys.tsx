'use client';

import { useEffect } from 'react';
import { ignoresShortcut } from './isEditable';

/** The rows the arrows walk: every row link of the list, in the order of the page. */
const ROWS = '#content [data-select-id]';

/**
 * Transazioni's arrows (W3): ↑ ↓ move the focus through the rows that are on screen; ↵ opens the
 * focused row, which is a link to its edit form. A row inside a closed disclosure has no box, so it
 * is not in the walk. At either end an arrow does nothing; with no row focused, ↓ takes the first
 * row and ↑ the last.
 */
export function ListKeys() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const { key } = event;
      if (key !== 'ArrowDown' && key !== 'ArrowUp') return;
      if (event.shiftKey || ignoresShortcut(event)) return;
      const rows = [...document.querySelectorAll<HTMLElement>(ROWS)].filter(
        (row) => row.getClientRects().length > 0,
      );
      if (rows.length === 0) return;
      const active = document.activeElement;
      const index = active instanceof HTMLElement ? rows.indexOf(active) : -1;
      const next =
        index === -1
          ? key === 'ArrowDown'
            ? rows[0]
            : rows[rows.length - 1]
          : rows[key === 'ArrowDown' ? index + 1 : index - 1];
      if (next === undefined) return;
      event.preventDefault();
      next.focus({ preventScroll: true });
      next.scrollIntoView({ block: 'nearest' });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  return null;
}
