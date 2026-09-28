import { categoryColors, type IconName } from '@saldo/ui';
import { Icon } from './Icon';
import styles from './IconBox.module.css';

/**
 * Wrapped here, once, as the phone's `theme.categoryColor` wraps it: an index past the end of the
 * palette would otherwise name a variable that does not exist, which renders as no colour at all
 * rather than as an error.
 */
export function paletteIndex(colorIndex: number): number {
  return ((colorIndex % categoryColors.length) + categoryColors.length) % categoryColors.length;
}

interface Props {
  name: IconName;
  /** The category palette's index; `undefined` leaves the box the neutral surface. */
  colorIndex?: number;
  /** A small mark on the corner: the ↻ of a recurring row. */
  badge?: IconName;
}

/** The phone's `IconBox`: an icon on its category's tint, the one place the web draws it. */
export function IconBox({ name, colorIndex, badge }: Props) {
  const index = colorIndex === undefined ? undefined : paletteIndex(colorIndex);
  return (
    <span
      className={styles.box}
      style={
        index === undefined
          ? undefined
          : { background: `var(--category-${index}-tint)`, color: `var(--category-${index})` }
      }
    >
      <Icon name={name} size={16} />
      {badge === undefined ? null : (
        <span className={styles.badge}>
          <Icon name={badge} size={10} />
        </span>
      )}
    </span>
  );
}
