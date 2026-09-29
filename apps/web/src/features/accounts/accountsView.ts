import {
  type Account,
  accountBalances,
  bankBalance,
  goalRatio,
  isPocket,
  type LocalDate,
  netWorth,
  type PeriodDef,
  pocketsOf,
  spendableTotal,
  type UserData,
} from '@saldo/core';

/** The phone's rule: only these two types are «Risparmi e investimenti» (§6.6). */
const SAVINGS_TYPES = new Set<Account['type']>(['savings', 'investment']);

export interface PocketView {
  account: Account;
  saved: number;
  target: number;
  ratio: number;
}

export interface AccountRowView {
  account: Account;
  /** The account and its open pockets together, which is what the phone's row shows. */
  balance: number;
  /** The account's own money, under the pockets: «libero». */
  free: number;
  pockets: PocketView[];
}

export interface AccountsView {
  netWorth: number;
  spendable: number;
  spending: AccountRowView[];
  savings: AccountRowView[];
  archivedCount: number;
}

export function accountsView(input: {
  data: UserData;
  today: LocalDate;
  def: PeriodDef;
}): AccountsView {
  const { data, today } = input;
  const balances = accountBalances(data.accounts, data.transactions, today);

  const live = data.accounts.filter((account) => account.archivedAt === null && !isPocket(account));
  const row = (account: Account): AccountRowView => ({
    account,
    balance: bankBalance(data.accounts, balances, account.id),
    free: balances.get(account.id) ?? 0,
    pockets: pocketsOf(data.accounts, account.id).map((pocket) => {
      const saved = balances.get(pocket.id) ?? 0;
      const target = pocket.goalTarget ?? 0;
      return { account: pocket, saved, target, ratio: goalRatio(saved, target) };
    }),
  });

  return {
    netWorth: netWorth(data.accounts, balances),
    spendable: spendableTotal(data.accounts, balances),
    // The phone's order inside the first group: the spendable ones, then the rest.
    spending: [
      ...live.filter((a) => !SAVINGS_TYPES.has(a.type) && a.includeInSpendable),
      ...live.filter((a) => !SAVINGS_TYPES.has(a.type) && !a.includeInSpendable),
    ].map(row),
    savings: live.filter((account) => SAVINGS_TYPES.has(account.type)).map(row),
    archivedCount: data.accounts.filter(
      (account) => account.archivedAt !== null && !isPocket(account),
    ).length,
  };
}
