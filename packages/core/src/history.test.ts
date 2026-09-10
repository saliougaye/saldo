import { describe, expect, it } from 'vitest';
import { APRIL_CYCLE, CATEGORIES, TODAY, tx } from './__tests__/fixtures';
import { categorySpendHistory, cycleHistory, cycleSpendHistory, HISTORY_WINDOW } from './history';
import { median } from './stats';

const CYCLE_START_DAY = 27;

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

describe('cycleHistory', () => {
  it('defaults to the six cycles before the selected one', () => {
    expect(HISTORY_WINDOW).toBe(6);
  });

  it('skips cycles without any transaction, most recent first', () => {
    const history = cycleHistory(pastTransactions(), APRIL_CYCLE, CYCLE_START_DAY);
    expect(history.map((entry) => entry.cycle)).toEqual([
      { start: '2026-02-27', end: '2026-03-26' },
      { start: '2025-12-27', end: '2026-01-26' },
    ]);
    expect(history[0]?.txs).toHaveLength(1);
    expect(history[1]?.txs).toHaveLength(2);
  });

  it('never includes the selected cycle itself', () => {
    const history = cycleHistory(
      [tx({ date: TODAY, amount: 999, categoryId: 'cat-groceries' })],
      APRIL_CYCLE,
      CYCLE_START_DAY,
    );
    expect(history).toEqual([]);
  });

  it('looks back only as far as asked', () => {
    expect(cycleHistory(pastTransactions(), APRIL_CYCLE, CYCLE_START_DAY, 1)).toHaveLength(1);
    expect(cycleHistory(pastTransactions(), APRIL_CYCLE, CYCLE_START_DAY, 0)).toEqual([]);
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
    expect(cycleHistory(onlyTransfer, APRIL_CYCLE, CYCLE_START_DAY)).toHaveLength(1);
  });
});

describe('cycleSpendHistory', () => {
  it('lists the counted spend of each cycle in the window', () => {
    const history = cycleHistory(pastTransactions(), APRIL_CYCLE, CYCLE_START_DAY);
    expect(cycleSpendHistory(history, TODAY)).toEqual([50000, 30000]);
    expect(median(cycleSpendHistory(history, TODAY))).toBe(40000);
  });

  it('is empty without history, so the median is null', () => {
    expect(cycleSpendHistory([], TODAY)).toEqual([]);
    expect(median(cycleSpendHistory([], TODAY))).toBeNull();
  });
});

describe('categorySpendHistory', () => {
  it('rolls each cycle up to parent level', () => {
    const history = cycleHistory(pastTransactions(), APRIL_CYCLE, CYCLE_START_DAY);
    expect(categorySpendHistory(history, CATEGORIES, TODAY).map(Object.fromEntries)).toEqual([
      { 'cat-groceries': 50000 },
      { 'cat-home': 30000 },
    ]);
  });
});
