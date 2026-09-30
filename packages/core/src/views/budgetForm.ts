import type { Budget } from '../entities';
import { amountBufferToMinor, type MinorDigits, minorToAmountBuffer } from '../money';

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
  icon: string | null;
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
    buffer: minorToAmountBuffer(budget.amount, minorDigits),
    categoryIds: [...budget.categoryIds],
    name: budget.name,
    period: budget.period,
    alertThreshold: budget.alertThreshold,
    rollover: budget.rollover,
    icon: budget.icon,
  };
}

/**
 * New budgets are built in three steps, edits are one page (§6.18).
 *
 * A budget is six decisions — categories, amount, name, period, alert, rollover — and on one
 * screen the ones below the fold were routinely missed. The order also fixes a smaller absurdity:
 * the median suggestion is computed *from* the categories, and it used to be offered above them.
 */
export const BUDGET_STEPS = ['categories', 'amount', 'details'] as const;
export type BudgetStep = (typeof BUDGET_STEPS)[number];

/** What a budget still needs, named so the footer can say it rather than only greying the button. */
export type BudgetMissing = 'categories' | 'amount';

/**
 * What the step the user is on is waiting for, or `null` when it lets them move on.
 *
 * The order is the wizard's own, so on the last step — which submits, and therefore repeats both
 * conditions, since a back-and-forth must not leave a budget that can be created with no amount —
 * the answer is the earlier question rather than the last one checked.
 */
export function budgetStepMissing(
  step: BudgetStep,
  values: BudgetFormValues,
  minorDigits: MinorDigits,
): BudgetMissing | null {
  const hasAmount = amountBufferToMinor(values.buffer, minorDigits) > 0;
  if (step === 'amount') return hasAmount ? null : 'amount';
  if (values.categoryIds.length === 0) return 'categories';
  return step === 'details' && !hasAmount ? 'amount' : null;
}

/** Whether the step the user is on lets them move to the next one. */
export function budgetStepReady(
  step: BudgetStep,
  values: BudgetFormValues,
  minorDigits: MinorDigits,
): boolean {
  return budgetStepMissing(step, values, minorDigits) === null;
}
