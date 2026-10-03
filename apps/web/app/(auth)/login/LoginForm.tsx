'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { authClient } from '../../../src/client/authClient';
import { log } from '../../../src/client/log';
import { describeAuthError } from '../../../src/features/auth/authErrors';
import { rememberPasskey } from '../../../src/features/auth/lastPasskey';
import { Alert } from '../../../src/ui/Alert';
import { Button } from '../../../src/ui/Button';
import { TextField } from '../../../src/ui/TextField';
import styles from '../auth.module.css';

export interface LoginStrings {
  emailLabel: string;
  emailPlaceholder: string;
  signIn: string;
  working: string;
  crossDeviceHint: string;
  cancelledTitle: string;
  cancelledBody: string;
  genericTitle: string;
  genericBody: string;
}

/**
 * The passkey ceremony, twice over: armed for the browser's **conditional UI** as soon as the page
 * loads — which is what makes the email field offer the passkey when it is focused, together with
 * `autocomplete="username webauthn"` — and run outright by the button.
 *
 * `@simplewebauthn/browser` aborts any ceremony in flight when a new one starts, so pressing the
 * button while autofill is armed is safe; the armed one then fails with an abort, which is ignored.
 */
export function LoginForm({ strings, next }: { strings: LoginStrings; next: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ title: string; body: string } | null>(null);
  const armed = useRef(false);

  const succeed = (credentialId: string | undefined) => {
    if (credentialId !== undefined) rememberPasskey(credentialId);
    // §17.4.1: an MCP authorization in progress. A full navigation, because the next stop is an API
    // route that redirects (to the consent page, or straight back to the client).
    if (next !== null) {
      window.location.assign(next);
      return;
    }
    // `replace`: the sign-in page must not come back on a hardware back from inside the app.
    router.replace('/home');
  };

  // The ceremony is armed once per page, not once per render — `succeed` is stable enough for that
  // (it only closes over `router`, which Next guarantees stable, and `next`, fixed by the server for
  // the page) and listing it would re-arm on
  // every render of a component that never unmounts before the ceremony resolves.
  // biome-ignore lint/correctness/useExhaustiveDependencies: armed once per page, not once per render.
  useEffect(() => {
    if (armed.current) return;
    armed.current = true;
    void (async () => {
      log('auth', 'arming the browser’s passkey autofill');
      const result = await authClient.signIn.passkey({
        autoFill: true,
        returnWebAuthnResponse: true,
      });
      // An abort is the button taking over, and a browser with no conditional UI simply never
      // resolves this — neither is worth a word on screen.
      if (result.error !== null || result.data === null) return;
      succeed('webauthn' in result ? result.webauthn?.response.id : undefined);
    })();
  }, []);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    const result = await authClient.signIn.passkey({
      returnWebAuthnResponse: true,
    });
    if (result.error !== null || result.data === null) {
      const failure = result.error;
      const code = failure === null ? undefined : 'code' in failure ? failure.code : undefined;
      log('auth', 'the passkey ceremony failed', { status: failure?.status, code });
      const message = describeAuthError(typeof code === 'string' ? code : undefined);
      setError(
        message.titleKey === 'sync.cancelled'
          ? { title: strings.cancelledTitle, body: strings.cancelledBody }
          : { title: strings.genericTitle, body: strings.genericBody },
      );
      setBusy(false);
      return;
    }
    succeed('webauthn' in result ? result.webauthn?.response.id : undefined);
  };

  return (
    <>
      {error === null ? null : <Alert title={error.title} body={error.body} />}
      <div className={styles.fields}>
        <TextField
          label={strings.emailLabel}
          placeholder={strings.emailPlaceholder}
          type="email"
          name="email"
          /** What makes the browser offer the passkey the moment this field is touched. */
          autoComplete="username webauthn"
          autoCapitalize="none"
          spellCheck={false}
        />
      </div>
      <Button icon="key" busy={busy} busyLabel={strings.working} onClick={() => void signIn()}>
        {strings.signIn}
      </Button>
      <p className={`${styles.hint} ${styles.centred}`}>{strings.crossDeviceHint}</p>
    </>
  );
}
