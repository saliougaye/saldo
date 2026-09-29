import type { LocalDate } from '../dates';
import type { Account } from '../entities';
import { amountBufferToMinor, type MinorDigits, minorToAmountBuffer } from '../money';

export interface GoalFormValues {
  name: string;
  icon: string;
  colorIndex: number;
  /** The target, as typed on the keypad. */
  buffer: string;
  deadline: LocalDate | null;
  parentAccountId: string | null;
  /** «Già da parte», moved from the parent on creation. */
  savedBuffer: string;
}

export function emptyGoalForm(): GoalFormValues {
  return {
    name: '',
    icon: 'target',
    colorIndex: 5,
    buffer: '',
    deadline: null,
    parentAccountId: null,
    savedBuffer: '',
  };
}

export function goalFormFrom(account: Account, minorDigits: MinorDigits): GoalFormValues {
  return {
    name: account.name,
    icon: account.icon,
    colorIndex: account.colorIndex,
    buffer: minorToAmountBuffer(account.goalTarget ?? 0, minorDigits),
    deadline: account.goalDeadline ?? null,
    parentAccountId: account.parentAccountId ?? null,
    savedBuffer: '',
  };
}

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
