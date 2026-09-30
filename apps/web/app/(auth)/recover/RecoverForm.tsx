'use client';

import { useState } from 'react';
import { authClient } from '../../../src/client/authClient';
import { log } from '../../../src/client/log';
import { recoverAnswer } from '../../../src/features/auth/recoverView';
import { Alert } from '../../../src/ui/Alert';
import { Button } from '../../../src/ui/Button';
import { TextField } from '../../../src/ui/TextField';
import styles from '../auth.module.css';

export interface RecoverStrings {
  /** The line above the field; null when the page already shows an alert in its place. */
  intro: string | null;
  emailLabel: string;
  emailPlaceholder: string;
  submit: string;
  working: string;
  sent: string;
  rateLimited: string;
  backToSignIn: string;
}

/**
 * Asks Better Auth for a magic link. The answer is the **same** sentence whatever the address is
 * and whatever the endpoint said (`recoverAnswer`): the page must not tell which addresses have an
 * account, nor which are verified. The link lands on the passkeys page, where the alert asks for a
 * new passkey; a link that is expired or already used comes back to `/recover?error=…`.
 */
export function RecoverForm({ strings }: { strings: RecoverStrings }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<'sent' | 'rateLimited' | null>(null);

  const submit = async () => {
    if (email.trim() === '') return;
    setBusy(true);
    const result = await authClient.signIn
      .magicLink({
        email: email.trim(),
        callbackURL: '/profile/passkeys?recovered',
        errorCallbackURL: '/recover',
      })
      .catch((): { error: { status?: number } } => ({ error: {} }));
    // Only the status reaches the log: never the address, never the body.
    if (result.error !== null)
      log('auth', 'the recovery request was not accepted', { status: result.error.status });
    setAnswer(recoverAnswer(result.error));
    setBusy(false);
  };

  if (answer === 'sent') {
    return (
      <>
        <Alert body={strings.sent} />
        <a className={styles.secondaryLink} href="/login">
          {strings.backToSignIn}
        </a>
      </>
    );
  }

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {strings.intro === null ? null : <p className={styles.lede}>{strings.intro}</p>}
      {answer === 'rateLimited' ? <Alert body={strings.rateLimited} /> : null}
      <div className={styles.fields}>
        <TextField
          label={strings.emailLabel}
          placeholder={strings.emailPlaceholder}
          type="email"
          name="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <Button type="submit" busy={busy} busyLabel={strings.working}>
        {strings.submit}
      </Button>
    </form>
  );
}
