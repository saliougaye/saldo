import { canRestoreGoal, isPocket, type UserData } from '@saldo/core';

export interface ArchivedView {
  accounts: { id: string; name: string; icon: string; colorIndex: number; archivedAt: string }[];
  goals: {
    id: string;
    name: string;
    icon: string;
    colorIndex: number;
    parentName: string;
    canRestore: boolean;
  }[];
}

/** The archived accounts and the closed goals, newest archived first (§6.6, §5.14). */
export function archivedView(data: UserData): ArchivedView {
  const archived = data.accounts
    .flatMap((account) =>
      account.archivedAt === null ? [] : [{ account, at: account.archivedAt }],
    )
    .sort((a, b) => b.at.localeCompare(a.at));
  return {
    accounts: archived
      .filter(({ account }) => !isPocket(account))
      .map(({ account, at }) => ({
        id: account.id,
        name: account.name,
        icon: account.icon,
        colorIndex: account.colorIndex,
        archivedAt: at,
      })),
    goals: archived
      .filter(({ account }) => isPocket(account))
      .map(({ account }) => ({
        id: account.id,
        name: account.name,
        icon: account.icon,
        colorIndex: account.colorIndex,
        parentName: data.accounts.find((a) => a.id === account.parentAccountId)?.name ?? '',
        canRestore: canRestoreGoal(account, data.accounts),
      })),
  };
}
