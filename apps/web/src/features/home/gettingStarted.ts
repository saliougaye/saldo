import { type Account, isPocket, type UserData } from '@saldo/core';

export type StartStepKey = 'account' | 'transaction' | 'budget' | 'goal';

export interface StartStep {
  key: StartStepKey;
  done: boolean;
}

export interface GettingStarted {
  steps: StartStep[];
  done: number;
  /** While an account, a transaction or a budget is missing; the goal step is optional. */
  show: boolean;
  /** No transaction yet: «In your accounts» takes the place of the summary (H5). */
  noTransactions: boolean;
  /** The account the done «Add an account» step names. */
  firstAccount: Account | null;
}

/** W11: the four first steps of a new user, in the order of figure 9. */
export function gettingStarted(data: UserData): GettingStarted {
  const live = data.accounts.filter((account) => account.archivedAt === null);
  const steps: StartStep[] = [
    { key: 'account', done: live.some((account) => !isPocket(account)) },
    { key: 'transaction', done: data.transactions.length > 0 },
    { key: 'budget', done: data.budgets.length > 0 },
    { key: 'goal', done: live.some(isPocket) },
  ];
  return {
    steps,
    done: steps.filter((step) => step.done).length,
    show: steps.slice(0, 3).some((step) => !step.done),
    noTransactions: data.transactions.length === 0,
    firstAccount: live.find((account) => !isPocket(account)) ?? null,
  };
}
