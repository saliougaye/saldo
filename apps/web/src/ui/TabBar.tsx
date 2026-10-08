import type { IconName } from '@saldo/ui';
import type { NavItem } from '../features/shell/nav';
import { Icon } from './Icon';
import { NavLink } from './NavLink';
import { NewTransactionLink } from './NewTransactionLink';
import styles from './TabBar.module.css';

/**
 * Narrow screens only: the phone's four tabs, in the phone's order (§17.1.7), and the FAB above
 * them that opens «Nuova transazione» — the top bar's button, which is hidden down here. `label`
 * names the landmark: the top bar is visible at the same time now, and two navigations called the
 * same thing are two the screen reader cannot tell apart.
 */
export function TabBar({
  items,
  label,
  newTransaction,
}: {
  items: (NavItem & { label: string })[];
  label: string;
  newTransaction: string;
}) {
  return (
    <>
      <NewTransactionLink className={styles.fab} aria-label={newTransaction}>
        <Icon name="plus" size={26} />
      </NewTransactionLink>
      <nav className={styles.bar} aria-label={label}>
        {items.map((item) => (
          <NavLink
            key={item.key}
            href={item.href}
            icon={item.icon as IconName}
            label={item.label}
          />
        ))}
      </nav>
    </>
  );
}
