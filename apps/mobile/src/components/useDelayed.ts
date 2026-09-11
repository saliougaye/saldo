import { useEffect, useState } from 'react';

/** Long enough that a query the device answers straight away never flashes a skeleton. */
export const LOADING_GRACE_MS = 180;

/**
 * True only once `active` has been true for `delay` milliseconds.
 *
 * A local SQLite query usually answers in a frame or two. Showing a skeleton for that is worse
 * than showing nothing: the eye catches the flash and reads it as a glitch, not as loading.
 */
export function useDelayed(active: boolean, delay = LOADING_GRACE_MS): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) {
      setShown(false);
      return;
    }
    const timer = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(timer);
  }, [active, delay]);
  return shown;
}
