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

type Report = (delta: 1 | -1) => void;

const NavPendingContext = createContext<Report>(() => {});

/**
 * Counts the navigations that wait for the server. While the count is above zero it shows a thin bar
 * at the top of the page and tells a screen reader. The bar waits 150 ms (CSS), so a quick
 * navigation shows nothing. The status element stays mounted, so that a screen reader hears the
 * change of its text: a live region that arrives with its text is often not read.
 */
export function NavPendingProvider({ label, children }: { label: string; children: ReactNode }) {
  const [count, setCount] = useState(0);
  const report = useCallback<Report>((delta) => setCount((current) => current + delta), []);
  const pending = count > 0;
  return (
    <NavPendingContext value={report}>
      {pending ? <div className={styles.bar} aria-hidden="true" /> : null}
      <VisuallyHidden>
        <span role="status">{pending ? label : ''}</span>
      </VisuallyHidden>
      {children}
    </NavPendingContext>
  );
}

/** Adds one to the count while `pending` is true, and removes it when it ends or on unmount. */
function useReport(pending: boolean) {
  const report = useContext(NavPendingContext);
  useEffect(() => {
    if (!pending) return;
    report(1);
    return () => report(-1);
  }, [pending, report]);
}

/** Rendered inside a `<Link>`: tells the provider while that link's navigation is pending. */
export function LinkPending() {
  useReport(useLinkStatus().pending);
  return null;
}

/**
 * For a navigation that starts from code (`router.push` after a search, a key). Wrap the call in
 * the function this returns: the bar shows until the new page has rendered.
 */
export function useNavTransition(): (action: () => void) => void {
  const [pending, start] = useTransition();
  useReport(pending);
  return start;
}
