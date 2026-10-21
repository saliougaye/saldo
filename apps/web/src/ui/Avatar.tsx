'use client';

import { Menu } from '@base-ui/react';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '../client/authClient';
import { isCurrent } from '../features/shell/nav';
import { AppLink as Link } from './AppLink';
import styles from './Avatar.module.css';
import { initials } from './initials';

interface Props {
  name: string;
  email: string;
  strings: { menu: string; profile: string; signOut: string; working: string };
}

/**
 * W10: the avatar opens the account menu — the name and the email, «Profile» and «Sign out». It
 * rings itself while Profile or Admin is the page, as a tab does. Sign out is the same call as
 * `SignOutButton`: Better Auth deletes the session, then `replace`, so Back does not land on a page
 * that has no session behind it (§17.1.4).
 */
export function Avatar({ name, email, strings }: Props) {
  const path = usePathname();
  const current = isCurrent('/profile', path) || isCurrent('/admin', path);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const signOut = () => {
    setBusy(true);
    void authClient.signOut().finally(() => router.replace('/login'));
  };
  return (
    <Menu.Root>
      <Menu.Trigger
        className={styles.avatar}
        aria-label={strings.menu}
        data-current={current ? '' : undefined}
      >
        <span aria-hidden="true">{initials(name)}</span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className={styles.positioner} sideOffset={8} align="end">
          <Menu.Popup className={styles.popup}>
            <div className={styles.who}>
              <b>{name}</b>
              <span>{email}</span>
            </div>
            <Menu.LinkItem className={styles.item} closeOnClick render={<Link href="/profile" />}>
              {strings.profile}
            </Menu.LinkItem>
            <Menu.Separator className={styles.separator} />
            <Menu.Item
              className={`${styles.item} ${styles.danger}`}
              disabled={busy}
              closeOnClick={false}
              onClick={signOut}
            >
              {busy ? strings.working : strings.signOut}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
