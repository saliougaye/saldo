'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
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
    /** `web.form.error_<error>` for every error the restore can return. */
    errors: Record<'invalid' | 'notFound' | 'closedGoal' | 'conflict', string>;
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

  // Stable: `Toast` restarts its timer whenever `onDismiss` changes.
  const dismiss = useCallback(() => {
    router.replace(withoutDeletedHref);
  }, [router, withoutDeletedHref]);

  const undo = () => {
    if (pending) return;
    startTransition(async () => {
      const result = await restoreTransactionAction(id);
      if (result.ok) {
        router.replace(restoredHref);
        router.refresh();
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
