'use client';

import { useState } from 'react';
import { log } from '../../../../src/client/log';
import { Button } from '../../../../src/ui/Button';
import { TextField } from '../../../../src/ui/TextField';
import styles from '../../app.module.css';
import { cancelEmailChangeAction, requestEmailChangeAction } from './actions';

export interface ChangeEmailStrings {
  label: string;
  send: string;
  working: string;
  /** «Waiting for you to confirm {email}», already interpolated; null when nothing is pending. */
  pending: string | null;
  /** The explanation under it, interpolated; null when nothing is pending. */
  sent: string | null;
  cancel: string;
  invalid: string;
  same: string;
  failed: string;
}

/**
 * Change of a real address. With a change pending the form is replaced by what is waited for and a
 * cancel button; the server says nothing about whether the address is free, so the line is the same
 * either way. Both calls are server actions with the account's own session.
 */
export function ChangeEmailForm({ strings }: { strings: ChangeEmailStrings }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<'invalid' | 'same' | 'failed' | null>(null);

  const run = async (call: () => ReturnType<typeof requestEmailChangeAction>) => {
    setBusy(true);
    setProblem(null);
    const result = await call().catch((): { ok: false; reason: 'failed' } => ({
      ok: false,
      reason: 'failed',
    }));
    setBusy(false);
    if (result.ok) {
      setEmail('');
      return;
    }
    if (result.reason === 'failed') log('auth', 'the email change was not accepted');
    setProblem(result.reason);
  };

  if (strings.pending !== null) {
    return (
      <div className={styles.verify}>
        <span className={styles.meta} role="status">
          {strings.pending}
        </span>
        {strings.sent === null ? null : <span className={styles.meta}>{strings.sent}</span>}
        <Button
          variant="secondary"
          busy={busy}
          busyLabel={strings.working}
          onClick={() => void run(cancelEmailChangeAction)}
        >
          {strings.cancel}
        </Button>
        {problem === null ? null : <span className={styles.meta}>{strings[problem]}</span>}
      </div>
    );
  }

  return (
    <form
      className={styles.verify}
      onSubmit={(event) => {
        event.preventDefault();
        if (email.trim() !== '') void run(() => requestEmailChangeAction(email));
      }}
    >
      <TextField
        label={strings.label}
        type="email"
        name="newEmail"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        value={email}
        invalid={problem !== null}
        hint={problem === null ? undefined : strings[problem]}
        onChange={(event) => setEmail(event.target.value)}
      />
      <Button type="submit" variant="secondary" busy={busy} busyLabel={strings.working}>
        {strings.send}
      </Button>
    </form>
  );
}
