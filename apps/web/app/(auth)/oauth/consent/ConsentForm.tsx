'use client';

import type { ToolScope } from '@saldo/core';
import { useState, useTransition } from 'react';
import {
  authorizeReadOnly,
  chosenScopes,
  offersWrite,
} from '../../../../src/features/consent/consentView';
import { Alert } from '../../../../src/ui/Alert';
import { Button } from '../../../../src/ui/Button';
import { Icon } from '../../../../src/ui/Icon';
import { SignOutButton } from '../../../../src/ui/SignOutButton';
import { VisuallyHidden } from '../../../../src/ui/VisuallyHidden';
import authStyles from '../../auth.module.css';
import { type ConsentActionResult, submitConsentAction } from './actions';
import { ConsentStop } from './ConsentStop';
import styles from './consent.module.css';

export interface ConsentStrings {
  title: string;
  freshTitle: string;
  freshBody: string;
  whatTitle: string;
  scopesLabel: string;
  readTitle: string;
  readBody: string;
  required: string;
  writeTitle: string;
  writeBody: string;
  /** «Sei entrato come …», already resolved with the address. */
  signedInAs: string;
  notYou: string;
  authorize: string;
  authorizeReadOnly: string;
  deny: string;
  busy: string;
  revocationNote: string;
  failed: string;
  deniedTitle: string;
  /** «Hai detto no a {client}…», already resolved. */
  deniedBody: string;
  back: string;
}

interface Props {
  /** The signed query as it came, sent back with the answer. */
  query: string;
  clientName: string;
  clientInitial: string;
  /** «torna a {host} · registrata adesso». */
  subtitle: string;
  fresh: boolean;
  requestedScopes: ToolScope[];
  userInitials: string;
  /** Sign out, then `/login?{the same signed query}`, which resumes this request (0.4a-2). */
  notYouHref: string;
  strings: ConsentStrings;
}

/**
 * Variant C («Carta del client», §17.4.3): who is asking, then what it may do, then who you are,
 * then the answer. `read` is required; `write`, when asked for, can be unticked, and the button says
 * so. The answer goes on to the authorize endpoint or to the client's own redirect (Decision 10).
 */
export function ConsentForm({
  query,
  clientName,
  clientInitial,
  subtitle,
  fresh,
  requestedScopes,
  userInitials,
  notYouHref,
  strings,
}: Props) {
  const write = offersWrite(requestedScopes);
  const [writeOn, setWriteOn] = useState(write);
  const [choice, setChoice] = useState<'accept' | 'deny' | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [denied, setDenied] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = pending || leaving;

  const answer = (accept: boolean) => {
    if (busy) return;
    setFailed(false);
    setChoice(accept ? 'accept' : 'deny');
    startTransition(async () => {
      let result: ConsentActionResult;
      try {
        result = await submitConsentAction(
          query,
          accept,
          accept ? chosenScopes(requestedScopes, writeOn) : [],
        );
      } catch {
        result = { ok: false };
      }
      if (!result.ok) {
        setFailed(true);
        return;
      }
      setLeaving(true);
      if (!accept) setDenied(true);
      window.location.assign(result.redirectTo);
    });
  };

  if (denied) {
    return (
      <ConsentStop
        icon="x"
        title={strings.deniedTitle}
        body={strings.deniedBody}
        back={strings.back}
      />
    );
  }

  return (
    <>
      <h1 className={authStyles.title}>{strings.title}</h1>
      <div className={styles.client}>
        <span className={styles.clientTile} aria-hidden="true">
          {clientInitial}
        </span>
        <span className={styles.text}>
          <b className={styles.clientName}>{clientName}</b>
          <span className={styles.clientSub}>{subtitle}</span>
        </span>
      </div>
      {fresh ? <Alert quiet title={strings.freshTitle} body={strings.freshBody} /> : null}
      <p className={styles.what}>{strings.whatTitle}</p>
      <fieldset className={styles.scopes}>
        <legend>
          <VisuallyHidden>{strings.scopesLabel}</VisuallyHidden>
        </legend>
        <label className={`${styles.scope} ${styles.locked}`}>
          <span className={styles.tile}>
            <Icon name="eye" size={16} />
          </span>
          <span className={styles.text}>
            <span className={styles.scopeTitle}>{strings.readTitle}</span>
            <span className={styles.scopeBody}>{strings.readBody}</span>
          </span>
          <span className={styles.required}>{strings.required}</span>
          <input type="checkbox" className={styles.checkbox} checked disabled readOnly />
        </label>
        {write ? (
          <label className={styles.scope}>
            <span className={styles.tile}>
              <Icon name="pencil" size={16} />
            </span>
            <span className={styles.text}>
              <span className={styles.scopeTitle}>{strings.writeTitle}</span>
              <span className={styles.scopeBody}>{strings.writeBody}</span>
            </span>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={writeOn}
              disabled={busy}
              onChange={(event) => setWriteOn(event.target.checked)}
            />
          </label>
        ) : null}
      </fieldset>
      <div className={styles.me}>
        <span className={styles.avatar} aria-hidden="true">
          {userInitials}
        </span>
        <span>{strings.signedInAs}</span>
        <SignOutButton
          variant="row"
          className={styles.notYou}
          label={strings.notYou}
          working={strings.busy}
          redirectTo={notYouHref}
        />
      </div>
      <div className={styles.actions}>
        <Button
          busy={busy && choice === 'accept'}
          busyLabel={strings.busy}
          disabled={busy}
          onClick={() => answer(true)}
        >
          {authorizeReadOnly(requestedScopes, writeOn)
            ? strings.authorizeReadOnly
            : strings.authorize}
        </Button>
        <Button
          variant="secondary"
          busy={busy && choice === 'deny'}
          busyLabel={strings.busy}
          disabled={busy}
          onClick={() => answer(false)}
        >
          {strings.deny}
        </Button>
      </div>
      {failed ? <Alert body={strings.failed} /> : null}
      <p className={`${authStyles.hint} ${authStyles.centred}`}>{strings.revocationNote}</p>
    </>
  );
}
