import type { IconName } from '@saldo/ui';
import type { NavItem } from '../features/shell/nav';
import { AppLink as Link } from './AppLink';
import { Avatar } from './Avatar';
import { Brand } from './Brand';
import { NavLink } from './NavLink';
import styles from './TopBar.module.css';

interface Props {
  items: (NavItem & { label: string })[];
  user: { name: string };
  strings: {
    /** Names the landmark: the tab bar is a second `<nav>` on the same page (§17.1.7). */
    label: string;
    newTransaction: string;
    profile: string;
  };
}

/**
 * Narrow screens only (D1): the brand, Admin as an icon and the avatar. The tab bar carries the
 * sections and the FAB.
 */
export function TopBar({ items, user, strings }: Props) {
  const trailing = items.filter((item) => item.trailing === true);
  return (
    <header className={styles.bar}>
      <nav className={styles.inner} aria-label={strings.label}>
        <Link className={styles.brand} href="/home">
          <Brand />
        </Link>
        <div className={styles.actions}>
          {trailing.length === 0 ? null : (
            <div className={styles.trailing}>
              {trailing.map((item) => (
                <NavLink
                  key={item.key}
                  href={item.href}
                  icon={item.icon as IconName}
                  label={item.label}
                  iconOnly
                />
              ))}
            </div>
          )}
          <Avatar name={user.name} label={strings.profile} />
        </div>
      </nav>
    </header>
  );
}
