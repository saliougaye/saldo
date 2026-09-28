'use client';

import { Menu } from '@base-ui/react';
import Link from 'next/link';
import styles from './AvatarMenu.module.css';
import { SignOutButton } from './SignOutButton';

interface Props {
  user: { name: string; email: string };
  strings: { openMenu: string; profile: string; signOut: string; working: string };
}

/** The initial is decorative: the accessible name is on the trigger, and the menu names the account. */
export function AvatarMenu({ user, strings }: Props) {
  const initial = user.name.trim().slice(0, 1).toUpperCase();
  return (
    <Menu.Root>
      <Menu.Trigger className={styles.avatar} aria-label={strings.openMenu}>
        <span aria-hidden="true">{initial}</span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={8} align="end">
          <Menu.Popup className={styles.popup}>
            <div className={styles.account}>
              <b className={styles.name}>{user.name}</b>
              <span className={styles.email}>{user.email}</span>
            </div>
            {/* `LinkItem`, not `Item`: 1.8 has the part that renders an `<a>`, and it closes the
                menu on click, which `Item`'s `render` of a `Link` would have to be told to do. */}
            <Menu.LinkItem className={styles.item} closeOnClick render={<Link href="/profile" />}>
              {strings.profile}
            </Menu.LinkItem>
            {/* An `Item`, not a button beside one: only an item joins the popup's roving focus,
                so this is what makes «Esci» reachable with the arrow keys. It stays open while the
                request is in flight, which is what shows the busy label. */}
            <Menu.Item
              closeOnClick={false}
              nativeButton
              render={<SignOutButton label={strings.signOut} working={strings.working} />}
            />
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
