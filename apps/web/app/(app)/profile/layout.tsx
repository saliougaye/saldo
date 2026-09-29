import type { ReactNode } from 'react';
import { userI18n } from '../../../src/i18n/server';
import { isAdmin } from '../../../src/server/auth/admin';
import { requireWebUser } from '../../../src/server/auth/currentUser';
import { getDb } from '../../../src/server/db/client';
import { initials } from '../../../src/ui/initials';
import { NavLink } from '../../../src/ui/NavLink';
import { SignOutButton } from '../../../src/ui/SignOutButton';
import { PANEL_SLOT } from './panelSlot';
import styles from './profile.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * §17.1.7, variant «5»: the header, then a sub-navigation that picks one section, and «Esci» at
 * its end. Categorie, Tag and Dati join the list with the forms in 0.3e.
 */
export default async function ProfileLayout({ children }: { children: ReactNode }) {
  const user = await requireWebUser();
  const [{ t }, admin] = await Promise.all([userI18n(user.id), isAdmin(getDb(), user.id)]);
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
      <div className={styles.layout}>
        <nav className={styles.subnav} aria-label={t('profile.title')}>
          <NavLink href="/profile/account" icon="settings" label={t('profile.title')} />
          <NavLink href="/profile/preferences" icon="wrench" label={t('settings.preferences')} />
          <NavLink href="/profile/passkeys" icon="key" label={t('web.passkeys.title')} />
          <hr className={styles.separator} />
          <SignOutButton
            variant="row"
            icon="arrowUR"
            className={styles.signOut}
            label={t('sync.signOut')}
            working={t('common.loading')}
          />
        </nav>
        <div className={styles.section}>{children}</div>
        {/* Where a section's panel opens (`createPortal` from a client component): beside the section, as in Transazioni. */}
        <div id={PANEL_SLOT} className={styles.slot} />
      </div>
    </div>
  );
}
