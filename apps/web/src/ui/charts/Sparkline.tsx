import { chartLine, sparklinePoints } from '@saldo/ui';
import styles from './Sparkline.module.css';

/**
 * The phone's account sparkline (§6.10) in DOM SVG: eight month-end balances, no axis, no dot —
 * a shape, not a chart to read values off of. `TrendChart` is the same idea at a larger scale.
 */
export function Sparkline({
  series,
  width = 240,
  height = 48,
}: {
  series: number[];
  width?: number;
  height?: number;
}) {
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={styles.chart}
      style={{ blockSize: `${height}px` }}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={sparklinePoints(series, width, height)}
        className={styles.line}
        strokeWidth={chartLine.sparklineStroke}
      />
    </svg>
  );
}
