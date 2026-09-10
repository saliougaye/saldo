import { describe, expect, it } from 'vitest';
import { APRIL_CYCLE, CATEGORIES, TODAY, tx } from './__tests__/fixtures';
import { categorySpendHistory, HISTORY_WINDOW, periodHistory, periodSpendHistory } from './history';
import type { PeriodDef } from './period';
import { median } from './stats';

/** The pay cycle these tests were written against (§5.2), now one period kind among four. */
const CYCLE_DEF: PeriodDef = { kind: 'cycle', startDay: 27 };

/** Two of the six previous cycles have transactions; the rest are empty. */
function pastTransactions() {
  return [
    // Cycle 27 Feb - 26 Mar 2026
    tx({ date: '2026-03-01', amount: 50000, categoryId: 'cat-supermarket' }),
    // Cycle 27 Dec 2025 - 26 Jan 2026
    tx({ date: '2026-01-05', amount: 30000, categoryId: 'cat-rent' }),
    tx({ date: '2026-01-06', amount: 200000, kind: 'income', categoryId: 'cat-salary' }),
  ];
}

describe('periodHistory', () => {
  it('defaults to the six cycles before the selected one', () => {
    expect(HISTORY_WINDOW).toBe(6);
  });

  it('skips cycles without any transaction, most recent first', () => {
    const history = periodHistory(pastTransactions(), CYCLE_DEF, APRIL_CYCLE);
    expect(history.map((entry) => entry.period)).toEqual([
      { start: '2026-02-27', end: '2026-03-26' },
      { start: '2025-12-27', end: '2026-01-26' },
    ]);
    expect(history[0]?.txs).toHaveLength(1);
    expect(history[1]?.txs).toHaveLength(2);
  });

  it('never includes the selected cycle itself', () => {
    const history = periodHistory(
      [tx({ date: TODAY, amount: 999, categoryId: 'cat-groceries' })],
      CYCLE_DEF,
      APRIL_CYCLE,
    );
    expect(history).toEqual([]);
  });

  it('looks back only as far as asked', () => {
    expect(periodHistory(pastTransactions(), CYCLE_DEF, APRIL_CYCLE, 1)).toHaveLength(1);
    expect(periodHistory(pastTransactions(), CYCLE_DEF, APRIL_CYCLE, 0)).toEqual([]);
  });

  it('counts a cycle as used even when nothing in it counts towards totals', () => {
    const onlyTransfer = [
      tx({
        date: '2026-03-01',
        amount: 1000,
        kind: 'transfer',
        categoryId: null,
        toAccountId: 'acc-savings',
      }),
    ];
    expect(periodHistory(onlyTransfer, CYCLE_DEF, APRIL_CYCLE)).toHaveLength(1);
  });
});

describe('periodSpendHistory', () => {
  it('lists the counted spend of each cycle in the window', () => {
    const history = periodHistory(pastTransactions(), CYCLE_DEF, APRIL_CYCLE);
    expect(periodSpendHistory(history, TODAY)).toEqual([50000, 30000]);
    expect(median(periodSpendHistory(history, TODAY))).toBe(40000);
  });

  it('is empty without history, so the median is null', () => {
    expect(periodSpendHistory([], TODAY)).toEqual([]);
    expect(median(periodSpendHistory([], TODAY))).toBeNull();
  });
});

describe('categorySpendHistory', () => {
  it('rolls each cycle up to parent level', () => {
    const history = periodHistory(pastTransactions(), CYCLE_DEF, APRIL_CYCLE);
    expect(categorySpendHistory(history, CATEGORIES, TODAY).map(Object.fromEntries)).toEqual([
      { 'cat-groceries': 50000 },
      { 'cat-home': 30000 },
    ]);
  });
});
