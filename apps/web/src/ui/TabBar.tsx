import type { IconName } from '@saldo/ui';
import type { NavItem } from '../features/shell/nav';
import { NavLink } from './NavLink';
import styles from './TabBar.module.css';

/** Narrow screens only: the phone's four tabs, in the phone's order (§17.1.7). */
export function TabBar({ items }: { items: (NavItem & { label: string })[] }) {
  return (
    <nav className={styles.bar} aria-label="Saldo">
      {items.map((item) => (
        <NavLink key={item.key} href={item.href} icon={item.icon as IconName} label={item.label} />
      ))}
    </nav>
  );
}
