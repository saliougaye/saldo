import type { IconName } from '@saldo/ui';
import type { ReactNode } from 'react';
import { Icon } from '../../../src/ui/Icon';
import { paletteIndex } from '../../../src/ui/IconBox';
import { PanelLink } from '../../../src/ui/PanelNav';
import { VisuallyHidden } from '../../../src/ui/VisuallyHidden';
import styles from './TxRow.module.css';

interface Props {
  /** The row's edit form (W3). */
  href: string;
  id: string;
  icon: IconName;
  /** The category palette's index; none leaves the icon muted. */
  colorIndex: number | null | undefined;
  title: string;
  subtitle: string;
  recurring: boolean;
  /** What the repeat icon means, for a screen reader. */
  recurringLabel: string;
  /** A row dated after today: the title in the muted ink. */
  upcoming: boolean;
  amount: ReactNode;
}

/**
 * One row of Transazioni (W5, figure 3): the category icon in the colour of its category, the
 * title, «Category · Account · #tag» under it, the amount. No chips (W12). The row is a link to
 * its edit form; `selectId` puts it in the walk of the arrows (`ListKeys`).
 */
export function TxRow({
  href,
  id,
  icon,
  colorIndex,
  title,
  subtitle,
  recurring,
  recurringLabel,
  upcoming,
  amount,
}: Props) {
  const tint =
    colorIndex === null || colorIndex === undefined
      ? undefined
      : `var(--category-${paletteIndex(colorIndex)})`;
  return (
    <PanelLink
      className={`${styles.row} ${upcoming ? styles.upcoming : ''}`}
      selectedClassName={styles.selected}
      selectId={id}
      href={href}
    >
      <span className={styles.icon} style={{ color: tint }}>
        <Icon name={icon} size={18} />
      </span>
      <span className={styles.text}>
        <span className={styles.title}>
          <b>{title}</b>
          {recurring ? (
            <>
              <Icon name="repeat" size={12} className={styles.repeat} />
              <VisuallyHidden>{recurringLabel}</VisuallyHidden>
            </>
          ) : null}
        </span>
        <span className={styles.subtitle}>{subtitle}</span>
      </span>
      <span className={styles.amount}>{amount}</span>
    </PanelLink>
  );
}
