import type { IconName } from '@saldo/ui';
import { Icon } from './Icon';
import { paletteIndex } from './IconBox';
import styles from './PickTile.module.css';

/** The grid around the tiles, and the class of the link each tile is (a `PanelLink` or a `Link`). */
export const pickTilesClassName = styles.tiles;
export const pickTileClassName = styles.tile;

interface Props {
  icon: IconName;
  /** The category palette's index: the colour of the glyph. */
  colorIndex: number;
  /** A goal's glyph sits in a circle, as its ring does; an account's in a square. */
  round?: boolean;
  title: string;
  /** One line under the title: what the type or the preset is for. */
  hint?: string;
}

/**
 * The inside of a first-step tile (W11): a coloured glyph on the raised surface, the name and one
 * line under it. The page gives the link around it, because a type opens a panel in place and a
 * preset navigates to another page.
 */
export function PickTileBody({ icon, colorIndex, round = false, title, hint }: Props) {
  return (
    <>
      <span
        className={`${styles.icon} ${round ? styles.round : ''}`}
        style={{ color: `var(--category-${paletteIndex(colorIndex)})` }}
        aria-hidden="true"
      >
        <Icon name={icon} size={17} />
      </span>
      <span className={styles.text}>
        <b className={styles.title}>{title}</b>
        {hint === undefined ? null : <span className={styles.hint}>{hint}</span>}
      </span>
    </>
  );
}
