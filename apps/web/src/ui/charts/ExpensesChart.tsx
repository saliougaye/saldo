import type { CSSProperties } from 'react';
import { AppLink as Link } from '../AppLink';
import styles from './ExpensesChart.module.css';

export interface ExpensesChartBar {
  key: string;
  /** The page of this period: the chart is the period picker (W6). */
  href: string;
  /** «Sep», under the bar. */
  tick: string;
  /** «1,366» under the tick; «~2,310» for a forecast period. Hidden below 760px. */
  value: string;
  /** The period and its amount, for the tooltip and a screen reader. */
  label: string;
  /** A forecast period's min–max, on a second line of the tooltip. */
  detail: string | null;
  kind: 'closed' | 'current' | 'forecast';
  selected: boolean;
  /** 0–1. */
  height: number;
  /** 0–1 and ≥ `height`: the running period's projection. */
  projectionHeight: number | null;
}

interface Props {
  bars: readonly ExpensesChartBar[];
  /** 0–1: the dashed line of «usual». */
  usualHeight: number | null;
}

/**
 * W6: one bar of expenses for each period and a dashed line for «usual». Each bar is a link to its
 * period, so the chart is the period picker. The running period fills what was spent and outlines
 * the projection above it; a forecast period is a light bar. The tooltip is CSS: it shows on hover
 * and on keyboard focus. A server component, with no state.
 */
export function ExpensesChart({ bars, usualHeight }: Props) {
  return (
    <div className={styles.cols}>
      {usualHeight === null ? null : (
        <span
          className={styles.usual}
          style={{ '--usual': usualHeight } as CSSProperties}
          aria-hidden="true"
        />
      )}
      {bars.map((bar) => (
        <Link
          key={bar.key}
          href={bar.href}
          className={`${styles.col} ${styles[bar.kind]}`}
          aria-current={bar.selected ? 'true' : undefined}
          aria-label={bar.detail === null ? bar.label : `${bar.label} · ${bar.detail}`}
        >
          <span className={styles.plot}>
            <span
              className={styles.bar}
              style={
                {
                  '--h': bar.height,
                  '--pj': bar.projectionHeight ?? bar.height,
                } as CSSProperties
              }
            >
              {bar.projectionHeight === null ? null : <span className={styles.projection} />}
              <span className={styles.spent} />
            </span>
            <span className={styles.tip} aria-hidden="true">
              <b>{bar.label}</b>
              {bar.detail}
            </span>
          </span>
          <span className={styles.tick} aria-hidden="true">
            <span className={styles.month}>{bar.tick}</span>
            <span className={styles.value}>{bar.value}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
