'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState, useTransition } from 'react';
import type { WriteError } from '../../../src/server/write/transactions';
import { actionApplied } from '../../../src/ui/actionApplied';
import { Toast } from '../../../src/ui/Toast';
import { restoreTransactionAction } from './actions';

/** §17.1.7: «Annulla» for five seconds, then the toast leaves. */
const UNDO_MS = 5000;

interface Props {
  id: string;
  /** Where «Annulla» lands once the row is back: the list with `t={id}`, so it is selected again. */
  restoredHref: string;
  /** The same page without `deleted`, so a reload after the toast has gone does not bring it back. */
  withoutDeletedHref: string;
  strings: {
    /** `transactions.deleted` with the row's title. */
    message: string;
    undo: string;
    /** `web.form.error_<error>` for every error the restore can return, and a throw. */
    errors: Record<WriteError | 'unexpected', string>;
  };
}

/**
 * The mockup's «Annulla» view: rendered by the page only while `?deleted=` names a tombstone of this
 * user. «Annulla» writes the row back (decision 9) and selects it; otherwise the toast leaves after
 * `UNDO_MS` by dropping `deleted` from the URL.
 */
export function UndoToast({ id, restoredHref, withoutDeletedHref, strings }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Once «Annulla» is pressed the timer no longer takes the toast away: not while the restore is on
  // its way, and not after it failed, which would drop the error before it is read.
  const undoing = useRef(false);

  // Stable: `Toast` restarts its timer whenever `onDismiss` changes.
  const dismiss = useCallback(() => {
    if (undoing.current) return;
    router.replace(withoutDeletedHref);
  }, [router, withoutDeletedHref]);

  const undo = () => {
    if (pending) return;
    undoing.current = true;
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof restoreTransactionAction>>;
      try {
        result = await restoreTransactionAction(id);
      } catch {
        setError(strings.errors.unexpected);
        return;
      }
      if (result.ok) {
        await actionApplied();
        router.replace(restoredHref);
        return;
      }
      setError(strings.errors[result.error]);
    });
  };

  return (
    <Toast
      message={error ?? strings.message}
      action={{ label: strings.undo, onClick: undo, busy: pending }}
      durationMs={UNDO_MS}
      onDismiss={dismiss}
    />
  );
}
