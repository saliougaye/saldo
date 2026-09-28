import type { ReactNode } from 'react';
import { userI18n } from '../../../src/i18n/server';
import { requireWebUser } from '../../../src/server/auth/currentUser';
import { NavLink } from '../../../src/ui/NavLink';
import styles from './profile.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function ProfileLayout({ children }: { children: ReactNode }) {
  const user = await requireWebUser();
  const { t } = await userI18n(user.id);
  return (
    <div className={styles.layout}>
      <nav className={styles.subnav} aria-label={t('profile.title')}>
        <NavLink href="/profile/account" icon="settings" label={t('profile.title')} />
        <NavLink href="/profile/preferences" icon="wrench" label={t('settings.preferences')} />
        <NavLink href="/profile/passkeys" icon="key" label={t('web.passkeys.title')} />
      </nav>
      <div className={styles.section}>{children}</div>
    </div>
  );
}
