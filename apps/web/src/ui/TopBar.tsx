import type { IconName } from '@saldo/ui';
import type { NavItem } from '../features/shell/nav';
import { AppLink as Link } from './AppLink';
import { Avatar } from './Avatar';
import { Brand } from './Brand';
import { Icon } from './Icon';
import { NavLink } from './NavLink';
import { NewTransactionLink } from './NewTransactionLink';
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
 * H1: from left to right the brand, the four destinations, «New transaction» and the avatar.
 * Admin, for the `admin` role, is an icon beside the avatar until R6 moves it into Profile.
 * Below 760px only the brand, Admin and the avatar show: the tab bar carries the rest.
 */
export function TopBar({ items, user, strings }: Props) {
  const main = items.filter((item) => item.trailing !== true);
  const trailing = items.filter((item) => item.trailing === true);
  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <Link className={styles.brand} href="/home">
          <Brand />
        </Link>
        <nav className={styles.nav} aria-label={strings.label}>
          {main.map((item) => (
            <NavLink
              key={item.key}
              href={item.href}
              icon={item.icon as IconName}
              label={item.label}
            />
          ))}
        </nav>
        <div className={styles.actions}>
          {trailing.map((item) => (
            <NavLink
              key={item.key}
              href={item.href}
              icon={item.icon as IconName}
              label={item.label}
              iconOnly
            />
          ))}
          {/* Decision 8: the form on Transazioni, from any page; `N` does the same (`Shortcuts`). */}
          <NewTransactionLink className={styles.new} aria-keyshortcuts="n">
            <Icon name="plus" size={16} />
            {strings.newTransaction}
          </NewTransactionLink>
          <Avatar name={user.name} label={strings.profile} />
        </div>
      </div>
    </header>
  );
}
