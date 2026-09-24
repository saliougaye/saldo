import { type LocalDate, type MinorDigits, minorToAmountBuffer } from '@saldo/core';
import { emptyForm, type TransactionFormValues } from '../transactions/useTransactionForm';

/**
 * «Accantona» / «Preleva» (§5.14): the ordinary transfer sheet, filled like «Salda carta»
 * (`settlementForm` reads these keys), with the amount left to the user.
 */
export function goalTransferParams(
  fromAccountId: string,
  toAccountId: string,
  description: string,
): Record<string, string> {
  return { settleTo: toAccountId, from: fromAccountId, description };
}

/** «Registra la spesa»: an expense from the goal for its whole balance; saving it closes the goal. */
export function goalExpenseParams(
  goalId: string,
  amount: number,
  description: string,
): Record<string, string> {
  return { closeGoal: goalId, amount: String(amount), description };
}

export function goalExpenseForm(
  params: Partial<Record<string, string | string[]>>,
  today: LocalDate,
  minorDigits: MinorDigits,
): { values: TransactionFormValues; closeGoalId: string } | null {
  const read = (key: string) => {
    const value = params[key];
    return typeof value === 'string' ? value : undefined;
  };
  const goalId = read('closeGoal');
  if (goalId === undefined || goalId.length === 0) return null;
  const amount = Number(read('amount'));
  return {
    closeGoalId: goalId,
    values: {
      ...emptyForm(today, goalId),
      kind: 'expense',
      buffer:
        Number.isInteger(amount) && amount > 0 ? minorToAmountBuffer(amount, minorDigits) : '',
      description: read('description') ?? '',
    },
  };
}
