import type { ReactNode } from 'react';
import styles from '../(auth)/auth.module.css';

/**
 * Decision 11 of 0.3e-1: the auth pages' shape — no top bar, one open column — because onboarding
 * comes before the app has anything to put in one. The column's rules stay in `auth.module.css`.
 */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return <main className={styles.page}>{children}</main>;
}
