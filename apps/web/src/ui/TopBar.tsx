import type { IconName } from '@saldo/ui';
import Link from 'next/link';
import type { NavItem } from '../features/shell/nav';
import { Avatar } from './Avatar';
import { Brand } from './Brand';
import { Icon } from './Icon';
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
    notYet: string;
  };
}

/**
 * §17.1.7: brand and sections leading, actions trailing. Below the breakpoint the bar keeps the
 * brand, Admin (an icon, so it fits) and the avatar — the tab bar carries the sections. The avatar
 * goes straight to Profilo, which is also where «Esci» lives.
 */
export function TopBar({ items, user, strings }: Props) {
  const sections = items.filter((item) => item.trailing !== true);
  const trailing = items.filter((item) => item.trailing === true);
  return (
    <header className={styles.bar}>
      <nav className={styles.inner} aria-label={strings.label}>
        <Link className={styles.brand} href="/home">
          <Brand />
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
                  iconOnly
                />
              ))}
            </div>
          )}
          {/* 0.3e turns this into the form panel; until then it says so rather than lying. */}
          <span className={styles.newDisabled} title={strings.notYet} aria-disabled="true">
            <Icon name="plus" size={16} />
            {strings.newTransaction}
            <kbd className={styles.kbd}>N</kbd>
          </span>
          <Avatar name={user.name} label={strings.profile} />
        </div>
      </nav>
    </header>
  );
}
