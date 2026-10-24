import type { CSSProperties } from 'react';
import styles from './HistoryBars.module.css';

export interface HistoryBar {
  key: string;
  /** «Sep», under the bar. */
  tick: string;
  /** Minor units. */
  amount: number;
}

interface Props {
  /** Oldest first; the last one is the selected period, in `colour`. */
  bars: readonly HistoryBar[];
  /** A CSS colour from the tokens: the category's. */
  colour: string;
  /** Minor units: the dashed line. `null` draws none. */
  median: number | null;
}

/**
 * A category's spend in its last periods (the panel of a Ripartizione row): one bar for each
 * period, the selected one in the category's colour, a dashed line for the median and the period
 * under each bar. Scaled on the largest of the bars and the median, so both fit. Decorative: the
 * figures are in words beside it.
 */
export function HistoryBars({ bars, colour, median }: Props) {
  const top = Math.max(1, median ?? 0, ...bars.map((bar) => bar.amount));
  const last = bars.length - 1;
  return (
    <div className={styles.chart} aria-hidden="true">
      <div className={styles.plot} style={{ '--count': bars.length } as CSSProperties}>
        {bars.map((bar, index) => (
          <span
            key={bar.key}
            className={styles.bar}
            style={
              {
                '--h': bar.amount / top,
                background: index === last ? colour : undefined,
              } as CSSProperties
            }
          />
        ))}
        {median === null ? null : (
          <span className={styles.median} style={{ '--m': median / top } as CSSProperties} />
        )}
      </div>
      <div className={styles.ticks} style={{ '--count': bars.length } as CSSProperties}>
        {bars.map((bar, index) => (
          <span key={bar.key} className={index === last ? styles.current : undefined}>
            {bar.tick}
          </span>
        ))}
      </div>
    </div>
  );
}
