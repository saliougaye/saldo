'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useRef } from 'react';
import { Icon } from './Icon';
import styles from './Panel.module.css';

interface Props {
  title: string;
  /** Where the ✕ goes, and where Esc goes: the same page without the selection. */
  closeHref: string;
  closeLabel: string;
  children: ReactNode;
}

/** `--layout-wide-breakpoint` (1024) less one: below it the panel is the whole screen. */
const NARROW = '(max-width: 1023px)';

/** A key typed into a field belongs to the field: Esc there clears or cancels, it does not close. */
function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

/**
 * §17.1.7: the trailing panel of Transazioni, Conti and Profilo — 420px beside the list on a wide
 * screen, the whole screen on a narrow one. Rendered only when something is selected; the page
 * keys it by the selection, so each one mounts afresh.
 *
 * A client component for Esc and for focus. The selection lives in the URL, so closing is a
 * navigation and the ✕ is a plain link — with JavaScript off the panel still opens, still reloads
 * and still closes; only the key does nothing.
 */
export function Panel({ title, closeHref, closeLabel, children }: Props) {
  const router = useRouter();
  const heading = useRef<HTMLHeadingElement>(null);

  // Full-screen, the panel covers the list the focus was left on: move it into the panel. Beside
  // the list it stays where it was, so the next row is one Tab away.
  useEffect(() => {
    if (window.matchMedia(NARROW).matches) heading.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || isEditable(event.target)) return;
      router.push(closeHref);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router, closeHref]);

  return (
    <aside className={styles.panel} aria-label={title}>
      <div className={styles.head}>
        <h2 className={styles.title} ref={heading} tabIndex={-1}>
          {title}
        </h2>
        <Link className={styles.close} href={closeHref} aria-label={closeLabel}>
          <Icon name="x" size={16} />
        </Link>
      </div>
      <div className={styles.body}>{children}</div>
    </aside>
  );
}
