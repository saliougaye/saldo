'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isCurrent } from '../features/shell/nav';
import styles from './Avatar.module.css';
import { initials } from './initials';

/**
 * The top bar's account: a link to Profilo, not a menu (§17.1.7). Profile holds the account, the
 * preferences and «Esci», so there is nothing left for a menu to offer. Rings itself while Profilo
 * is the page, as a tab does.
 */
export function Avatar({ name, label }: { name: string; label: string }) {
  const current = isCurrent('/profile', usePathname());
  return (
    <Link
      className={styles.avatar}
      href="/profile"
      aria-label={label}
      aria-current={current ? 'page' : undefined}
    >
      <span aria-hidden="true">{initials(name)}</span>
    </Link>
  );
}
