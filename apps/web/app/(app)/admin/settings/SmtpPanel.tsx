'use client';

import { interpolate } from '@saldo/i18n/translate';
import { useRouter } from 'next/navigation';
import { type FormEvent, type KeyboardEvent, useState, useTransition } from 'react';
import type { SettingsErrorStrings } from '../../../../src/features/admin/errorStrings';
import { DEFAULT_SMTP_PORT } from '../../../../src/features/admin/settingsView';
import { Alert } from '../../../../src/ui/Alert';
import { Button } from '../../../../src/ui/Button';
import { ConfirmDialog } from '../../../../src/ui/ConfirmDialog';
import { FormFoot } from '../../../../src/ui/FormFoot';
import { TextField } from '../../../../src/ui/TextField';
import styles from '../admin.module.css';
import { removeSmtpAction, saveSmtpAction, sendTestEmailAction } from './actions';

interface Props {
  /** The stored (or the environment's) configuration as strings for the fields; blank when there is none. */
  initial: { host: string; port: string; user: string; from: string };
  /**
   * What the page knows about the password — never the password: `set` (there is one and it still
   * reads), `unreadable` (there is one the current key cannot open), `none`.
   */
  password: 'set' | 'unreadable' | 'none';
  /** The test email has something to send with: a stored row, or the environment's group. */
  configured: boolean;
  /** A stored row exists, so «Rimuovi configurazione» has something to remove. */
  hasRow: boolean;
  /** `SMTP_HOST` sets the group: the fields show, disabled; only the test email is offered. */
  locked: boolean;
  closeHref: string;
  strings: {
    host: string;
    port: string;
    user: string;
    password: string;
    passwordSet: string;
    replace: string;
    passwordHint: string;
    passwordUnreadable: string;
    from: string;
    test: string;
    testSaveFirst: string;
    remove: string;
    removeTitle: string;
    removeBody: string;
    removeConfirm: string;
    saved: string;
    cancel: string;
    save: string;
    busy: string;
    keyboardHint: string;
    /** `Email di prova inviata a {{email}}.` */
    testSent: string;
    testSyntheticEmail: string;
    testNotConfigured: string;
    /** `Invio non riuscito: {{detail}}` */
    testFailed: string;
    testFailedNoDetail: string;
    errors: SettingsErrorStrings;
  };
}

type TestOutcome = { ok: true; text: string } | { ok: false; text: string };

/**
 * «Email (SMTP)». The stored password never reaches this component: it learns only whether there
 * is one. «Sostituisci» reveals an empty field; left empty, the password is kept — which the server
 * allows only while host and user are unchanged.
 */
