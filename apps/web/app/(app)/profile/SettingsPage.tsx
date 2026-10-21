import { goalViews } from '@saldo/core';
import type { ReactNode } from 'react';
import { activeInviteCount } from '../../../src/features/admin/invitesView';
import { categoriesView } from '../../../src/features/categories/categoriesView';
import { tagsView } from '../../../src/features/tags/tagsView';
import { userI18n } from '../../../src/i18n/server';
import { isAdminUser, listAccounts } from '../../../src/server/auth/admin';
import { requireWebUser } from '../../../src/server/auth/currentUser';
import { listInvites } from '../../../src/server/auth/invites';
import { getDb } from '../../../src/server/db/client';
import { env } from '../../../src/server/env';
import { pageState } from '../../../src/server/page/context';
import { pageInstanceInfo } from '../../../src/server/page/instanceSettings';
import { loadUserData } from '../../../src/server/userData/load';
import { initials } from '../../../src/ui/initials';
import { NavLink } from '../../../src/ui/NavLink';
import { SignOutButton } from '../../../src/ui/SignOutButton';
import { SubnavGroup, SubnavLayout, SubnavSeparator } from '../../../src/ui/SubnavLayout';
import styles from './profile.module.css';

/**
 * W10: Profile's frame, which Admin shares. The head (avatar, name, email, and «Admin» for the
 * admin role), then the menu in four groups — Account, Organise with its counts, Connections and
 * data, and Admin for the admin role only — and «Sign out» under a line. The Admin group is only a
 * set of links: `requireWebAdmin` still guards the admin layout, every admin page and every admin
 * Server Action.
 *
 * It does not call `readPage`: that sends an account that never onboarded to `/onboarding`, and an
 * admin of such an account still administers the instance (`adminContext`, §17.1.7). Without a
 * `settings` row the counts are those of an empty projection.
 */
export async function SettingsPage({ children }: { children: ReactNode }) {
  const user = await requireWebUser();
  const [data, { t }] = await Promise.all([loadUserData(user.id), userI18n(user.id)]);
  const { today, def } = pageState({
    data,
    now: new Date(),
    fallbackTimeZone: env().defaultTimeZone,
    params: {},
  });
  const admin = isAdminUser(user);
  const db = getDb();
  const adminData = admin
    ? await Promise.all([listAccounts(db), listInvites(db, new Date()), pageInstanceInfo()])
    : null;

  // The rows each section of «Organise» lists, from the view function each section calls.
  const counts = {
    categories: categoriesView(data).sections.reduce(
      (sum, section) => sum + section.rows.length,
      0,
    ),
    tags: tagsView(data).length,
    budgets: data.budgets.length,
    goals: goalViews(data.accounts, data.transactions, today, def).length,
  };

  return (
    <SubnavLayout
      navLabel={t('profile.title')}
      indexPath="/profile"
      back={{ text: t('profile.title'), label: t('web.profile.backLabel') }}
      head={
        <header className={styles.head}>
          <span className={styles.avatar} aria-hidden="true">
            {initials(user.displayName)}
          </span>
          <div className={styles.who}>
            <h1 className={styles.name}>{user.displayName}</h1>
            <p className={styles.email}>
              {user.email}
              {admin ? <span className={styles.badge}>{t('admin.roleAdmin')}</span> : null}
            </p>
          </div>
        </header>
      }
      nav={
        <>
          <SubnavGroup title={t('web.profile.groupAccount')}>
            <NavLink
              href="/profile/account"
              alsoCurrentAt="/profile"
              icon="settings"
              label={t('profile.title')}
            />
            <NavLink href="/profile/passkeys" icon="key" label={t('web.passkeys.title')} />
            <NavLink href="/profile/preferences" icon="wrench" label={t('settings.preferences')} />
          </SubnavGroup>
          <SubnavGroup title={t('web.profile.groupOrganise')}>
            <NavLink
              href="/profile/categories"
              icon="grip"
              label={t('categories.title')}
              count={counts.categories}
            />
            <NavLink href="/profile/tags" icon="tag" label={t('tags.title')} count={counts.tags} />
            <NavLink
              href="/profile/budgets"
              icon="target"
              label={t('budgets.title')}
              count={counts.budgets}
            />
            <NavLink
              href="/profile/goals"
              icon="piggy"
              label={t('goals.title')}
              count={counts.goals}
            />
          </SubnavGroup>
          <SubnavGroup title={t('web.profile.groupConnections')}>
            <NavLink href="/profile/connectors" icon="plug" label={t('web.connectors.title')} />
            <NavLink href="/profile/data" icon="archive" label={t('web.data.title')} />
          </SubnavGroup>
          {adminData === null ? null : (
            <SubnavGroup title={t('web.profile.groupAdmin', { name: adminData[2].name })}>
              <NavLink
                href="/admin/accounts"
                icon="shield"
                label={t('admin.nav.accounts')}
                count={adminData[0].length}
              />
              <NavLink
                href="/admin/invites"
                icon="key"
                label={t('admin.nav.invites')}
                count={activeInviteCount(adminData[1])}
              />
              <NavLink href="/admin/instance" icon="info" label={t('admin.nav.instance')} />
              <NavLink href="/admin/settings" icon="settings" label={t('admin.nav.settings')} />
              <NavLink href="/admin/mcp" icon="plug" label={t('admin.mcp.title')} />
            </SubnavGroup>
          )}
          <SubnavSeparator />
          <SignOutButton
            variant="row"
            icon="arrowUR"
            className={styles.signOut}
            label={t('sync.signOut')}
            working={t('common.loading')}
          />
        </>
      }
    >
      {children}
    </SubnavLayout>
  );
}
