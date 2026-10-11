import type { ReactNode } from 'react';
import { userI18n } from '../../../src/i18n/server';
import { isAdminUser } from '../../../src/server/auth/admin';
import { requireWebUser } from '../../../src/server/auth/currentUser';
import { initials } from '../../../src/ui/initials';
import { NavLink } from '../../../src/ui/NavLink';
import { SignOutButton } from '../../../src/ui/SignOutButton';
import { SubnavLayout, SubnavSeparator } from '../../../src/ui/SubnavLayout';
import styles from './profile.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * §17.1.7, variant «5»: the header, then a sub-navigation that picks one section, and «Esci» at
 * its end. Categorie, Budget and Obiettivi are sections of their own (0.3e-2b), Tag and Dati since 0.3e-3. «Connettori» after Passkey since 0.4a.
 */
export default async function ProfileLayout({ children }: { children: ReactNode }) {
  const user = await requireWebUser();
  const admin = isAdminUser(user);
  const { t } = await userI18n(user.id);
  return (
    <div className={styles.page}>
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
      <SubnavLayout
        navLabel={t('profile.title')}
        nav={
          <>
            <NavLink href="/profile/account" icon="settings" label={t('profile.title')} />
            <NavLink href="/profile/preferences" icon="wrench" label={t('settings.preferences')} />
            <NavLink href="/profile/categories" icon="grip" label={t('categories.title')} />
            <NavLink href="/profile/tags" icon="tag" label={t('tags.title')} />
            <NavLink href="/profile/budgets" icon="target" label={t('budgets.title')} />
            <NavLink href="/profile/goals" icon="piggy" label={t('goals.title')} />
            <NavLink href="/profile/passkeys" icon="key" label={t('web.passkeys.title')} />
            <NavLink href="/profile/connectors" icon="plug" label={t('web.connectors.title')} />
            <NavLink href="/profile/data" icon="archive" label={t('web.data.title')} />
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
    </div>
  );
}
