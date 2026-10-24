'use client';

import { useState } from 'react';
import { authClient } from '../../../../src/client/authClient';
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
  later: string;
  /** The sentence that asks for the passkey, shown when the session is too old. */
  reauth: string;
  reauthButton: string;
  reauthFailed: string;
  failed: string;
}

/**
 * Change of a real address. With a change pending the form is replaced by what is waited for and a
 * cancel button; the server says nothing about whether the address is free, so the line is the same
 * either way. Both calls are server actions with the account's own session.
 *
 * A session that no passkey ceremony created in the last 5 minutes cannot start the change. The form
 * then asks for the passkey with a button, not on its own: Safari refuses a WebAuthn prompt that no
 * click started. The ceremony makes a new session, and the same address goes out once more.
 */
export function ChangeEmailForm({ strings }: { strings: ChangeEmailStrings }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [reauth, setReauth] = useState(false);
  const [problem, setProblem] = useState<
    'invalid' | 'same' | 'later' | 'reauthFailed' | 'failed' | null
  >(null);

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
    if (result.reason === 'reauth') {
      setReauth(true);
      return;
    }
    if (result.reason === 'failed') log('auth', 'the email change was not accepted');
    setProblem(result.reason);
  };

  const confirmWithPasskey = async () => {
    setBusy(true);
    setProblem(null);
    const answer = await authClient.signIn.passkey().catch(() => null);
    setBusy(false);
    setReauth(false);
    if (answer === null || answer.error !== null || answer.data === null) {
      log('auth', 'the passkey was not confirmed for the email change');
      setProblem('reauthFailed');
      return;
    }
    await run(() => requestEmailChangeAction(email));
  };

  if (strings.pending !== null) {
    return (
      <div className={styles.change}>
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

  if (reauth) {
    return (
      <div className={styles.change}>
        <span className={styles.meta} role="status">
          {strings.reauth}
        </span>
        <Button
          variant="secondary"
          busy={busy}
          busyLabel={strings.working}
          onClick={() => void confirmWithPasskey()}
        >
          {strings.reauthButton}
        </Button>
      </div>
    );
  }

  return (
    <form
      noValidate
      className={styles.change}
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
