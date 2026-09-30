import {
  type BudgetView,
  budgetViews,
  type LocalDate,
  type PeriodDef,
  type PeriodView,
  type UserData,
} from '@saldo/core';

/**
 * The budgets of the selected period, in the order the user set (§5.8). Home and `/budgets` both
 * call this, so a ring cannot say one thing on one page and another on the other.
 */
export function budgetsView(input: {
  data: UserData;
  today: LocalDate;
  def: PeriodDef;
  period: PeriodView;
}): { items: BudgetView[] } {
  const { data, today, def, period } = input;
  const items = budgetViews({
    budgets: [...data.budgets].sort((a, b) => a.sortOrder - b.sortOrder),
    categories: data.categories,
    transactions: data.transactions,
    period: period.range,
    def,
    today,
  });
  return { items };
}
