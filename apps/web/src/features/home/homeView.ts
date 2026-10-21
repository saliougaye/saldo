import {
  type BudgetAdvice,
  type BudgetCardStatus,
  type BudgetTargetInput,
  type BudgetView,
  budgetAdvice,
  budgetCardStatus,
  budgetEventIds,
  featuredTarget,
  type GoalCardStatus,
  type GoalTargetInput,
  type GoalView,
  goalCardStatus,
  goalEventIds,
  goalViews,
  isUpcoming,
  type LocalDate,
  newestFirst,
  type PeriodDef,
  type PeriodSummary,
  type PeriodView,
  rankBudget,
  rankGoal,
  spendingByCategory,
  splitUpcoming,
  summarizePeriod,
  type Transaction,
  type TransactionKind,
  type TransactionRow,
  type TransactionRowDeps,
  transactionRow,
  type UserData,
  unbudgetedSpend,
} from '@saldo/core';
import { budgetsView } from '../budgets/budgetsView';
import { type HomeTrend, homeTrend } from './trend';

/** How many rows «In arrivo» and «Ultime transazioni» show before «Vedi tutte» (§6.2). */
export const HOME_ROWS = 5;

/**
 * H8: a closed period has no «In arrivo», so «Ultime transazioni» takes both columns, 5 rows in
 * each.
 */
export const HOME_ROWS_CLOSED = 10;

/** H7: «In arrivo» reads as a timeline, the nearest date first. Equal dates keep their order. */
function nearestFirst(a: Transaction, b: Transaction): number {
  return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
}

export interface HomeRow extends TransactionRow {
  id: string;
  date: LocalDate;
  /**
   * `transactionRow` returns title, subtitle, icon, colorIndex and amount — **no badge**: the phone's
   * screens add the ↻ themselves from `recurrenceId`. Both apps decide it the same way, so it is
   * carried here rather than recomputed in the page.
   */
  recurring: boolean;
}

/**
 * «In arrivo» (§6.1): the rows the card shows, and how many there are.
 *
 * The two travel together because they are not the same number past five rows, and a page reading
 * `rows.length` for the header would be quietly wrong exactly when the card matters most. `count`
 * is also what decides the card exists at all: the phone hides it at zero.
 */
export interface HomeUpcoming {
  rows: HomeRow[];
  /** Every row «In arrivo», not the five shown. */
  count: number;
  /**
   * Income minus expense of every upcoming row, not only the five shown: Transazioni's trailing
   * (D4). The same sum as `listView`'s `upcoming.net`.
   */
  net: number;
}

export interface HomeBudgets {
  items: BudgetView[];
  featuredId: string | null;
  /** The budgets over their limit that are not the featured one: a row each (§5.13). */
  eventIds: string[];
  status: BudgetCardStatus;
  advice: BudgetAdvice | null;
  /** Each budget's own sentence (D4: every budget is a card now), by budget id. */
  adviceById: Record<string, BudgetAdvice>;
  /** D6: the spend of the period in categories no budget covers. */
  unbudgeted: number;
}

export interface HomeGoals {
  items: GoalView[];
  featuredId: string | null;
  /** Expired then reached, the featured one excluded: a row each (§5.13). */
  eventIds: string[];
  status: GoalCardStatus;
  // No `advice`: the featured goal's sentence is `goalSentence` from `@saldo/i18n`, which reads
  // `goalAdvice` itself — the same call the phone's `useGoalText` makes.
}

export interface HomeView {
  summary: PeriodSummary;
  upcoming: HomeUpcoming;
  /** «Ultime transazioni». No count beside it: its header says «Tutte le transazioni», not a number. */
  recent: HomeRow[];
  budgets: HomeBudgets;
  goals: HomeGoals;
  trend: HomeTrend;
}

export interface HomeViewInput {
  data: UserData;
  today: LocalDate;
  def: PeriodDef;
  period: PeriodView;
  /** `t('kinds.<kind>')`, injected so this stays pure; the page passes its translator. */
  kindLabel?: (kind: TransactionKind) => string;
}

/**
 * Home, as numbers (§6.2). Every figure comes from `@saldo/core`; nothing is computed here but the
 * slicing and the lookups, which is the point — if the phone and the web disagree, one of them is
 * not calling this.
 */
