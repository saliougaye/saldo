import { categoryColors, type IconName } from '@saldo/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
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
  // Wrapped here, once, as the phone's `theme.categoryColor` wraps it: an index past the end of
  // the palette would otherwise name a variable that does not exist, which renders as no colour
  // at all rather than as an error.
  const paletteIndex =
    colorIndex === undefined
      ? undefined
      : ((colorIndex % categoryColors.length) + categoryColors.length) % categoryColors.length;
  const body = (
    <>
      {icon === undefined ? null : (
        <span
          className={styles.iconBox}
          style={
            paletteIndex === undefined
              ? undefined
              : {
                  background: `var(--category-${paletteIndex}-tint)`,
                  color: `var(--category-${paletteIndex})`,
                }
          }
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
