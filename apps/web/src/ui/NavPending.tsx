'use client';

import { useLinkStatus } from 'next/link';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
  useTransition,
} from 'react';
import styles from './NavPending.module.css';
import { VisuallyHidden } from './VisuallyHidden';

/** A navigation that waits for the server, or a `PageSkeleton` on the screen. */
type Kind = 'navigation' | 'skeleton';
type Report = (kind: Kind, delta: 1 | -1) => void;

const NavPendingContext = createContext<Report>(() => {});

/** The same delay as the bar's `animation-delay` in `NavPending.module.css`. */
const ANNOUNCE_DELAY_MS = 150;

/**
 * Counts what waits for the server: the navigations, and the skeletons on the screen.
 *
 * - A navigation shows a thin bar at the top of the page. The bar waits 150 ms (CSS), so a quick
 *   navigation shows nothing.
 * - A skeleton shows no bar: the skeleton is already the visible feedback.
 * - For both, a screen reader hears «Loading…» after the same 150 ms. The status element stays
 *   mounted, because a live region that arrives with its text is often not read.
 */
export function NavPendingProvider({ label, children }: { label: string; children: ReactNode }) {
  const [counts, setCounts] = useState<Record<Kind, number>>({ navigation: 0, skeleton: 0 });
  const report = useCallback<Report>(
    (kind, delta) => setCounts((current) => ({ ...current, [kind]: current[kind] + delta })),
    [],
  );
  const busy = counts.navigation > 0 || counts.skeleton > 0;
  const [announced, setAnnounced] = useState(false);
  useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => setAnnounced(true), ANNOUNCE_DELAY_MS);
    return () => {
      clearTimeout(timer);
      setAnnounced(false);
    };
  }, [busy]);
  return (
    <NavPendingContext value={report}>
      {counts.navigation > 0 ? <div className={styles.bar} aria-hidden="true" /> : null}
      <VisuallyHidden>
        <span role="status">{announced ? label : ''}</span>
      </VisuallyHidden>
      {children}
    </NavPendingContext>
  );
}

/** Adds one to the count of `kind` while `pending` is true, and removes it when it ends or on unmount. */
function useReport(kind: Kind, pending: boolean) {
  const report = useContext(NavPendingContext);
  useEffect(() => {
    if (!pending) return;
    report(kind, 1);
    return () => report(kind, -1);
  }, [kind, pending, report]);
}

/** Rendered inside a `<Link>`: tells the provider while that link's navigation is pending. */
export function LinkPending() {
  useReport('navigation', useLinkStatus().pending);
  return null;
}

/**
 * Rendered inside `PageSkeleton`: the link stops being pending when the skeleton shows, and the
 * skeleton is `aria-hidden`. This keeps «Loading…» for a screen reader until the page replaces it.
 */
export function SkeletonPending() {
  useReport('skeleton', true);
  return null;
}

/**
 * For a navigation that starts from code (`router.push` after a search, a key). Wrap the call in
 * the function this returns: the bar shows until the new page has rendered.
 */
export function useNavTransition(): (action: () => void) => void {
  const [pending, start] = useTransition();
  useReport('navigation', pending);
  return start;
}