export function homeView({ data, today, def, period, kindLabel }: HomeViewInput): HomeView {
  const txs = data.transactions;
  const summary = summarizePeriod(txs, period.range, today);
  const periodEnd = period.range.end;

  const categories = new Map(data.categories.map((category) => [category.id, category]));
  const accounts = new Map(data.accounts.map((account) => [account.id, account]));
  const deps: TransactionRowDeps = {
    category: (id) => categories.get(id),
    accountName: (id) => accounts.get(id)?.name ?? '',
    kindLabel: kindLabel ?? ((kind) => kind),
    // Home is not about one account, so a transfer here carries no sign (§5.3).
    viewpointAccountId: null,
  };

  // The order the phone's query returns, byte for byte (see `newestFirst`).
  const byDateDesc = [...txs].sort(newestFirst);
  const row = (tx: Transaction): HomeRow => ({
    ...transactionRow(tx, deps),
    id: tx.id,
    date: tx.date,
    recurring: tx.recurrenceId !== null,
  });

  // «In arrivo» stops at the end of the period: a row dated after it belongs to the next period
  // (§5.12, §6.15).
  const upcomingAll = byDateDesc
    .filter((tx) => isUpcoming(tx, today) && tx.date <= periodEnd)
    .sort(nearestFirst);
  // `periodEnd` bounds this list too, and not only «In arrivo»: the phone's query never loads a
  // row past it, so on a **closed** period its «Ultime transazioni» stops at the period. Without
  // the bound the web reaches into the periods after it and shows five rows the phone does not.
  const recent = byDateDesc
    .filter((tx) => !isUpcoming(tx, today) && tx.date >= period.range.start && tx.date <= periodEnd)
    .slice(0, period.isCurrent ? HOME_ROWS : HOME_ROWS_CLOSED)
    .map(row);

  const { items: budgetItems } = budgetsView({ data, today, def, period });
  const budgetInputs: BudgetTargetInput[] = budgetItems.map((view) => ({
    id: view.budget.id,
    progress: view,
    pace: view.pace,
  }));
  // `featuredTarget`'s second argument is the item featured last time, which the phone keeps
  // device-locally so the card does not change face at every transaction. The web has nowhere to
  // keep it in 0.3d and passes null: the hysteresis never applies, which is correct-but-jumpier,
  // and is the same answer on a page rendered once per request.
  const featuredBudgetId = featuredTarget(budgetInputs.map(rankBudget), null);
  const featuredBudget = budgetItems.find((view) => view.budget.id === featuredBudgetId);

  const goalItems = goalViews(data.accounts, txs, today, def);
  const goalInputs: GoalTargetInput[] = goalItems.map((view) => ({
    id: view.account.id,
    progress: view.progress,
  }));
  // Same `null`, same reason as the budgets above.
  const featuredGoalId = featuredTarget(goalInputs.map(rankGoal), null);

  // As for the featured budget below: the budget's own range decides whether it is open, and
  // `daysLeft` excludes today while the advice spends today too.
  const adviceById: Record<string, BudgetAdvice> = {};
  for (const view of budgetItems) {
    adviceById[view.budget.id] = budgetAdvice(view, view.pace, view.open, view.daysLeft + 1);
  }
  const unbudgeted = unbudgetedSpend(
    budgetItems.map((view) => view.budget),
    spendingByCategory(txs, period.range, today),
    data.categories,
  );

  return {
    summary,
    trend: homeTrend(txs, def, period, today),
    upcoming: {
      rows: upcomingAll.slice(0, HOME_ROWS).map(row),
      count: upcomingAll.length,
      net: splitUpcoming(upcomingAll, today).upcomingNet,
    },
    recent,
    budgets: {
      items: budgetItems,
      featuredId: featuredBudgetId,
      eventIds: budgetEventIds(budgetInputs, featuredBudgetId),
      status: budgetCardStatus(budgetInputs),
      advice:
        featuredBudget === undefined
          ? null
          : // As on the phone: the budget's own range decides whether it is open, and `daysLeft`
            // excludes today while the advice spends today too.
            budgetAdvice(
              featuredBudget,
              featuredBudget.pace,
              featuredBudget.open,
              featuredBudget.daysLeft + 1,
            ),
      adviceById,
      unbudgeted,
    },
    goals: {
      items: goalItems,
      featuredId: featuredGoalId,
      eventIds: goalEventIds(goalInputs, featuredGoalId),
      status: goalCardStatus(goalInputs),
    },
  };
}
