'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { AccountWriteError } from '../../../src/server/write/accounts';
import { Button } from '../../../src/ui/Button';
import { ConfirmDialog } from '../../../src/ui/ConfirmDialog';
import styles from './accountForms.module.css';
import { closeGoalAction } from './actions';

interface Props {
  id: string;
  /** Where the page goes once the goal is closed: `/accounts`. */
  afterHref: string;
  /** «Registra la spesa»: `goalExpenseHref` for a funded goal; the dialog offers it only then. */
  expenseHref: string | null;
  strings: {
    /** The button in the goal panel, «Chiudi obiettivo». */
    action: string;
    /** Funded: `goals.closeTitle`; empty: `goals.close`. */
    title: string;
    /** Funded: `goals.closeBody` with the balance; empty: `goals.closeEmpty`. */
    body: string;
    /** Empty goal: `goals.confirmClose`. */
    confirm: string;
    /** Funded goal, first answer: `goals.recordExpense`. */
    recordExpense: string;
    /** Funded goal, second answer: `goals.returnTo` with the parent's name. */
    returnTo: string;
    cancel: string;
    busy: string;
    /** `web.accounts.error_<error>` for every error the action can return, and a throw. */
    errors: Record<AccountWriteError | 'unexpected', string>;
  };
}

/**
 * §6.38: closing a goal. An empty one only confirms; one that holds money asks what happened to it:
 * «Registra la spesa» goes to the expense form (saving that closes the goal), «Riporta in {conto}»
 * closes it here and now, the money back in the parent.
 */
export function CloseGoal({ id, afterHref, expenseHref, strings }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const funded = expenseHref !== null;

  const close = () => {
    if (pending) return;
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof closeGoalAction>>;
      try {
        result = await closeGoalAction(id);
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

  const recordExpense = () => {
    if (expenseHref === null || pending) return;
    setOpen(false);
    router.push(expenseHref);
  };

  return (
    <>
      <button
        type="button"
        className={`${styles.actionLink} ${styles.actionButton}`}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
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
        cancelLabel={strings.cancel}
        // Funded: the primary answer is the expense; the return is the second one. Empty: one answer.
        confirmLabel={funded ? strings.recordExpense : strings.confirm}
        busy={funded ? false : pending}
        busyLabel={strings.busy}
        onConfirm={funded ? recordExpense : close}
        secondary={
          funded ? (
            <Button variant="secondary" busy={pending} busyLabel={strings.busy} onClick={close}>
              {strings.returnTo}
            </Button>
          ) : undefined
        }
      />
    </>
  );
}
