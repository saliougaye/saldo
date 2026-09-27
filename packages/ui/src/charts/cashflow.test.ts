import { describe, expect, it } from 'vitest';
import { CASHFLOW_HATCH_PATH, cashflowChart, cashflowColumns } from './cashflow';

const plain = (income: number, expenses: number) => ({ key: `${income}`, income, expenses });

describe('cashflowColumns', () => {
  it('scales income and expenses on one shared maximum', () => {
    const [first, second] = cashflowColumns([plain(100, 50), plain(0, 200)], false);
    expect(first?.income).toBe(Math.round((100 / 200) * cashflowChart.halfHeight));
    expect(first?.expenses).toBe(Math.round((50 / 200) * cashflowChart.halfHeight));
    expect(second?.expenses).toBe(cashflowChart.halfHeight);
  });

  it('draws no bar for zero and at least one point for anything else', () => {
    const [column] = cashflowColumns([plain(0, 1), plain(0, 1_000_000)], false);
    expect(column?.income).toBe(0);
    expect(column?.expenses).toBe(1);
  });

  it('gives every bar the same stub while the figures are hidden, and no band', () => {
    const columns = cashflowColumns(
      [plain(0, 10), { key: 'f', income: 5, expenses: 8, forecast: { min: 4, max: 12 } }],
      true,
    );
    for (const column of columns) {
      expect(column.income).toBe(cashflowChart.hiddenStub);
      expect(column.expenses).toBe(cashflowChart.hiddenStub);
      expect(column.band).toBeNull();
    }
  });

  it('includes the forecast maximum in the scale and draws the band between min and max', () => {
    const [, forecast] = cashflowColumns(
      [plain(0, 50), { key: 'f', income: 0, expenses: 50, forecast: { min: 25, max: 100 } }],
      false,
    );
    expect(forecast?.expenses).toBe(Math.round(0.5 * cashflowChart.halfHeight));
    expect(forecast?.band).toEqual({
      top: Math.round(0.25 * cashflowChart.halfHeight),
      height: cashflowChart.halfHeight - Math.round(0.25 * cashflowChart.halfHeight),
    });
  });

  it('puts the divider before the first forecast column only', () => {
    const forecast = { min: 1, max: 2 };
    const columns = cashflowColumns(
      [
        plain(1, 1),
        { key: 'a', income: 1, expenses: 1, forecast },
        { key: 'b', income: 1, expenses: 1, forecast },
      ],
      false,
    );
    expect(columns.map((column) => column.divider)).toEqual([false, true, false]);
  });

  it('hands each input back with its geometry', () => {
    const input = plain(1, 1);
    expect(cashflowColumns([input], false)[0]?.bar).toBe(input);
  });

  it('scales to a taller half on the web, stub included', () => {
    const [column] = cashflowColumns([plain(100, 50)], false, 64);
    expect(column?.income).toBe(64);
    expect(column?.expenses).toBe(32);
    expect(cashflowColumns([plain(1, 1)], true, 64)[0]?.income).toBe(Math.round(64 * 0.35));
  });

  it('keeps the design constants of the prototype', () => {
    expect(cashflowChart.barWidth).toBe(16);
    expect(cashflowChart.hiddenStub).toBe(19);
    expect(CASHFLOW_HATCH_PATH).toBe('M0,5 L5,0 M-1,1 L1,-1 M4,6 L6,4');
  });
});
