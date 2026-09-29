'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ConfirmDialog } from '../../../src/ui/ConfirmDialog';
import { Icon } from '../../../src/ui/Icon';
import { deleteTransactionAction } from './actions';
import styles from './transactions.module.css';

interface Props {
  id: string;
  /** Where the page goes once the row is a tombstone: the list without `t`, plus `deleted={id}`. */
  deletedHref: string;
  strings: {
    /** The button in the detail's actions row, «Elimina». */
    action: string;
    title: string;
    /** `transactions.deleteBody`, or `transactions.deleteRecurringBody` for an occurrence. */
    body: string;
    confirm: string;
    cancel: string;
    busy: string;
    /** `web.form.error_<error>`, resolved by the page for every error the action can return. */
    errors: Record<'invalid' | 'notFound' | 'closedGoal' | 'conflict', string>;
  };
}

/**
 * The detail panel's «Elimina» and its question (§17.1.7, the mockup's «Elimina» view). Confirming
 * tombstones the transaction (decision 9) and moves the page to `?deleted={id}`, where the page
 * renders «Annulla» (decision 8). A refusal keeps the dialog open and says why.
 */
export function DeleteTransaction({ id, deletedHref, strings }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    if (pending) return;
    startTransition(async () => {
      const result = await deleteTransactionAction(id);
      if (result.ok) {
        setOpen(false);
        router.push(deletedHref);
        router.refresh();
        return;
      }
      setError(strings.errors[result.error]);
    });
  };

  return (
    <>
      <button
        type="button"
        className={`${styles.action} ${styles.danger}`}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Icon name="trash" size={14} />
        {strings.action}
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          if (pending) return;
          setOpen(next);
        }}
        title={strings.title}
        body={strings.body}
        error={error ?? undefined}
        confirmLabel={strings.confirm}
        cancelLabel={strings.cancel}
        busy={pending}
        busyLabel={strings.busy}
        onConfirm={confirm}
      />
    </>
  );
}
