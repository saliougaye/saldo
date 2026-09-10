import type { Budget } from '@saldo/core';
import {
  type BudgetProgress,
  budgetProgress,
  budgetRange,
  type Category,
  type Cycle,
  cycleLength,
  effectiveLimit,
  elapsedDays,
  expandCategoryIds,
  type LocalDate,
  type PeriodDef,
  periodContaining,
  spendingByCategory,
  type Transaction,
} from '@saldo/core';

export interface BudgetView extends BudgetProgress {
  budget: Budget;
  range: { start: LocalDate; end: LocalDate };
  /** Days left in the range, floored at 0 (§6.4). */
  daysLeft: number;
  /** True while the range still contains today. */
  open: boolean;
  /** `amount` plus any rollover carry (§5.8). */
  limitWithCarry: number;
}

export interface BudgetProgressInput {
  budgets: readonly Budget[];
  categories: readonly Category[];
  /** Rows covering the selected period *and* the periods the carry walks back through. */
  transactions: readonly Transaction[];
  period: Cycle;
  def: PeriodDef;
  today: LocalDate;
}

/**
 * Turns budgets into everything §5.8 and §6.4 render. Kept as a pure function over already-loaded
 * rows: screens call it inside `useMemo`, and it is testable without a database.
 */
export function budgetViews(input: BudgetProgressInput): BudgetView[] {
  const { budgets, categories, transactions, period, def, today } = input;

  return budgets.map((budget) => {
    const range = budgetRange(budget.period, period, today);
    const spending = spendingByCategory(transactions, range, today);

    // Rollover only applies to budgets that follow the app's period (§5.8).
    const ids = expandCategoryIds(budget.categoryIds, categories);
    const spentIn = (target: Cycle): number => {
      const amounts = spendingByCategory(transactions, target, today);
      let total = 0;
      for (const id of ids) total += amounts.get(id) ?? 0;
      return total;
    };
    const limitWithCarry =
      budget.period === 'period'
        ? effectiveLimit({
            amount: budget.amount,
            // The carry walks back to the period the budget was created *in*, not to its
            // creation date, so the ISO timestamp is mapped onto a period first.
            createdAtPeriodStart: periodContaining(def, budget.createdAt.slice(0, 10)).start,
            period,
            def,
            spentInPeriod: spentIn,
            rollover: budget.rollover,
          })
        : budget.amount;

    const length = cycleLength(range);
    const elapsed = elapsedDays(range, today);
    const progress = budgetProgress(
      { ...budget, amount: limitWithCarry },
      spending,
      categories,
      length === 0 ? 0 : elapsed / length,
    );

    return {
      ...progress,
      budget,
      range,
      daysLeft: Math.max(0, length - elapsed),
      open: today >= range.start && today <= range.end,
      limitWithCarry,
    };
  });
}
