'use client';

import { useEffect, useRef, useState } from 'react';
import { authClient } from '../../../src/client/authClient';
import { log } from '../../../src/client/log';
import { describeAuthError, fieldForErrorCode } from '../../../src/features/auth/authErrors';
import {
  type RegisterStep,
  registerSteps,
  stepBefore,
  stepForErrorCode,
} from '../../../src/features/auth/registerSteps';
import { registrationContextJson } from '../../../src/features/auth/registrationBody';
import type { InstanceInfo } from '../../../src/server/instance';
import { Alert } from '../../../src/ui/Alert';
import { Brand } from '../../../src/ui/Brand';
import { Button } from '../../../src/ui/Button';
import { Icon } from '../../../src/ui/Icon';
import { Steps, stepsBackClass } from '../../../src/ui/Steps';
import { TextField } from '../../../src/ui/TextField';
import styles from '../../(auth)/auth.module.css';

interface Props {
  redirectUri: string;
  state: string;
  canRegister: boolean;
  requiresInvite: boolean;
  initialMode: 'login' | 'register';
  instance: InstanceInfo;
  strings: Record<string, string>;
  stepLabels: string[];
}

/**
 * §9.3 steps 4–5. The ceremony runs here because the app has no `navigator.credentials`; on success a
 * one-time token is minted and travels back in the deep link, single use, one minute, stored hashed.
 * The app cannot read this browser's cookie, which is the whole reason the token exists.
 */
