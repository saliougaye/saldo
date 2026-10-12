import type { IconName } from '@saldo/ui';
import type { NavItem } from '../features/shell/nav';
import { AppLink as Link } from './AppLink';
import { Brand } from './Brand';
import { Icon } from './Icon';
import { NavLink } from './NavLink';
import { NewTransactionLink } from './NewTransactionLink';
import { ProfileLink } from './ProfileLink';
import styles from './SideBar.module.css';

interface Props {
  items: (NavItem & { label: string })[];
  user: { name: string };
  strings: {
    /** The same name as the top bar's landmark: only one of the two shows at a width. */
    label: string;
    newTransaction: string;
    profile: string;
  };
}

/**
 * D1: the wide screen's navigation. The brand, the five destinations in one column, and at the
 * foot «Nuova transazione» and the person. `data-sidebar` lets Profilo and Admin hide it while
 * their own sub-navigation takes its place (D10).
 */
export function SideBar({ items, user, strings }: Props) {
  return (
    <div className={styles.bar} data-sidebar="">
      <Link className={styles.brand} href="/home">
        <Brand />
      </Link>
      <nav aria-label={strings.label}>
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.key}>
              <NavLink href={item.href} icon={item.icon as IconName} label={item.label} />
            </li>
          ))}
        </ul>
      </nav>
      <div className={styles.foot}>
        {/* Decision 8: the form on Transazioni, from any page; `N` does the same (`Shortcuts`). */}
        <NewTransactionLink className={styles.new} aria-keyshortcuts="n">
          <Icon name="plus" size={16} />
          {strings.newTransaction}
          <span aria-hidden="true">
            <kbd className={styles.kbd}>N</kbd>
          </span>
        </NewTransactionLink>
        <ProfileLink name={user.name} label={strings.profile} />
      </div>
    </div>
  );
}
