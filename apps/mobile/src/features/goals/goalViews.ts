import {
  type Account,
  type GoalProgress,
  goalProgress,
  isPocket,
  type LedgerTx,
  type LocalDate,
  type PeriodDef,
} from '@saldo/core';

/** An open goal as every screen reads it (§5.14). */
export interface GoalView {
  account: Account;
  parent: Account | undefined;
  progress: GoalProgress;
}

/** Open pockets with their progress, in the accounts' order. Pure: `today` and `def` are injected. */
export function goalViews(
  accounts: readonly Account[],
  txs: readonly LedgerTx[],
  today: LocalDate,
  def: PeriodDef,
): GoalView[] {
  return accounts.flatMap((account) => {
    const { goalTarget, goalStartDate } = account;
    if (!isPocket(account) || account.archivedAt !== null) return [];
    if (goalTarget == null || goalStartDate == null) return [];
    return [
      {
        account,
        parent: accounts.find((candidate) => candidate.id === account.parentAccountId),
        progress: goalProgress(
          {
            id: account.id,
            openingBalance: account.openingBalance,
            goalTarget,
            goalDeadline: account.goalDeadline ?? null,
            goalStartDate,
          },
          txs,
          today,
          def,
        ),
      },
    ];
  });
}
