import { plural } from '@saldo/i18n/translate';
import { Fragment } from 'react';
import {
  accountActions,
  accountCounts,
  accountFacts,
  accountRows,
  deleteConfirmation,
} from '../../../../src/features/admin/accountsView';
import { adminErrorStrings } from '../../../../src/features/admin/errorStrings';
import { resolveMessage } from '../../../../src/features/admin/resolveMessage';
import { type AccountDetail, accountDetails } from '../../../../src/server/auth/admin';
import { requireWebAdmin } from '../../../../src/server/auth/currentUser';
import { isSyntheticEmail } from '../../../../src/server/auth/email';
import { getDb } from '../../../../src/server/db/client';
import { adminContext } from '../../../../src/server/page/adminContext';
import { initials } from '../../../../src/ui/initials';
import { type PanelSpec, PanelSwitch } from '../../../../src/ui/PanelSwitch';
import { Section } from '../../../../src/ui/Section';
import { SummaryRow } from '../../../../src/ui/SummaryRow';
import styles from '../admin.module.css';
import { AccountActions, AccountActionsShared } from './AccountActions';
import { DeleteAccount, DeleteAccountShared } from './DeleteAccount';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PATH = '/admin/accounts';

/** `?u={id}` opens an account. An id that names no account opens nothing. */
const PANEL_PARAMS = { flags: [], values: ['u'] } as const;

/**
 * Admin → Account (§17.1.7): one row per account, oldest first, and `?u={id}` opens that account's
 * panel — the facts, what an admin may do to it, and the danger zone — in place (`PanelSwitch`).
 * The page renders the panel of every account. A panel holds only what an admin may read about any
 * account: the list's row, the dates, the counts and the invite's label. No token, no session id,
 * no address of a device. The actions are Server Actions that check the admin again.
 */
export default async function AdminAccountsPage() {
  const admin = await requireWebAdmin();
  const db = getDb();
  const [ctx, accounts] = await Promise.all([adminContext(admin), accountDetails(db)]);
  const { t, locale } = ctx;
  const rows = accountRows(accounts);
  const counts = accountCounts(accounts);

  const say = (message: Parameters<typeof resolveMessage>[0], style: 'long' | 'short' = 'long') =>
    resolveMessage(message, { t, locale, formatDate: ctx.formatDate[style] });
  const errors = adminErrorStrings(t);
  const trailing = [
    plural(t, locale, 'admin.accounts.count', counts.total),
    ...(counts.revoked > 0
      ? [plural(t, locale, 'admin.accounts.revokedCount', counts.revoked)]
      : []),
  ].join(' · ');

  const actions = (detail: AccountDetail) => {
    const can = accountActions(admin.id, detail);
    if (can.self) return <p className={styles.warn}>{t('admin.accounts.selfNote')}</p>;
    const confirmation = deleteConfirmation(detail);
    return (
      <>
        <AccountActions
          id={detail.id}
          can={can}
          titles={{
            promote: t('admin.accounts.promoteTitle', { name: detail.displayName }),
            revoke: t('admin.accounts.revokeTitle', { name: detail.displayName }),
          }}
        />
        <div className={styles.danger}>
          <h3 className={styles.dangerTitle}>{t('admin.accounts.dangerZone')}</h3>
          <p className={styles.warn}>{t('admin.accounts.deleteNote')}</p>
          <DeleteAccount
            id={detail.id}
            expected={confirmation.expected}
            text={{
              title: t('admin.accounts.deleteTitle', { name: detail.displayName }),
              body: plural(t, locale, 'admin.accounts.deleteBody', detail.syncedRows),
              label: t(confirmation.labelKey),
            }}
          />
        </div>
      </>
    );
  };

  // Every panel the page can open, rendered here: a click only chooses one (`PanelSwitch`).
  const panels: Record<string, PanelSpec> = Object.fromEntries(
    accounts.map((detail): [string, PanelSpec] => [
      `u:${detail.id}`,
      {
        title: detail.displayName,
        form: true,
        body: (
          <>
            <div className={styles.who}>
              <span className={styles.avatarBig} aria-hidden="true">
                {initials(detail.displayName)}
              </span>
              <div className={styles.whoText}>
                <p className={styles.whoName}>{detail.displayName}</p>
                {isSyntheticEmail(detail.email) ? null : (
                  <p className={styles.whoSub}>{detail.email}</p>
                )}
              </div>
            </div>
            <dl className={styles.facts}>
              {accountFacts(detail).map((fact) => (
                <Fragment key={fact.id}>
                  <dt>{t(fact.labelKey)}</dt>
                  <dd>{say(fact.value)}</dd>
                </Fragment>
              ))}
            </dl>
            {actions(detail)}
          </>
        ),
      },
    ]),
  );

  return (
    <AccountActionsShared
      value={{
        strings: {
          promote: t('admin.accounts.promote'),
          revoke: t('admin.accounts.revoke'),
          restore: t('admin.accounts.restore'),
          promoteNote: t('admin.accounts.promoteNote'),
          promoteConfirm: t('admin.accounts.promoteConfirm'),
          revokeNote: t('admin.accounts.revokeNote'),
          revokeConfirm: t('admin.accounts.revokeConfirm'),
          cancel: t('common.cancel'),
          busy: t('common.loading'),
          errors,
        },
      }}
    >
      <DeleteAccountShared
        value={{
          afterHref: PATH,
          strings: {
            action: t('admin.accounts.delete'),
            confirm: t('admin.accounts.deleteConfirm'),
            cancel: t('common.cancel'),
            busy: t('common.loading'),
            errors,
          },
        }}
      >
        <PanelSwitch
          baseHref={PATH}
          params={PANEL_PARAMS}
          panels={panels}
          closeLabel={t('common.close')}
          slot
        >
          <Section open title={t('admin.nav.accounts')} trailing={trailing}>
            <div>
              {rows.map((row) => (
                <div key={row.id} className={row.revoked ? styles.muted : undefined}>
                  <SummaryRow
                    href={`${PATH}?u=${encodeURIComponent(row.id)}`}
                    selectId={`u:${row.id}`}
                    leading={
                      <span className={styles.avatar} aria-hidden="true">
                        {row.initials}
                      </span>
                    }
                    title={row.name}
                    subtitle={row.email ?? t('admin.noEmail')}
                    value={
                      <span className={styles.role}>
                        {t(row.roleKey)}
                        {row.revoked ? ` · ${t('admin.accounts.revoked')}` : ''}
                      </span>
                    }
                  />
                </div>
              ))}
            </div>
          </Section>
        </PanelSwitch>
      </DeleteAccountShared>
    </AccountActionsShared>
  );
}
