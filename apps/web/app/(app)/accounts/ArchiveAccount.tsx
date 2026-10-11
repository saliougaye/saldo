'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { AccountWriteError } from '../../../src/server/write/accounts';
import { ConfirmDialog } from '../../../src/ui/ConfirmDialog';
import { Icon } from '../../../src/ui/Icon';
import { sharedProps } from '../../../src/ui/sharedProps';
import styles from './accountForms.module.css';
import { archiveAccountAction } from './actions';

/** What every account's «Archivia» shares, given once (`ArchiveAccountShared`). */
export interface ArchiveAccountSharedValue {
  /** Where the page goes once the account is archived: `/accounts`. */
  afterHref: string;
  strings: {
    /** The button in the panel's actions row, «Archivia conto». */
    action: string;
    title: string;
    confirm: string;
    cancel: string;
    busy: string;
    /** `web.accounts.error_<error>` for every error the action can return, and a throw. */
    errors: Record<AccountWriteError | 'unexpected', string>;
  };
}

const shared = sharedProps<ArchiveAccountSharedValue>('ArchiveAccount');

/** Gives every `ArchiveAccount` below it the props they share. */
export const ArchiveAccountShared = shared.Provider;

interface Props {
  id: string;
  /** The row's version as the page loaded it: a phone's edit since then is a `conflict` (§17.4.2). */
  updatedAt: string;
  /** `web.accounts.archiveBody`, with the account's name. */
  body: string;
}

/**
 * The account panel's «Archivia» and its question (§5.6). The page already hides the button when
 * the account holds open goals; `holdsGoals` still reads here for a goal a phone added a second ago.
 */
export function ArchiveAccount({ id, updatedAt, body }: Props) {
  const { afterHref, strings } = shared.useShared();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    if (pending) return;
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof archiveAccountAction>>;
      try {
        result = await archiveAccountAction(id, updatedAt);
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
        className={`${styles.actionLink} ${styles.actionButton} ${styles.danger}`}
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
        body={body}
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
