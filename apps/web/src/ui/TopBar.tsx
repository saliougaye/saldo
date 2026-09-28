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
 * §17.1.7: brand and sections leading, actions trailing. The sections are hidden below the
 * breakpoint, where the tab bar carries them — the bar itself stays, because Profile, Admin and
 * sign-out are reached from the avatar on a narrow screen and it lives here.
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
          {trailing.map((item) => (
            <NavLink
              key={item.key}
              href={item.href}
              icon={item.icon as IconName}
              label={item.label}
            />
          ))}
          {/* 0.3e turns this into the form panel; until then it says so rather than lying. */}
          <span className={styles.newDisabled} title={strings.notYet}>
            <Icon name="plus" size={16} />
            {strings.newTransaction}
          </span>
          <AvatarMenu user={user} strings={strings} />
        </div>
      </nav>
    </header>
  );
}
