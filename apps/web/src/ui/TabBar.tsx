import type { IconName } from '@saldo/ui';
import type { NavItem } from '../features/shell/nav';
import { NavLink } from './NavLink';
import styles from './TabBar.module.css';

/**
 * Narrow screens only: the phone's four tabs, in the phone's order (§17.1.7). `label` names the
 * landmark: the top bar is visible at the same time now, and two navigations called the same thing
 * are two the screen reader cannot tell apart.
 */
export function TabBar({
  items,
  label,
}: {
  items: (NavItem & { label: string })[];
  label: string;
}) {
  return (
    <nav className={styles.bar} aria-label={label}>
      {items.map((item) => (
        <NavLink key={item.key} href={item.href} icon={item.icon as IconName} label={item.label} />
      ))}
    </nav>
  );
}
