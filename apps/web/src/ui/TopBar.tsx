import type { IconName } from '@saldo/ui';
import Link from 'next/link';
import type { NavItem } from '../features/shell/nav';
import { AvatarMenu } from './AvatarMenu';
import { Icon } from './Icon';
import { NavLink } from './NavLink';
import styles from './TopBar.module.css';

interface Props {
  items: (NavItem & { label: string })[];
  user: { name: string; email: string };
  strings: {
    newTransaction: string;
    openMenu: string;
    profile: string;
    signOut: string;
    working: string;
    notYet: string;
  };
}

/**
 * §17.1.7: brand and sections leading, actions trailing. Below the breakpoint the bar keeps only
 * the brand and the avatar — the tab bar carries the sections, and Profile, Admin and sign-out are
 * reached from the avatar, which is why the trailing items are handed to it as well as rendered
 * here. CSS decides which copy of them is seen; `navItems` stays the one list.
 */
export function TopBar({ items, user, strings }: Props) {
  const sections = items.filter((item) => item.trailing !== true);
  const trailing = items.filter((item) => item.trailing === true);
  return (
    <header className={styles.bar}>
      <nav className={styles.inner} aria-label="Saldo">
        <Link className={styles.brand} href="/home">
          Saldo
        </Link>
        <ul className={styles.sections}>
          {sections.map((item) => (
            <li key={item.key}>
              <NavLink href={item.href} icon={item.icon as IconName} label={item.label} />
            </li>
          ))}
        </ul>
        <div className={styles.actions}>
          {trailing.length === 0 ? null : (
            <div className={styles.trailing}>
              {trailing.map((item) => (
                <NavLink
                  key={item.key}
                  href={item.href}
                  icon={item.icon as IconName}
                  label={item.label}
                />
              ))}
            </div>
          )}
          {/* 0.3e turns this into the form panel; until then it says so rather than lying. */}
          <span className={styles.newDisabled} title={strings.notYet}>
            <Icon name="plus" size={16} />
            {strings.newTransaction}
          </span>
          <AvatarMenu items={trailing} user={user} strings={strings} />
        </div>
      </nav>
    </header>
  );
}
