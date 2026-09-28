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
export function NavLink({ href, icon, label }: { href: string; icon: IconName; label: string }) {
  const current = isCurrent(href, usePathname());
  return (
    <Link className={styles.link} href={href} aria-current={current ? 'page' : undefined}>
      <Icon name={icon} size={16} className={styles.icon} />
      <span>{label}</span>
    </Link>
  );
}
