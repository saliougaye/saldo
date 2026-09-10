import type { Budget } from '@saldo/core';
import {
  type BudgetProgress,
  budgetProgress,
  budgetRange,
  type Category,
  type Cycle,
  cycleContaining,
  cycleLength,
  effectiveLimit,
  elapsedDays,
  expandCategoryIds,
  type LocalDate,
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
  /** Rows covering the selected cycle *and* the cycles the carry walks back through. */
  transactions: readonly Transaction[];
  cycle: Cycle;
  cycleStartDay: number;
  today: LocalDate;
}

/**
 * Turns budgets into everything §5.8 and §6.4 render. Kept as a pure function over already-loaded
 * rows: screens call it inside `useMemo`, and it is testable without a database.
 */
export function budgetViews(input: BudgetProgressInput): BudgetView[] {
  const { budgets, categories, transactions, cycle, cycleStartDay, today } = input;

  return budgets.map((budget) => {
    const range = budgetRange(budget.period, cycle, today);
    const spending = spendingByCategory(transactions, range, today);

    // Rollover only applies to cycle budgets (§5.8); the others ignore the toggle.
    const ids = expandCategoryIds(budget.categoryIds, categories);
    const spentIn = (target: Cycle): number => {
      const amounts = spendingByCategory(transactions, target, today);
      let total = 0;
      for (const id of ids) total += amounts.get(id) ?? 0;
      return total;
    };
    const limitWithCarry =
      budget.period === 'cycle'
        ? effectiveLimit({
            amount: budget.amount,
            // The carry walks back to the cycle the budget was created *in*, not to its
            // creation date, so the ISO timestamp has to be mapped onto a cycle first.
            createdAtCycleStart: cycleContaining(budget.createdAt.slice(0, 10), cycleStartDay)
              .start,
            cycle,
            cycleStartDay,
            spentInCycle: spentIn,
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
