import { amountBufferToMinor, type LocalDate, type MinorDigits } from '@saldo/core';
import type { GoalFormValues } from './goalFormValues';

/** §6.37: four steps for a new goal; an edit is one page without the account. */
export const GOAL_STEPS = ['look', 'target', 'deadline', 'account'] as const;
export type GoalStep = (typeof GOAL_STEPS)[number];

export type GoalMissing = 'name' | 'target' | 'deadline' | 'parent';

/**
 * What the step (or the edit page) is waiting for, in the wizard's own order, so the last step
 * names the earliest gap rather than the last one checked.
 */
export function goalStepMissing(
  step: GoalStep | 'edit',
  values: GoalFormValues,
  today: LocalDate,
  minorDigits: MinorDigits,
): GoalMissing | null {
  const checks: [GoalStep, GoalMissing, boolean][] = [
    ['look', 'name', values.name.trim().length > 0],
    ['target', 'target', amountBufferToMinor(values.buffer, minorDigits) > 0],
    ['deadline', 'deadline', values.deadline === null || values.deadline > today],
    ['account', 'parent', values.parentAccountId !== null],
  ];
  // Editing checks the name and the target only: an expired goal must be renamable without first
  // being given a new deadline, and the parent never changes (§5.14).
  const upTo = step === 'edit' ? 1 : GOAL_STEPS.indexOf(step);
  for (const [, missing, ok] of checks.slice(0, upTo + 1)) {
    if (!ok) return missing;
  }
  return null;
}
