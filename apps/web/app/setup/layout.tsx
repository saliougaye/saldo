import type { ReactNode } from 'react';
import styles from '../(auth)/auth.module.css';

/** 0.3h: the auth pages' shape, as onboarding uses it — no top bar, one open column. */
export default function SetupLayout({ children }: { children: ReactNode }) {
  return <main className={styles.page}>{children}</main>;
}
