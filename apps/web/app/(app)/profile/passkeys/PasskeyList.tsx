'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { authClient } from '../../../../src/client/authClient';
import { lastPasskeyId, rememberPasskey } from '../../../../src/features/auth/lastPasskey';
import {
  canDeletePasskey,
  type PasskeyRow,
  passkeyRows,
  type StoredPasskey,
} from '../../../../src/features/passkeys/list';
import { passkeyProvider } from '../../../../src/features/passkeys/provider';
import { AppLink as Link } from '../../../../src/ui/AppLink';
import { Button } from '../../../../src/ui/Button';
import { ConfirmDialog } from '../../../../src/ui/ConfirmDialog';
import { Icon } from '../../../../src/ui/Icon';
import { Panel } from '../../../../src/ui/Panel';
import { TextField } from '../../../../src/ui/TextField';
import { PANEL_SLOT } from '../panelSlot';
import { deletePasskeyAction, renamePasskeyAction } from './actions';
import styles from './passkeys.module.css';

const PATH = '/profile/passkeys';
/** The parameter that carries the selected passkey, and the only state the panel has. */
const SELECTION_PARAM = 'k';

interface Row extends StoredPasskey {
  /** «Aggiunta il 10 set», already formatted in the user's locale and zone by the page. */
  addedOn: string | null;
  /** «10 settembre 2026», for the panel. */
  addedLong: string | null;
}

interface Props {
  passkeys: Row[];
  strings: Record<string, string>;
}

