'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { AdminErrorStrings } from '../../../../src/features/admin/errorStrings';
import { Button } from '../../../../src/ui/Button';
import { ConfirmDialog } from '../../../../src/ui/ConfirmDialog';
import { revokeInviteAction } from './actions';

interface Props {
  id: string;
  strings: {
    action: string;
    title: string;
    body: string;
    cancel: string;
    busy: string;
    errors: AdminErrorStrings;
  };
}

/** «Revoca» an active invite; it asks first, because the code stops working at once. */
export function RevokeInvite({ id, strings }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    if (pending) return;
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof revokeInviteAction>>;
      try {
        result = await revokeInviteAction(id);
      } catch {
        setError(strings.errors.unexpected);
        return;
      }
      if (result.ok) {
        setOpen(false);
        router.refresh();
        return;
      }
      setError(strings.errors[result.error]);
    });
  };

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {strings.action}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          if (pending) return;
          setOpen(next);
        }}
        title={strings.title}
        body={strings.body}
        error={error ?? undefined}
        confirmLabel={strings.action}
        cancelLabel={strings.cancel}
        busy={pending}
        busyLabel={strings.busy}
        onConfirm={confirm}
      />
    </>
  );
}
