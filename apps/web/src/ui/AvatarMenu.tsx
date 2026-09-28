'use client';

import { Menu } from '@base-ui/react';
import type { IconName } from '@saldo/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavItem } from '../features/shell/nav';
import { isCurrent } from '../features/shell/nav';
import styles from './AvatarMenu.module.css';
import { Icon } from './Icon';
import { SignOutButton } from './SignOutButton';

interface Props {
  /** The top bar's trailing destinations (Admin). Shown here below the breakpoint only. */
  items: (NavItem & { label: string })[];
  user: { name: string; email: string };
  strings: { openMenu: string; profile: string; signOut: string; working: string };
}

/** The initial is decorative: the accessible name is on the trigger, and the menu names the account. */
export function AvatarMenu({ items, user, strings }: Props) {
  const path = usePathname();
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
            {/* §17.1.7: below the breakpoint Admin is reached from here, above it from the top
                bar's trailing links. One destination, one list (`navItems`), CSS picks the copy —
                so neither width shows both. Icon and `aria-current` as `NavLink` gives them, since
                on a narrow screen this row is the only copy there is. */}
            {items.map((item) => (
              <Menu.LinkItem
                key={item.key}
                className={`${styles.item} ${styles.narrowOnly}`}
                closeOnClick
                render={
                  <Link
                    href={item.href}
                    aria-current={isCurrent(item.href, path) ? 'page' : undefined}
                  />
                }
              >
                <Icon name={item.icon as IconName} size={16} className={styles.icon} />
                <span>{item.label}</span>
              </Menu.LinkItem>
            ))}
            {/* `LinkItem`, not `Item`: 1.8 has the part that renders an `<a>`, and it closes the
                menu on click, which `Item`'s `render` of a `Link` would have to be told to do. */}
            <Menu.LinkItem className={styles.item} closeOnClick render={<Link href="/profile" />}>
              <span>{strings.profile}</span>
            </Menu.LinkItem>
            {/* An `Item`, not a button beside one: only an item joins the popup's roving focus,
                so this is what makes «Esci» reachable with the arrow keys. It stays open while the
                request is in flight, which is what shows the busy label. */}
            <Menu.Item
              className={styles.item}
              closeOnClick={false}
              nativeButton
              render={
                <SignOutButton variant="row" label={strings.signOut} working={strings.working} />
              }
            />
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
