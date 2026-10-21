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
  user: { name: string; email: string };
  strings: {
    /** Names the landmark: the tab bar is a second `<nav>` on the same page (§17.1.7). */
    label: string;
    newTransaction: string;
    accountMenu: string;
    profile: string;
    signOut: string;
    working: string;
  };
}

/**
 * H1: from left to right the brand, the four destinations, «New transaction» and the avatar, which
 * opens the account menu (W10). Admin is a group of the Profile menu, not an item here.
 * Below 760px only the brand and the avatar show: the tab bar carries the rest.
 */
export function TopBar({ items, user, strings }: Props) {
  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <Link className={styles.brand} href="/home">
          <Brand />
        </Link>
        <nav className={styles.nav} aria-label={strings.label}>
          {items.map((item) => (
            <NavLink
              key={item.key}
              href={item.href}
              icon={item.icon as IconName}
              label={item.label}
            />
          ))}
        </nav>
        <div className={styles.actions}>
          {/* Decision 8: the form on Transazioni, from any page; `N` does the same (`Shortcuts`). */}
          <NewTransactionLink className={styles.new} aria-keyshortcuts="n">
            <Icon name="plus" size={16} />
            {strings.newTransaction}
          </NewTransactionLink>
          <Avatar
            name={user.name}
            email={user.email}
            strings={{
              menu: strings.accountMenu,
              profile: strings.profile,
              signOut: strings.signOut,
              working: strings.working,
            }}
          />
        </div>
      </div>
    </header>
  );
}
