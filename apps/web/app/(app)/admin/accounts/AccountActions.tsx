'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { AdminErrorStrings } from '../../../../src/features/admin/errorStrings';
import { Alert } from '../../../../src/ui/Alert';
import { Button } from '../../../../src/ui/Button';
import { ConfirmDialog } from '../../../../src/ui/ConfirmDialog';
import styles from '../admin.module.css';
import { promoteAccountAction, restoreAccountAction, revokeAccountAction } from './actions';

interface Props {
  id: string;
  can: { promote: boolean; revoke: boolean; restore: boolean };
  strings: {
    promote: string;
    revoke: string;
    restore: string;
    revokeTitle: string;
    revokeNote: string;
    revokeConfirm: string;
    cancel: string;
    busy: string;
    errors: AdminErrorStrings;
  };
}

/** «Rendi admin», «Revoca accesso» (which asks first) and «Ripristina accesso» (which does not). */
export function AccountActions({ id, can, strings }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
        setOpen(false);
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
            busy={pending}
            busyLabel={strings.busy}
            onClick={() => run(promoteAccountAction)}
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
              setOpen(true);
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
      {error !== null && !open ? (
        <div className={styles.feedback}>
          <Alert body={error} />
        </div>
      ) : null}
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          if (pending) return;
          setOpen(next);
        }}
        title={strings.revokeTitle}
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
