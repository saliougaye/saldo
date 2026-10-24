import {
  type Account,
  accountBalances,
  bankBalance,
  type CreditStatement,
  creditCardDue,
  creditStatementAccrued,
  creditStatementDue,
  type GoalProgress,
  goalProgress,
  isPocket,
  type LocalDate,
  monthEndBalances,
  type PeriodDef,
  periodContaining,
  summarizePeriod,
  type UserData,
} from '@saldo/core';

/** The phone's sparkline window (§6.10). */
const SPARK_MONTHS = 8;

export interface AccountDetailView {
  account: Account;
  balance: number;
  free: number;
  series: number[];
  /** A credit card only: what is owed today, and the statement it comes from. */
  due: number | null;
  accrued: number | null;
  statement: CreditStatement | null;
  /** A pocket only. */
  goal: GoalProgress | null;
  /** The current period's income and spend, and income less spend. */
  period: { income: number; spent: number; net: number };
}

/**
 * Conti's trailing panel (§5.3, §5.14): one account's balance, its eight-month sparkline, its
 * credit-card statement when it has one, its goal progress when it is a pocket, and the current
 * period's income and spend. Every figure comes from `@saldo/core`; nothing is added up here.
 */
export function accountDetail(input: {
  data: UserData;
  id: string;
  today: LocalDate;
  def: PeriodDef;
}): AccountDetailView | null {
  const { data, id, today, def } = input;
  const account = data.accounts.find((row) => row.id === id);
  if (account === undefined) return null;

  const balances = accountBalances(data.accounts, data.transactions, today);
  const own = balances.get(account.id) ?? 0;
  const range = periodContaining(def, today);
  const mine = data.transactions.filter(
    (tx) => tx.accountId === account.id || tx.toAccountId === account.id,
  );
  const summary = summarizePeriod(mine, range, today);

  const card =
    account.type === 'credit_card'
      ? {
          due: creditCardDue(own),
          accrued:
            account.creditCloseDay === null
              ? null
              : creditStatementAccrued(
                  account.id,
                  account.creditCloseDay,
                  data.transactions,
                  today,
                ),
          statement: creditStatementDue(account, data.transactions, today),
        }
      : { due: null, accrued: null, statement: null };

  return {
    account,
    balance: bankBalance(data.accounts, balances, account.id),
    free: own,
    series: monthEndBalances({
      accountId: account.id,
      openingBalance: account.openingBalance,
      txs: data.transactions,
      today,
      months: SPARK_MONTHS,
    }),
    ...card,
    goal:
      isPocket(account) &&
      account.goalTarget !== null &&
      account.goalTarget !== undefined &&
      account.goalStartDate !== null &&
      account.goalStartDate !== undefined
        ? goalProgress(
            {
              id: account.id,
              openingBalance: account.openingBalance,
              goalTarget: account.goalTarget,
              goalDeadline: account.goalDeadline ?? null,
              goalStartDate: account.goalStartDate,
            },
            data.transactions,
            today,
            def,
          )
        : null,
    period: { income: summary.income, spent: summary.spent, net: summary.remaining },
  };
}
