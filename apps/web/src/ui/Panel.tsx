'use client';

import { useRouter } from 'next/navigation';
import {
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { AppLink as Link } from './AppLink';
import { Icon } from './Icon';
import { isEditable } from './isEditable';
import { useNavTransition } from './NavPending';
import styles from './Panel.module.css';
import { isPlainClick } from './PanelNav';

/** How a close came: Esc is the keyboard; the ✕ and the scrim are the pointer. */
export type CloseFrom = 'key' | 'pointer';

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
   * and it closes at once. `from` says which: the keyboard closes with no motion. It answers false
   * when closing has to be a navigation after all; the panel then closes as a panel without this
   * prop does.
   */
  onClose?: (from: CloseFrom) => boolean;
  /** The page is playing the exit (with `onClose`); it takes the panel out when the exit has played. */
  closing?: boolean;
  /**
   * Opened or closed from the keyboard: no entrance and no exit. The entrance reads it once, when
   * the panel shows (an open panel never plays it again); the exit reads it live.
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
 * and slides in — when the panel opens, and stays put while the selection moves between rows. A page
 * may instead keep the panel mounted and hidden in `<Activity>`: it then slides in each time it shows.
 *
 * A client component for Esc and for focus. The selection lives in the URL, so closing is a
 * navigation and the ✕ is a plain link: a reload keeps the panel open, and a modified click opens
 * the list in a new tab. A page can keep the panel in client state instead (`onClose`): the URL then
 * follows the panel, and nothing waits for the server.
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
  const startNav = useNavTransition();
  const heading = useRef<HTMLHeadingElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Which `closeHref` the exit is playing for. A navigation that keeps this panel mounted (on Conti,
  // the form closing into the detail, in the same slot) brings a new `closeHref`, and the panel is open again.
  const [closingFor, setClosingFor] = useState<string | null>(null);
  const closing = closingProp || closingFor === closeHref;
  // The entrance plays once, when the panel shows: a later change of `instant` must not replay it.
  // A page can keep a panel mounted and hidden in `<Activity>` (the new transaction form): the
  // panel mounts once, while hidden, and shows many times. Layout effects run again each time it
  // shows, before the paint, so the latch takes the `instant` of that showing.
  const [enteredInstantly, setEnteredInstantly] = useState(instant);
  const instantNow = useRef(instant);
  useLayoutEffect(() => {
    instantNow.current = instant;
  });
  useLayoutEffect(() => {
    setEnteredInstantly(instantNow.current);
  }, []);

  // A page that owns the panel closes it at once. Otherwise closing is a navigation, which unmounts
  // the panel at once: play the exit first, then go.
  const close = useCallback(
    (from: CloseFrom) => {
      if (closingProp) return;
      if (onClose?.(from) === true) return;
      if (closingFor === closeHref) return;
      clearTimeout(timer.current);
      // The keyboard closes on the next frame: no exit (spec §06).
      if (from === 'key') {
        startNav(() => router.push(closeHref));
        return;
      }
      setClosingFor(closeHref);
      timer.current = setTimeout(() => startNav(() => router.push(closeHref)), EXIT_MS);
    },
    [router, startNav, closeHref, closingFor, onClose, closingProp],
  );

  // Unmounted, or hidden in `<Activity>`: a panel that shows again starts open.
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      setClosingFor(null);
    },
    [],
  );

  // Full-screen, the panel covers the list the focus was left on: move it into the panel. Beside
  // the list it stays where it was, so the next row is one Tab away.
  // Unless something inside already took it: a form that opens on its first field (the form's focus
  // effect, which runs first: child effects precede the parent's).
  useEffect(() => {
    const panel = heading.current?.closest('aside');
    if (panel?.contains(document.activeElement) === true) return;
    if (window.matchMedia(NARROW).matches) heading.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || isEditable(event.target)) return;
      close('key');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [close]);

  // With `onClose`, a plain click closes in place and the link never navigates: a prefetch of
  // `closeHref` only loads a page that nobody asks for. A modified click still opens it.
  const prefetch = onClose === undefined ? undefined : false;

  // A modified click (new tab) keeps the link's own behaviour.
  const onLinkClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    close('pointer');
  };

  return (
    <>
      {sheet ? (
        // The scrim closes as the ✕ does; it is not a second control, so it stays out of the tab order.
        <Link
          className={styles.scrim}
          href={closeHref}
          prefetch={prefetch}
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
            prefetch={prefetch}
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
