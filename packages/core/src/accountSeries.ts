import { addMonths, daysInMonth, type LocalDate, makeLocalDate, parseLocalDate } from './dates';
import type { LedgerTx } from './ledger';
import type { MinorUnits } from './money';

/** Signed effect of one transaction on one account, both legs of a transfer included (§5.3). */
export function accountEffect(tx: LedgerTx, accountId: string): MinorUnits {
  let effect = 0;
  if (tx.accountId === accountId) effect += tx.kind === 'income' ? tx.amount : -tx.amount;
  if (tx.kind === 'transfer' && tx.toAccountId === accountId) effect += tx.amount;
  return effect;
}

export interface MonthEndBalancesInput {
  accountId: string;
  openingBalance: MinorUnits;
  txs: readonly LedgerTx[];
  today: LocalDate;
  /** How many months the sparkline covers, ending with the current one (§6.10). */
  months: number;
}

/**
 * Balance at the end of each of the last `months` months, the last point being the balance today
 * (§6.10). `excludeFromTotals` still counts: it hides a row from cycle totals, not from balances.
 */
export function monthEndBalances(input: MonthEndBalancesInput): MinorUnits[] {
  const { accountId, openingBalance, txs, today, months } = input;
  const { year, month } = parseLocalDate(today);

  const cutoffs: LocalDate[] = [];
  for (let back = months - 1; back >= 0; back -= 1) {
    const ym = addMonths({ year, month }, -back);
    const monthEnd = makeLocalDate(ym.year, ym.month, daysInMonth(ym.year, ym.month));
    // The current month is cut at today, not at its last day.
    cutoffs.push(monthEnd > today ? today : monthEnd);
  }

  return cutoffs.map((cutoff) => {
    let balance = openingBalance;
    for (const tx of txs) {
      if (tx.date > cutoff) continue;
      balance += accountEffect(tx, accountId);
    }
    return balance;
  });
}

export interface OpeningBalanceInput {
  accountId: string;
  /** What the user typed as the balance right now. */
  currentBalance: MinorUnits;
  txs: readonly LedgerTx[];
  today: LocalDate;
}

/**
 * The `openingBalance` to store so the account's computed balance equals what the user typed
 * (§6.22): the balance formula run backwards. Editing a *current* balance is what people mean; the
 * opening balance is an implementation detail they never see.
 */
export function openingBalanceForCurrent(input: OpeningBalanceInput): MinorUnits {
  const { accountId, currentBalance, txs, today } = input;
  let effects = 0;
  for (const tx of txs) {
    if (tx.date > today) continue;
    effects += accountEffect(tx, accountId);
  }
  return currentBalance - effects;
}
