import type { IconName } from '@saldo/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { IconBox } from './IconBox';
import styles from './ListRow.module.css';
import { VisuallyHidden } from './VisuallyHidden';

interface Props {
  icon?: IconName;
  /** The category palette's index; `undefined` leaves the icon the neutral surface. */
  colorIndex?: number;
  badge?: IconName;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  href?: string;
  /** A dated-ahead row: a 2px leading border, as on the phone (§5.12). */
  upcoming?: boolean;
  selected?: boolean;
  /**
   * The whole row as one sentence for a screen reader — the phone's `accessibilityLabel`. The
   * visible text is then hidden from it, so the row is not read twice.
   */
  label?: string;
}

export function ListRow({
  icon,
  colorIndex,
  badge,
  title,
  subtitle,
  trailing,
  href,
  upcoming = false,
  selected = false,
  label,
}: Props) {
  const hidden = label === undefined ? undefined : true;
  const body = (
    <>
      {label === undefined ? null : <VisuallyHidden>{label}</VisuallyHidden>}
      {icon === undefined ? null : <IconBox name={icon} colorIndex={colorIndex} badge={badge} />}
      <span className={styles.text} aria-hidden={hidden}>
        <span className={styles.title}>{title}</span>
        {subtitle === undefined ? null : <span className={styles.subtitle}>{subtitle}</span>}
      </span>
      {trailing === undefined ? null : (
        <span className={styles.trailing} aria-hidden={hidden}>
          {trailing}
        </span>
      )}
    </>
  );
  const className = `${styles.row} ${upcoming ? styles.upcoming : ''} ${
    selected ? styles.selected : ''
  }`;
  if (href === undefined) return <div className={className}>{body}</div>;
  return (
    <Link className={className} href={href} aria-current={selected ? 'true' : undefined}>
      {body}
    </Link>
  );
}
