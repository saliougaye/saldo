import { polylinePoints } from '@saldo/ui';
import styles from './accounts.module.css';

/** The coordinate space of the line. The SVG stretches it to the width it gets. */
const VIEW_WIDTH = 600;
/** W9: the net worth line is 120px high. */
const HEIGHT = 120;
/** The line stays this far inside the top and the bottom edge, so its stroke is not cut. */
const INSET = 2;

/**
 * W9: the net worth of the last months as a line over a faint area, on a baseline, with one month
 * label under each point. The scale runs from the lowest month to the highest, as the mockup's: the
 * shape is the change, and the figure next to the title says how much it is.
 */
export function NetWorthChart({
  series,
  labels,
}: {
  series: readonly number[];
  /** One label for each value, «feb», «mar». */
  labels: readonly string[];
}) {
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  // The values sit between INSET and HEIGHT − INSET: the scale grows by the inset at both ends.
  const pad = (span * INSET) / (HEIGHT - 2 * INSET);
  const line = polylinePoints(series, VIEW_WIDTH, HEIGHT, min - pad, span + 2 * pad);
  const area = `0,${HEIGHT} ${line} ${VIEW_WIDTH},${HEIGHT}`;
  return (
    <div className={styles.chart}>
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className={styles.chartSvg}
        aria-hidden="true"
      >
        <polygon className={styles.chartArea} points={area} />
        <line
          className={styles.chartBase}
          x1={0}
          x2={VIEW_WIDTH}
          y1={HEIGHT}
          y2={HEIGHT}
          vectorEffect="non-scaling-stroke"
        />
        <polyline className={styles.chartLine} points={line} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className={styles.chartAxis} aria-hidden="true">
        {/* Eight months in a row: no two labels are the same. */}
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}
