'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { WriteError } from '../../../src/server/write/transactions';
import { actionApplied } from '../../../src/ui/actionApplied';
import { Icon } from '../../../src/ui/Icon';
import { deleteTransactionAction } from './actions';
import styles from './TransactionForm.module.css';

interface Props {
  id: string;
  /** The row's version as the page loaded it: a phone's edit since then is a `conflict` (§17.4.2). */
  updatedAt: string;
  /** Where the page goes once the row is a tombstone: the list without `t`, plus `deleted={id}`. */
  deletedHref: string;
  strings: {
    /** «Elimina». */
    action: string;
    busy: string;
    /** `web.form.error_<error>`, resolved by the page for every error the action can return, and a throw. */
    errors: Record<WriteError | 'unexpected', string>;
  };
}

/**
 * «Elimina» on the left of the edit form's foot (W3). It deletes at once: the page moves to
 * `?deleted={id}`, which closes the dialog and shows the toast with «Annulla» for 5 seconds.
 * A refusal stays in the form and says why.
 */
export function DeleteTransaction({ id, updatedAt, deletedHref, strings }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const remove = () => {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof deleteTransactionAction>>;
      try {
        result = await deleteTransactionAction(id, updatedAt);
      } catch {
        setError(strings.errors.unexpected);
        return;
      }
      if (result.ok) {
        await actionApplied();
        // `replace`: Back must not open the form of a row that is gone.
        router.replace(deletedHref);
        return;
      }
      setError(strings.errors[result.error]);
    });
  };

  return (
    <div className={styles.deleteSlot}>
      <button
        type="button"
        className={styles.delete}
        onClick={remove}
        disabled={pending}
        aria-busy={pending}
      >
        <Icon name="trash" size={14} />
        {pending ? strings.busy : strings.action}
      </button>
      {error === null ? null : (
        <span className={styles.deleteError} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
