'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '../../../src/client/authClient';
import { log } from '../../../src/client/log';
import { describeAuthError } from '../../../src/features/auth/authErrors';
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

/** An error, and the step it belongs in. */
interface Refusal {
  step: RegisterStep;
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
    setRefusal({
      step: stepForErrorCode(code, steps),
      title: strings[message.titleKey] ?? strings['web.auth.genericError'] ?? '',
      body: strings[message.bodyKey] ?? '',
    });
    setStep(stepForErrorCode(code, steps));
  };

  /** Step 1 → 2 (or straight to the ceremony when the server asks for no code). */
  const submitIdentity = () => {
    setRefusal(null);
    // The server validates it too (`normaliseEmail`); this is so the person is not sent to the next
    // screen only to be turned back.
    if (name.trim().length === 0 || !email.includes('@')) {
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
      log('auth', 'the invite code was refused before the ceremony', { status: error.status });
      refuse('invalid_invite');
      return;
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
          <h1 className={styles.title}>{strings.registerTitle}</h1>
          <p className={styles.lede}>{strings.registerBody}</p>
          {shown === null ? null : <Alert title={shown.title} body={shown.body} />}
          <div className={styles.fields}>
            <TextField
              label={label('nameLabel')}
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              maxLength={80}
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
              invalid={shown !== null}
            />
          </div>
          <Button onClick={submitIdentity}>{strings.continue}</Button>
          <p className={styles.switchLine}>
            {strings.haveAccount} <a href="/login">{strings.signInLink}</a>
          </p>
        </>
      ) : null}

      {step === 'invite' ? (
        <>
          <h1 className={styles.title}>{strings.inviteTitle}</h1>
          <p className={styles.lede}>{strings.inviteBody}</p>
          {shown === null ? null : <Alert title={shown.title} body={shown.body} />}
          <TextField
            label={label('inviteLabel')}
            hint={strings.inviteHint}
            value={invite}
            onChange={(event) => setInvite(event.target.value.toUpperCase())}
            mono
            invalid={shown !== null}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={32}
          />
          <Button busy={busy} busyLabel={strings.working} onClick={() => void submitInvite()}>
            {strings.continue}
          </Button>
        </>
      ) : null}

      {step === 'passkey' ? (
        <>
          <span className={styles.passkeyArt}>
            <Icon name="key" size={32} />
          </span>
          <h1 className={styles.title}>{strings.passkeyTitle}</h1>
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
