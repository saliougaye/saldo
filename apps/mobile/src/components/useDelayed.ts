import { useEffect, useRef, useState } from 'react';

/** Long enough that a query the device answers straight away never flashes a skeleton. */
export const LOADING_GRACE_MS = 120;
/** Once a skeleton is up, it stays up this long: a 30ms blink reads as a glitch, not as loading. */
export const LOADING_MIN_MS = 320;

/**
 * Whether to show a loading state for something that has been loading for `grace` milliseconds.
 *
 * Two rules, because either alone is wrong. Without the grace, a local SQLite query — usually a
 * frame or two — flashes a skeleton on every screen. Without the minimum, a query that crosses the
 * grace by a hair shows one for a few milliseconds, which is worse than showing none: the eye
 * catches the flash but not the content.
 */
export function useDelayed(
  active: boolean,
  grace = LOADING_GRACE_MS,
  minVisible = LOADING_MIN_MS,
): boolean {
  const [shown, setShown] = useState(false);
  const shownAt = useRef<number | null>(null);

  useEffect(() => {
    if (active) {
      const timer = setTimeout(() => {
        shownAt.current = Date.now();
        setShown(true);
      }, grace);
      return () => clearTimeout(timer);
    }
    if (shownAt.current === null) {
      setShown(false);
      return;
    }
    // It is up: keep it up for what is left of its minimum, then take it away.
    const elapsed = Date.now() - shownAt.current;
    const remaining = Math.max(0, minVisible - elapsed);
    const timer = setTimeout(() => {
      shownAt.current = null;
      setShown(false);
    }, remaining);
    return () => clearTimeout(timer);
  }, [active, grace, minVisible]);

  return shown;
}
