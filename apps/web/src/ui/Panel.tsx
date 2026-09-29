'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type MouseEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import styles from './Panel.module.css';

interface Props {
  title: string;
  /** Where the ✕ goes, and where Esc goes: the same page without the selection. */
  closeHref: string;
  closeLabel: string;
  /** The body carries its own heading: the title stays as the name of the landmark and the focus target. */
  bare?: boolean;
  children: ReactNode;
}

/** `--layout-wide-breakpoint` (1024) less one: below it the panel is the whole screen. */
const NARROW = '(max-width: 1023px)';

/** The exit is quicker than the entrance: the system answers fast where the user has already decided. */
const EXIT_MS = 150;

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
 * screen, the whole screen on a narrow one. Rendered only when something is selected, so it mounts —
 * and slides in — when the panel opens, and stays put while the selection moves between rows.
 *
 * A client component for Esc and for focus. The selection lives in the URL, so closing is a
 * navigation and the ✕ is a plain link — with JavaScript off the panel still opens, still reloads
 * and still closes; only the key does nothing.
 */
export function Panel({ title, closeHref, closeLabel, bare = false, children }: Props) {
  const router = useRouter();
  const heading = useRef<HTMLHeadingElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [closing, setClosing] = useState(false);

  // Closing is a navigation, which unmounts the panel at once: play the exit first, then go.
  const close = useCallback(() => {
    if (timer.current !== undefined) return;
    setClosing(true);
    timer.current = setTimeout(() => router.push(closeHref), EXIT_MS);
  }, [router, closeHref]);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Full-screen, the panel covers the list the focus was left on: move it into the panel. Beside
  // the list it stays where it was, so the next row is one Tab away.
  useEffect(() => {
    if (window.matchMedia(NARROW).matches) heading.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || isEditable(event.target)) return;
      close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [close]);

  // A modified click (new tab) keeps the link's own behaviour.
  const onClose = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
      return;
    event.preventDefault();
    close();
  };

  return (
    <aside className={styles.panel} aria-label={title} data-closing={closing ? '' : undefined}>
      <div className={`${styles.head} ${bare ? styles.bare : ''}`}>
        <h2 className={`${styles.title} ${bare ? styles.hidden : ''}`} ref={heading} tabIndex={-1}>
          {title}
        </h2>
        <Link className={styles.close} href={closeHref} aria-label={closeLabel} onClick={onClose}>
          <Icon name="x" size={16} />
        </Link>
      </div>
      <div className={styles.body}>{children}</div>
    </aside>
  );
}
