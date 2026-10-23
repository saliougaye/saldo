import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { paletteCommands } from '../../src/features/search/commands';
import { navItems } from '../../src/features/shell/nav';
import { userI18n } from '../../src/i18n/server';
import { requireWebUser } from '../../src/server/auth/currentUser';
import { CommandPalette } from '../../src/ui/CommandPalette';
import { NavPendingProvider } from '../../src/ui/NavPending';
import { Shortcuts } from '../../src/ui/Shortcuts';
import { TabBar } from '../../src/ui/TabBar';
import { TopBar } from '../../src/ui/TopBar';
import { searchAction } from './actions';
import styles from './shell.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * H1 and H2 (2026-10-20): one top bar on every width, and one column of 1040px under it. Below
 * 760px the top bar keeps the brand and the avatar, and the phone's tab bar navigates.
 * The theme is *not* set here: the root layout puts it on `<html>`, which is the only element a
 * portalled popup is also inside.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireWebUser();
  const { t } = await userI18n(user.id);
  const items = navItems().map((item) => ({ ...item, label: t(item.labelKey) }));
  // Palette spec §02: the shortcut the button shows, right on the first render.
  const apple = /Mac|iPhone|iPad/.test((await headers()).get('user-agent') ?? '');
  return (
    <NavPendingProvider label={t('common.loading')}>
      <div className={styles.shell}>
        <a className={styles.skip} href="#content">
          {t('web.shell.skipToContent')}
        </a>
        <TopBar
          items={items}
          user={{ name: user.displayName, email: user.email }}
          search={
            <CommandPalette
              commands={paletteCommands(t)}
              search={searchAction}
              apple={apple}
              strings={{
                button: t('common.search'),
                title: t('web.search.title'),
                placeholder: t('web.search.placeholder'),
                actions: t('web.search.actions'),
                goTo: t('web.search.goTo'),
                searching: t('web.search.searching'),
                error: t('web.search.error'),
                noResultsHint: t('web.search.noResultsHint'),
                move: t('web.search.keysMove'),
                open: t('web.search.keysOpen'),
                close: t('web.search.keysClose'),
              }}
            />
          }
          strings={{
            label: t('web.shell.mainNav'),
            newTransaction: t('web.shell.newTransaction'),
            accountMenu: t('web.shell.accountMenu'),
            profile: t('profile.title'),
            signOut: t('sync.signOut'),
            working: t('common.loading'),
          }}
        />
        <main className={styles.content} id="content">
          {children}
        </main>
        <TabBar
          items={items}
          label={t('web.shell.sectionNav')}
          newTransaction={t('web.shell.newTransaction')}
        />
        <Shortcuts />
      </div>
    </NavPendingProvider>
  );
}
