'use client';

import { AlertDialog, Dialog } from '@base-ui/react';
import { useEffect, useState, useTransition } from 'react';
import { authClient } from '../../../../src/client/authClient';
import { lastPasskeyId, rememberPasskey } from '../../../../src/features/auth/lastPasskey';
import {
  canDeletePasskey,
  passkeyRows,
  type StoredPasskey,
} from '../../../../src/features/passkeys/list';
import { passkeyProvider } from '../../../../src/features/passkeys/provider';
import { Button } from '../../../../src/ui/Button';
import { TextField } from '../../../../src/ui/TextField';
import { deletePasskeyAction, renamePasskeyAction } from './actions';
import styles from './passkeys.module.css';

interface Row extends StoredPasskey {
  /** «Aggiunta il …», already formatted in the user's locale and zone by the page. */
  addedOn: string | null;
}

interface Props {
  passkeys: Row[];
  strings: Record<string, string>;
}

export function PasskeyList({ passkeys, strings }: Props) {
  const [lastCredential, setLastCredential] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [name, setName] = useState('');
  /** The key of the line to show when something was refused, or `null` when nothing was. */
  const [failure, setFailure] = useState<'lastOneNote' | 'failed' | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, startTransition] = useTransition();

  // `strings` is a `Record<string, string>`, so `noUncheckedIndexedAccess` reads every lookup as
  // possibly missing. A required prop like `TextField`'s `label` cannot take that `undefined`, and
  // AGENTS.md forbids a non-null assertion, so this turns it back into a plain `string` — same
  // pattern as `RegisterFlow.tsx`'s `label`.
  const label = (key: string): string => strings[key] ?? '';

  // `localStorage` is a browser fact: reading it during render would differ from the server's HTML.
  useEffect(() => setLastCredential(lastPasskeyId()), []);

  // `passkeyRows` spreads each row, so `addedOn` — already formatted by the page — survives the sort.
  const rows = passkeyRows(passkeys, lastCredential);
  const deletable = canDeletePasskey(rows.length);

  const addPasskey = async () => {
    // A second click would start a second ceremony, which aborts the first — and the first then
    // reports that abort as a failure even though the second is about to succeed.
    if (adding) return;
    setFailure(null);
    setAdding(true);
    const result = await authClient.passkey.addPasskey({ returnWebAuthnResponse: true });
    if (result.error !== null || result.data === null) {
      setAdding(false);
      setFailure('failed');
      return;
    }
    // `webauthn` is a sibling of `data`, not nested under it — same shape as `LoginForm`'s ceremony.
    const credentialId = 'webauthn' in result ? result.webauthn?.response.id : undefined;
    if (credentialId !== undefined) rememberPasskey(credentialId);
    // The page is a Server Component: the new row arrives with the next render.
    window.location.reload();
  };

  return (
    <>
      {rows.length === 0 ? <p className={styles.note}>{strings.empty}</p> : null}
      <div className={styles.rows}>
        {rows.map((row) => {
          const provider = passkeyProvider(row.aaguid) ?? strings.unknownProvider;
          return (
            <div className={styles.row} key={row.id}>
              <div className={styles.text}>
                <div className={styles.name}>{row.name ?? provider}</div>
                <div className={styles.meta}>
                  {[
                    row.name === null ? null : provider,
                    row.addedOn,
                    row.backedUp ? strings.synced : strings.notSynced,
                  ]
                    .filter((part) => part !== null)
                    .join(' · ')}
                </div>
              </div>
              {row.inUse ? <span className={styles.badge}>{strings.inUse}</span> : null}
              <div className={styles.actions}>
                <Button
                  variant="link"
                  onClick={() => {
                    setFailure(null);
                    setName(row.name ?? '');
                    setRenaming(row);
                  }}
                >
                  {strings.rename}
                </Button>
                <Button
                  variant="link"
                  disabled={!deletable}
                  /** §17.1.7: the last one's Elimina is disabled and says why. */
                  title={deletable ? undefined : strings.lastOneNote}
                  onClick={() => {
                    setFailure(null);
                    setDeleting(row);
                  }}
                >
                  {strings.remove}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      {/* With no passkey at all there is nothing to keep, so the «last one» line would be nonsense. */}
      {deletable || rows.length === 0 ? null : <p className={styles.note}>{strings.lastOneNote}</p>}
      {failure === null ? null : (
        <p className={styles.note} role="alert">
          {strings[failure] ?? strings.failed}
        </p>
      )}
      <Button
        icon="key"
        busy={adding}
        busyLabel={strings.working}
        onClick={() => void addPasskey()}
      >
        {strings.add}
      </Button>

      <Dialog.Root open={renaming !== null} onOpenChange={(open) => open || setRenaming(null)}>
        <Dialog.Portal>
          <Dialog.Backdrop className={styles.backdrop} />
          <Dialog.Popup className={styles.dialog}>
            <Dialog.Title className={styles.dialogTitle}>{strings.renameTitle}</Dialog.Title>
            <TextField
              label={label('nameLabel')}
              hint={strings.renameHint}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
              autoFocus
            />
            <div className={styles.dialogButtons}>
              <Button variant="secondary" onClick={() => setRenaming(null)}>
                {strings.cancel}
              </Button>
              <Button
                busy={busy}
                busyLabel={strings.working}
                /** The action refuses an empty name (`updatePasskey` validates `min(1)`), so the
                 * button does not offer to send one. */
                disabled={name.trim().length === 0}
                onClick={() => {
                  const target = renaming;
                  if (target === null) return;
                  startTransition(async () => {
                    const result = await renamePasskeyAction(target.id, name);
                    if (!result.ok) setFailure('failed');
                    setRenaming(null);
                  });
                }}
              >
                {strings.save}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      <AlertDialog.Root open={deleting !== null} onOpenChange={(open) => open || setDeleting(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className={styles.backdrop} />
          <AlertDialog.Popup className={styles.dialog}>
            <AlertDialog.Title className={styles.dialogTitle}>
              {strings.deleteTitle}
            </AlertDialog.Title>
            <AlertDialog.Description className={styles.dialogBody}>
              {strings.deleteBody}
            </AlertDialog.Description>
            <div className={styles.dialogButtons}>
              <Button variant="secondary" onClick={() => setDeleting(null)}>
                {strings.cancel}
              </Button>
              <Button
                busy={busy}
                busyLabel={strings.working}
                onClick={() => {
                  const target = deleting;
                  if (target === null) return;
                  startTransition(async () => {
                    const result = await deletePasskeyAction(target.id);
                    // The action's own reason, so a refusal to delete the last one says that and not
                    // «something went wrong» — the two are refused for very different causes.
                    if (!result.ok)
                      setFailure(result.reason === 'last_one' ? 'lastOneNote' : 'failed');
                    setDeleting(null);
                  });
                }}
              >
                {strings.remove}
              </Button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
