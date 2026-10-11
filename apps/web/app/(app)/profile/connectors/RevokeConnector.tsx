'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Alert } from '../../../../src/ui/Alert';
import { Button } from '../../../../src/ui/Button';
import { sharedProps } from '../../../../src/ui/sharedProps';
import { type RevokeConnectorResult, revokeConnectorAction } from './actions';
import styles from './connectors.module.css';

/** What every connector's «Revoca accesso» shares, given once (`RevokeConnectorShared`). */
interface RevokeConnectorSharedValue {
  /** The list without a selection: where the page goes once the connector is gone. */
  closeHref: string;
  strings: {
    revoke: string;
    body: string;
    confirm: string;
    cancel: string;
    busy: string;
    failed: string;
  };
}

const shared = sharedProps<RevokeConnectorSharedValue>('RevokeConnector');

/** Gives every `RevokeConnector` below it the props they share. */
export const RevokeConnectorShared = shared.Provider;

interface Props {
  clientId: string;
  /** `web.connectors.revokeTitle` with the client's name. */
  title: string;
}

/**
 * «Revoca accesso» at the foot of the panel, with the inline confirmation of §17.4.3 («Revocare
 * {client}? Smetterà di funzionare alla prossima chiamata») rather than a dialog: the panel is
 * already the place of this one connector.
 */
export function RevokeConnector({ clientId, title }: Props) {
  const { closeHref, strings } = shared.useShared();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const revoke = () => {
    if (pending) return;
    setFailed(false);
    startTransition(async () => {
      let result: RevokeConnectorResult;
      try {
        result = await revokeConnectorAction(clientId);
      } catch {
        result = { ok: false };
      }
      if (!result.ok) {
        setFailed(true);
        return;
      }
      router.replace(closeHref);
    });
  };

  if (!confirming) {
    return (
      <div className={styles.panelActions}>
        <Button variant="secondary" icon="trash" onClick={() => setConfirming(true)}>
          {strings.revoke}
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.confirm}>
      <Alert title={title} body={strings.body} />
      <div className={styles.panelActions}>
        <Button variant="secondary" disabled={pending} onClick={() => setConfirming(false)}>
          {strings.cancel}
        </Button>
        <Button variant="secondary" busy={pending} busyLabel={strings.busy} onClick={revoke}>
          {strings.confirm}
        </Button>
      </div>
      {failed ? (
        <p className={styles.hint} role="alert">
          {strings.failed}
        </p>
      ) : null}
    </div>
  );
}
