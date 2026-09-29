import { type Account, accountSchema, type Budget, budgetSchema, emptyUserData } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { ACCOUNT, dataWith, tx } from '../test/fixtures';
import { homeView } from './homeView';

const TODAY = '2026-09-15';
const PERIOD = { start: '2026-09-01', end: '2026-09-30' };
const DEF = { kind: 'month', startDay: 1 } as const;
const PERIOD_VIEW = { range: PERIOD, isCurrent: true, elapsed: 15, length: 30 };

function pocket(over: {
  id: string;
  name: string;
  goalTarget: number;
  goalDeadline: string | null;
}): Account {
  return accountSchema.parse({
    type: 'pocket',
    institution: null,
    openingBalance: 0,
    includeInSpendable: false,
    colorIndex: 3,
    icon: 'piggy',
    creditCloseDay: null,
    creditChargeDay: null,
    creditPaymentAccountId: null,
    archivedAt: null,
    sortOrder: 1,
    parentAccountId: ACCOUNT.id,
    goalStartDate: '2026-09-01',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z-0000-web',
    deletedAt: null,
    ...over,
  });
}

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

const BUDGET_2: Budget = budgetSchema.parse({
  id: 'b2',
  name: 'Casa',
  categoryIds: ['c2'],
  amount: 10000,
  period: 'period',
  alertThreshold: 80,
  rollover: false,
  icon: 'home',
  sortOrder: 1,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z-0000-web',
  deletedAt: null,
});

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
    expect(view.upcoming.rows.map((row) => row.id)).toEqual(['ahead']);
    expect(view.upcoming.count).toBe(1);
    expect(view.recent.map((row) => row.id)).toEqual(['past']);
  });

  it('keeps «Ultime transazioni» inside a closed period, as the phone\u2019s query does', () => {
    const view = homeView({
      data: dataWith([
        tx({ id: 'inside', amount: 100, date: '2026-08-20' }),
        tx({ id: 'after', amount: 100, date: '2026-09-10' }),
      ]),
      today: TODAY,
      def: DEF,
      period: {
        range: { start: '2026-08-01', end: '2026-08-31' },
        isCurrent: false,
        elapsed: 31,
        length: 31,
      },
    });
    expect(view.recent.map((row) => row.id)).toEqual(['inside']);
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
    expect(view.upcoming.rows).toEqual([]);
    expect(view.upcoming.count).toBe(0);
    expect(view.summary.spent).toBe(0);
    expect(view.budgets.items).toEqual([]);
    expect(view.budgets.eventIds).toEqual([]);
    expect(view.budgets.advice).toBeNull();
    expect(view.goals.items).toEqual([]);
    expect(view.goals.eventIds).toEqual([]);
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
  it('counts every row «In arrivo», not the five it shows', () => {
    const ahead = Array.from({ length: 7 }, (_, index) =>
      tx({ id: `u${index}`, amount: 100, date: `2026-09-${16 + index}` }),
    );
    const view = homeView({
      data: dataWith(ahead),
      today: TODAY,
      def: DEF,
      period: PERIOD_VIEW,
    });
    expect(view.upcoming.rows).toHaveLength(5);
    expect(view.upcoming.rows[0]?.date).toBe('2026-09-22');
    // What the card's header says, and what decides the card exists at all.
    expect(view.upcoming.count).toBe(7);
  });

  it('gives the budgets over their limit a row each, the featured one apart', () => {
    const data = dataWith([
      tx({ id: 't1', amount: 15000, date: '2026-09-05' }),
      tx({ id: 't2', amount: 12000, date: '2026-09-06', categoryId: 'c2' }),
    ]);
    const view = homeView({
      data: { ...data, budgets: [BUDGET, BUDGET_2] },
      today: TODAY,
      def: DEF,
      period: PERIOD_VIEW,
    });
    // Both are over; the larger overrun is featured and the other becomes the exception row.
    expect(view.budgets.status).toEqual({ kind: 'overLimit', count: 2 });
    expect(view.budgets.featuredId).toBe('b1');
    expect(view.budgets.eventIds).toEqual(['b2']);
    expect(view.budgets.advice).toEqual({ kind: 'overLimit', overrun: 5000 });
  });

  it('features the goal still running and gives the reached one a row, with its advice', () => {
    const running = pocket({
      id: 'p1',
      name: 'Vacanza',
      goalTarget: 100000,
      goalDeadline: '2026-12-31',
    });
    const done = pocket({ id: 'p2', name: 'Cauzione', goalTarget: 5000, goalDeadline: null });
    const transfer = (id: string, amount: number, toAccountId: string, date: string) =>
      tx({ id, amount, date, kind: 'transfer', toAccountId, categoryId: null });
    const data = dataWith([
      transfer('g1', 20000, 'p1', '2026-09-05'),
      transfer('g2', 5000, 'p2', '2026-09-02'),
    ]);
    const view = homeView({
      data: { ...data, accounts: [ACCOUNT, running, done] },
      today: TODAY,
      def: DEF,
      period: PERIOD_VIEW,
    });
    expect(view.goals.items.map((item) => item.account.id)).toEqual(['p1', 'p2']);
    expect(view.goals.items[0]?.progress.saved).toBe(20000);
    expect(view.goals.status).toEqual({ expired: 0, behind: 0, reached: 1 });
    expect(view.goals.featuredId).toBe('p1');
    expect(view.goals.eventIds).toEqual(['p2']);
  });
});
