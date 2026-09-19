import type { Budget, MinorDigits } from '@saldo/core';
import type { IconName } from '@saldo/ui';

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
  /** `null` until the user picks one; a new budget then takes its first category's icon. */
  icon: IconName | null;
}

export function emptyBudgetForm(): BudgetFormValues {
  return {
    buffer: '',
    categoryIds: [],
    name: '',
    period: 'period',
    alertThreshold: 90,
    rollover: false,
    icon: null,
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
    icon: budget.icon as IconName,
  };
}
