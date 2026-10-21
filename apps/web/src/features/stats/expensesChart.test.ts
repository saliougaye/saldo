import { describe, expect, it } from 'vitest';
import { expensesChartView } from './expensesChart';
import type { NavigatorColumn } from './navigatorView';

/** A column of the navigator with only what the chart reads. */
function column(kind: NavigatorColumn['kind'], expenses: number, month: number): NavigatorColumn {
  const mm = String(month).padStart(2, '0');
  return {
    range: { start: `2026-${mm}-01`, end: `2026-${mm}-28` },
    kind,
    selected: false,
    running: kind === 'current',
    values: { income: 0, expenses },
    net: -expenses,
    forecast: null,
  };
}

const CLOSED = [100, 300, 200, 400, 500, 600].map((amount, index) =>
  column('closed', amount, index + 1),
);

describe('expensesChartView', () => {
  it('reads «usual» as the median of the closed bars only, rounded to the minor unit', () => {
    const view = expensesChartView({
      columns: [...CLOSED, column('current', 9000, 7), column('forecast', 9000, 8)],
      projection: null,
    });
    // 100 200 300 400 500 600 → (300 + 400) / 2; the current and the forecast bars do not count.
    expect(view.usual).toBe(350);

    const odd = expensesChartView({
      columns: [column('closed', 101, 1), column('closed', 200, 2)],
      projection: null,
    });
    expect(odd.usual).toBe(151);
  });

  it('scales every bar on the largest of the amounts, the projection and «usual»', () => {
    const view = expensesChartView({
      columns: [...CLOSED, column('current', 300, 7)],
      projection: 1200,
    });
    // The projection, 1200, is the top of the chart.
    expect(view.bars.map((bar) => bar.height)).toEqual([
      100 / 1200,
      300 / 1200,
      200 / 1200,
      400 / 1200,
      500 / 1200,
      600 / 1200,
      300 / 1200,
    ]);
    expect(view.usualHeight).toBe(350 / 1200);
  });

  it('puts the projection on the current bar only, never below what was spent', () => {
    const view = expensesChartView({
      columns: [column('closed', 400, 1), column('current', 300, 2), column('forecast', 200, 3)],
      projection: 250,
    });
    expect(view.bars.map((bar) => bar.projectionHeight)).toEqual([null, 300 / 400, null]);
  });

  it('draws flat bars when nothing was spent', () => {
    const view = expensesChartView({
      columns: [column('closed', 0, 1), column('current', 0, 2)],
      projection: null,
    });
    expect(view.bars.map((bar) => bar.height)).toEqual([0, 0]);
    expect(view.usual).toBe(0);
    expect(view.usualHeight).toBe(0);
  });
});