export function SmtpPanel({
  initial,
  password,
  configured,
  hasRow,
  locked,
  closeHref,
  strings,
}: Props) {
  const router = useRouter();
  const [host, setHost] = useState(initial.host);
  const [port, setPort] = useState(initial.port);
  const [user, setUser] = useState(initial.user);
  const [from, setFrom] = useState(initial.from);
  const [secret, setSecret] = useState('');
  // The field is hidden behind «impostata» while a readable password is kept.
  const [replacing, setReplacing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [outcome, setOutcome] = useState<TestOutcome | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [testing, startTesting] = useTransition();
  const [removePending, startRemoving] = useTransition();

  const showField = !locked && (password !== 'set' || replacing);
  const dirty =
    host !== initial.host ||
    port !== initial.port ||
    user !== initial.user ||
    from !== initial.from ||
    secret !== '';
  const canTest = configured && !dirty;

  const touch = () => {
    setProblem(null);
    setSaved(false);
    setOutcome(null);
  };

  const submit = () => {
    if (pending || locked) return;
    // Typed: replace. Empty: keep — except that with no user there is nothing to sign in as, so
    // the password goes too (the server refuses one without the other).
    const passwordInput = secret !== '' ? secret : user.trim() === '' ? null : undefined;
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof saveSmtpAction>>;
      try {
        result = await saveSmtpAction({ host, port, user, from, password: passwordInput });
      } catch {
        setProblem(strings.errors.unexpected);
        return;
      }
      if (result.ok) {
        setProblem(null);
        setSaved(true);
        setOutcome(null);
        // What the server stored is trimmed: show it as it is, so the form is not «changed».
        setHost(host.trim());
        setPort(port.trim());
        setUser(user.trim());
        setFrom(from.trim());
        setSecret('');
        setReplacing(false);
        router.refresh();
        return;
      }
      setSaved(false);
      setProblem(strings.errors[result.error]);
      if (result.error === 'passwordRequired') setReplacing(true);
    });
  };

  const sendTest = () => {
    if (testing || !canTest) return;
    setSaved(false);
    setOutcome(null);
    startTesting(async () => {
      let result: Awaited<ReturnType<typeof sendTestEmailAction>>;
      try {
        result = await sendTestEmailAction();
      } catch {
        setOutcome({ ok: false, text: strings.errors.unexpected });
        return;
      }
      if (result.ok) {
        setOutcome({ ok: true, text: interpolate(strings.testSent, { email: result.to }) });
      } else if (result.error === 'failed') {
        setOutcome({
          ok: false,
          text:
            result.detail === ''
              ? strings.testFailedNoDetail
              : interpolate(strings.testFailed, { detail: result.detail }),
        });
      } else {
        setOutcome({
          ok: false,
          text:
            result.error === 'syntheticEmail'
              ? strings.testSyntheticEmail
              : strings.testNotConfigured,
        });
      }
    });
  };

  const remove = () => {
    if (removePending) return;
    startRemoving(async () => {
      let result: Awaited<ReturnType<typeof removeSmtpAction>>;
      try {
        result = await removeSmtpAction();
      } catch {
        setRemoveError(strings.errors.unexpected);
        return;
      }
      if (result.ok) {
        setRemoving(false);
        setHost('');
        setPort(String(DEFAULT_SMTP_PORT));
        setUser('');
        setFrom('');
        setSecret('');
        setReplacing(false);
        setSaved(false);
        setProblem(null);
        setOutcome(null);
        router.refresh();
        return;
      }
      setRemoveError(strings.errors[result.error]);
    });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
      return;
    }
    if (event.key === 'Escape' && event.target instanceof HTMLInputElement) event.target.blur();
  };

  const field = (set: (value: string) => void) => (event: { target: { value: string } }) => {
    set(event.target.value);
    touch();
  };

  const testButton = (
    <Button
      variant="secondary"
      disabled={!canTest}
      busy={testing}
      busyLabel={strings.busy}
      onClick={sendTest}
    >
      {canTest ? strings.test : strings.testSaveFirst}
    </Button>
  );

  return (
    <>
      <form
        className={styles.form}
        onSubmit={onSubmit}
        onKeyDown={onKeyDown}
        noValidate
        data-owns-keys=""
      >
        <div className={styles.twoCols}>
          <TextField
            label={strings.host}
            value={host}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            disabled={locked}
            autoFocus={!locked && !hasRow}
            onChange={field(setHost)}
          />
          <TextField
            label={strings.port}
            value={port}
            inputMode="numeric"
            autoComplete="off"
            disabled={locked}
            onChange={field(setPort)}
          />
        </div>
        <TextField
          label={strings.user}
          value={user}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          disabled={locked}
          onChange={field(setUser)}
        />
        {showField || (locked && password === 'none') ? (
          <TextField
            label={strings.password}
            type="password"
            autoComplete="new-password"
            autoCapitalize="off"
            spellCheck={false}
            value={secret}
            hint={
              locked
                ? undefined
                : password === 'unreadable'
                  ? strings.passwordUnreadable
                  : strings.passwordHint
            }
            disabled={locked}
            autoFocus={replacing}
            onChange={field(setSecret)}
          />
        ) : (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>{strings.password}</span>
            <div className={styles.secretRow}>
              <span className={styles.secret}>
                <span className={styles.dotOk} aria-hidden="true" />
                {strings.passwordSet}
              </span>
              {locked ? null : (
                <Button variant="secondary" onClick={() => setReplacing(true)}>
                  {strings.replace}
                </Button>
              )}
            </div>
            {locked ? null : <span className={styles.status}>{strings.passwordHint}</span>}
          </div>
        )}
        <TextField
          label={strings.from}
          value={from}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          disabled={locked}
          onChange={field(setFrom)}
        />
        {problem === null ? null : <Alert body={problem} />}
        {saved ? (
          <p className={styles.status} role="status">
            {strings.saved}
          </p>
        ) : null}
        <div>{testButton}</div>
        {outcome === null ? null : outcome.ok ? (
          <p className={styles.status} role="status">
            {outcome.text}
          </p>
        ) : (
          <Alert body={outcome.text} />
        )}
        {locked ? null : (
          <FormFoot
            hint={strings.keyboardHint}
            cancelHref={closeHref}
            cancelLabel={strings.cancel}
            submitLabel={strings.save}
            busyLabel={strings.busy}
            pending={pending}
          />
        )}
      </form>
      {hasRow && !locked ? (
        <div className={styles.danger}>
          <Button
            variant="secondary"
            icon="trash"
            onClick={() => {
              setRemoveError(null);
              setRemoving(true);
            }}
          >
            {strings.remove}
          </Button>
        </div>
      ) : null}
      <ConfirmDialog
        open={removing}
        onOpenChange={(next) => {
          if (removePending) return;
          setRemoving(next);
        }}
        title={strings.removeTitle}
        body={strings.removeBody}
        error={removeError ?? undefined}
        confirmLabel={strings.removeConfirm}
        cancelLabel={strings.cancel}
        busy={removePending}
        busyLabel={strings.busy}
        onConfirm={remove}
      />
    </>
  );
}
