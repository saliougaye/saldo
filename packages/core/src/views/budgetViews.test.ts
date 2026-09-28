import { describe, expect, it } from 'vitest';
import type { Budget, Category, Transaction } from '../entities';
import type { PeriodDef } from '../period';
import { budgetViews } from './budgetViews';

const CYCLE = { start: '2026-03-27', end: '2026-04-26' };
const TODAY = '2026-04-18';
const START_DAY = 27;
/** These tests were written against a pay cycle (§5.2). */
const CYCLE_DEF: PeriodDef = { kind: 'cycle', startDay: START_DAY };

function category(id: string, overrides: Partial<Category> = {}): Category {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '001775000000000-0000-dev',
    deletedAt: null,
    name: id,
    direction: 'expense',
    parentId: null,
    icon: 'cart',
    colorIndex: 0,
    archivedAt: null,
    sortOrder: 0,
    ...overrides,
  };
}

function tx(date: string, amount: number, categoryId = 'cat-food'): Transaction {
  return {
    id: `${date}-${amount}-${categoryId}`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '001775000000000-0000-dev',
    deletedAt: null,
    kind: 'expense',
    amount,
    date,
    accountId: 'acc-1',
    toAccountId: null,
    categoryId,
    description: '',
    note: null,
    tagIds: [],
    excludeFromTotals: false,
    recurrenceId: null,
  };
}

function budget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 'b1',
    createdAt: '2026-01-05T00:00:00.000Z',
    updatedAt: '001775000000000-0000-dev',
    deletedAt: null,
    name: 'Spesa',
    categoryIds: ['cat-food'],
    amount: 40000,
    period: 'period',
    alertThreshold: 90,
    rollover: false,
    icon: 'cart',
    sortOrder: 0,
    ...overrides,
  };
}

const categories = [category('cat-food'), category('cat-market', { parentId: 'cat-food' })];

function view(overrides: Partial<Budget>, transactions: Transaction[]) {
  const [only] = budgetViews({
    budgets: [budget(overrides)],
    categories,
    transactions,
    period: CYCLE,
    def: CYCLE_DEF,
    today: TODAY,
  });
  if (only === undefined) throw new Error('no view');
  return only;
}

describe('budgetViews', () => {
  it('sums the budget categories and their children inside the cycle', () => {
    const result = view({}, [tx('2026-04-01', 12000), tx('2026-04-02', 8000, 'cat-market')]);
    expect(result.spent).toBe(20000);
    expect(result.limit).toBe(40000);
    expect(result.ratio).toBeCloseTo(0.5, 10);
  });

  it('ignores rows outside the range', () => {
    const result = view({}, [tx('2026-03-26', 50000), tx('2026-04-27', 50000)]);
    expect(result.spent).toBe(0);
  });

  it('reports the days left, the pace and whether the range is still open', () => {
    const result = view({}, []);
    // Cycle is 31 days and today is day 23.
    expect(result.daysLeft).toBe(8);
    expect(result.pace).toBeCloseTo(23 / 31, 10);
    expect(result.open).toBe(true);
  });

  it('measures a week budget against the ISO week containing today', () => {
    const result = view({ period: 'week' }, [
      tx('2026-04-13', 1000),
      tx('2026-04-17', 2000),
      // Outside the week 13–19 Apr.
      tx('2026-04-12', 9000),
      tx('2026-04-20', 9000),
    ]);
    expect(result.range).toEqual({ start: '2026-04-13', end: '2026-04-19' });
    expect(result.spent).toBe(3000);
  });

  it('leaves a scheduled row inside the range out of the spend', () => {
    // 19 Apr is inside the week but still in the future, and §5.3 counts nothing after today.
    const result = view({ period: 'week' }, [tx('2026-04-13', 1000), tx('2026-04-19', 2000)]);
    expect(result.spent).toBe(1000);
  });

  it('measures a year budget against the calendar year', () => {
    const result = view({ period: 'year' }, [tx('2026-01-15', 5000), tx('2025-12-31', 9000)]);
    expect(result.range).toEqual({ start: '2026-01-01', end: '2026-12-31' });
    expect(result.spent).toBe(5000);
  });

  it('adds the rollover carry to the limit, but only for a cycle budget', () => {
    // Created in the cycle starting 27 Dec; the two cycles before this one each leave 30000.
    const transactions = [tx('2026-01-05', 10000), tx('2026-02-05', 10000)];
    const withRollover = view(
      { rollover: true, createdAt: '2025-12-28T00:00:00.000Z' },
      transactions,
    );
    const without = view({ rollover: false, createdAt: '2025-12-28T00:00:00.000Z' }, transactions);
    expect(withRollover.limitWithCarry).toBeGreaterThan(without.limitWithCarry);
    expect(without.limitWithCarry).toBe(40000);
  });

  it('flags over pace, over limit and the alert threshold', () => {
    const result = view({ alertThreshold: 50 }, [tx('2026-04-01', 45000)]);
    expect(result.overLimit).toBe(true);
    expect(result.overPace).toBe(true);
    expect(result.alertReached).toBe(true);
  });
});
