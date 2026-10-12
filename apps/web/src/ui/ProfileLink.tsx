'use client';

import { usePathname } from 'next/navigation';
import { isCurrent } from '../features/shell/nav';
import { AppLink as Link } from './AppLink';
import { initials } from './initials';
import styles from './ProfileLink.module.css';

/**
 * The sidebar's foot (D1): the person's initials and name, a link to Profilo. Current while
 * Profilo is the page, as a nav link is. A client component for `usePathname()`, as `Avatar` is.
 */
export function ProfileLink({ name, label }: { name: string; label: string }) {
  const current = isCurrent('/profile', usePathname());
  return (
    <Link
      className={styles.link}
      href="/profile"
      aria-label={label}
      aria-current={current ? 'page' : undefined}
    >
      <span className={styles.avatar} aria-hidden="true">
        {initials(name)}
      </span>
      <span className={styles.name} aria-hidden="true">
        {name}
      </span>
    </Link>
  );
}
