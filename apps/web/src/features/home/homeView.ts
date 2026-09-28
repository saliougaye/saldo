import {
  type BudgetAdvice,
  type BudgetCardStatus,
  type BudgetTargetInput,
  type BudgetView,
  budgetAdvice,
  budgetCardStatus,
  budgetViews,
  featuredTarget,
  type GoalCardStatus,
  type GoalTargetInput,
  type GoalView,
  goalCardStatus,
  goalViews,
  isUpcoming,
  type LocalDate,
  type PeriodDef,
  type PeriodSummary,
  type PeriodView,
  rankBudget,
  rankGoal,
  summarizePeriod,
  type Transaction,
  type TransactionKind,
  type TransactionRow,
  type TransactionRowDeps,
  transactionRow,
  type UserData,
  upcomingUntil,
} from '@saldo/core';

/** How many rows «In arrivo» and «Ultime transazioni» show before «Vedi tutte» (§6.2). */
export const HOME_ROWS = 5;

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

export interface HomeView {
  summary: PeriodSummary;
  upcoming: HomeRow[];
  recent: HomeRow[];
  budgets: {
    items: BudgetView[];
    featuredId: string | null;
    status: BudgetCardStatus;
    advice: BudgetAdvice | null;
  };
  goals: { items: GoalView[]; featuredId: string | null; status: GoalCardStatus };
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
  const upcomingEnd = upcomingUntil(def, period.range, today);

  const categories = new Map(data.categories.map((category) => [category.id, category]));
  const accounts = new Map(data.accounts.map((account) => [account.id, account]));
  const deps: TransactionRowDeps = {
    category: (id) => categories.get(id),
    accountName: (id) => accounts.get(id)?.name ?? '',
    kindLabel: kindLabel ?? ((kind) => kind),
    // Home is not about one account, so a transfer here carries no sign (§5.3).
    viewpointAccountId: null,
  };

  // The order the phone's query returns: date, then creation, then id, all descending.
  const byDateDesc = [...txs].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      b.createdAt.localeCompare(a.createdAt) ||
      b.id.localeCompare(a.id),
  );
  const row = (tx: Transaction): HomeRow => ({
    ...transactionRow(tx, deps),
    id: tx.id,
    date: tx.date,
    recurring: tx.recurrenceId !== null,
  });

  // «In arrivo» reaches into the next period while this one is current; everything else is
  // filtered by the period itself (§5.12, §6.15).
  const upcoming = byDateDesc
    .filter((tx) => isUpcoming(tx, today) && tx.date <= upcomingEnd)
    .slice(0, HOME_ROWS)
    .map(row);
  const recent = byDateDesc
    .filter((tx) => !isUpcoming(tx, today) && tx.date >= period.range.start)
    .slice(0, HOME_ROWS)
    .map(row);

  const budgetItems = budgetViews({
    budgets: data.budgets,
    categories: data.categories,
    transactions: txs,
    period: period.range,
    def,
    today,
  });
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
  const featured = budgetItems.find((view) => view.budget.id === featuredBudgetId);

  const goalItems = goalViews(data.accounts, txs, today, def);
  const goalInputs: GoalTargetInput[] = goalItems.map((view) => ({
    id: view.account.id,
    progress: view.progress,
  }));

  return {
    summary,
    upcoming,
    recent,
    budgets: {
      items: budgetItems,
      featuredId: featuredBudgetId,
      status: budgetCardStatus(budgetInputs),
      advice:
        featured === undefined
          ? null
          : // As on the phone: the budget's own range decides whether it is open, and `daysLeft`
            // excludes today while the advice spends today too.
            budgetAdvice(featured, featured.pace, featured.open, featured.daysLeft + 1),
    },
    goals: {
      items: goalItems,
      featuredId: featuredTarget(goalInputs.map(rankGoal), null),
      status: goalCardStatus(goalInputs),
    },
  };
}
