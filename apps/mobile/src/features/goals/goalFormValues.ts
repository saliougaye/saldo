import type { Account, LocalDate, MinorDigits } from '@saldo/core';
import { minorToAmountBuffer } from '@saldo/core';
import type { IconName } from '@saldo/ui';

export interface GoalFormValues {
  name: string;
  icon: IconName;
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
    icon: account.icon as IconName,
    colorIndex: account.colorIndex,
    buffer: minorToAmountBuffer(account.goalTarget ?? 0, minorDigits),
    deadline: account.goalDeadline ?? null,
    parentAccountId: account.parentAccountId ?? null,
    savedBuffer: '',
  };
}
