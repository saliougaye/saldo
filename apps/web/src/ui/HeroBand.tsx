import type { ReactNode } from 'react';
import styles from './HeroBand.module.css';

/** A key figure of a page head: its label above, then the amount. */
export function HeroFigure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.figure}>
      <span className={styles.label}>{label}</span>
      {children}
    </div>
  );
}
