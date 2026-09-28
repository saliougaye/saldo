import { readSettings } from '@saldo/core';
import type { ReactNode } from 'react';
import { navItems } from '../../src/features/shell/nav';
import { userI18n } from '../../src/i18n/server';
import { isAdmin } from '../../src/server/auth/admin';
import { requireWebUser } from '../../src/server/auth/currentUser';
import { getDb } from '../../src/server/db/client';
import { loadUserData } from '../../src/server/userData/load';
import { TabBar } from '../../src/ui/TabBar';
import { TopBar } from '../../src/ui/TopBar';
import styles from './shell.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * §17.1.7: a top bar on wide screens, the phone's tab bar on narrow ones — both rendered, CSS picks.
 * The theme is set here rather than on `<html>`, which a nested layout cannot touch; `tokensCss()`
 * writes both forced themes as attribute selectors, so this wrapper carries either of them.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireWebUser();
  const [data, admin, { t }] = await Promise.all([
    loadUserData(user.id),
    isAdmin(getDb(), user.id),
    userI18n(user.id),
  ]);
  const settings = readSettings(data.settings);
  const items = navItems(admin).map((item) => ({ ...item, label: t(item.labelKey) }));
  return (
    <div
      className={styles.shell}
      data-theme={settings.theme === 'system' ? undefined : settings.theme}
    >
      <a className={styles.skip} href="#content">
        {t('web.shell.skipToContent')}
      </a>
      <TopBar
        items={items}
        user={{ name: user.displayName, email: user.email }}
        strings={{
          newTransaction: t('web.shell.newTransaction'),
          openMenu: t('web.shell.openMenu'),
          profile: t('profile.title'),
          signOut: t('sync.signOut'),
          working: t('common.loading'),
          notYet: t('web.shell.comingIn0_3e'),
        }}
      />
      <main className={styles.content} id="content">
        {children}
      </main>
      <TabBar items={items.filter((item) => item.trailing !== true)} />
    </div>
  );
}
