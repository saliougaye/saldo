'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { BudgetWriteError } from '../../../src/server/write/budgets';
import { ConfirmDialog } from '../../../src/ui/ConfirmDialog';
import { Icon } from '../../../src/ui/Icon';
import { deleteBudgetAction } from './actions';
import styles from './budgets.module.css';

interface Props {
  id: string;
  /** Where the page goes once the budget is gone: `/budgets`. */
  afterHref: string;
  strings: {
    /** The button in the form's foot, «Elimina budget». */
    action: string;
    /** `budgets.deleteTitle`, with the budget's name. */
    title: string;
    body: string;
    confirm: string;
    cancel: string;
    busy: string;
    /** `web.budgets.error_<error>` for every error the action can return, and a throw. */
    errors: Record<BudgetWriteError | 'unexpected', string>;
  };
}

/**
 * «Elimina budget» and its question (§5.8). Like the phone, it asks first and offers no undo: the
 * transactions stay, only the budget goes.
 */
export function DeleteBudget({ id, afterHref, strings }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    if (pending) return;
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof deleteBudgetAction>>;
      try {
        result = await deleteBudgetAction(id);
      } catch {
        setError(strings.errors.unexpected);
        return;
      }
      if (result.ok) {
        setOpen(false);
        router.push(afterHref);
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
        className={styles.deleteButton}
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
