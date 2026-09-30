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
import { accountDetail, listAccounts } from '../../../../src/server/auth/admin';
import { requireWebAdmin } from '../../../../src/server/auth/currentUser';
import { isSyntheticEmail } from '../../../../src/server/auth/email';
import { getDb } from '../../../../src/server/db/client';
import { adminContext } from '../../../../src/server/page/adminContext';
import { initials } from '../../../../src/ui/initials';
import { Section } from '../../../../src/ui/Section';
import { SlotPanel } from '../../../../src/ui/SlotPanel';
import { SummaryRow } from '../../../../src/ui/SummaryRow';
import styles from '../admin.module.css';
import { AccountActions } from './AccountActions';
import { DeleteAccount } from './DeleteAccount';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PATH = '/admin/accounts';

/**
 * Admin → Account (§17.1.7): one row per account, oldest first, and `?u={id}` opens that account's
 * panel — the facts, what an admin may do to it, and the danger zone. An id that names nothing opens nothing.
 */
export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireWebAdmin();
  const db = getDb();
  const [ctx, accounts, params] = await Promise.all([
    adminContext(admin),
    listAccounts(db),
    searchParams,
  ]);
  const { t, locale } = ctx;
  const rows = accountRows(accounts);
  const counts = accountCounts(accounts);
  const requested = Array.isArray(params.u) ? params.u[0] : params.u;
  const detail = requested === undefined ? null : await accountDetail(db, requested);

  const say = (message: Parameters<typeof resolveMessage>[0], style: 'long' | 'short' = 'long') =>
    resolveMessage(message, { t, locale, formatDate: ctx.formatDate[style] });
  const errors = adminErrorStrings(t);
  const trailing = [
    plural(t, locale, 'admin.accounts.count', counts.total),
    ...(counts.revoked > 0
      ? [plural(t, locale, 'admin.accounts.revokedCount', counts.revoked)]
      : []),
  ].join(' · ');

  return (
    <>
      <Section open title={t('admin.nav.accounts')} trailing={trailing}>
        <div>
          {rows.map((row) => (
            <div key={row.id} className={row.revoked ? styles.muted : undefined}>
              <SummaryRow
                href={`${PATH}?u=${encodeURIComponent(row.id)}`}
                selected={detail?.id === row.id}
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

      {detail === null ? null : (
        <SlotPanel
          key="panel"
          sheet
          title={detail.displayName}
          closeHref={PATH}
          closeLabel={t('common.close')}
        >
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
          {(() => {
            const can = accountActions(admin.id, detail);
            if (can.self) return <p className={styles.warn}>{t('admin.accounts.selfNote')}</p>;
            const confirmation = deleteConfirmation(detail);
            return (
              <>
                <AccountActions
                  // A switch between two accounts is a new set of buttons and a closed dialog.
                  key={detail.id}
                  id={detail.id}
                  can={can}
                  strings={{
                    promote: t('admin.accounts.promote'),
                    revoke: t('admin.accounts.revoke'),
                    restore: t('admin.accounts.restore'),
                    promoteTitle: t('admin.accounts.promoteTitle', { name: detail.displayName }),
                    promoteNote: t('admin.accounts.promoteNote'),
                    promoteConfirm: t('admin.accounts.promoteConfirm'),
                    revokeTitle: t('admin.accounts.revokeTitle', { name: detail.displayName }),
                    revokeNote: t('admin.accounts.revokeNote'),
                    revokeConfirm: t('admin.accounts.revokeConfirm'),
                    cancel: t('common.cancel'),
                    busy: t('common.loading'),
                    errors,
                  }}
                />
                <div className={styles.danger}>
                  <h3 className={styles.dangerTitle}>{t('admin.accounts.dangerZone')}</h3>
                  <p className={styles.warn}>{t('admin.accounts.deleteNote')}</p>
                  <DeleteAccount
                    key={detail.id}
                    id={detail.id}
                    expected={confirmation.expected}
                    afterHref={PATH}
                    strings={{
                      action: t('admin.accounts.delete'),
                      title: t('admin.accounts.deleteTitle', { name: detail.displayName }),
                      body: plural(t, locale, 'admin.accounts.deleteBody', detail.syncedRows),
                      label: t(confirmation.labelKey),
                      confirm: t('admin.accounts.deleteConfirm'),
                      cancel: t('common.cancel'),
                      busy: t('common.loading'),
                      errors,
                    }}
                  />
                </div>
              </>
            );
          })()}
        </SlotPanel>
      )}
    </>
  );
}
