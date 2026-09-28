import type { ReactNode } from 'react';
import styles from './auth.module.css';

/** §17.1.7: no top bar on the auth pages — nobody is signed in yet. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <main className={styles.page}>{children}</main>;
}
