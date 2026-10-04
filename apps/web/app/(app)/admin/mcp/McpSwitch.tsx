'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { SettingsErrorStrings } from '../../../../src/features/admin/errorStrings';
import type { SettingsWriteResult } from '../../../../src/server/settings/write';
import { Alert } from '../../../../src/ui/Alert';
import { Button } from '../../../../src/ui/Button';
import { Switch } from '../../../../src/ui/Switch';
import { saveMcpEnabledAction } from './actions';
import styles from './mcp.module.css';

interface Props {
  enabled: boolean;
  /** `MCP_ENABLED` sets it: the switch shows the value, disabled. */
  locked: boolean;
  strings: {
    label: string;
    note: string;
    offTitle: string;
    /** «3 utenti hanno 5 connettori autorizzati: …», resolved with the counts on the server. */
    offBody: string;
    cancel: string;
    turnOff: string;
    busy: string;
    errors: SettingsErrorStrings;
  };
}

/**
 * «Permetti agli utenti di collegare client MCP» (§17.4.3, variant C). On is written at once; off
 * asks first, inline, naming what stops — «Annulla» / «Spegni».
 */
export function McpSwitch({ enabled, locked, strings }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = (next: boolean) => {
    if (pending || locked) return;
    setProblem(null);
    startTransition(async () => {
      let result: SettingsWriteResult;
      try {
        result = await saveMcpEnabledAction(next);
      } catch {
        setProblem(strings.errors.unexpected);
        return;
      }
      if (!result.ok) {
        setProblem(strings.errors[result.error]);
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  };

  return (
    <>
      <Switch
        label={strings.label}
        note={strings.note}
        checked={enabled}
        disabled={locked || pending}
        onChange={(next) => {
          if (next) save(true);
          else setConfirming(true);
        }}
      />
      {confirming ? (
        <div className={styles.confirmBlock}>
          <Alert title={strings.offTitle} body={strings.offBody} />
          <div className={styles.confirm}>
            <Button variant="secondary" disabled={pending} onClick={() => setConfirming(false)}>
              {strings.cancel}
            </Button>
            <Button
              variant="secondary"
              busy={pending}
              busyLabel={strings.busy}
              onClick={() => save(false)}
            >
              {strings.turnOff}
            </Button>
          </div>
        </div>
      ) : null}
      {problem === null ? null : <Alert body={problem} />}
    </>
  );
}
