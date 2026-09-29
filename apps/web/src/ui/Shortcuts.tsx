'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ignoresShortcut } from './isEditable';

/** Decision 8: «Nuova transazione» is the form on Transazioni, from any page. */
const NEW_TRANSACTION_HREF = '/transactions?new';

/**
 * The keys that work on every page of the shell (§17.1.7): `N` opens «Nuova transazione». Mounted
 * once in the `(app)` layout; it renders nothing, and without JavaScript the top bar's link and the
 * FAB still get there.
 */
export function Shortcuts() {
  const router = useRouter();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'n' && event.key !== 'N') return;
      if (ignoresShortcut(event)) return;
      event.preventDefault();
      router.push(NEW_TRANSACTION_HREF);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router]);
  return null;
}
