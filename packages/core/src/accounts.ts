import { cycleContaining } from './cycle';
import { addMonths, daysInMonth, type LocalDate, makeLocalDate, parseLocalDate } from './dates';
import type { Account } from './entities';
import type { LedgerTx } from './ledger';
import type { MinorUnits } from './money';

/** The account fields balances need. */
export type AccountRef = Pick<
  Account,
  | 'id'
  | 'type'
  | 'openingBalance'
  | 'includeInSpendable'
  | 'archivedAt'
  | 'creditCloseDay'
  | 'creditChargeDay'
>;

/**
 * Balance per account id (§5.3): opening balance plus income, minus expenses, minus outgoing and
 * plus incoming transfers, over every transaction dated on or before `today`.
 *
 * Note the deliberate difference from `countsInTotals`: `excludeFromTotals` hides a transaction
 * from cycle totals, statistics and budgets, but the money still left the account, so balances
 * count it. Callers pass non-deleted rows only; tombstones are filtered by the repositories.
 */
export function accountBalances(
  accounts: readonly AccountRef[],
  txs: readonly LedgerTx[],
  today: LocalDate,
): Map<string, MinorUnits> {
  const balances = new Map<string, MinorUnits>(
    accounts.map((account) => [account.id, account.openingBalance]),
  );
  const add = (accountId: string | null, amount: MinorUnits): void => {
    if (accountId === null) return;
    const current = balances.get(accountId);
    if (current === undefined) return;
    balances.set(accountId, current + amount);
  };
  for (const tx of txs) {
    if (tx.date > today) continue;
    if (tx.kind === 'income') add(tx.accountId, tx.amount);
    else add(tx.accountId, -tx.amount);
    if (tx.kind === 'transfer') add(tx.toAccountId, tx.amount);
  }
  return balances;
}

function sumBalances(
  accounts: readonly AccountRef[],
  balances: ReadonlyMap<string, MinorUnits>,
  include: (account: AccountRef) => boolean,
): MinorUnits {
  let total = 0;
  for (const account of accounts) {
    if (account.archivedAt !== null || !include(account)) continue;
    total += balances.get(account.id) ?? 0;
  }
  return total;
}

/** "Totale spendibile": non-archived accounts flagged `includeInSpendable`. */
export function spendableTotal(
  accounts: readonly AccountRef[],
  balances: ReadonlyMap<string, MinorUnits>,
): MinorUnits {
  return sumBalances(accounts, balances, (account) => account.includeInSpendable);
}

/** "Patrimonio complessivo": every non-archived account. */
export function netWorth(
  accounts: readonly AccountRef[],
  balances: ReadonlyMap<string, MinorUnits>,
): MinorUnits {
  return sumBalances(accounts, balances, () => true);
}

/**
 * "Maturato nel ciclo di fatturazione": card expenses after the last `closeDay` up to `today`.
 * The close day ends the previous statement, so it is excluded from the open one.
 */
export function creditStatementAccrued(
  accountId: string,
  closeDay: number,
  txs: readonly LedgerTx[],
  today: LocalDate,
): MinorUnits {
  const lastClose = cycleContaining(today, closeDay).start;
  let total = 0;
  for (const tx of txs) {
    if (tx.accountId !== accountId || tx.kind !== 'expense') continue;
    if (tx.date <= lastClose || tx.date > today) continue;
    total += tx.amount;
  }
  return total;
}

/**
 * "Da rimborsare": what a credit card owes. A card in credit owes nothing, so an overpaid
 * balance reports 0 rather than its absolute value.
 */
export function creditCardDue(balance: MinorUnits): MinorUnits {
  return balance < 0 ? -balance : 0;
}

/** "Prossimo addebito": the first `chargeDay` strictly after `today`, clamped to short months. */
export function nextCreditChargeDate(chargeDay: number, today: LocalDate): LocalDate {
  const { year, month } = parseLocalDate(today);
  const inMonth = (y: number, m: number): LocalDate =>
    makeLocalDate(y, m, Math.min(chargeDay, daysInMonth(y, m)));
  const thisMonth = inMonth(year, month);
  if (thisMonth > today) return thisMonth;
  const next = addMonths({ year, month }, 1);
  return inMonth(next.year, next.month);
}
