'use client';

import { useState, useTransition } from 'react';
import type { AccountWriteError } from '../../../src/server/write/accounts';
import { Button } from '../../../src/ui/Button';
import styles from './accountForms.module.css';
import { restoreAccountAction, restoreGoalAction } from './actions';

interface Props {
  id: string;
  kind: 'account' | 'goal';
  label: string;
  busyLabel: string;
  /** Resolved by the page: `web.accounts.error_<error>` for each error, and a throw. */
  errors: Record<AccountWriteError | 'unexpected', string>;
  /** Why the button is disabled: a goal whose account is archived (§5.14). Present means disabled. */
  disabledNote?: string;
}

/** «Ripristina» for an archived account or a closed goal; both refresh the page in place. */
export function RestoreButton({ id, kind, label, busyLabel, errors, disabledNote }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const restore = () => {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof restoreAccountAction>>;
      try {
        result = await (kind === 'account' ? restoreAccountAction(id) : restoreGoalAction(id));
      } catch {
        setError(errors.unexpected);
        return;
      }
      // The action renders the page again (`refreshAfterWrite`): nothing to refresh here.
      if (result.ok) return;
      setError(errors[result.error]);
    });
  };

  return (
    <div className={styles.restore}>
      <Button
        variant="secondary"
        busy={pending}
        busyLabel={busyLabel}
        disabled={disabledNote !== undefined}
        onClick={restore}
      >
        {label}
      </Button>
      {error === null ? null : (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
      {disabledNote === undefined ? null : <span className={styles.note}>{disabledNote}</span>}
    </div>
  );
}
