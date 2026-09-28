import type { ReactNode } from 'react';
import styles from './VisuallyHidden.module.css';

/** Read by a screen reader, never drawn: the web's `accessibilityLabel`. */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className={styles.hidden}>{children}</span>;
}
