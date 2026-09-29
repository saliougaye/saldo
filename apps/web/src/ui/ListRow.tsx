import type { IconName } from '@saldo/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { IconBox } from './IconBox';
import styles from './ListRow.module.css';
import { VisuallyHidden } from './VisuallyHidden';

interface Props {
  /** Replaces the icon box: a budget's or a goal's ring leads its row. */
  leading?: ReactNode;
  icon?: IconName;
  /** The category palette's index; `undefined` leaves the icon the neutral surface. */
  colorIndex?: number;
  badge?: IconName;
  /**
   * What the badge means, in words. `IconBox` draws the badge `aria-hidden`, so without this the
   * one thing it says — that the row repeats — reaches nobody reading with a screen reader.
   */
  badgeLabel?: string;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  href?: string;
  /** A dated-ahead row: a 2px leading border, as on the phone (§5.12). */
  upcoming?: boolean;
  /** Home's density: 12px above and below, no side padding, the hover painted past the row. */
  open?: boolean;
  selected?: boolean;
  /**
   * The whole row as one sentence for a screen reader — the phone's `accessibilityLabel`. The
   * visible text is then hidden from it, so the row is not read twice.
   */
  label?: string;
}

export function ListRow({
  leading,
  icon,
  colorIndex,
  badge,
  badgeLabel,
  title,
  subtitle,
  trailing,
  href,
  upcoming = false,
  open = false,
  selected = false,
  label,
}: Props) {
  const hidden = label === undefined ? undefined : true;
  const body = (
    <>
      {label === undefined ? null : <VisuallyHidden>{label}</VisuallyHidden>}
      {leading}
      {icon === undefined ? null : <IconBox name={icon} colorIndex={colorIndex} badge={badge} />}
      {badge === undefined || badgeLabel === undefined || label !== undefined ? null : (
        <VisuallyHidden>{badgeLabel}</VisuallyHidden>
      )}
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
  const className = `${styles.row} ${open ? styles.open : ''} ${upcoming ? styles.upcoming : ''} ${
    selected ? styles.selected : ''
  }`;
  if (href === undefined) return <div className={className}>{body}</div>;
  return (
    <Link className={className} href={href} aria-current={selected ? 'true' : undefined}>
      {body}
    </Link>
  );
}
