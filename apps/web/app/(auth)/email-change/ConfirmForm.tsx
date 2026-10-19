'use client';

import { useState } from 'react';
import { log } from '../../../src/client/log';
import { Alert } from '../../../src/ui/Alert';
import { Button } from '../../../src/ui/Button';
import { Icon } from '../../../src/ui/Icon';
import styles from '../auth.module.css';

export interface ConfirmStrings {
  title: string;
  body: string;
  confirm: string;
  working: string;
  doneTitle: string;
  doneBody: string;
  open: string;
  invalidTitle: string;
  invalidBody: string;
}

/** The one step that spends the link: a button, because loading the page must not. */
export function ConfirmForm({ token, strings }: { token: string; strings: ConfirmStrings }) {
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<'changed' | 'invalid' | null>(null);

  const confirm = async () => {
    setBusy(true);
    const response = await fetch('/api/email-change/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    }).catch(() => null);
    setBusy(false);
    if (response === null || !response.ok) {
      log('auth', 'the email change link was not accepted', { status: response?.status });
    }
    setOutcome(response?.ok === true ? 'changed' : 'invalid');
  };

  if (outcome === 'changed') {
    return (
      <>
        <div className={styles.done}>
          <div className={styles.check}>
            <Icon name="check" size={28} />
          </div>
          <h1 className={styles.title}>{strings.doneTitle}</h1>
          <p className={styles.lede}>{strings.doneBody}</p>
        </div>
        <a className={styles.secondaryLink} href="/home">
          {strings.open}
        </a>
      </>
    );
  }
  if (outcome === 'invalid') {
    return <Alert title={strings.invalidTitle} body={strings.invalidBody} />;
  }
  return (
    <>
      <h1 className={styles.title}>{strings.title}</h1>
      <p className={styles.lede}>{strings.body}</p>
      <Button busy={busy} busyLabel={strings.working} onClick={() => void confirm()}>
        {strings.confirm}
      </Button>
    </>
  );
}
