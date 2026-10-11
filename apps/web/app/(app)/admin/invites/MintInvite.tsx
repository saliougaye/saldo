'use client';

import { interpolate } from '@saldo/i18n/translate';
import { useRouter } from 'next/navigation';
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react';
import type { AdminErrorStrings } from '../../../../src/features/admin/errorStrings';
import type { MintActionResult } from '../../../../src/server/admin/invites';
import { Alert } from '../../../../src/ui/Alert';
import { Button } from '../../../../src/ui/Button';
import { FormFoot } from '../../../../src/ui/FormFoot';
import { Segmented } from '../../../../src/ui/Segmented';
import { TextField } from '../../../../src/ui/TextField';
import { VisuallyHidden } from '../../../../src/ui/VisuallyHidden';
import styles from '../admin.module.css';
import { mintInviteAction } from './actions';

interface Props {
  closeHref: string;
  doneHref: string;
  maxLabelLength: number;
  /** The four lifetimes, as the server accepts them; `value` is the number of days. */
  ttlOptions: readonly { value: string; label: string }[];
  defaultTtl: string;
  strings: {
    newTitle: string;
    label: string;
    labelHint: string;
    ttl: string;
    create: string;
    cancel: string;
    busy: string;
    keyboardHint: string;
    /** `Invito per «{{label}}»`. */
    mintedTitle: string;
    copyNow: string;
    copyNowBody: string;
    copyCode: string;
    copyLink: string;
    copied: string;
    qrLabel: string;
    qrCaption: string;
    /** `Scade il {{date}}`. */
    expiresOn: string;
    done: string;
    errors: AdminErrorStrings;
  };
}

type Minted = Extract<MintActionResult, { ok: true }>;

const QUIET_ZONE = 4;
const COPIED_MS = 2000;

/**
 * «Nuovo invito»: the form, then — in this component's state and nowhere else — the code, shown
 * once. It is never written to the URL, a cookie or web storage; leaving any way but «Fatto» loses it.
 */
export function MintInvite(props: Props) {
  const { closeHref, doneHref, maxLabelLength, ttlOptions, defaultTtl, strings } = props;
  const router = useRouter();
  const [label, setLabel] = useState('');
  const [ttl, setTtl] = useState(defaultTtl);
  const [minted, setMinted] = useState<{ label: string; invite: Minted } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const submit = () => {
    if (pending) return;
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof mintInviteAction>>;
      try {
        result = await mintInviteAction({ label, ttlDays: Number(ttl) });
      } catch {
        setProblem(strings.errors.unexpected);
        return;
      }
      if (result.ok) {
        setProblem(null);
        setMinted({ label: label.trim(), invite: result });
        // The list behind the panel shows the new invite now: ✕ and Esc close in place, with no
        // request. The code stays in this component's state; the refresh keeps it mounted.
        router.refresh();
        return;
      }
      setProblem(strings.errors[result.error]);
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

  const copy = async (which: 'code' | 'link', text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    setCopied(which);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), COPIED_MS);
  };

  if (minted === null) {
    return (
      <form
        className={styles.form}
        onSubmit={onSubmit}
        onKeyDown={onKeyDown}
        noValidate
        data-owns-keys=""
      >
        <TextField
          label={strings.label}
          hint={strings.labelHint}
          value={label}
          maxLength={maxLabelLength}
          autoComplete="off"
          autoFocus
          onChange={(event) => {
            setLabel(event.target.value);
            setProblem(null);
          }}
        />
        <Segmented label={strings.ttl} value={ttl} options={ttlOptions} onChange={setTtl} />
        {problem === null ? null : <Alert body={problem} />}
        <FormFoot
          hint={strings.keyboardHint}
          cancelHref={closeHref}
          cancelLabel={strings.cancel}
          submitLabel={strings.create}
          busyLabel={strings.busy}
          pending={pending}
        />
      </form>
    );
  }

  const { invite } = minted;
  const box = invite.qr.size + QUIET_ZONE * 2;
  return (
    <div className={styles.minted}>
      <h3 className={styles.mintedTitle}>
        {minted.label === ''
          ? strings.newTitle
          : interpolate(strings.mintedTitle, { label: minted.label })}
      </h3>
      <Alert title={strings.copyNow} body={strings.copyNowBody} />
      <p className={styles.code}>{invite.code}</p>
      <div className={styles.copyRow}>
        <div className={styles.linkBox}>{invite.link}</div>
        <Button variant="secondary" onClick={() => copy('link', invite.link)}>
          {copied === 'link' ? strings.copied : strings.copyLink}
        </Button>
      </div>
      <div className={styles.copyRow}>
        <Button variant="secondary" onClick={() => copy('code', invite.code)}>
          {copied === 'code' ? strings.copied : strings.copyCode}
        </Button>
      </div>
      <VisuallyHidden>
        <span role="status">{copied === null ? '' : strings.copied}</span>
      </VisuallyHidden>
      <svg
        className={styles.qr}
        viewBox={`0 0 ${box} ${box}`}
        role="img"
        aria-label={strings.qrLabel}
        shapeRendering="crispEdges"
      >
        <rect className={styles.qrLight} width={box} height={box} />
        <path
          className={styles.qrDark}
          transform={`translate(${QUIET_ZONE} ${QUIET_ZONE})`}
          d={invite.qr.path}
        />
      </svg>
      <p className={styles.caption}>
        {strings.qrCaption} {interpolate(strings.expiresOn, { date: invite.expiresOn })}.
      </p>
      <Button
        onClick={() => {
          router.replace(doneHref);
          router.refresh();
        }}
      >
        {strings.done}
      </Button>
    </div>
  );
}
