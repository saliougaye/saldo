import type { IconName } from '@saldo/ui';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { Icon } from './Icon';
import styles from './ListRow.module.css';

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
}: Props) {
  // A custom property, because a CSS Module cannot name one of the 24 category colours: the
  // stylesheet tints it (`--category-N` has no `-bg` companion; the phone tints at 14%).
  const tint = colorIndex === undefined ? undefined : `var(--category-${colorIndex})`;
  const body = (
    <>
      {icon === undefined ? null : (
        <span
          className={`${styles.iconBox} ${tint === undefined ? '' : styles.tinted}`}
          style={tint === undefined ? undefined : ({ '--row-tint': tint } as CSSProperties)}
        >
          <Icon name={icon} size={16} />
          {badge === undefined ? null : (
            <span className={styles.badge}>
              <Icon name={badge} size={10} />
            </span>
          )}
        </span>
      )}
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        {subtitle === undefined ? null : <span className={styles.subtitle}>{subtitle}</span>}
      </span>
      {trailing === undefined ? null : <span className={styles.trailing}>{trailing}</span>}
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
