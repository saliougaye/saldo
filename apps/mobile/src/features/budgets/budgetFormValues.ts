import type { Budget, MinorDigits } from '@saldo/core';

/**
 * What the budget form holds while it is being filled in — separate from the screen so the step
 * rules can be tested without rendering React Native.
 */
export interface BudgetFormValues {
  buffer: string;
  categoryIds: string[];
  name: string;
  period: Budget['period'];
  alertThreshold: number | null;
  rollover: boolean;
}

export function emptyBudgetForm(): BudgetFormValues {
  return {
    buffer: '',
    categoryIds: [],
    name: '',
    period: 'period',
    alertThreshold: 90,
    rollover: false,
  };
}

export function budgetFormFrom(budget: Budget, minorDigits: MinorDigits): BudgetFormValues {
  return {
    buffer: (budget.amount / 10 ** minorDigits).toString(),
    categoryIds: [...budget.categoryIds],
    name: budget.name,
    period: budget.period,
    alertThreshold: budget.alertThreshold,
    rollover: budget.rollover,
  };
}
