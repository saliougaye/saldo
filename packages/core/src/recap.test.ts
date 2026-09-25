import { describe, expect, it } from 'vitest';
import { ACCOUNTS, CATEGORIES, tx } from './__tests__/fixtures';
import type { CategoryRef, LedgerTx } from './ledger';
import type { PeriodDef } from './period';
import {
  type PeriodRecap,
  type PeriodRecapInput,
  periodRecap,
  type RecapBudgetRef,
  recapPeriod,
} from './recap';

const MONTH: PeriodDef = { kind: 'month', startDay: 1 };
const SEPTEMBER = { start: '2026-09-01', end: '2026-09-30' };
const OCTOBER_FIRST = '2026-10-01';
const CATS: CategoryRef[] = [
  ...CATEGORIES,
  { id: 'cat-fun', parentId: null },
  { id: 'cat-gifts', parentId: null },
  { id: 'cat-pets', parentId: null },
];

function salary(date: string, amount: number): LedgerTx {
  return tx({ date, amount, kind: 'income', categoryId: 'cat-salary', accountId: 'acc-checking' });
}

/** July and August as history, September as the closed period. Expenses on the card. */
function ledger(): LedgerTx[] {
  return [
    salary('2026-07-27', 230000),
    tx({ date: '2026-07-01', amount: 72000, categoryId: 'cat-rent' }),
    tx({ date: '2026-07-10', amount: 41000 }),
    salary('2026-08-27', 230000),
    tx({ date: '2026-08-01', amount: 72000, categoryId: 'cat-rent' }),
    tx({ date: '2026-08-10', amount: 40000 }),
    salary('2026-09-27', 245000),
    tx({ date: '2026-09-01', amount: 72000, categoryId: 'cat-rent' }),
    tx({ date: '2026-09-10', amount: 38620 }),
    tx({ date: '2026-09-15', amount: 16200, categoryId: 'cat-transport' }),
  ];
}

function recap(overrides: Partial<PeriodRecapInput> = {}): PeriodRecap {
  const result = periodRecap({
    def: MONTH,
    period: SEPTEMBER,
    today: OCTOBER_FIRST,
    transactions: ledger(),
    categories: CATS,
    budgets: [],
    accounts: ACCOUNTS,
    ...overrides,
  });
  if (result === null) throw new Error('expected a recap');
  return result;
}

describe('recapPeriod', () => {
  it('is the period before the one containing today, for every kind', () => {
    const month: PeriodDef = { kind: 'month', startDay: 1 };
    const week: PeriodDef = { kind: 'week', startDay: 1 };
    const cycle: PeriodDef = { kind: 'cycle', startDay: 27 };
    const year: PeriodDef = { kind: 'year', startDay: 1 };
    expect(recapPeriod(month, '2026-10-01')).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(recapPeriod(month, '2026-10-19')).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(recapPeriod(week, '2026-10-05')).toEqual({ start: '2026-09-28', end: '2026-10-04' });
    expect(recapPeriod(cycle, '2026-04-27')).toEqual({ start: '2026-03-27', end: '2026-04-26' });
    expect(recapPeriod(year, '2027-01-01')).toEqual({ start: '2026-01-01', end: '2026-12-31' });
  });
});

describe('periodRecap: totals', () => {
  it('has nothing to say about a period without transactions', () => {
    const withoutSeptember = ledger().filter((row) => !row.date.startsWith('2026-09'));
    expect(
      periodRecap({
        def: MONTH,
        period: SEPTEMBER,
        today: OCTOBER_FIRST,
        transactions: withoutSeptember,
        categories: CATS,
        budgets: [],
        accounts: ACCOUNTS,
      }),
    ).toBeNull();
  });

  it('computes the net and compares it with the period before and the usual median', () => {
    expect(recap()).toMatchObject({
      period: SEPTEMBER,
      income: 245000,
      spent: 126820,
      net: 118180,
      previousNet: 118000,
      // Median of August (118000) and July (117000), the two used periods of the window (§5.5).
      usualNet: 117500,
      incomeDelta: 7,
      spentDelta: 13,
    });
  });

  it('leaves the comparisons out when nothing came before', () => {
    const onlySeptember = ledger().filter((row) => row.date.startsWith('2026-09'));
    expect(recap({ transactions: onlySeptember })).toMatchObject({
      net: 118180,
      previousNet: null,
      usualNet: null,
      incomeDelta: null,
      spentDelta: null,
    });
  });
});

