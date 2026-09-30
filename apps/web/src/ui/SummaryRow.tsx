import Link from 'next/link';
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
  /** The whole row opens its editor: the same page with the panel's parameter. */
  href?: string;
  /** Its editor is the one open in the panel. */
  selected?: boolean;
}

/** Profilo's row (§17.1.7): the setting and what it is now — the editor opens in the panel. */
export function SummaryRow({
  title,
  subtitle,
  value,
  leading,
  trailing,
  href,
  selected = false,
}: Props) {
  const body = (
    <>
      {leading}
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        {subtitle === undefined ? null : <span className={styles.subtitle}>{subtitle}</span>}
      </span>
      {value === undefined ? null : <span className={styles.value}>{value}</span>}
      {trailing}
    </>
  );
  if (href === undefined) return <div className={styles.row}>{body}</div>;
  return (
    <Link
      className={`${styles.row} ${selected ? styles.selected : ''}`}
      href={href}
      aria-current={selected ? 'true' : undefined}
    >
      {body}
    </Link>
  );
}
