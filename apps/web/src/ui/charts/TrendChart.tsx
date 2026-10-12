import { chartLine, trendGeometry } from '@saldo/ui';
import styles from './TrendChart.module.css';

/**
 * The coordinate space the lines are drawn in. A server component cannot measure its box, so the
 * SVG stretches this space to whatever width it gets (`preserveAspectRatio="none"`) and keeps its
 * strokes at their own width (`vector-effect`); the dot, which would stretch into an ellipse, is
 * placed over it in percentages instead.
 */
const VIEW_WIDTH = 600;
/** §17.1.7: Andamento del periodo is 220px tall on the web, where the phone's is 96. */
export const WEB_TREND_HEIGHT = 220;

interface Props {
  /** Cumulative counted expenses per elapsed day (§5.6). */
  current: readonly number[];
  /** The average of the previous three periods, resampled to the current length. */
  usual: readonly number[];
  /** The drawn height. 220 on Statistiche's own section; 96 in a page head. */
  height?: number;
  /**
   * How many days the x axis covers. `current` runs up to today and `usual` over the whole period:
   * with the span, `current` takes its share of the width instead of stretching across it.
   */
  span?: number;
}

/**
 * «Andamento del periodo» (§5.6) as the phone's `CycleTrendChart` draws it: `usual` in the strong
 * border colour behind, `current` in the accent in front, a dot at its last point. The geometry is
 * `@saldo/ui`'s, shared with the phone.
 */
export function TrendChart({ current, usual, height = WEB_TREND_HEIGHT, span }: Props) {
  const spanned = span !== undefined && span > 1;
  const currentWidth = spanned
    ? (VIEW_WIDTH * Math.max(current.length - 1, 0)) / (span - 1)
    : VIEW_WIDTH;
  const full = trendGeometry(current, usual, VIEW_WIDTH, height);
  // Same max in both (it is taken over the two series); only `current` and its dot use the narrower width.
  const own = spanned ? trendGeometry(current, usual, currentWidth, height) : full;
  const trend = { usual: full.usual, current: own.current, last: own.last };
  return (
    <div className={styles.chart} style={{ blockSize: `${height}px` }} aria-hidden="true">
      <svg
        className={styles.svg}
        viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {trend.usual === '' ? null : (
          <polyline
            points={trend.usual}
            className={styles.usual}
            strokeWidth={chartLine.usualStroke}
            vectorEffect="non-scaling-stroke"
          />
        )}
        {trend.current === '' ? null : (
          <polyline
            points={trend.current}
            className={styles.current}
            strokeWidth={chartLine.currentStroke}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      {trend.last === null ? null : (
        <span
          className={styles.dot}
          style={{
            insetInlineStart: `${(trend.last.x / VIEW_WIDTH) * 100}%`,
            insetBlockStart: `${(trend.last.y / height) * 100}%`,
            inlineSize: `${chartLine.dotRadius * 2}px`,
            blockSize: `${chartLine.dotRadius * 2}px`,
            margin: `${-chartLine.dotRadius}px 0 0 ${-chartLine.dotRadius}px`,
          }}
        />
      )}
    </div>
  );
}
