/** Design geometry (`docs/design/Spese.dc.html` lines 878-887). */
const COLUMN_HEIGHT = 88;

export const spendHistoryChart = {
  columnHeight: COLUMN_HEIGHT,
  columnRadius: 3,
  /** Every column while the figures are hidden: the labels are masked, the shape must be too. */
  hiddenStub: Math.round(COLUMN_HEIGHT * 0.4),
  /** Closed cycles keep the running one's hue, faded, so the current cycle reads first. */
  pastAlpha: 0.4,
  /** The track is the same hue again, barely there, so the column well belongs to the category. */
  trackAlpha: 0.1,
  legendSwatch: 8,
} as const;

/** One column per cycle over a track (§6.10), each at least one point tall. */
export function spendHistoryColumns<T extends { amount: number }>(
  bars: readonly T[],
  hidden: boolean,
): { bar: T; height: number }[] {
  const max = Math.max(1, ...bars.map((bar) => bar.amount));
  return bars.map((bar) => ({
    bar,
    height: hidden
      ? spendHistoryChart.hiddenStub
      : Math.max(1, Math.round((bar.amount / max) * COLUMN_HEIGHT)),
  }));
}
