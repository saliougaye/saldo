import { describe, expect, it } from 'vitest';
import { CATEGORIES, tx } from './__tests__/fixtures';
import { EMPTY_FILTERS, type FilterLookup } from './filters';
import {
  budgetSuggestions,
  emergencyFundTarget,
  matchesInOtherPeriods,
  nearestPeriodWithData,
} from './firstSteps';
import type { PeriodDef } from './period';

const MONTH: PeriodDef = { kind: 'month', startDay: 1 };
const TODAY = '2026-04-18';
const APRIL = { start: '2026-04-01', end: '2026-04-30' };

/** The fixture's categories as the budget page reads them: live, salary the only income one. */
const LIVE = CATEGORIES.map((category) => ({
  ...category,
  direction: category.id === 'cat-salary' ? ('income' as const) : ('expense' as const),
  archivedAt: null,
}));

/** Three used months before April. Groceries (with its child) and transport are spent each month. */
function threeMonths() {
  return [
    tx({ date: '2026-01-05', amount: 10000, categoryId: 'cat-groceries' }),
    tx({ date: '2026-02-05', amount: 20000, categoryId: 'cat-supermarket' }),
    tx({ date: '2026-03-05', amount: 30000, categoryId: 'cat-groceries' }),
    tx({ date: '2026-01-07', amount: 4000, categoryId: 'cat-transport' }),
    tx({ date: '2026-02-07', amount: 6000, categoryId: 'cat-transport' }),
    tx({ date: '2026-03-07', amount: 5000, categoryId: 'cat-transport' }),
    // Spent in one month of three: its median is 0, so it suggests nothing.
    tx({ date: '2026-03-09', amount: 50000, categoryId: 'cat-rent' }),
    // Income is never a budget.
    tx({ date: '2026-03-01', amount: 200000, kind: 'income', categoryId: 'cat-salary' }),
  ];
}

describe('budgetSuggestions', () => {
  it('ranks the categories by their median monthly spend, at the parent level', () => {
    const suggestions = budgetSuggestions({
      txs: threeMonths(),
      categories: LIVE,
      budgets: [],
      def: MONTH,
      period: APRIL,
      today: TODAY,
    });
    expect(suggestions).toEqual([
      { categoryId: 'cat-groceries', amount: 20000 },
      { categoryId: 'cat-transport', amount: 5000 },
    ]);
  });

  it('leaves out a category that a budget already covers, and keeps the count', () => {
    const suggestions = budgetSuggestions({
      txs: threeMonths(),
      categories: LIVE,
      budgets: [{ id: 'b1', categoryIds: ['cat-groceries'] }],
      def: MONTH,
      period: APRIL,
      today: TODAY,
      count: 1,
    });
    expect(suggestions).toEqual([{ categoryId: 'cat-transport', amount: 5000 }]);
  });

  it('REGRESSION: leaves out an archived category, whose «Create» link the budget form drops', () => {
    // Its link opened «New budget» with the amount and no category: the form takes only live ones.
    const suggestions = budgetSuggestions({
      txs: threeMonths(),
      categories: LIVE.map((category) =>
        category.id === 'cat-groceries'
          ? { ...category, archivedAt: '2026-03-31T12:00:00.000Z' }
          : category,
      ),
      budgets: [],
      def: MONTH,
      period: APRIL,
      today: TODAY,
    });
    expect(suggestions).toEqual([{ categoryId: 'cat-transport', amount: 5000 }]);
  });

  it('suggests nothing with no history', () => {
    expect(
      budgetSuggestions({
        txs: [],
        categories: LIVE,
        budgets: [],
        def: MONTH,
        period: APRIL,
        today: TODAY,
      }),
    ).toEqual([]);
  });
});

describe('matchesInOtherPeriods', () => {
  const lookup: FilterLookup = {
    accountName: () => '',
    categoryName: () => '',
    categoryParentId: () => null,
  };
  const txs = [
    tx({ date: '2026-01-03', amount: 100, description: 'Esselunga' }),
    tx({ date: '2026-01-20', amount: 100, description: 'Esselunga Viale' }),
    tx({ date: '2026-03-02', amount: 100, description: 'esselunga' }),
    tx({ date: '2026-04-02', amount: 100, description: 'Esselunga' }),
    tx({ date: '2026-02-02', amount: 100, description: 'Coop' }),
  ];

  it('counts the matches of each other period, newest period first', () => {
    const matches = matchesInOtherPeriods({
      txs,
      filters: { ...EMPTY_FILTERS, query: 'esselunga' },
      lookup,
      def: MONTH,
      exclude: APRIL,
    });
    expect(matches).toEqual([
      { range: { start: '2026-03-01', end: '2026-03-31' }, count: 1 },
      { range: { start: '2026-01-01', end: '2026-01-31' }, count: 2 },
    ]);
  });

  it('stops at the limit', () => {
    const matches = matchesInOtherPeriods({
      txs,
      filters: { ...EMPTY_FILTERS, query: 'esselunga' },
      lookup,
      def: MONTH,
      exclude: APRIL,
      limit: 1,
    });
    expect(matches.map((entry) => entry.range.start)).toEqual(['2026-03-01']);
  });
});

describe('emergencyFundTarget', () => {
  it('is three times the median monthly spend', () => {
    const txs = [
      tx({ date: '2026-01-05', amount: 10000 }),
      tx({ date: '2026-02-05', amount: 30000 }),
      tx({ date: '2026-03-05', amount: 20000 }),
    ];
    expect(emergencyFundTarget({ txs, def: MONTH, today: TODAY })).toBe(60000);
  });

  it('REGRESSION: stays three months of spend for a user who tracks weeks', () => {
    // It took three of the user's own periods: three weeks of spend for a weekly user.
    const weekly = [
      ...['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26'],
      ...['2026-02-02', '2026-02-09', '2026-02-16', '2026-02-23'],
      ...['2026-03-02', '2026-03-09', '2026-03-16', '2026-03-23'],
    ].map((date) => tx({ date, amount: 10000 }));
    expect(
      emergencyFundTarget({ txs: weekly, def: { kind: 'week', startDay: 1 }, today: TODAY }),
    ).toBe(120000);
  });

  it('is null with no history', () => {
    expect(emergencyFundTarget({ txs: [], def: MONTH, today: TODAY })).toBeNull();
  });
});

describe('nearestPeriodWithData', () => {
  const txs = [
    tx({ date: '2026-01-20', amount: 100 }),
    tx({ date: '2026-03-02', amount: 100 }),
    tx({ date: '2026-03-28', amount: 100 }),
  ];
  const range = (start: string, end: string) => ({ start, end });

  it('takes the latest period before an empty one', () => {
    expect(
      nearestPeriodWithData({ txs, def: MONTH, period: range('2026-04-01', '2026-04-30') }),
    ).toEqual(range('2026-03-01', '2026-03-31'));
  });

  it('takes the first period after an empty one that comes before every row', () => {
    expect(
      nearestPeriodWithData({ txs, def: MONTH, period: range('2025-11-01', '2025-11-30') }),
    ).toEqual(range('2026-01-01', '2026-01-31'));
  });

  it('is null with no row at all', () => {
    expect(
      nearestPeriodWithData({ txs: [], def: MONTH, period: range('2026-04-01', '2026-04-30') }),
    ).toBeNull();
  });
});
