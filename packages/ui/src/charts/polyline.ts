export interface Point {
  x: number;
  y: number;
}

/** Strokes of the line charts (§5.6, §6.10). */
export const chartLine = {
  usualStroke: 1.5,
  currentStroke: 2,
  dotRadius: 3,
  sparklineStroke: 1.5,
  hiddenStroke: 1.5,
  hiddenDash: '3 4',
} as const;

/**
 * SVG `points` for a series spread across `width`: `min` sits on the bottom edge and `min + span`
 * on the top. A single value sits in the middle. One decimal is all SVG needs.
 */
export function polylinePoints(
  series: readonly number[],
  width: number,
  height: number,
  min: number,
  span: number,
): string {
  if (series.length === 0) return '';
  const step = series.length === 1 ? 0 : width / (series.length - 1);
  return series
    .map((value, index) => {
      const x = series.length === 1 ? width / 2 : index * step;
      const y = height - ((value - min) / span) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/** What a line chart draws while its figures are hidden: "there is a chart here", and no more. */
export function hiddenBaseline(width: number, height: number): string {
  return `0,${(height / 2).toFixed(1)} ${width.toFixed(1)},${(height / 2).toFixed(1)}`;
}

export interface TrendGeometry {
  usual: string;
  current: string;
  /** The dot at the end of the current series; null when there is none. */
  last: Point | null;
}

/**
 * "Andamento del ciclo" (§5.6): cumulative spending of the current cycle over the usual one, on one
 * scale that starts at zero.
 */
export function trendGeometry(
  current: readonly number[],
  usual: readonly number[],
  width: number,
  height: number,
): TrendGeometry {
  const max = Math.max(1, ...current, ...usual);
  const lastValue = current[current.length - 1];
  return {
    usual: polylinePoints(usual, width, height, 0, max),
    current: polylinePoints(current, width, height, 0, max),
    last:
      lastValue === undefined
        ? null
        : { x: current.length <= 1 ? width / 2 : width, y: height - (lastValue / max) * height },
  };
}

/** Month-end balances (§6.10). Zero is always inside the scale, so a negative balance reads as one. */
export function sparklinePoints(series: readonly number[], width: number, height: number): string {
  const min = Math.min(...series, 0);
  const max = Math.max(...series, 0);
  return polylinePoints(series, width, height, min, max - min || 1);
}