export function MobileAuth({
  redirectUri,
  state,
  canRegister,
  requiresInvite,
  initialMode,
  instance,
  strings,
  stepLabels,
}: Props) {
  const steps = registerSteps(requiresInvite);
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [step, setStep] = useState<RegisterStep>('identity');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState(false);
  const [handedOff, setHandedOff] = useState(false);
  const [refusal, setRefusal] = useState<{
    step: RegisterStep;
    field: 'name' | 'email' | 'invite' | null;
    title: string;
    body: string;
  } | null>(null);
  /** Set once the ceremony has left a session here: from then on the only thing left is the handoff. */
  const [signedIn, setSignedIn] = useState(false);

  // `strings` is a `Record<string, string>`, so `noUncheckedIndexedAccess` reads every lookup as
  // possibly missing — true for the by-path keys `describeAuthError` names, never for the fixed
  // labels the page always fills. A required prop like `TextField`'s `label` cannot take that
  // `undefined`, and AGENTS.md forbids a non-null assertion, so this is the one place that turns
  // it back into a plain `string`.
  const label = (key: string): string => strings[key] ?? '';

  /**
   * The two lines that explain most failed ceremonies before anything is clicked: WebAuthn needs a
   * secure context, and a browser without a platform authenticator cannot run it at all. Both look
   * like "the button does nothing" from the phone.
   */
  useEffect(() => {
    log('auth', 'the sign-in page is ready', {
      mode: initialMode,
      canRegister,
      requiresInvite,
      redirectScheme: redirectUri.split(':')[0],
      secureContext: window.isSecureContext,
      webauthn: typeof window.PublicKeyCredential !== 'undefined',
      origin: window.location.origin,
    });
  }, [initialMode, canRegister, requiresInvite, redirectUri]);

  const refuse = (code: string | undefined) => {
    const message = describeAuthError(code);
    const owner = stepForErrorCode(code, steps);
    setRefusal({
      step: owner,
      field: fieldForErrorCode(code),
      title: strings[message.titleKey] ?? strings['web.auth.genericError'] ?? '',
      body: strings[message.bodyKey] ?? '',
    });
    setStep(owner);
    setBusy(false);
  };

  // Changing step swaps the whole heading and its fields, which would leave the focus on a button
  // that no longer exists.
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const moved = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the step is the trigger, not a read.
  useEffect(() => {
    if (!moved.current) {
      moved.current = true;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  /** The ceremony left this browser holding a session; the app gets a one-time token instead. */
  const handOff = async () => {
    log('auth', 'the ceremony left a session here, minting the handoff token');
    setSignedIn(true);
    setBusy(true);
    const { data, error } = await authClient.oneTimeToken.generate();
    if (error !== null || data === null) {
      log('auth', 'the server would not mint a handoff token', {
        status: error?.status,
        message: error?.message,
      });
      // The ceremony succeeded: the account exists and this browser is signed in. Sending the person
      // back to «Crea passkey» would be a dead end, because that button can only answer `email_taken`
      // from here. The only thing missing is the token, so the only thing offered is minting it again.
      refuse('handoff_failed');
      return;
    }
    const url = new URL(redirectUri);
    url.searchParams.set('ott', data.token);
    url.searchParams.set('state', state);
    // The scheme only. The whole point of the token is that nothing but the app ever reads it, and a
    // console is somewhere it would be readable.
    log('auth', `handing back to ${url.protocol}//${url.host}${url.pathname}`);
    setHandedOff(true);
    window.location.href = url.toString();
  };

  const signIn = async () => {
    setRefusal(null);
    setBusy(true);
    log('auth', 'asking the browser for a passkey');
    const { error } = await authClient.signIn.passkey();
    if (error !== null) {
      const code = 'code' in error ? error.code : undefined;
      log('auth', 'the passkey ceremony failed', { status: error.status, code });
      refuse(typeof code === 'string' ? code : undefined);
      return;
    }
    await handOff();
  };

  const submitIdentity = () => {
    setRefusal(null);
    // Each refusal names the field it is about, so the alert and the marked field agree.
    if (name.trim().length === 0) {
      refuse('display_name_required');
      return;
    }
    if (!email.includes('@')) {
      refuse('email_required');
      return;
    }
    setStep(requiresInvite ? 'invite' : 'passkey');
  };

  const submitInvite = async () => {
    setRefusal(null);
    setBusy(true);
    const { error } = await authClient.$fetch<{ valid: boolean }>('/invite/check', {
      method: 'POST',
      body: { invite },
    });
    setBusy(false);
    if (error !== null) {
      const code = 'code' in error ? error.code : undefined;
      log('auth', 'the check endpoint did not accept the invite code', {
        status: error.status,
        code,
      });
      // Only the endpoint's own answer means «this code is wrong»; a rate limit or an unreachable
      // server says nothing about it, and `resolveUser` checks it again before the ceremony anyway.
      if (code === 'invalid_invite' || error.status === 403) {
        refuse('invalid_invite');
        return;
      }
    }
    setStep('passkey');
  };

  const createPasskey = async () => {
    setRefusal(null);
    setBusy(true);
    log('auth', 'creating a passkey for a new account', { withInvite: requiresInvite });
    const { error } = await authClient.passkey.addPasskey({
      context: registrationContextJson({
        name: name.trim(),
        email: email.trim(),
        invite: requiresInvite ? invite : null,
      }),
      createSession: true,
    });
    if (error !== null) {
      const code = 'code' in error ? error.code : undefined;
      log('auth', 'the server refused the registration', { status: error.status, code });
      refuse(typeof code === 'string' ? code : undefined);
      return;
    }
    await handOff();
  };

  if (handedOff) {
    return (
      <div className={styles.done}>
        <span className={styles.check}>
          <Icon name="check" size={26} />
        </span>
        <h1 className={styles.title}>{strings.doneTitle}</h1>
        <p className={styles.lede}>{strings.doneBody}</p>
      </div>
    );
  }

  const shown = refusal !== null && refusal.step === step ? refusal : null;

  if (mode === 'login') {
    return (
      <>
        <Brand instanceName={instance.name} />
        <h1 className={styles.title}>{strings.signInTitle}</h1>
        <p className={styles.lede}>{strings.signInBody}</p>
        {refusal === null ? null : <Alert title={refusal.title} body={refusal.body} />}
        {signedIn ? (
          <Button icon="key" busy={busy} busyLabel={strings.working} onClick={() => void handOff()}>
            {strings.retry}
          </Button>
        ) : (
          <Button icon="key" busy={busy} busyLabel={strings.working} onClick={() => void signIn()}>
            {strings.signIn}
          </Button>
        )}
        {canRegister ? (
          <>
            <div className={styles.or}>{strings.or ?? ''}</div>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setRefusal(null);
                setStep('identity');
                setMode('register');
              }}
            >
              {strings.createAccount}
            </Button>
          </>
        ) : null}
      </>
    );
  }

  const at = steps.indexOf(step) + 1;
  return (
    <>
      {at > 1 ? (
        <button
          type="button"
          className={stepsBackClass}
          onClick={() => {
            setRefusal(null);
            const previous = stepBefore(steps, step);
            if (previous === null) setMode('login');
            else setStep(previous);
          }}
        >
          <Icon name="chevL" size={14} />
          {strings.back}
        </button>
      ) : (
        <Brand instanceName={instance.name} />
      )}
      <Steps at={at} total={steps.length} label={stepLabels[at - 1] ?? ''} />

      {step === 'identity' ? (
        <>
          <h1 className={styles.title} ref={headingRef} tabIndex={-1}>
            {strings.registerTitle}
          </h1>
          <p className={styles.lede}>{strings.registerBody}</p>
          {shown === null ? null : <Alert title={shown.title} body={shown.body} />}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitIdentity();
            }}
          >
            <div className={styles.fields}>
              <TextField
                label={label('nameLabel')}
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                maxLength={80}
                invalid={shown?.field === 'name'}
              />
              <TextField
                label={label('emailLabel')}
                placeholder={strings.emailPlaceholder}
                hint={strings.emailHint}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                invalid={shown?.field === 'email'}
              />
            </div>
            <Button type="submit">{strings.continue}</Button>
          </form>
          <p className={styles.switchLine}>
            {strings.haveAccount}{' '}
            <button
              type="button"
              onClick={() => {
                setRefusal(null);
                setMode('login');
              }}
            >
              {strings.signInLink}
            </button>
          </p>
        </>
      ) : null}

      {step === 'invite' ? (
        <>
          <h1 className={styles.title} ref={headingRef} tabIndex={-1}>
            {strings.inviteTitle}
          </h1>
          <p className={styles.lede}>{strings.inviteBody}</p>
          {shown === null ? null : <Alert title={shown.title} body={shown.body} />}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submitInvite();
            }}
          >
            <TextField
              label={label('inviteLabel')}
              hint={strings.inviteHint}
              value={invite}
              onChange={(event) => setInvite(event.target.value.toUpperCase())}
              mono
              invalid={shown?.field === 'invite'}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={32}
            />
            <Button type="submit" busy={busy} busyLabel={strings.working}>
              {strings.continue}
            </Button>
          </form>
        </>
      ) : null}

      {step === 'passkey' ? (
        <>
          <span className={styles.passkeyArt}>
            <Icon name="key" size={32} />
          </span>
          <h1 className={styles.title} ref={headingRef} tabIndex={-1}>
            {strings.passkeyTitle}
          </h1>
          <p className={styles.lede}>{strings.passkeyBody}</p>
          {shown === null ? null : <Alert title={shown.title} body={shown.body} />}
          <Button
            icon="key"
            busy={busy}
            busyLabel={strings.working}
            onClick={() => (signedIn ? void handOff() : void createPasskey())}
          >
            {signedIn ? strings.retry : strings.passkeyButton}
          </Button>
          {signedIn ? null : (
            <p className={`${styles.hint} ${styles.centred}`}>{strings.passkeyPhoneHint}</p>
          )}
        </>
      ) : null}
    </>
  );
}
