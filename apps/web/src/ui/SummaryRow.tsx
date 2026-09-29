import type { ReactNode } from 'react';
import styles from './SummaryRow.module.css';

interface Props {
  title: string;
  /** Under the title, faint: the days a cycle covers, the hour in a zone. */
  subtitle?: string;
  /** The current value, muted, on the trailing side. */
  value?: ReactNode;
  /** A leading tile, for the passkeys' key. */
  leading?: ReactNode;
  /** A control on the far end, after the value. */
  trailing?: ReactNode;
}

/** Profilo's row (§17.1.7): the setting and what it is now — the editor opens in the panel. */
export function SummaryRow({ title, subtitle, value, leading, trailing }: Props) {
  return (
    <div className={styles.row}>
      {leading}
      <div className={styles.text}>
        <span className={styles.title}>{title}</span>
        {subtitle === undefined ? null : <span className={styles.subtitle}>{subtitle}</span>}
      </div>
      {value === undefined ? null : <span className={styles.value}>{value}</span>}
      {trailing}
    </div>
  );
}
