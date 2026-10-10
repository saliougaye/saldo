import {
  type Budget,
  budgetSchema,
  categorySchema,
  EMPTY_FILTERS,
  getForecastTool,
  getPeriodSummaryTool,
  listAccountsTool,
  listBudgetsTool,
  listGoalsTool,
  listTransactionsTool,
  type PeriodDef,
  settingsSchema,
  spendingByCategoryTool,
  type ToolContext,
  type UserData,
} from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { accountsView } from '../accounts/accountsView';
import { budgetsView } from '../budgets/budgetsView';
import { homeView } from '../home/homeView';
import { periodFromParam } from '../period/periodParams';
import { navigatorForecast } from '../stats/navigatorView';
import { statsView } from '../stats/statsView';
import {
  ACCOUNT,
  ACCOUNT_2,
  account,
  CATEGORY,
  CATEGORY_2,
  CATEGORY_CHILD,
  RECURRENCE,
  TAG,
  tx,
} from '../test/fixtures';
import { listView } from '../transactions/listView';

// §17.4.2 and §17.4.5: «the answer matches Statistiche to the cent». Each test runs a read tool of
// `@saldo/core` and the view function the page renders from, on the same data, and asks them for
// the same numbers. A tool that drifted from its page fails here, not in front of a user.

const CTX: ToolContext = { today: '2026-09-15', timeZone: 'Europe/Rome' };

const SETTINGS = settingsSchema.parse({
  id: 'settings',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z-0000-web',
  deletedAt: null,
  periodKind: 'month',
  cycleStartDay: 27,
  currency: 'EUR',
  language: 'it',
  theme: 'system',
  onboardingCompletedAt: '2026-01-01T00:00:00.000Z',
  timeZone: 'Europe/Rome',
});

const INCOME = categorySchema.parse({
  ...CATEGORY,
  id: 'c-in',
  name: 'Stipendio',
  direction: 'income',
});

const POCKET = account({
  id: 'p1',
  name: 'Vacanze',
  type: 'pocket',
  includeInSpendable: false,
  parentAccountId: ACCOUNT.id,
  goalTarget: 100000,
  goalStartDate: '2026-06-01',
  goalDeadline: '2026-12-31',
  sortOrder: 2,
});

function budget(over: Partial<Budget> & Pick<Budget, 'id' | 'categoryIds'>): Budget {
  return budgetSchema.parse({
    name: 'Budget',
    amount: 10000,
    period: 'period',
    alertThreshold: 80,
    rollover: false,
    icon: 'cart',
    sortOrder: 0,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z-0000-web',
    deletedAt: null,
    ...over,
  });
}

/** Three used months, then September with an excluded row, a transfer and a row ahead of today. */
function data(): UserData {
  const history = ['2026-06', '2026-07', '2026-08'].flatMap((ym) => [
    tx({ id: `in-${ym}`, date: `${ym}-01`, amount: 200000, kind: 'income', categoryId: INCOME.id }),
    tx({
      id: `rent-${ym}`,
      date: `${ym}-05`,
      amount: 70000,
      categoryId: CATEGORY_2.id,
      recurrenceId: RECURRENCE.id,
    }),
    tx({ id: `fruit-${ym}`, date: `${ym}-10`, amount: 5000, categoryId: CATEGORY_CHILD.id }),
  ]);
  const september = [
    tx({ id: 'in-sep', date: '2026-09-01', amount: 200000, kind: 'income', categoryId: INCOME.id }),
    tx({
      id: 'pocket-sep',
      date: '2026-09-02',
      amount: 20000,
      kind: 'transfer',
      categoryId: null,
      toAccountId: POCKET.id,
    }),
    tx({
      id: 'rent-sep',
      date: '2026-09-05',
      amount: 70000,
      categoryId: CATEGORY_2.id,
      recurrenceId: RECURRENCE.id,
    }),
    tx({
      id: 'fruit-sep',
      date: '2026-09-08',
      amount: 3000,
      categoryId: CATEGORY_CHILD.id,
      tagIds: [TAG.id],
    }),
    tx({ id: 'shop-sep', date: '2026-09-12', amount: 1200 }),
    tx({ id: 'excluded-sep', date: '2026-09-11', amount: 999, excludeFromTotals: true }),
    tx({ id: 'ahead-sep', date: '2026-09-20', amount: 800 }),
  ];
  return {
    settings: SETTINGS,
    accounts: [ACCOUNT, ACCOUNT_2, POCKET],
    categories: [CATEGORY, CATEGORY_2, CATEGORY_CHILD, INCOME],
    tags: [TAG],
    transactions: [...history, ...september],
    recurrences: [RECURRENCE],
    budgets: [
      budget({ id: 'b-home', categoryIds: [CATEGORY_2.id], amount: 60000, sortOrder: 1 }),
      budget({ id: 'b-food', categoryIds: [CATEGORY.id], amount: 10000, rollover: true }),
    ],
    attachments: [],
  };
}

/** What `pageState` derives from the settings row, for the view functions that take it. */
const DEF: PeriodDef = { kind: SETTINGS.periodKind, startDay: SETTINGS.cycleStartDay };

