import { median } from '@saldo/core';
import type { NavigatorColumn } from './navigatorView';

export interface ExpensesChartBar {
  column: NavigatorColumn;
  amount: number;
  /** 0–1 of the chart's height. */
  height: number;
  /**
   * The running period's projection, as a height: the outlined part above what was spent (W6).
   * Never below `height`. `null` on every other bar, and when there is no projection.
   */
  projectionHeight: number | null;
}

export interface ExpensesChartView {
  bars: ExpensesChartBar[];
  /** The median of the closed bars, in minor units; `null` with no closed bar. */
  usual: number | null;
  usualHeight: number | null;
}

/**
 * W6: «Expenses by period» — one bar for each column of the navigator (the closed periods, the
 * running one, the forecast ones) and a dashed line for «usual», the median of the closed bars.
 * The chart is scaled on the largest of the amounts, the projection and «usual», so all three fit.
 */
export function expensesChartView(input: {
  columns: readonly NavigatorColumn[];
  /** `periodProjection` of the running period. */
  projection: number | null;
}): ExpensesChartView {
  const { columns, projection } = input;
  const middle = median(
    columns.filter((column) => column.kind === 'closed').map((column) => column.values.expenses),
  );
  const usual = middle === null ? null : Math.round(middle);
  const top = Math.max(
    0,
    ...columns.map((column) => column.values.expenses),
    projection ?? 0,
    usual ?? 0,
  );
  const ratio = (value: number) => (top === 0 ? 0 : value / top);
  return {
    bars: columns.map((column) => ({
      column,
      amount: column.values.expenses,
      height: ratio(column.values.expenses),
      projectionHeight:
        column.kind === 'current' && projection !== null
          ? ratio(Math.max(projection, column.values.expenses))
          : null,
    })),
    usual,
    usualHeight: usual === null ? null : ratio(usual),
  };
}
