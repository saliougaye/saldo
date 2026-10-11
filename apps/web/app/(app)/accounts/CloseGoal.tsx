'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { AccountWriteError } from '../../../src/server/write/accounts';
import { actionApplied } from '../../../src/ui/actionApplied';
import { Button } from '../../../src/ui/Button';
import { ConfirmDialog } from '../../../src/ui/ConfirmDialog';
import { useNavTransition } from '../../../src/ui/NavPending';
import { sharedProps } from '../../../src/ui/sharedProps';
import styles from './accountForms.module.css';
import { closeGoalAction } from './actions';

/** What every goal's «Chiudi obiettivo» shares, given once (`CloseGoalShared`). */
export interface CloseGoalSharedValue {
  /** Where the page goes once the goal is closed: `/accounts`. */
  afterHref: string;
  strings: {
    /** The button in the goal panel, «Chiudi obiettivo»; also the title of an empty goal's question. */
    action: string;
    /** The title of a funded goal's question: `goals.closeTitle`. */
    fundedTitle: string;
    /** Empty goal: `goals.confirmClose`. */
    confirm: string;
    /** Funded goal, first answer: `goals.recordExpense`. */
    recordExpense: string;
    cancel: string;
    busy: string;
    /** `web.accounts.error_<error>` for every error the action can return, and a throw. */
    errors: Record<AccountWriteError | 'unexpected', string>;
  };
}

const shared = sharedProps<CloseGoalSharedValue>('CloseGoal');

/** Gives every `CloseGoal` below it the props they share. */
export const CloseGoalShared = shared.Provider;

interface Props {
  id: string;
  /** The row's version as the page loaded it: a phone's edit since then is a `conflict` (§17.4.2). */
  updatedAt: string;
  /** «Registra la spesa»: `goalExpenseHref` for a funded goal; the dialog offers it only then. */
  expenseHref: string | null;
  /** Funded: `goals.closeBody` with the balance; empty: `goals.closeEmpty`. */
  body: string;
  /** Funded goal, second answer: `goals.returnTo` with the parent's name. */
  returnTo: string;
}

/**
 * §6.38: closing a goal. An empty one only confirms; one that holds money asks what happened to it:
 * «Registra la spesa» goes to the expense form (saving that closes the goal), «Riporta in {conto}»
 * closes it here and now, the money back in the parent.
 */
export function CloseGoal({ id, updatedAt, expenseHref, body, returnTo }: Props) {
  const { afterHref, strings } = shared.useShared();
  const router = useRouter();
  const startNav = useNavTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const funded = expenseHref !== null;

  const close = () => {
    if (pending) return;
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof closeGoalAction>>;
      try {
        result = await closeGoalAction(id, updatedAt);
      } catch {
        setError(strings.errors.unexpected);
        return;
      }
      if (result.ok) {
        setOpen(false);
        await actionApplied();
        router.push(afterHref);
        return;
      }
      setError(strings.errors[result.error]);
    });
  };

  const recordExpense = () => {
    if (expenseHref === null || pending) return;
    setOpen(false);
    startNav(() => router.push(expenseHref));
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
        title={funded ? strings.fundedTitle : strings.action}
        body={body}
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
              {returnTo}
            </Button>
          ) : undefined
        }
      />
    </>
  );
}
