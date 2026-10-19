/** Geometry taken from the design prototype (not in this repository): fixed-width bars in 54px halves. */
const HALF_HEIGHT = 54;
/** 45° stripes, 2px of ink every 5px, as in the prototype's `repeating-linear-gradient`. */
const HATCH_PERIOD = 5;
/** The hidden-mode stub, as a share of the half height. */
const HIDDEN_STUB_RATIO = 0.35;

export const cashflowChart = {
  barWidth: 16,
  halfHeight: HALF_HEIGHT,
  /** Height of every bar while the figures are hidden. */
  hiddenStub: Math.round(HALF_HEIGHT * HIDDEN_STUB_RATIO),
  barRadius: 2,
  columnGap: 5,
  hatchPeriod: HATCH_PERIOD,
  hatchInk: 2,
  /** Forecast bars sit one step behind the running period's (§5.7). */
  forecastOpacity: 0.5,
  /** The min–max band: a little wider than the bar it sits behind, and faint. */
  bandWidth: 22,
  bandOpacity: 0.2,
  /** Dashes of the divider between what happened and what is expected. */
  dividerDash: '3 4',
} as const;

/**
 * The three diagonals of one 5x5 tile: the middle one plus the two that continue the stripes of
 * the neighbouring tiles, so the pattern is seamless. Lines rather than a rotated rectangle,
 * because `patternTransform` is unreliable in react-native-svg and renders as dots.
 */
export const CASHFLOW_HATCH_PATH = `M0,${HATCH_PERIOD} L${HATCH_PERIOD},0 M-1,1 L1,-1 M${HATCH_PERIOD - 1},${
  HATCH_PERIOD + 1
} L${HATCH_PERIOD + 1},${HATCH_PERIOD - 1}`;

export interface CashflowValues {
  income: number;
  expenses: number;
  /** A forecast period (§5.17): the expenses could end anywhere between `min` and `max`. */
  forecast?: { min: number; max: number };
}

export interface CashflowColumn<T> {
  bar: T;
  /** Bar heights in points, each within `halfHeight`. */
  income: number;
  expenses: number;
  /** The forecast range, measured down from the axis; null for a real period or when hidden. */
  band: { top: number; height: number } | null;
  /** The first forecast column: the seam between what happened and what is expected. */
  divider: boolean;
}

/**
 * Cashflow of §5.7: income above the axis, expenses below it, both halves on one scale so the
 * columns are comparable. A period with nothing in it gets no bar rather than a 1pt stub, so "no
 * data" reads as empty; hidden mode gives every bar the same stub, because the shape of the year
 * would otherwise still say which months were heavy.
 */
export function cashflowColumns<T extends CashflowValues>(
  bars: readonly T[],
  hidden: boolean,
  /** Height of each half in points: the phone's 54 by default, taller on the web (§17.1.7). */
  halfHeight: number = HALF_HEIGHT,
): CashflowColumn<T>[] {
  const max = Math.max(
    1,
    ...bars.flatMap((bar) => [bar.income, bar.expenses, bar.forecast?.max ?? 0]),
  );
  const stub = Math.round(halfHeight * HIDDEN_STUB_RATIO);
  const height = (value: number) => {
    if (hidden) return stub;
    return value === 0 ? 0 : Math.max(1, Math.round((value / max) * halfHeight));
  };
  return bars.map((bar, index) => {
    const forecast = bar.forecast;
    return {
      bar,
      income: height(bar.income),
      expenses: height(bar.expenses),
      band:
        forecast === undefined || hidden
          ? null
          : {
              top: height(forecast.min),
              height: Math.max(1, height(forecast.max) - height(forecast.min)),
            },
      divider: forecast !== undefined && bars[index - 1]?.forecast === undefined,
    };
  });
}
