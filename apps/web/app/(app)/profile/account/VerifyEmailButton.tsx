'use client';

import { useEffect, useState } from 'react';
import { authClient } from '../../../../src/client/authClient';
import { log } from '../../../../src/client/log';
import { Button } from '../../../../src/ui/Button';
import styles from '../../app.module.css';

export interface VerifyEmailStrings {
  send: string;
  working: string;
  /** «Link inviato a {email}», already interpolated: the address is known to the page. */
  sent: string;
  failed: string;
}

/** The button stays off this long after a send: the server throttles per address, so a click sooner is wasted. */
export const RESEND_LOCK_MS = 60_000;

/**
 * §17.1.4 (0.3f-3): asks Better Auth to mail the verification link to the address on the account.
 * The link's callback is `/email-verified`, a public page — opening it signs nobody in.
 */
export function VerifyEmailButton({
  email,
  strings,
}: {
  email: string;
  strings: VerifyEmailStrings;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'sent' | 'failed' | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!locked) return;
    const timer = setTimeout(() => {
      setLocked(false);
      setStatus(null);
    }, RESEND_LOCK_MS);
    return () => clearTimeout(timer);
  }, [locked]);

  const send = async () => {
    setBusy(true);
    setStatus(null);
    const result = await authClient
      .sendVerificationEmail({ email, callbackURL: '/email-verified' })
      .catch((): { error: { status?: number } } => ({ error: {} }));
    setBusy(false);
    if (result.error !== null) {
      log('auth', 'the verification request was not accepted', { status: result.error.status });
      setStatus('failed');
      return;
    }
    setStatus('sent');
    setLocked(true);
  };

  return (
    <>
      <Button
        variant="secondary"
        busy={busy}
        busyLabel={strings.working}
        disabled={locked}
        onClick={() => void send()}
      >
        {strings.send}
      </Button>
      {status === null ? null : (
        <span className={styles.meta} role="status">
          {status === 'sent' ? strings.sent : strings.failed}
        </span>
      )}
    </>
  );
}
