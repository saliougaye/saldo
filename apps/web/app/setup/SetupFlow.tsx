'use client';

import { interpolate } from '@saldo/i18n/translate';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { authClient } from '../../src/client/authClient';
import { log } from '../../src/client/log';
import { describeAuthError, fieldForErrorCode } from '../../src/features/auth/authErrors';
import { rememberPasskey } from '../../src/features/auth/lastPasskey';
import { registrationContextJson } from '../../src/features/auth/registrationBody';
import type { RegistrationMode } from '../../src/server/env';
import type { InstanceInfo } from '../../src/server/instance';
import type { SetupMailStatus } from '../../src/server/setup/state';
import { Alert } from '../../src/ui/Alert';
import { AuthFooter, Brand } from '../../src/ui/Brand';
import { Button } from '../../src/ui/Button';
import { Icon } from '../../src/ui/Icon';
import { type ListOption, OptionList } from '../../src/ui/OptionList';
import { Steps, stepsBackClass } from '../../src/ui/Steps';
import { TextField } from '../../src/ui/TextField';
import authStyles from '../(auth)/auth.module.css';
import { type FirstInviteResult, mintFirstInviteAction, saveSetupServerAction } from './actions';
import styles from './setup.module.css';

/** Benvenuto, Il tuo server, Il tuo account, Pronto. `Steps` counts only the middle two. */
type Step = 0 | 1 | 2 | 3;

/** `instanceNameRowSchema`'s limit, checked here so the person is told before the round trip. */
const MAX_NAME_LENGTH = 60;
const COPIED_MS = 2000;

interface Props {
  locale: string;
  instance: InstanceInfo;
  initialName: string;
  nameLocked: boolean;
  initialMode: RegistrationMode;
  modeLocked: boolean;
  modeChoices: readonly ListOption<RegistrationMode>[];
  /** «Impostati da REGISTRATION, INSTANCE_NAME», or null when nothing is locked. */
  lockedNote: string | null;
  mail: SetupMailStatus;
  smtpSettingsHref: string;
  /** Every string this flow can show, resolved by the page. Keys that name an i18n path are the
   * ones `describeAuthError` answers with. */
  strings: Record<string, string>;
  /** «Passo 1 di 2», «Passo 2 di 2». */
  stepLabels: string[];
}

/** An error, the step it belongs in, and the field it is about. */
interface Refusal {
  step: Step;
  field: 'name' | 'email' | 'displayName' | null;
  title: string;
  body: string;
}

type Minted = Extract<FirstInviteResult, { ok: true }>;

