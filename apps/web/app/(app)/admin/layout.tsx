import { plural } from '@saldo/i18n/translate';
import type { ReactNode } from 'react';
import { activeInviteCount } from '../../../src/features/admin/invitesView';
import { listAccounts } from '../../../src/server/auth/admin';
import { requireWebAdmin } from '../../../src/server/auth/currentUser';
import { listInvites } from '../../../src/server/auth/invites';
import { getDb } from '../../../src/server/db/client';
import { adminContext } from '../../../src/server/page/adminContext';
import { pageInstanceInfo } from '../../../src/server/page/instanceSettings';
import { NavLink } from '../../../src/ui/NavLink';
import { SubnavLayout } from '../../../src/ui/SubnavLayout';
import styles from './admin.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * §17.1.7, Admin (variant «3»): the head, then Profilo's shell — a sub-navigation with the counts,
 * the section, the panel. The guard is here and in every page and Server Action: a layout does not
 * run for an action, and a page can render without it.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireWebAdmin();
  const db = getDb();
  const [{ t, locale }, accounts, invites, instance] = await Promise.all([
    adminContext(user),
    listAccounts(db),
    listInvites(db, new Date()),
    pageInstanceInfo(),
  ]);
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>{t('admin.title')}</h1>
        <p className={styles.headCount}>
          {plural(t, locale, 'admin.headCount', accounts.length, { name: instance.name })}
        </p>
      </header>
      <SubnavLayout
        navLabel={t('admin.title')}
        nav={
          <>
            <NavLink
              href="/admin/accounts"
              icon="shield"
              label={t('admin.nav.accounts')}
              count={accounts.length}
            />
            <NavLink
              href="/admin/invites"
              icon="key"
              label={t('admin.nav.invites')}
              count={activeInviteCount(invites)}
            />
            <NavLink href="/admin/instance" icon="info" label={t('admin.nav.instance')} />
            <NavLink href="/admin/settings" icon="settings" label={t('admin.nav.settings')} />
            <NavLink href="/admin/mcp" icon="plug" label={t('admin.mcp.title')} />
          </>
        }
      >
        {children}
      </SubnavLayout>
    </div>
  );
}
