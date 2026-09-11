import { describe, expect, it } from 'vitest';
import { APRIL_CYCLE, aprilTransactions, CATEGORIES, TODAY, tx } from './__tests__/fixtures';
import {
  countsInTotals,
  isUpcoming,
  rollupToParents,
  signedAmount,
  spendingByCategory,
  spendingByTag,
  splitUpcoming,
  summarizePeriod,
  totalsOf,
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

describe('spendingByTag', () => {
  const tagged = () => [
    tx({ date: '2026-03-28', amount: 5000, tagIds: ['tag-rome', 'tag-trip'] }),
    tx({ date: '2026-04-02', amount: 3000, tagIds: ['tag-rome'] }),
    tx({ date: '2026-04-03', amount: 1200, tagIds: [] }),
    tx({ date: '2026-04-05', amount: 900, tagIds: ['tag-rome'], excludeFromTotals: true }),
    tx({ date: '2026-04-20', amount: 4000, tagIds: ['tag-rome'] }),
    tx({ date: '2026-03-20', amount: 7000, tagIds: ['tag-rome'] }),
    tx({
      date: '2026-04-04',
      amount: 2500,
      kind: 'income',
      categoryId: 'cat-salary',
      tagIds: ['tag-rome'],
    }),
  ];

  it('ranks tags by counted spend, descending', () => {
    const { tags } = spendingByTag(tagged(), APRIL_CYCLE, TODAY);
    expect(tags).toEqual([
      { tagId: 'tag-rome', amount: 8000, count: 2 },
      { tagId: 'tag-trip', amount: 5000, count: 1 },
    ]);
  });

  it('counts a two-tag transaction in both, so the tags overshoot the period spend', () => {
    const { tags } = spendingByTag(tagged(), APRIL_CYCLE, TODAY);
    const sum = tags.reduce((total, row) => total + row.amount, 0);
    const { spent } = summarizePeriod(tagged(), APRIL_CYCLE, TODAY);
    expect(sum).toBeGreaterThan(spent);
  });

  it('reports what carries no tag at all, so the ranking can say what it leaves out', () => {
    const spending = spendingByTag(tagged(), APRIL_CYCLE, TODAY);
    expect(spending.untagged).toBe(1200);
    expect(spending.untaggedCount).toBe(1);
  });

  it('sums income when asked', () => {
    const { tags } = spendingByTag(tagged(), APRIL_CYCLE, TODAY, 'income');
    expect(tags).toEqual([{ tagId: 'tag-rome', amount: 2500, count: 1 }]);
  });

  it('breaks ties on the tag id, so the order never depends on input order', () => {
    const txs = [
      tx({ date: '2026-04-02', amount: 1000, tagIds: ['tag-b'] }),
      tx({ date: '2026-04-02', amount: 1000, tagIds: ['tag-a'] }),
    ];
    expect(spendingByTag(txs, APRIL_CYCLE, TODAY).tags.map((row) => row.tagId)).toEqual([
      'tag-a',
      'tag-b',
    ]);
  });

  it('is empty for no rows', () => {
    expect(spendingByTag([], APRIL_CYCLE, TODAY)).toEqual({
      tags: [],
      untagged: 0,
      untaggedCount: 0,
    });
  });
});

describe('totalsOf', () => {
  it('adds up what the list shows, expenses and income apart', () => {
    const totals = totalsOf([
      tx({ date: '2026-04-02', amount: 3000 }),
      tx({ date: '2026-04-03', amount: 1200 }),
      tx({ date: '2026-04-04', amount: 9000, kind: 'income', categoryId: 'cat-salary' }),
    ]);
    expect(totals).toEqual({ expense: 4200, income: 9000, count: 3 });
  });

  it('counts rows the totals normally drop, because the list is showing them on purpose', () => {
    const totals = totalsOf([tx({ date: '2026-04-02', amount: 3000, excludeFromTotals: true })]);
    expect(totals).toEqual({ expense: 3000, income: 0, count: 1 });
  });

  it('leaves transfers out of both sides but still counts them', () => {
    const totals = totalsOf([
      tx({ date: '2026-04-01', amount: 50000, kind: 'transfer', categoryId: null }),
      tx({ date: '2026-04-02', amount: 3000 }),
    ]);
    expect(totals).toEqual({ expense: 3000, income: 0, count: 2 });
  });

  it('is zero for no rows', () => {
    expect(totalsOf([])).toEqual({ expense: 0, income: 0, count: 0 });
  });
});

describe('signedAmount', () => {
  it('signs an expense down and an income up whatever the viewpoint', () => {
    const expense = tx({ date: TODAY, amount: 1500 });
    const income = tx({ date: TODAY, amount: 9000, kind: 'income', categoryId: 'cat-salary' });
    expect(signedAmount(expense, null)).toBe(-1500);
    expect(signedAmount(expense, 'acc-card')).toBe(-1500);
    expect(signedAmount(income, null)).toBe(9000);
    expect(signedAmount(income, 'acc-checking')).toBe(9000);
  });

  it('gives a transfer no sign when no account is the viewpoint', () => {
    const transfer = tx({
      date: TODAY,
      amount: 50000,
      kind: 'transfer',
      categoryId: null,
      accountId: 'acc-checking',
      toAccountId: 'acc-savings',
    });
    expect(signedAmount(transfer, null)).toBeNull();
  });

  it('signs a transfer by the leg the viewpoint account is on', () => {
    const transfer = tx({
      date: TODAY,
      amount: 50000,
      kind: 'transfer',
      categoryId: null,
      accountId: 'acc-checking',
      toAccountId: 'acc-savings',
    });
    expect(signedAmount(transfer, 'acc-checking')).toBe(-50000);
    expect(signedAmount(transfer, 'acc-savings')).toBe(50000);
    expect(signedAmount(transfer, 'acc-card')).toBeNull();
  });
});
