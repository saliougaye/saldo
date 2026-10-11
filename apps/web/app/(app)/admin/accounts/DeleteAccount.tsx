'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState, useTransition } from 'react';
import { confirmationMatches } from '../../../../src/features/admin/confirmation';
import type { AdminErrorStrings } from '../../../../src/features/admin/errorStrings';
import { Button } from '../../../../src/ui/Button';
import { ConfirmDialog } from '../../../../src/ui/ConfirmDialog';
import { sharedProps } from '../../../../src/ui/sharedProps';
import { TextField } from '../../../../src/ui/TextField';
import styles from '../admin.module.css';
import { deleteAccountAction } from './actions';

/** What every account's «Elimina account» shares, given once (`DeleteAccountShared`). */
export interface DeleteAccountSharedValue {
  /** Where the page goes once the account is gone: the list with no panel. */
  afterHref: string;
  strings: {
    action: string;
    confirm: string;
    cancel: string;
    busy: string;
    errors: AdminErrorStrings;
  };
}

const shared = sharedProps<DeleteAccountSharedValue>('DeleteAccount');

/** Gives every `DeleteAccount` below it the props they share. */
export const DeleteAccountShared = shared.Provider;

interface Props {
  id: string;
  /** What must be typed (the address, or the display name for a synthetic one); compared, never shown as a hint. */
  expected: string;
  /** `admin.accounts.deleteTitle` with the name, the body with the count of rows, the field's label. */
  text: { title: string; body: string; label: string };
}

/** «Elimina account» and its question: the confirm button waits until the typed text matches. */
export function DeleteAccount({ id, expected, text }: Props) {
  const { afterHref, strings } = shared.useShared();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const matches = confirmationMatches(typed, expected);

  const confirm = () => {
    if (pending || !matches) return;
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof deleteAccountAction>>;
      try {
        result = await deleteAccountAction({ id, confirmation: typed });
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

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    confirm();
  };

  return (
    <>
      <div className={styles.dangerButton}>
        <Button
          variant="secondary"
          icon="trash"
          onClick={() => {
            setError(null);
            setTyped('');
            setOpen(true);
          }}
        >
          {strings.action}
        </Button>
      </div>
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          if (pending) return;
          setOpen(next);
        }}
        title={text.title}
        body={text.body}
        error={error ?? undefined}
        confirmLabel={strings.confirm}
        cancelLabel={strings.cancel}
        busy={pending}
        busyLabel={strings.busy}
        confirmDisabled={!matches}
        onConfirm={confirm}
      >
        <form className={styles.confirmField} onSubmit={onSubmit} noValidate>
          <TextField
            label={text.label}
            value={typed}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            onChange={(event) => {
              setTyped(event.target.value);
              setError(null);
            }}
          />
        </form>
      </ConfirmDialog>
    </>
  );
}
