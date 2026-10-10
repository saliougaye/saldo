'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ignoresShortcut } from './isEditable';
import { useNavTransition } from './NavPending';
import { NEW_TRANSACTION_HREF, openNewTransaction } from './NewTransactionLink';

/**
 * The keys that work on every page of the shell (§17.1.7): `N` opens «Nuova transazione» — in
 * place on Transazioni, which answers the request, and on its page from anywhere else. Mounted
 * once in the `(app)` layout; it renders nothing, and without JavaScript the top bar's link and the
 * FAB still get there.
 */
export function Shortcuts() {
  const router = useRouter();
  const startNav = useNavTransition();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'n' && event.key !== 'N') return;
      if (ignoresShortcut(event)) return;
      event.preventDefault();
      if (!openNewTransaction(true)) startNav(() => router.push(NEW_TRANSACTION_HREF));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router, startNav]);
  return null;
}