describe('the read tools say what the pages say', () => {
  it.each([undefined, '2026-08-10'])('get_period_summary matches Statistiche (?p=%s)', (param) => {
    const period = periodFromParam(DEF, CTX.today, param);
    const stats = statsView({
      data: data(),
      def: DEF,
      today: CTX.today,
      period,
      direction: 'expense',
    });
    const tool = getPeriodSummaryTool.run(data(), CTX, { period: param });
    expect(tool.income.minor).toBe(stats.figures.income);
    expect(tool.expenses.minor).toBe(stats.figures.spent);
    expect(tool.balance.minor).toBe(stats.figures.net);
    expect(tool.committed.amount.minor).toBe(stats.committed.amount);
    expect(tool.committed.sharePercent).toBe(stats.committed.share);
    expect(tool.committed.discretionary.minor).toBe(stats.committed.discretionary);
  });

  it.each(['expense', 'income'] as const)(
    'spending_by_category matches the split of Statistiche (%s)',
    (direction) => {
      const period = periodFromParam(DEF, CTX.today, undefined);
      const stats = statsView({ data: data(), def: DEF, today: CTX.today, period, direction });
      const tool = spendingByCategoryTool.run(data(), CTX, { direction });
      expect(tool.total.minor).toBe(stats.split.total);
      expect(
        tool.categories.map((row) => [row.categoryId, row.amount.minor, row.sharePercent]),
      ).toEqual(stats.split.rows.map((row) => [row.categoryId, row.amount, row.share]));
    },
  );

  it('list_accounts matches Conti', () => {
    const page = accountsView({ data: data(), today: CTX.today, def: DEF });
    const tool = listAccountsTool.run(data(), CTX, { includeArchived: false });
    expect(tool.netWorth.minor).toBe(page.netWorth);
    expect(tool.spendable.minor).toBe(page.spendable);
    for (const row of [...page.spending, ...page.savings]) {
      const mirrored = tool.accounts.find((candidate) => candidate.id === row.account.id);
      expect(mirrored?.balance.minor).toBe(row.balance);
      expect(mirrored?.free.minor).toBe(row.free);
      expect(mirrored?.pockets.map((pocket) => [pocket.id, pocket.saved.minor])).toEqual(
        row.pockets.map((pocket) => [pocket.account.id, pocket.saved]),
      );
    }
  });

  it.each([undefined, '2026-08-10'])('list_budgets matches Budget (?p=%s)', (param) => {
    const period = periodFromParam(DEF, CTX.today, param);
    const page = budgetsView({ data: data(), today: CTX.today, def: DEF, period });
    const tool = listBudgetsTool.run(data(), CTX, { period: param });
    expect(
      tool.budgets.map((row) => [row.id, row.spent.minor, row.limit.minor, row.ratio]),
    ).toEqual(page.items.map((view) => [view.budget.id, view.spent, view.limit, view.ratio]));
  });

  it('list_goals matches the goals of Home', () => {
    const period = periodFromParam(DEF, CTX.today, undefined);
    const page = homeView({ data: data(), today: CTX.today, def: DEF, period });
    const tool = listGoalsTool.run(data(), CTX, {});
    expect(
      tool.goals.map((goal) => [goal.id, goal.saved.minor, goal.state, goal.perPeriod?.minor]),
    ).toEqual(
      page.goals.items.map((view) => [
        view.account.id,
        view.progress.saved,
        view.progress.state,
        view.progress.perPeriod ?? undefined,
      ]),
    );
  });

  it('get_forecast matches the forecast columns of Statistiche', () => {
    const page = navigatorForecast({ data: data(), def: DEF, today: CTX.today });
    const tool = getForecastTool.run(data(), CTX, {});
    expect(page).not.toBeNull();
    expect(tool.available).toBe(true);
    expect(
      tool.periods.map((period) => [
        period.start,
        period.end,
        period.income.minor,
        period.expenses.minor,
        period.expensesMin.minor,
        period.expensesMax.minor,
        period.balance.minor,
      ]),
    ).toEqual(
      (page ?? []).map((period) => [
        period.range.start,
        period.range.end,
        period.income,
        period.expenses,
        period.expensesMin,
        period.expensesMax,
        period.balance,
      ]),
    );
  });

  it('list_transactions matches Transazioni on a closed period', () => {
    // A closed period: the list's «In arrivo» horizon is the period's own end, so both read the
    // same rows. (On the current period the list also reaches into the next one; the tool stops
    // at the period, by decision.)
    const period = periodFromParam(DEF, CTX.today, '2026-08-10');
    for (const filters of [EMPTY_FILTERS, { ...EMPTY_FILTERS, categoryId: CATEGORY.id }]) {
      const page = listView({ data: data(), filters, today: CTX.today, period });
      const tool = listTransactionsTool.run(data(), CTX, {
        period: '2026-08-10',
        categoryId: filters.categoryId ?? undefined,
        limit: 200,
        offset: 0,
      });
      expect(tool.transactions.map((row) => row.id)).toEqual(
        page.days.flatMap((day) => day.rows.map((row) => row.id)),
      );
      expect(tool.totals.expense.minor).toBe(page.totals.expense);
      expect(tool.totals.income.minor).toBe(page.totals.income);
      expect(tool.totals.count).toBe(page.totals.count);
    }
  });
});
