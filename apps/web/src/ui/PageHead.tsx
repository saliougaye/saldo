import type { ReactNode } from 'react';
import styles from './PageHead.module.css';

interface Props {
  /** The period header, or the page's title row. */
  title: ReactNode;
  /** The 56px figure: `HeroFigure` with an `AmountText size="hero"`. */
  hero: ReactNode;
  /** The smaller figures under the hero. */
  stats?: ReactNode;
  /** The shape on the right: a `ChartFrame`. */
  aside?: ReactNode;
}

/**
 * The head of Home, Statistiche and Conti (G2): title, hero and figures in the 7/12 column, a
 * chart in the 5/12 column, both on the same bottom line. One column below the breakpoint.
 */
export function PageHead({ title, hero, stats, aside }: Props) {
  return (
    <section className={styles.head}>
      <div className={styles.lead}>
        {title}
        {hero}
        {stats === undefined ? null : <div className={styles.stats}>{stats}</div>}
      </div>
      {aside === undefined ? null : <div className={styles.aside}>{aside}</div>}
    </section>
  );
}
