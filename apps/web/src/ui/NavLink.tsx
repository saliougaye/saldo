'use client';

import type { IconName } from '@saldo/ui';
import { usePathname } from 'next/navigation';
import { isCurrent } from '../features/shell/nav';
import { AppLink as Link } from './AppLink';
import { Icon } from './Icon';
import styles from './NavLink.module.css';

/**
 * A client component for one reason: `aria-current` needs the path, and `usePathname()` is the only
 * way a component below a layout learns it without every page passing it down.
 */
export function NavLink({
  href,
  icon,
  label,
  iconOnly = false,
  count,
  alsoCurrentAt,
}: {
  href: string;
  icon: IconName;
  label: string;
  /** The label then only names the link for a screen reader (the top bar's Admin). */
  iconOnly?: boolean;
  /** How many there are, at the end of the link (the admin's «Account 4»); absent, nothing is drawn. */
  count?: number;
  /** A second path where this link is the current one: «Profile» on the bare `/profile`. */
  alsoCurrentAt?: string;
}) {
  const path = usePathname();
  const current = isCurrent(href, path) || (alsoCurrentAt !== undefined && path === alsoCurrentAt);
  return (
    <Link
      className={styles.link}
      href={href}
      aria-current={current ? 'page' : undefined}
      aria-label={iconOnly ? label : undefined}
    >
      <Icon name={icon} size={18} className={styles.icon} />
      {iconOnly ? null : <span>{label}</span>}
      {count === undefined ? null : <span className={styles.count}>{count}</span>}
    </Link>
  );
}