export function PasskeyList({ passkeys, strings }: Props) {
  const router = useRouter();
  const selectedId = useSearchParams().get(SELECTION_PARAM);
  const [lastCredential, setLastCredential] = useState<string | null>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [draft, setDraft] = useState<{ id: string; name: string } | null>(null);
  /** The key of the line to show when something was refused, or `null` when nothing was. */
  const [failure, setFailure] = useState<'lastOneNote' | 'failed' | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, startTransition] = useTransition();

  // `strings` is a `Record<string, string>`, so `noUncheckedIndexedAccess` reads every lookup as
  // possibly missing. A required prop like `TextField`'s `label` cannot take that `undefined`, and
  // AGENTS.md forbids a non-null assertion, so this turns it back into a plain `string` — same
  // pattern as `RegisterFlow.tsx`'s `label`.
  const label = (key: string): string => strings[key] ?? '';

  // `localStorage` and the layout's slot are browser facts: reading them during render would differ
  // from the server's HTML.
  useEffect(() => {
    setLastCredential(lastPasskeyId());
    setSlot(document.getElementById(PANEL_SLOT));
  }, []);

  // `passkeyRows` spreads each row, so what the page added to it survives the sort.
  const rows = passkeyRows(passkeys, lastCredential);
  const deletable = canDeletePasskey(rows.length);
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const providerOf = (row: Row) => passkeyProvider(row.aaguid) ?? label('unknownProvider');
  const nameOf = (row: Row) => row.name ?? providerOf(row);
  const selectedName = selected === null ? '' : nameOf(selected);
  const editing = selected !== null && draft?.id === selected.id ? draft.name : selectedName;

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

  const subtitle = (row: PasskeyRow<Row>) =>
    [row.name === null ? null : providerOf(row), row.addedOn, row.inUse ? label('inUse') : null]
      .filter((part) => part !== null)
      .join(' · ');

  return (
    <>
      {rows.length === 0 ? <p className={styles.note}>{strings.empty}</p> : null}
      <div className={styles.rows}>
        {rows.map((row) => (
          <Link
            className={`${styles.row} ${row.id === selected?.id ? styles.selected : ''}`}
            key={row.id}
            href={`${PATH}?${SELECTION_PARAM}=${row.id}`}
            aria-current={row.id === selected?.id ? 'true' : undefined}
          >
            <span className={styles.tile}>
              <Icon name="key" size={18} />
            </span>
            <span className={styles.text}>
              <span className={styles.name}>{nameOf(row)}</span>
              <span className={styles.meta}>{subtitle(row)}</span>
            </span>
            <Icon name="chevR" size={16} className={styles.chevron} />
          </Link>
        ))}
      </div>
      {failure === null ? null : (
        <p className={styles.note} role="alert">
          {strings[failure] ?? strings.failed}
        </p>
      )}
      <div className={styles.add}>
        <Button
          icon="plus"
          variant="secondary"
          busy={adding}
          busyLabel={strings.working}
          onClick={() => void addPasskey()}
        >
          {strings.add}
        </Button>
      </div>

      {selected === null || slot === null
        ? null
        : createPortal(
            <Panel title={nameOf(selected)} closeHref={PATH} closeLabel={strings.close ?? ''} bare>
              <div className={styles.panelHead}>
                <span className={`${styles.tile} ${styles.tileLarge}`}>
                  <Icon name="key" size={20} />
                </span>
                <div className={styles.text}>
                  <span className={styles.panelName}>{nameOf(selected)}</span>
                  <span className={styles.meta}>{subtitle(selected)}</span>
                </div>
              </div>

              <div className={styles.field}>
                <TextField
                  label={label('nameLabel')}
                  hint={strings.renameHint}
                  value={editing}
                  onChange={(event) => setDraft({ id: selected.id, name: event.target.value })}
                  maxLength={60}
                />
                {/* The action refuses an empty name (`updatePasskey` validates `min(1)`), so the
                    button does not offer to send one — nor to send the name that is already there. */}
                {editing.trim().length === 0 || editing.trim() === selectedName ? null : (
                  <Button
                    busy={busy}
                    busyLabel={strings.working}
                    onClick={() => {
                      const target = selected;
                      startTransition(async () => {
                        const result = await renamePasskeyAction(target.id, editing);
                        setFailure(result.ok ? null : 'failed');
                        if (result.ok) setDraft(null);
                      });
                    }}
                  >
                    {strings.save}
                  </Button>
                )}
              </div>

              <dl className={styles.facts}>
                <div className={styles.fact}>
                  <dt className={styles.factLabel}>{strings.provider}</dt>
                  <dd className={styles.factValue}>{providerOf(selected)}</dd>
                </div>
                {selected.addedLong === null ? null : (
                  <div className={styles.fact}>
                    <dt className={styles.factLabel}>{strings.added}</dt>
                    <dd className={styles.factValue}>{selected.addedLong}</dd>
                  </div>
                )}
                <div className={styles.fact}>
                  <dt className={styles.factLabel}>{strings.syncedLabel}</dt>
                  <dd className={styles.factValue}>
                    {selected.backedUp ? strings.synced : strings.notSynced}
                  </dd>
                </div>
              </dl>

              <div className={styles.panelActions}>
                <Button
                  variant="secondary"
                  icon="trash"
                  disabled={!deletable}
                  /** §17.1.7: the last one's Elimina is disabled and says why. */
                  title={deletable ? undefined : strings.lastOneNote}
                  onClick={() => {
                    setFailure(null);
                    setDeleting(selected);
                  }}
                >
                  {strings.remove}
                </Button>
              </div>
              {deletable ? null : <p className={styles.note}>{strings.lastOneNote}</p>}
            </Panel>,
            slot,
          )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => open || setDeleting(null)}
        title={label('deleteTitle')}
        body={label('deleteBody')}
        confirmLabel={label('remove')}
        cancelLabel={label('cancel')}
        busy={busy}
        busyLabel={strings.working}
        onConfirm={() => {
          const target = deleting;
          if (target === null) return;
          startTransition(async () => {
            const result = await deletePasskeyAction(target.id);
            // The action's own reason, so a refusal to delete the last one says that and not
            // «something went wrong» — the two are refused for very different causes.
            if (!result.ok) setFailure(result.reason === 'last_one' ? 'lastOneNote' : 'failed');
            setDeleting(null);
            if (result.ok) router.replace(PATH);
          });
        }}
      />
    </>
  );
}
