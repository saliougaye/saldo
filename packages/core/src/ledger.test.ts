import { describe, expect, it } from 'vitest';
import { APRIL_CYCLE, aprilTransactions, CATEGORIES, TODAY, tx } from './__tests__/fixtures';
import {
  countsInTotals,
  isUpcoming,
  rollupToParents,
  spendingByCategory,
  splitUpcoming,
  summarizePeriod,
} from './ledger';

describe('isUpcoming / countsInTotals', () => {
  it('treats future dated transactions as upcoming and not counted', () => {
    const future = tx({ date: '2026-04-20', amount: 100 });
    expect(isUpcoming(future, TODAY)).toBe(true);
    expect(countsInTotals(future, TODAY)).toBe(false);
  });

  it('ignores transfers and excluded transactions', () => {
    expect(countsInTotals(tx({ date: TODAY, amount: 1, kind: 'transfer' }), TODAY)).toBe(false);
    expect(countsInTotals(tx({ date: TODAY, amount: 1, excludeFromTotals: true }), TODAY)).toBe(
      false,
    );
    expect(countsInTotals(tx({ date: TODAY, amount: 1 }), TODAY)).toBe(true);
  });
});

describe('summarizePeriod', () => {
  it('computes income, spent, remaining and pace for the design cycle', () => {
    const summary = summarizePeriod(aprilTransactions(), APRIL_CYCLE, TODAY);
    expect(summary).toMatchObject({
      income: 231000,
      spent: 86240,
      remaining: 144760,
      length: 31,
      elapsed: 23,
      overPace: false,
    });
    expect(summary.pace).toBeCloseTo(23 / 31, 10);
    expect(summary.ratio).toBeCloseTo(86240 / 231000, 10);
  });

  it('reports ratio 0 and no over pace without income', () => {
    const summary = summarizePeriod([tx({ date: TODAY, amount: 500 })], APRIL_CYCLE, TODAY);
    expect(summary.ratio).toBe(0);
    expect(summary.overPace).toBe(false);
    expect(summary.remaining).toBe(-500);
  });

  it('flags spending faster than the cycle pace', () => {
    const txs = [
      tx({ date: '2026-03-27', amount: 100000, kind: 'income', categoryId: 'cat-salary' }),
      tx({ date: '2026-03-28', amount: 90000 }),
    ];
    expect(summarizePeriod(txs, APRIL_CYCLE, TODAY).overPace).toBe(true);
  });
});

describe('spendingByCategory / rollupToParents', () => {
  it('sums counted expenses per leaf category', () => {
    const spending = spendingByCategory(aprilTransactions(), APRIL_CYCLE, TODAY);
    expect(Object.fromEntries(spending)).toEqual({
      'cat-rent': 78000,
      'cat-supermarket': 6240,
      'cat-groceries': 2000,
    });
  });

  it('sums income when asked', () => {
    const income = spendingByCategory(aprilTransactions(), APRIL_CYCLE, TODAY, 'income');
    expect(Object.fromEntries(income)).toEqual({ 'cat-salary': 231000 });
  });

  it('rolls children up into parents', () => {
    const spending = spendingByCategory(aprilTransactions(), APRIL_CYCLE, TODAY);
    expect(Object.fromEntries(rollupToParents(spending, CATEGORIES))).toEqual({
      'cat-home': 78000,
      'cat-groceries': 8240,
    });
  });
});

describe('splitUpcoming', () => {
  const row = (id: string, date: string, kind: 'expense' | 'income' = 'expense', amount = 1000) =>
    ({ id, date, kind, amount }) as const;

  it('puts today on the settled side, tomorrow on the upcoming one', () => {
    const split = splitUpcoming(
      [row('a', '2026-09-12'), row('b', '2026-09-11'), row('c', '2026-09-10')],
      '2026-09-11',
    );
    expect(split.upcoming.map((row) => row.id)).toEqual(['a']);
    expect(split.settled.map((row) => row.id)).toEqual(['b', 'c']);
  });

  it('keeps the order it was given, so a sorted list stays sorted', () => {
    const split = splitUpcoming(
      [row('a', '2026-09-20'), row('b', '2026-09-15'), row('c', '2026-09-05')],
      '2026-09-11',
    );
    expect(split.upcoming.map((row) => row.id)).toEqual(['a', 'b']);
  });

  it('nets the upcoming rows, income up and expenses down', () => {
    const split = splitUpcoming(
      [row('a', '2026-09-20', 'expense', 1500), row('b', '2026-09-21', 'income', 500)],
      '2026-09-11',
    );
    expect(split.upcomingNet).toBe(-1000);
  });

  it('treats a transfer as money leaving, like every other non-income row', () => {
    const transfer = { id: 't', date: '2026-09-20', kind: 'transfer', amount: 700 } as const;
    expect(splitUpcoming([transfer], '2026-09-11').upcomingNet).toBe(-700);
  });

  it('is empty on both sides for no rows, and nets zero', () => {
    expect(splitUpcoming([], '2026-09-11')).toEqual({ upcoming: [], settled: [], upcomingNet: 0 });
  });
});
