'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { AdminErrorStrings } from '../../../../src/features/admin/errorStrings';
import { Alert } from '../../../../src/ui/Alert';
import { Button } from '../../../../src/ui/Button';
import { ConfirmDialog } from '../../../../src/ui/ConfirmDialog';
import { sharedProps } from '../../../../src/ui/sharedProps';
import styles from '../admin.module.css';
import { promoteAccountAction, restoreAccountAction, revokeAccountAction } from './actions';

/** What every account's actions share, given once (`AccountActionsShared`). */
interface AccountActionsSharedValue {
  strings: {
    promote: string;
    revoke: string;
    restore: string;
    promoteNote: string;
    promoteConfirm: string;
    revokeNote: string;
    revokeConfirm: string;
    cancel: string;
    busy: string;
    errors: AdminErrorStrings;
  };
}

const shared = sharedProps<AccountActionsSharedValue>('AccountActions');

/** Gives every `AccountActions` below it the props they share. */
export const AccountActionsShared = shared.Provider;

interface Props {
  id: string;
  can: { promote: boolean; revoke: boolean; restore: boolean };
  /** `admin.accounts.promoteTitle` and `admin.accounts.revokeTitle`, with the account's name. */
  titles: { promote: string; revoke: string };
}

/** «Rendi admin» and «Revoca accesso» (both ask first) and «Ripristina accesso» (which does not).
 * Promotion cannot be undone from the panel or the CLI, hence the question.
 */
export function AccountActions({ id, can, titles }: Props) {
  const { strings } = shared.useShared();
  const router = useRouter();
  const [open, setOpen] = useState<'promote' | 'revoke' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>) => {
    if (pending) return;
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof action>>;
      try {
        result = await action(id);
      } catch {
        setError(strings.errors.unexpected);
        return;
      }
      if (result.ok) {
        setError(null);
        setOpen(null);
        router.refresh();
        return;
      }
      setError(
        result.error === 'self' || result.error === 'notFound'
          ? strings.errors[result.error]
          : strings.errors.unexpected,
      );
    });
  };

  return (
    <>
      <div className={styles.actions}>
        {can.promote ? (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setError(null);
              setOpen('promote');
            }}
          >
            {strings.promote}
          </Button>
        ) : null}
        {can.revoke ? (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setError(null);
              setOpen('revoke');
            }}
          >
            {strings.revoke}
          </Button>
        ) : null}
        {can.restore ? (
          <Button
            variant="secondary"
            busy={pending}
            busyLabel={strings.busy}
            onClick={() => run(restoreAccountAction)}
          >
            {strings.restore}
          </Button>
        ) : null}
      </div>
      {can.revoke ? <p className={styles.warn}>{strings.revokeNote}</p> : null}
      {error !== null && open === null ? (
        <div className={styles.feedback}>
          <Alert body={error} />
        </div>
      ) : null}
      <ConfirmDialog
        open={open === 'promote'}
        onOpenChange={(next) => {
          if (pending) return;
          setOpen(next ? 'promote' : null);
        }}
        title={titles.promote}
        body={strings.promoteNote}
        error={error ?? undefined}
        confirmLabel={strings.promoteConfirm}
        cancelLabel={strings.cancel}
        busy={pending}
        busyLabel={strings.busy}
        onConfirm={() => run(promoteAccountAction)}
      />
      <ConfirmDialog
        open={open === 'revoke'}
        onOpenChange={(next) => {
          if (pending) return;
          setOpen(next ? 'revoke' : null);
        }}
        title={titles.revoke}
        body={strings.revokeNote}
        error={error ?? undefined}
        confirmLabel={strings.revokeConfirm}
        cancelLabel={strings.cancel}
        busy={pending}
        busyLabel={strings.busy}
        onConfirm={() => run(revokeAccountAction)}
      />
    </>
  );
}
