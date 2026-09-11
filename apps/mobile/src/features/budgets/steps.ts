import { amountBufferToMinor, type MinorDigits } from '@saldo/core';
import type { BudgetFormValues } from './budgetFormValues';

/**
 * New budgets are built in three steps, edits are one page (§6.18).
 *
 * A budget is six decisions — categories, amount, name, period, alert, rollover — and on one
 * screen the ones below the fold were routinely missed. The order also fixes a smaller absurdity:
 * the median suggestion is computed *from* the categories, and it used to be offered above them.
 */
export const BUDGET_STEPS = ['categories', 'amount', 'details'] as const;
export type BudgetStep = (typeof BUDGET_STEPS)[number];

/** Whether the step the user is on lets them move to the next one. */
export function budgetStepReady(
  step: BudgetStep,
  values: BudgetFormValues,
  minorDigits: MinorDigits,
): boolean {
  if (step === 'categories') return values.categoryIds.length > 0;
  if (step === 'amount') return amountBufferToMinor(values.buffer, minorDigits) > 0;
  // The last step submits, so it repeats both conditions: a back-and-forth must not leave a
  // budget that can be created with no amount.
  return values.categoryIds.length > 0 && amountBufferToMinor(values.buffer, minorDigits) > 0;
}
