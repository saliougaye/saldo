import { describe, expect, it } from 'vitest';
import { APRIL_CYCLE, aprilTransactions, CATEGORIES, TODAY, tx } from './__tests__/fixtures';
import {
  rollupToParents,
  signedAmount,
  spendingByCategory,
  splitUpcoming,
  summarizePeriod,
  tagTotals,
  tagUsage,
  totalsOf,
  transactionsWithTag,
} from './ledger';

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

  it('flags spending faster than the cycle pace', () => {
    const txs = [
      tx({ date: '2026-03-27', amount: 100000, kind: 'income', categoryId: 'cat-salary' }),
      tx({ date: '2026-03-28', amount: 90000 }),
    ];
    expect(summarizePeriod(txs, APRIL_CYCLE, TODAY).overPace).toBe(true);
  });
});

describe('spendingByCategory / rollupToParents', () => {
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

  it('treats a transfer as money leaving, like every other non-income row', () => {
    const transfer = { id: 't', date: '2026-09-20', kind: 'transfer', amount: 700 } as const;
    expect(splitUpcoming([transfer], '2026-09-11').upcomingNet).toBe(-700);
  });
});

describe('tagTotals', () => {
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

  it('ranks tags by counted spend, descending, with their counted income beside it', () => {
    const { tags } = tagTotals(tagged(), APRIL_CYCLE, TODAY);
    expect(tags).toEqual([
      { tagId: 'tag-rome', expense: 8000, income: 2500, count: 3 },
      { tagId: 'tag-trip', expense: 5000, income: 0, count: 1 },
    ]);
  });

  it('never nets income against spend', () => {
    const txs = [
      tx({ date: '2026-04-02', amount: 80_000, tagIds: ['tag-trip'] }),
      tx({
        date: '2026-04-03',
        amount: 30_000,
        kind: 'income',
        categoryId: 'cat-refund',
        tagIds: ['tag-trip'],
      }),
    ];
    const [trip] = tagTotals(txs, APRIL_CYCLE, TODAY).tags;
    expect(trip).toMatchObject({ expense: 80_000, income: 30_000 });
  });
});

describe('tagUsage and transactionsWithTag', () => {
  // Regression: the tags list said «7 transactions» for Trasloco, while the tag screen and its
  // Merge and Delete sheets said 6. The screen read its rows only up to today, so it dropped the
  // one scheduled after today, which a merge or a delete still rewrites.
  it('count a scheduled transaction, so the tags list and the tag screen agree (bug: 7 against 6)', () => {
    const txs = [
      // Scheduled: after TODAY (2026-04-18).
      tx({ date: '2026-05-02', amount: 1200, tagIds: ['tag-move'] }),
      tx({ date: '2026-03-30', amount: 4000, tagIds: ['tag-move', 'tag-trip'] }),
      tx({ date: '2026-04-10', amount: 900, tagIds: ['tag-move'], excludeFromTotals: true }),
      tx({ date: '2026-04-11', amount: 500, tagIds: [] }),
    ];

    const usage = tagUsage(txs);
    const screen = transactionsWithTag(txs, 'tag-move');
    expect(usage.get('tag-move')).toBe(3);
    expect(screen).toHaveLength(3);
    expect(screen.map((row) => row.date)).toEqual(['2026-03-30', '2026-04-10', '2026-05-02']);
    expect(usage.get('tag-trip')).toBe(1);
  });
});

describe('totalsOf', () => {
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
});

describe('signedAmount', () => {
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
