import { goalViews, readSettings } from '@saldo/core';
import { LANGUAGE_NAMES } from '@saldo/i18n';
import { plural, type Translate } from '@saldo/i18n/translate';
import type { ReactNode } from 'react';
import { activeInviteCount } from '../../../src/features/admin/invitesView';
import { registrationChoices } from '../../../src/features/admin/settingsView';
import { categoriesView } from '../../../src/features/categories/categoriesView';
import { tagsView } from '../../../src/features/tags/tagsView';
import { userI18n } from '../../../src/i18n/server';
import { isAdminUser, listAccounts } from '../../../src/server/auth/admin';
import { requireWebUser } from '../../../src/server/auth/currentUser';
import { isSyntheticEmail } from '../../../src/server/auth/email';
import { listInvites } from '../../../src/server/auth/invites';
import { listPasskeysForUser } from '../../../src/server/auth/passkeys';
import { getDb } from '../../../src/server/db/client';
import { env, type RegistrationMode } from '../../../src/server/env';
import { listConnectors } from '../../../src/server/mcp/connectors';
import { pageState } from '../../../src/server/page/context';
import {
  pageInstanceInfo,
  pageMcpSetting,
  pageRegistrationMode,
} from '../../../src/server/page/instanceSettings';
import { loadUserData } from '../../../src/server/userData/load';
import { initials } from '../../../src/ui/initials';
import { SignOutButton } from '../../../src/ui/SignOutButton';
import {
  SubnavFoot,
  SubnavGroup,
  SubnavLayout,
  SubnavLink,
  SubnavSeparator,
} from '../../../src/ui/SubnavLayout';
import styles from './profile.module.css';

/**
 * W10: Profile's frame, which Admin shares. The head (avatar, name, email, and «Admin» for the
 * admin role), then the menu in four groups — Account, Organise with its counts, Connections and
 * data, and Admin for the admin role only — and «Sign out» under a line. The Admin group is only a
 * set of links: `requireWebAdmin` still guards the admin layout, every admin page and every admin
 * Server Action. Below 760px the menu is the list of groups, and each item without a count carries a
 * hint of what is inside (spec §06): the address, the passkeys, the preferences, the connectors.
 *
 * It does not call `readPage`: that sends an account that never onboarded to `/onboarding`, and an
 * admin of such an account still administers the instance (`adminContext`, §17.1.7). Without a
 * `settings` row the counts are those of an empty projection.
 */
export async function SettingsPage({ children }: { children: ReactNode }) {
  const user = await requireWebUser();
  const db = getDb();
  const [data, { t, locale }, passkeys, connectors] = await Promise.all([
    loadUserData(user.id),
    userI18n(user.id),
    listPasskeysForUser(db, user.id),
    listConnectors(user.id),
  ]);
  const { today, def } = pageState({
    data,
    now: new Date(),
    fallbackTimeZone: env().defaultTimeZone,
    params: {},
  });
  const admin = isAdminUser(user);
  const adminData = admin
    ? await Promise.all([
        listAccounts(db),
        listInvites(db, new Date()),
        pageInstanceInfo(),
        pageRegistrationMode(),
        pageMcpSetting(),
      ])
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

  // Spec §06: what the list of groups below 760px says under each item that has no count.
  const settings = readSettings(data.settings);
  const hints = {
    account: isSyntheticEmail(user.email) ? undefined : user.email,
    passkeys: plural(t, locale, 'admin.accounts.passkeys', passkeys.length),
    preferences: [
      // «Sistema» would read twice beside the theme's: the language in use says more.
      LANGUAGE_NAMES[settings.language === 'system' ? locale : settings.language],
      t(`profile.${settings.theme}`),
      settings.currency,
    ].join(' · '),
    connectors:
      connectors.length === 0
        ? undefined
        : plural(t, locale, 'web.profile.hintConnectors', connectors.length),
    data: t('web.profile.hintData'),
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
            <SubnavLink
              href="/profile/account"
              alsoCurrentAt="/profile"
              icon="settings"
              label={t('profile.title')}
              hint={hints.account}
            />
            <SubnavLink
              href="/profile/passkeys"
              icon="key"
              label={t('web.passkeys.title')}
              hint={hints.passkeys}
            />
            <SubnavLink
              href="/profile/preferences"
              icon="wrench"
              label={t('settings.preferences')}
              hint={hints.preferences}
            />
          </SubnavGroup>
          <SubnavGroup title={t('web.profile.groupOrganise')}>
            <SubnavLink
              href="/profile/categories"
              icon="grip"
              label={t('categories.title')}
              count={counts.categories}
            />
            <SubnavLink
              href="/profile/tags"
              icon="tag"
              label={t('tags.title')}
              count={counts.tags}
            />
            <SubnavLink
              href="/profile/budgets"
              icon="target"
              label={t('budgets.title')}
              count={counts.budgets}
            />
            <SubnavLink
              href="/profile/goals"
              icon="piggy"
              label={t('goals.title')}
              count={counts.goals}
            />
          </SubnavGroup>
          <SubnavGroup title={t('web.profile.groupConnections')}>
            <SubnavLink
              href="/profile/connectors"
              icon="plug"
              label={t('web.connectors.title')}
              hint={hints.connectors}
            />
            <SubnavLink
              href="/profile/data"
              icon="archive"
              label={t('web.data.title')}
              hint={hints.data}
            />
          </SubnavGroup>
          {adminData === null ? null : (
            <SubnavGroup title={t('web.profile.groupAdmin', { name: adminData[2].name })}>
              <SubnavLink
                href="/admin/accounts"
                icon="shield"
                label={t('admin.nav.accounts')}
                count={adminData[0].length}
              />
              <SubnavLink
                href="/admin/invites"
                icon="key"
                label={t('admin.nav.invites')}
                count={activeInviteCount(adminData[1])}
                hint={plural(t, locale, 'web.profile.hintInvites', activeInviteCount(adminData[1]))}
              />
              <SubnavLink
                href="/admin/instance"
                icon="info"
                label={t('admin.nav.instance')}
                hint={adminData[2].name}
              />
              <SubnavLink
                href="/admin/settings"
                icon="settings"
                label={t('admin.nav.settings')}
                hint={registrationLabel(adminData[3], t)}
              />
              <SubnavLink
                href="/admin/mcp"
                icon="plug"
                label={t('admin.mcp.title')}
                hint={t(adminData[4].value ? 'web.profile.hintOn' : 'web.profile.hintOff')}
              />
            </SubnavGroup>
          )}
          <SubnavSeparator />
          <SubnavFoot>
            <SignOutButton
              variant="row"
              icon="arrowUR"
              className={styles.signOut}
              label={t('sync.signOut')}
              working={t('common.loading')}
            />
          </SubnavFoot>
        </>
      }
    >
      {children}
    </SubnavLayout>
  );
}

/** The registration mode's name, as Admin → Impostazioni shows it («Solo con invito»). */
function registrationLabel(mode: RegistrationMode, t: Translate): string | undefined {
  const choice = registrationChoices().find((item) => item.value === mode);
  return choice === undefined ? undefined : t(choice.labelKey);
}
