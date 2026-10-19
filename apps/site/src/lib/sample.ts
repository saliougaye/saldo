import { budgetProgress, cycleLength, diffDays, elapsedDays } from '@saldo/core';
import type { CategoryKey } from '../content/en';
import type { SiteContent } from '../content/index';

/**
 * Figures that more than one screen shows, calculated from the sample data so they cannot disagree
 * (spec 0.8a §12). The over-pace rule is `@saldo/core`'s own `budgetProgress`.
 */
type Sample = SiteContent['sample'];

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

export function incomeTotal(sample: Sample): number {
  return sum(sample.income.map((entry) => entry.amount));
}

export function expensesTotal(sample: Sample): number {
  return sum(Object.values(sample.spent));
}

export function leftToSpend(sample: Sample): number {
  return incomeTotal(sample) - expensesTotal(sample);
}

/** Day of the period and its length: «day 13 of 30». */
export function periodDay(sample: Sample): {
  elapsed: number;
  length: number;
  pace: number;
  daysLeft: number;
} {
  const elapsed = elapsedDays(sample.period, sample.period.today);
  const length = cycleLength(sample.period);
  return { elapsed, length, pace: elapsed / length, daysLeft: length - elapsed };
}

interface BudgetState {
  category: CategoryKey;
  spent: number;
  limit: number;
  ratio: number;
  overPace: boolean;
  overLimit: boolean;
}

export function budgetStates(sample: Sample): BudgetState[] {
  const { pace } = periodDay(sample);
  const spending = new Map<string, number>(Object.entries(sample.spent));
  return sample.budgets.map((budget) => {
    const progress = budgetProgress(
      { categoryIds: [budget.category], amount: budget.limit, alertThreshold: null },
      spending,
      [{ id: budget.category, parentId: null }],
      pace,
    );
    return { category: budget.category, ...progress };
  });
}

export function spendableTotal(sample: Sample): number {
  return sum(sample.accounts.spending.map((account) => account.balance));
}

export function netWorth(sample: Sample): number {
  return spendableTotal(sample) + sum(sample.accounts.savings.map((account) => account.balance));
}

export function cardDue(sample: Sample): number {
  return sample.card.accrued + sample.card.statement;
}

interface GoalState {
  ratio: number;
  /** elapsed / length from the start to the deadline; null without a deadline. */
  pace: number | null;
  /** Saved minus where the pace says the goal should be, in cents. */
  gap: number;
}

export function goalState(goal: Sample['goals'][number], today: string): GoalState {
  const ratio = goal.saved / goal.target;
  if (goal.deadline === null) return { ratio, pace: null, gap: 0 };
  const pace = diffDays(goal.start, today) / diffDays(goal.start, goal.deadline);
  return { ratio, pace, gap: Math.round(goal.saved - goal.target * pace) };
}

/** Recurring cost per month: weekly entries count 52/12 times. */
export function recurringPerMonth(sample: Sample): {
  expenses: number;
  income: number;
  share: number;
} {
  let expenses = 0;
  let income = 0;
  for (const entry of sample.recurring) {
    const monthly =
      entry.cadence === 'weekly' ? Math.round((entry.amount * 52) / 12) : entry.amount;
    if (monthly < 0) expenses += monthly;
    else income += monthly;
  }
  return { expenses, income, share: income > 0 ? Math.round((-expenses / income) * 100) : 0 };
}

export function recapFigures(sample: Sample) {
  const recap = sample.recap;
  const rows = Object.entries(recap.spent) as [CategoryKey, number][];
  const expenses = sum(rows.map(([, amount]) => amount));
  const shown = rows.slice(0, 3);
  const rest = rows.slice(3);
  return {
    expenses,
    net: recap.income - expenses,
    shown,
    rest: { count: rest.length, amount: sum(rest.map(([, amount]) => amount)) },
  };
}
