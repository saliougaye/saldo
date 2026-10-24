'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ignoresShortcut } from './isEditable';
import { useNavTransition } from './NavPending';

interface Props {
  /** The previous period's page, or null at the first one the page reaches. */
  previousHref: string | null;
  nextHref: string | null;
}

/**
 * Statistics (W6, open item 4): ← and → select the previous and the next period. Not while the
 * focus is in a field, and not while a dialog, a menu or a form owns the keys (`ignoresShortcut`).
 */
export function PeriodKeys({ previousHref, nextHref }: Props) {
  const router = useRouter();
  const startNav = useNavTransition();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (event.shiftKey || ignoresShortcut(event)) return;
      if (document.querySelector('[role="dialog"][data-panel]') !== null) return;
      const href = event.key === 'ArrowLeft' ? previousHref : nextHref;
      if (href === null) return;
      event.preventDefault();
      startNav(() => router.push(href, { scroll: false }));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router, startNav, previousHref, nextHref]);
  return null;
}
