import type { ReactNode } from 'react';
import styles from './Band.module.css';

/**
 * §17.1.7: a page opens with a band, not a card — the period header across the width, one figure at
 * 56px, the rest beside it. On a narrow screen it becomes the phone's hero card.
 */
export function Band({ children }: { children: ReactNode }) {
  return <div className={styles.band}>{children}</div>;
}

export function BandFigures({ children }: { children: ReactNode }) {
  return <div className={styles.figures}>{children}</div>;
}

export function BandFigure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.figure}>
      <span className={styles.label}>{label}</span>
      {children}
    </div>
  );
}
