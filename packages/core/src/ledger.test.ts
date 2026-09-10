import { describe, expect, it } from 'vitest';
import { APRIL_CYCLE, aprilTransactions, CATEGORIES, TODAY, tx } from './__tests__/fixtures';
import {
  countsInTotals,
  isUpcoming,
  rollupToParents,
  spendingByCategory,
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
