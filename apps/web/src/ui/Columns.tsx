import type { ReactNode } from 'react';
import styles from './Columns.module.css';

/** The 7/5 pair of Home and Statistiche: one column below the breakpoint, in source order. */
export function Columns({ lead, trail }: { lead: ReactNode; trail: ReactNode }) {
  return (
    <div className={styles.columns}>
      <div className={styles.lead}>{lead}</div>
      <div className={styles.trail}>{trail}</div>
    </div>
  );
}
