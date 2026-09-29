'use client';

import type { IconName } from '@saldo/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isCurrent } from '../features/shell/nav';
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
}: {
  href: string;
  icon: IconName;
  label: string;
  /** The label then only names the link for a screen reader (the top bar's Admin). */
  iconOnly?: boolean;
}) {
  const current = isCurrent(href, usePathname());
  return (
    <Link
      className={styles.link}
      href={href}
      aria-current={current ? 'page' : undefined}
      aria-label={iconOnly ? label : undefined}
    >
      <Icon name={icon} size={18} className={styles.icon} />
      {iconOnly ? null : <span>{label}</span>}
    </Link>
  );
}
