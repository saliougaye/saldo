'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type MouseEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { isEditable } from './isEditable';
import styles from './Panel.module.css';

interface Props {
  title: string;
  /** Where the ✕ goes, and where Esc goes: the same page without the selection. */
  closeHref: string;
  closeLabel: string;
  /** The body carries its own heading: the title stays as the name of the landmark and the focus target. */
  bare?: boolean;
  /** Below the breakpoint, a bottom sheet over a scrim instead of the whole screen: the form's shape. */
  sheet?: boolean;
  /**
   * A page that keeps the panel in client state: the ✕, the scrim and Esc ask it to close,
   * and it closes at once. It answers false when closing has to be a navigation after all; the panel
   * then closes as a panel without this prop does.
   */
  onClose?: () => boolean;
  /** The page is playing the exit (with `onClose`); it takes the panel out when the exit has played. */
  closing?: boolean;
  /**
   * Opened or closed from the keyboard: no entrance and no exit. The entrance reads it once, at mount
   * (an open panel never plays it again); the exit reads it live.
   */
  instant?: boolean;
  children: ReactNode;
}

/** `--layout-wide-breakpoint` (1024) less one: below it the panel is the whole screen. */
const NARROW = '(max-width: 1023px)';

/** The exit is quicker than the entrance: the system answers fast where the user has already decided. */
const EXIT_MS = 150;

/**
 * §17.1.7: the trailing panel of Transazioni, Conti and Profilo — 420px beside the list on a wide
 * screen, the whole screen on a narrow one. Rendered only when something is selected, so it mounts —
 * and slides in — when the panel opens, and stays put while the selection moves between rows.
 *
 * A client component for Esc and for focus. The selection lives in the URL, so closing is a
 * navigation and the ✕ is a plain link — with JavaScript off the panel still opens, still reloads
 * and still closes; only the key does nothing. A page can keep the panel in client state instead
 * (`onClose`): the URL then follows the panel, and nothing waits for the server.
 */
export function Panel({
  title,
  closeHref,
  closeLabel,
  bare = false,
  sheet = false,
  onClose,
  closing: closingProp = false,
  instant = false,
  children,
}: Props) {
  const router = useRouter();
  const heading = useRef<HTMLHeadingElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Which `closeHref` the exit is playing for. A navigation that keeps this panel mounted (the form
  // closing into the detail, in the same slot) brings a new `closeHref`, and the panel is open again.
  const [closingFor, setClosingFor] = useState<string | null>(null);
  const closing = closingProp || closingFor === closeHref;
  // The entrance plays once, when the panel mounts: a later change of `instant` must not replay it.
  const [enteredInstantly] = useState(instant);

  // A page that owns the panel closes it at once. Otherwise closing is a navigation, which unmounts
  // the panel at once: play the exit first, then go.
  const close = useCallback(() => {
    if (closingProp) return;
    if (onClose?.() === true) return;
    if (closingFor === closeHref) return;
    clearTimeout(timer.current);
    setClosingFor(closeHref);
    timer.current = setTimeout(() => router.push(closeHref), EXIT_MS);
  }, [router, closeHref, closingFor, onClose, closingProp]);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Full-screen, the panel covers the list the focus was left on: move it into the panel. Beside
  // the list it stays where it was, so the next row is one Tab away.
  // Unless something inside already took it: a form that opens on its first field (`autoFocus`).
  useEffect(() => {
    const panel = heading.current?.closest('aside');
    if (panel?.contains(document.activeElement) === true) return;
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
  const onLinkClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
      return;
    event.preventDefault();
    close();
  };

  return (
    <>
      {sheet ? (
        // The scrim closes as the ✕ does; it is not a second control, so it stays out of the tab order.
        <Link
          className={styles.scrim}
          href={closeHref}
          aria-hidden="true"
          tabIndex={-1}
          onClick={onLinkClick}
          data-closing={closing ? '' : undefined}
          data-instant={instant ? '' : undefined}
          data-still={enteredInstantly ? '' : undefined}
        />
      ) : null}
      <aside
        className={styles.panel}
        aria-label={title}
        data-closing={closing ? '' : undefined}
        data-instant={instant ? '' : undefined}
        data-still={enteredInstantly ? '' : undefined}
        data-sheet={sheet ? '' : undefined}
      >
        {sheet ? <span className={styles.handle} aria-hidden="true" /> : null}
        <div className={`${styles.head} ${bare ? styles.bare : ''}`}>
          <h2
            className={`${styles.title} ${bare ? styles.hidden : ''}`}
            ref={heading}
            tabIndex={-1}
          >
            {title}
          </h2>
          <Link
            className={styles.close}
            href={closeHref}
            aria-label={closeLabel}
            onClick={onLinkClick}
          >
            <Icon name="x" size={16} />
          </Link>
        </div>
        <div className={styles.body}>{children}</div>
      </aside>
    </>
  );
}
