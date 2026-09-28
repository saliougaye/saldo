'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { Icon } from './Icon';
import styles from './Panel.module.css';

interface Props {
  title: string;
  /** Where the ✕ goes, and where Esc goes: the same page without the selection. */
  closeHref: string;
  closeLabel: string;
  children: ReactNode;
}

/**
 * §17.1.7: the trailing panel of Transazioni, Conti and Profilo — 420px beside the list on a wide
 * screen, the whole screen on a narrow one. Rendered only when something is selected.
 *
 * A client component for one reason: Esc. The selection lives in the URL, so closing is a
 * navigation and the ✕ is a plain link — with JavaScript off the panel still opens, still reloads
 * and still closes; only the key does nothing.
 */
export function Panel({ title, closeHref, closeLabel, children }: Props) {
  const router = useRouter();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') router.push(closeHref);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router, closeHref]);

  return (
    <aside className={styles.panel} aria-label={title}>
      <div className={styles.head}>
        <h2 className={styles.title}>{title}</h2>
        <Link className={styles.close} href={closeHref} aria-label={closeLabel}>
          <Icon name="x" size={16} />
        </Link>
      </div>
      <div className={styles.body}>{children}</div>
    </aside>
  );
}
