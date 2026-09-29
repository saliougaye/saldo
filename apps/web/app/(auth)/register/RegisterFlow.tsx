'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { authClient } from '../../../src/client/authClient';
import { log } from '../../../src/client/log';
import { describeAuthError, fieldForErrorCode } from '../../../src/features/auth/authErrors';
import { rememberPasskey } from '../../../src/features/auth/lastPasskey';
import {
  type RegisterStep,
  registerSteps,
  stepBefore,
  stepForErrorCode,
} from '../../../src/features/auth/registerSteps';
import { registrationContextJson } from '../../../src/features/auth/registrationBody';
import type { InstanceInfo } from '../../../src/server/instance';
import { Alert } from '../../../src/ui/Alert';
import { AuthFooter, Brand } from '../../../src/ui/Brand';
import { Button } from '../../../src/ui/Button';
import { Icon } from '../../../src/ui/Icon';
import { Steps, stepsBackClass } from '../../../src/ui/Steps';
import { TextField } from '../../../src/ui/TextField';
import styles from '../auth.module.css';

/** Every string this flow can show, resolved by the page. Keys that name an i18n path are the ones
 * `describeAuthError` answers with. */
export type RegisterStrings = Record<string, string>;

interface Props {
  requiresInvite: boolean;
  initialInvite: string;
  instance: InstanceInfo;
  strings: RegisterStrings;
  stepLabels: string[];
}

/** An error, the step it belongs in, and the field it is about. */
interface Refusal {
  step: RegisterStep;
  field: 'name' | 'email' | 'invite' | null;
  title: string;
  body: string;
}

export function RegisterFlow({
  requiresInvite,
  initialInvite,
  instance,
  strings,
  stepLabels,
}: Props) {
  const router = useRouter();
  const steps = registerSteps(requiresInvite);
  const [step, setStep] = useState<RegisterStep>('identity');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [invite, setInvite] = useState(initialInvite);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);

  // `strings` is a `Record<string, string>`, so `noUncheckedIndexedAccess` reads every lookup as
  // possibly missing — true for the by-path keys `describeAuthError` names, never for the fixed
  // labels the page always fills. A required prop like `TextField`'s `label` cannot take that
  // `undefined`, and AGENTS.md forbids a non-null assertion, so this is the one place that turns
  // it back into a plain `string` — the empty fallback only shows if the page's `strings` prop is
  // incomplete, which `registrationBody.test.ts`'s sibling in `authErrors`/`registerSteps` cannot
  // catch because it is a prop shape, not a translation.
  const label = (key: string): string => strings[key] ?? '';

  const at = steps.indexOf(step) + 1;
  const shown = refusal !== null && refusal.step === step ? refusal : null;
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
  };

  // Changing step swaps the whole heading and its fields: without this the focus is left on a button
  // that no longer exists, which drops it to the document and announces nothing.
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

  /** Step 1 → 2 (or straight to the ceremony when the server asks for no code). */
  const submitIdentity = () => {
    setRefusal(null);
    // The server validates both too (`resolveRegistration`); this is so the person is not sent to the
    // next screen only to be turned back — and each refusal names the field it is about.
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

  /**
   * Step 2. §17.1.7: the code is checked **here**, before the ceremony, so nobody puts a finger on a
   * sensor to be told afterwards that it was wrong. The check is a convenience — `resolveUser` checks
   * again and the registration is what spends the code.
   */
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
      // Only the endpoint's own answer means «this code is wrong». A rate limit, a 500 or a browser
      // that could not reach the server say nothing about the code, and refusing here would trap
      // somebody holding a valid one on a step with no way out. `resolveUser` checks it again before
      // the ceremony, so letting them through costs nothing: the gate is there, not here.
      if (code === 'invalid_invite' || error.status === 403) {
        refuse('invalid_invite');
        return;
      }
    }
    setStep('passkey');
  };

  /** Step 3: the ceremony. `createSession: true` leaves this browser signed in. */
  const createPasskey = async () => {
    setRefusal(null);
    setBusy(true);
    const result = await authClient.passkey.addPasskey({
      context: registrationContextJson({
        name: name.trim(),
        email: email.trim(),
        invite: requiresInvite ? invite : null,
      }),
      createSession: true,
      returnWebAuthnResponse: true,
    });
    if (result.error !== null || result.data === null) {
      const failure = result.error;
      const code = failure === null ? undefined : 'code' in failure ? failure.code : undefined;
      log('auth', 'the server refused the registration', { status: failure?.status, code });
      setBusy(false);
      refuse(typeof code === 'string' ? code : undefined);
      return;
    }
    const credentialId = 'webauthn' in result ? result.webauthn?.response.id : undefined;
    if (credentialId !== undefined) rememberPasskey(credentialId);
    router.replace('/home');
  };

  return (
    <>
      {at > 1 ? (
        <button
          type="button"
          className={stepsBackClass}
          onClick={() => {
            setRefusal(null);
            const previous = stepBefore(steps, step);
            if (previous !== null) setStep(previous);
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
          {/* A form, so Enter in either field is «Continua» — the browser's own behaviour. */}
          <form
            className={styles.form}
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
            {strings.haveAccount} <a href="/login">{strings.signInLink}</a>
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
            className={styles.form}
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
            onClick={() => void createPasskey()}
          >
            {strings.passkeyButton}
          </Button>
          <p className={`${styles.hint} ${styles.centred}`}>{strings.passkeyPhoneHint}</p>
        </>
      ) : null}

      <AuthFooter version={instance.version} host={instance.host} />
    </>
  );
}