describe('periodRecap: categories', () => {
  it('lists parent-level spend, largest first, with no tag when nothing grew', () => {
    expect(recap().categories).toEqual([
      { categoryId: 'cat-home', amount: 72000, aboveUsual: null },
      { categoryId: 'cat-groceries', amount: 38620, aboveUsual: null },
      { categoryId: 'cat-transport', amount: 16200, aboveUsual: null },
    ]);
    expect(recap().otherCategories).toEqual({ count: 0, amount: 0 });
  });

  it('tags the category that grew most against its own median', () => {
    // Groceries 38620 + 22130 = 60750 against a median of 40500: +50%.
    const rows = [...ledger(), tx({ date: '2026-09-20', amount: 22130 })];
    const groceries = recap({ transactions: rows }).categories.find(
      (row) => row.categoryId === 'cat-groceries',
    );
    expect(groceries?.aboveUsual).toBe(50);
    expect(
      recap({ transactions: rows }).categories.filter((row) => row.aboveUsual !== null),
    ).toHaveLength(1);
  });

  it('never tags a category without history', () => {
    const onlySeptember = ledger().filter((row) => row.date.startsWith('2026-09'));
    expect(
      recap({ transactions: onlySeptember }).categories.every((row) => row.aboveUsual === null),
    ).toBe(true);
  });

  it('keeps the top five and folds the rest', () => {
    const spend = (categoryId: string, amount: number) =>
      tx({ date: '2026-09-12', amount, categoryId });
    const rows = [
      spend('cat-groceries', 700),
      spend('cat-home', 600),
      spend('cat-health', 500),
      spend('cat-transport', 400),
      spend('cat-fun', 300),
      spend('cat-gifts', 200),
      spend('cat-pets', 100),
    ];
    const result = recap({ transactions: rows });
    expect(result.categories.map((row) => row.categoryId)).toEqual([
      'cat-groceries',
      'cat-home',
      'cat-health',
      'cat-transport',
      'cat-fun',
    ]);
    expect(result.otherCategories).toEqual({ count: 2, amount: 300 });
  });
});

function budget(overrides: Partial<RecapBudgetRef> & Pick<RecapBudgetRef, 'id'>): RecapBudgetRef {
  return {
    name: overrides.id,
    categoryIds: ['cat-groceries'],
    amount: 40000,
    period: 'period',
    rollover: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('periodRecap: budgets', () => {
  it('measures the budgets that closed with the period, in their order', () => {
    const budgets = [
      budget({ id: 'plain' }),
      // Created in August: 42000 − 40000 spent carries 2000 into September, so September measures
      // against 44000 and carries 44000 − 38620 = 5380 into October.
      budget({
        id: 'rolling',
        amount: 42000,
        rollover: true,
        createdAt: '2026-08-15T10:00:00.000Z',
      }),
      budget({ id: 'tight', amount: 30000 }),
      budget({ id: 'monthly', period: 'month' }),
      budget({ id: 'yearly', period: 'year' }),
      budget({ id: 'weekly', period: 'week' }),
      budget({ id: 'too-new', createdAt: '2026-10-01T08:00:00.000Z' }),
    ];
    expect(recap({ budgets }).budgets).toEqual([
      { budgetId: 'plain', name: 'plain', spent: 38620, limit: 40000, over: false, carry: 0 },
      {
        budgetId: 'rolling',
        name: 'rolling',
        spent: 38620,
        limit: 44000,
        over: false,
        carry: 5380,
      },
      { budgetId: 'tight', name: 'tight', spent: 38620, limit: 30000, over: true, carry: 0 },
      { budgetId: 'monthly', name: 'monthly', spent: 38620, limit: 40000, over: false, carry: 0 },
    ]);
  });

  it('keeps a weekly budget in a weekly recap and drops a monthly one', () => {
    const week: PeriodDef = { kind: 'week', startDay: 1 };
    const closed = recapPeriod(week, '2026-10-05');
    const result = periodRecap({
      def: week,
      period: closed,
      today: '2026-10-05',
      transactions: [tx({ date: '2026-09-30', amount: 5000 })],
      categories: CATS,
      budgets: [
        budget({ id: 'weekly', period: 'week', amount: 10000 }),
        budget({ id: 'monthly', period: 'month' }),
      ],
      accounts: ACCOUNTS,
    });
    expect(result?.budgets).toEqual([
      { budgetId: 'weekly', name: 'weekly', spent: 5000, limit: 10000, over: false, carry: 0 },
    ]);
  });
});

describe('periodRecap: biggest expense and net worth', () => {
  it('names the single largest counted expense', () => {
    expect(recap().biggestExpense).toMatchObject({
      amount: 72000,
      date: '2026-09-01',
      categoryId: 'cat-rent',
      description: '',
    });
  });

  it('skips excluded rows and transfers, and breaks a tie by the earlier date', () => {
    const rows = [
      tx({ date: '2026-09-05', amount: 9000, excludeFromTotals: true }),
      tx({ date: '2026-09-08', amount: 5000, description: 'Treno' }),
      tx({ date: '2026-09-03', amount: 5000, description: 'Cena' }),
      tx({
        date: '2026-09-04',
        amount: 20000,
        kind: 'transfer',
        categoryId: null,
        accountId: 'acc-checking',
        toAccountId: 'acc-savings',
      }),
    ];
    expect(recap({ transactions: rows }).biggestExpense).toMatchObject({
      amount: 5000,
      description: 'Cena',
      date: '2026-09-03',
    });
  });

  it('measures net worth from the day before the period to its last day', () => {
    expect(recap().netWorthChange).toBe(118180);
    // A transfer moves nothing; an excluded expense leaves the totals but not the balances.
    const rows = [
      ...ledger(),
      tx({
        date: '2026-09-20',
        amount: 50000,
        kind: 'transfer',
        categoryId: null,
        accountId: 'acc-checking',
        toAccountId: 'acc-savings',
      }),
      tx({ date: '2026-09-21', amount: 1000, excludeFromTotals: true }),
    ];
    const result = recap({ transactions: rows });
    expect(result.net).toBe(118180);
    expect(result.netWorthChange).toBe(117180);
  });
});