export function SetupFlow(props: Props) {
  const {
    locale,
    instance,
    initialName,
    nameLocked,
    initialMode,
    modeLocked,
    modeChoices,
    lockedNote,
    mail,
    smtpSettingsHref,
    strings,
    stepLabels,
  } = props;
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState(initialName);
  const [mode, setMode] = useState<RegistrationMode>(initialMode);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [inviteLabel, setInviteLabel] = useState('');
  const [minted, setMinted] = useState<Minted | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  // See RegisterFlow: `strings` is a Record, so fixed labels are read back as plain strings here.
  const label = (key: string): string => strings[key] ?? '';

  // The instance name the person is typing, or the resolved one when it is locked or empty.
  const shownInstanceName = nameLocked || name.trim() === '' ? instance.name : name.trim();
  const modeLabel = modeChoices.find((choice) => choice.value === mode)?.label ?? mode;

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
    window.scrollTo({ top: 0 });
  }, [step]);

  const shown = refusal !== null && refusal.step === step ? refusal : null;

  const go = (next: Step) => {
    setRefusal(null);
    setStep(next);
  };

  /** Step 2 → 3: save the server step, then move on. A locked value is skipped by the server. */
  const submitServer = () => {
    if (pending) return;
    if (!nameLocked && name.trim().length > MAX_NAME_LENGTH) {
      setRefusal({
        step: 1,
        field: 'name',
        title: label('errorInvalid'),
        body: label('nameTooLong'),
      });
      return;
    }
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof saveSetupServerAction>>;
      try {
        result = await saveSetupServerAction({ name: name.trim(), mode });
      } catch {
        setRefusal({ step: 1, field: null, title: label('errorUnexpected'), body: '' });
        return;
      }
      if (result.ok) {
        go(2);
        return;
      }
      if (result.error === 'alreadySetUp') {
        // Somebody finished the wizard in another tab or on the phone: the door is `/login` now.
        router.replace('/login');
        return;
      }
      setRefusal({ step: 1, field: null, title: label('errorInvalid'), body: '' });
    });
  };

  const refuseCeremony = (code: string | undefined) => {
    const message = describeAuthError(code);
    const field = fieldForErrorCode(code);
    setRefusal({
      step: 2,
      field: field === 'name' ? 'displayName' : field === 'email' ? 'email' : null,
      title: strings[message.titleKey] ?? label('web.auth.genericError'),
      body: strings[message.bodyKey] ?? '',
    });
  };

  /** Step 3: the ceremony — the same call as `/register`, with no invite: the first account needs none. */
  const createAccount = async () => {
    setRefusal(null);
    if (displayName.trim().length === 0) {
      refuseCeremony('display_name_required');
      return;
    }
    if (!email.includes('@')) {
      refuseCeremony('email_required');
      return;
    }
    setBusy(true);
    const result = await authClient.passkey.addPasskey({
      context: registrationContextJson({
        name: displayName.trim(),
        email: email.trim(),
        invite: null,
      }),
      createSession: true,
      returnWebAuthnResponse: true,
    });
    setBusy(false);
    if (result.error !== null || result.data === null) {
      const failure = result.error;
      const code = failure === null ? undefined : 'code' in failure ? failure.code : undefined;
      log('auth', 'the server refused the first registration', { status: failure?.status, code });
      refuseCeremony(typeof code === 'string' ? code : undefined);
      return;
    }
    const credentialId = 'webauthn' in result ? result.webauthn?.response.id : undefined;
    if (credentialId !== undefined) rememberPasskey(credentialId);
    go(3);
  };

  const mint = () => {
    if (pending) return;
    startTransition(async () => {
      let result: FirstInviteResult;
      try {
        result = await mintFirstInviteAction({ label: inviteLabel.trim() });
      } catch {
        setRefusal({ step: 3, field: null, title: label('errorUnexpected'), body: '' });
        return;
      }
      if (!result.ok) {
        setRefusal({ step: 3, field: null, title: label('errorInvalid'), body: '' });
        return;
      }
      setRefusal(null);
      setMinted(result);
    });
  };

  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  const expiresOn = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(iso));

  const alert = shown === null ? null : <Alert title={shown.title} body={shown.body} />;

  return (
    <>
      {step === 0 ? <Brand instanceName={nameLocked ? instance.name : undefined} /> : null}
      {step === 1 || step === 2 ? (
        <>
          <button type="button" className={stepsBackClass} onClick={() => go(step === 1 ? 0 : 1)}>
            <Icon name="chevL" size={14} />
            {label('back')}
          </button>
          <Steps at={step} total={2} label={stepLabels[step - 1] ?? ''} />
        </>
      ) : null}

      {step === 0 ? (
        <>
          <span className={authStyles.passkeyArt}>
            <Icon name="server" size={32} />
          </span>
          <h1 className={authStyles.title} ref={headingRef} tabIndex={-1}>
            {label('welcomeTitle')}
          </h1>
          <p className={authStyles.lede}>{label('welcomeBody')}</p>
          <dl className={styles.summary}>
            <div className={styles.summaryRow}>
              <dt>{label('version')}</dt>
              <dd>{instance.version}</dd>
            </div>
            <div className={styles.summaryRow}>
              <dt>{label('database')}</dt>
              <dd>
                <span className={styles.dot} aria-hidden="true" />
                {label('databaseOk')}
              </dd>
            </div>
            <div className={styles.summaryRow}>
              <dt>{label('accounts')}</dt>
              <dd>{label('accountsNone')}</dd>
            </div>
          </dl>
          <Button onClick={() => go(1)}>{label('start')}</Button>
          <p className={`${authStyles.hint} ${authStyles.centred}`}>{label('welcomeHint')}</p>
          <AuthFooter version={instance.version} host={instance.host} />
        </>
      ) : null}

      {step === 1 ? (
        <>
          <h1 className={authStyles.title} ref={headingRef} tabIndex={-1}>
            {label('serverTitle')}
          </h1>
          <p className={authStyles.lede}>{label('serverBody')}</p>
          {alert}
          <form
            className={authStyles.form}
            onSubmit={(event) => {
              event.preventDefault();
              submitServer();
            }}
          >
            <div className={authStyles.fields}>
              <TextField
                label={label('nameLabel')}
                placeholder={label('namePlaceholder')}
                value={nameLocked ? instance.name : name}
                onChange={(event) => setName(event.target.value)}
                disabled={nameLocked}
                maxLength={MAX_NAME_LENGTH}
                autoComplete="organization"
                invalid={shown?.field === 'name'}
              />
              {/* `OptionList` names the group for assistive tech only; this is the visible label. */}
              <div className={styles.group}>
                <span className={styles.groupLabel}>{label('registrationLabel')}</span>
                <OptionList
                  label={label('registrationLabel')}
                  groups={[{ options: modeChoices }]}
                  selected={mode}
                  onSelect={setMode}
                  disabled={modeLocked}
                />
              </div>
              {lockedNote === null ? null : (
                <p className={styles.lockNote}>
                  <Icon name="shield" size={13} />
                  <span>{lockedNote}</span>
                </p>
              )}
            </div>
            <Button type="submit" busy={pending} busyLabel={label('working')}>
              {label('continue')}
            </Button>
          </form>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <span className={authStyles.passkeyArt}>
            <Icon name="key" size={32} />
          </span>
          <h1 className={authStyles.title} ref={headingRef} tabIndex={-1}>
            {label('accountTitle')}
          </h1>
          <p className={authStyles.lede}>
            {interpolate(label('accountBody'), { instance: shownInstanceName })}
          </p>
          {alert}
          <form
            className={authStyles.form}
            onSubmit={(event) => {
              event.preventDefault();
              void createAccount();
            }}
          >
            <div className={authStyles.fields}>
              <TextField
                label={label('yourNameLabel')}
                placeholder={label('yourNamePlaceholder')}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                autoComplete="given-name"
                maxLength={80}
                invalid={shown?.field === 'displayName'}
              />
              <TextField
                label={label('emailLabel')}
                placeholder={label('emailPlaceholder')}
                hint={label('emailHint')}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                invalid={shown?.field === 'email'}
              />
            </div>
            <Button type="submit" icon="key" busy={busy} busyLabel={label('waiting')}>
              {label('createButton')}
            </Button>
          </form>
          <p className={`${authStyles.hint} ${authStyles.centred}`}>{label('passkeyHint')}</p>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <div className={authStyles.done}>
            <span className={authStyles.check}>
              <Icon name="check" size={26} />
            </span>
            <h1 className={authStyles.title} ref={headingRef} tabIndex={-1}>
              {label('doneTitle')}
            </h1>
            <p className={authStyles.lede}>
              {interpolate(label('doneBody'), {
                name: displayName.trim(),
                instance: shownInstanceName,
              })}
            </p>
          </div>
          <dl className={styles.summary}>
            <div className={styles.summaryRow}>
              <dt>{label('summaryInstance')}</dt>
              <dd>{shownInstanceName}</dd>
            </div>
            <div className={styles.summaryRow}>
              <dt>{label('summaryRegistration')}</dt>
              <dd>{modeLabel}</dd>
            </div>
            <div className={styles.summaryRow}>
              <dt>{label('summaryEmail')}</dt>
              <dd>
                {mail === 'none' ? (
                  <>
                    {label('emailStatus')} ·{' '}
                    <a href={smtpSettingsHref}>{label('emailConfigure')}</a>
                  </>
                ) : (
                  <>
                    <span className={styles.dot} aria-hidden="true" />
                    {label('emailStatus')}
                  </>
                )}
              </dd>
            </div>
          </dl>
          {mode === 'invite' && minted === null ? (
            <form
              className={styles.invite}
              onSubmit={(event) => {
                event.preventDefault();
                mint();
              }}
            >
              <h2 className={styles.inviteTitle}>
                {label('inviteTitle')} <small>· {label('optional')}</small>
              </h2>
              {alert}
              <TextField
                label={label('inviteFor')}
                placeholder={label('inviteForPlaceholder')}
                value={inviteLabel}
                onChange={(event) => setInviteLabel(event.target.value)}
                maxLength={80}
                autoComplete="off"
              />
              <Button type="submit" variant="secondary" busy={pending} busyLabel={label('working')}>
                {label('inviteCreate')}
              </Button>
            </form>
          ) : null}
          {mode === 'invite' && minted !== null ? (
            <div className={styles.invite}>
              <h2 className={styles.inviteTitle}>{label('inviteCreated')}</h2>
              <p className={styles.code}>{minted.code}</p>
              <div className={styles.group}>
                <span className={styles.groupLabel}>{label('inviteLink')}</span>
                <div className={styles.linkBox}>{minted.link}</div>
              </div>
              <Button variant="secondary" onClick={() => void copyLink(minted.link)}>
                {copied ? label('copied') : label('copyLink')}
              </Button>
              <p className={authStyles.hint}>
                {interpolate(label('inviteOnce'), { date: expiresOn(minted.expiresAt) })}
              </p>
            </div>
          ) : null}
          <Button
            onClick={() => {
              router.replace('/home');
              router.refresh();
            }}
          >
            {label('go')}
          </Button>
        </>
      ) : null}
    </>
  );
}
