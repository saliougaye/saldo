import {
  type Account,
  accountSchema,
  type Budget,
  budgetSchema,
  type Category,
  categorySchema,
  emptyUserData,
  type Transaction,
  transactionSchema,
  type UserData,
} from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { homeView } from './homeView';

const TODAY = '2026-09-15';
const PERIOD = { start: '2026-09-01', end: '2026-09-30' };
const DEF = { kind: 'month', startDay: 1 } as const;
const PERIOD_VIEW = { range: PERIOD, isCurrent: true, elapsed: 15, length: 30 };

// The fixtures go through the schemas rather than through `as`: a row this test invents but the
// app could never store would make the assertions below prove nothing (§17.1.2).
const ACCOUNT: Account = accountSchema.parse({
  id: 'a1',
  name: 'Conto',
  type: 'checking',
  institution: null,
  openingBalance: 0,
  includeInSpendable: true,
  colorIndex: 0,
  icon: 'wallet',
  creditCloseDay: null,
  creditChargeDay: null,
  creditPaymentAccountId: null,
  archivedAt: null,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z-0000-web',
  deletedAt: null,
});

const CATEGORY: Category = categorySchema.parse({
  id: 'c1',
  name: 'Spesa',
  direction: 'expense',
  parentId: null,
  icon: 'cart',
  colorIndex: 1,
  archivedAt: null,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z-0000-web',
  deletedAt: null,
});

const BUDGET: Budget = budgetSchema.parse({
  id: 'b1',
  name: 'Spesa',
  categoryIds: ['c1'],
  amount: 10000,
  period: 'period',
  alertThreshold: 80,
  rollover: false,
  icon: 'cart',
  sortOrder: 0,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z-0000-web',
  deletedAt: null,
});

function tx(over: Partial<Transaction> & Pick<Transaction, 'id' | 'amount' | 'date'>): Transaction {
  return transactionSchema.parse({
    kind: 'expense',
    accountId: ACCOUNT.id,
    toAccountId: null,
    categoryId: CATEGORY.id,
    description: '',
    note: null,
    tagIds: [],
    excludeFromTotals: false,
    recurrenceId: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z-0000-web',
    deletedAt: null,
    ...over,
  });
}

function dataWith(transactions: Transaction[]): UserData {
  return {
    ...emptyUserData(),
    transactions,
    accounts: [ACCOUNT],
    categories: [CATEGORY],
  };
}

describe('homeView', () => {
  it('summarises the period exactly as summarizePeriod does', () => {
    const view = homeView({
      data: dataWith([
        tx({ id: 't1', amount: 2000, date: '2026-09-02', kind: 'income' }),
        tx({ id: 't2', amount: 500, date: '2026-09-03' }),
      ]),
      today: TODAY,
      def: DEF,
      period: PERIOD_VIEW,
    });
    expect(view.summary.income).toBe(2000);
    expect(view.summary.spent).toBe(500);
    expect(view.summary.remaining).toBe(1500);
  });

  it('puts a transaction dated ahead in «In arrivo» and not in «Ultime»', () => {
    const view = homeView({
      data: dataWith([
        tx({ id: 'past', amount: 100, date: '2026-09-10' }),
        tx({ id: 'ahead', amount: 100, date: '2026-09-20' }),
      ]),
      today: TODAY,
      def: DEF,
      period: PERIOD_VIEW,
    });
    expect(view.upcoming.map((row) => row.id)).toEqual(['ahead']);
    expect(view.recent.map((row) => row.id)).toEqual(['past']);
  });

  it('shows at most five rows in each list, newest first', () => {
    const many = Array.from({ length: 8 }, (_, index) =>
      tx({ id: `t${index}`, amount: 100, date: `2026-09-0${index + 1}` }),
    );
    const view = homeView({
      data: dataWith(many),
      today: TODAY,
      def: DEF,
      period: PERIOD_VIEW,
    });
    expect(view.recent).toHaveLength(5);
    expect(view.recent[0]?.date).toBe('2026-09-08');
  });

  it('leaves the lists empty and the totals at zero for an account with nothing in it', () => {
    const view = homeView({
      data: emptyUserData(),
      today: TODAY,
      def: DEF,
      period: PERIOD_VIEW,
    });
    expect(view.recent).toEqual([]);
    expect(view.upcoming).toEqual([]);
    expect(view.summary.spent).toBe(0);
    expect(view.budgets.items).toEqual([]);
    expect(view.goals.items).toEqual([]);
  });

  it('features the budget the phone features, and says why', () => {
    const data = dataWith([tx({ id: 't1', amount: 9000, date: '2026-09-05' })]);
    const view = homeView({
      data: { ...data, budgets: [BUDGET] },
      today: TODAY,
      def: DEF,
      period: PERIOD_VIEW,
    });
    expect(view.budgets.featuredId).toBe('b1');
    // `BudgetView extends BudgetProgress`: the spend is on the view itself, not under `progress`.
    expect(view.budgets.items[0]?.spent).toBe(9000);
    expect(view.budgets.status.kind).toBe('overPace');
    expect(view.budgets.advice?.kind).toBe('perDay');
  });
});
