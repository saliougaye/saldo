import { describe, expect, it } from 'vitest';
import { spendHistoryChart, spendHistoryColumns } from './spendHistory';

describe('spendHistoryColumns', () => {
  it('scales every column on the largest amount', () => {
    const columns = spendHistoryColumns([{ amount: 50 }, { amount: 100 }], false);
    expect(columns.map((column) => column.height)).toEqual([44, 88]);
  });

  it('keeps a one-point column even for nothing, so the well stays readable', () => {
    expect(spendHistoryColumns([{ amount: 0 }, { amount: 100 }], false)[0]?.height).toBe(1);
  });

  it('gives every column the same stub while the figures are hidden', () => {
    const columns = spendHistoryColumns([{ amount: 5 }, { amount: 500 }], true);
    expect(columns.map((column) => column.height)).toEqual([35, 35]);
    expect(spendHistoryChart.hiddenStub).toBe(35);
  });

  it('hands each input back with its height', () => {
    const input = { amount: 1 };
    expect(spendHistoryColumns([input], false)[0]?.bar).toBe(input);
  });
});
