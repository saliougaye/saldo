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

/** A credit card's closed statement and what is left to pay of it (§5.3). */
export interface CreditStatement {
  /** The close day that ended the statement: the last one on or before today. */
  closeDate: LocalDate;
  /** When the bank takes it — the first charge day after the close — or null with no charge day. */
  chargeDate: LocalDate | null;
  /** What the card owed on the close date; 0 if it was in credit. */
  statement: MinorUnits;
  /** What is still to pay of it. */
  due: MinorUnits;
}

/**
 * What the bank will charge: the balance at the last `creditCloseDay` (the close day belongs to
 * the statement it closes, as in `creditStatementAccrued`), minus the transfers into the card
 * since then.
 *
 * A payment counts from the day after the close up to the later of the charge date and the day
 * before the next close, so one made early, one made a few days late and one already scheduled
 * for the charge day all settle it. Refunds and expenses after the close belong to the next
 * statement, with one cap: the statement never asks for more than the whole card owes today, so a
 * refund that leaves the card owing less, or a card in credit, owes at most that.
 *
 * Null for anything but a credit card with a close day: without one there is no statement.
 */
export function creditStatementDue(
  account: AccountRef,
  txs: readonly LedgerTx[],
  today: LocalDate,
): CreditStatement | null {
  if (account.type !== 'credit_card' || account.creditCloseDay === null) return null;
  const cycle = cycleContaining(today, account.creditCloseDay);
  const closeDate = cycle.start;
  const chargeDate =
    account.creditChargeDay === null
      ? null
      : nextCreditChargeDate(account.creditChargeDay, closeDate);
  const windowEnd = chargeDate !== null && chargeDate > cycle.end ? chargeDate : cycle.end;
  const balanceOn = (date: LocalDate): MinorUnits =>
    accountBalances([account], txs, date).get(account.id) ?? 0;
  const statement = creditCardDue(balanceOn(closeDate));
  let paid = 0;
  for (const tx of txs) {
    if (tx.kind !== 'transfer' || tx.toAccountId !== account.id) continue;
    if (tx.date <= closeDate || tx.date > windowEnd) continue;
    paid += tx.amount;
  }
  const due = Math.max(0, Math.min(statement - paid, creditCardDue(balanceOn(today))));
  return { closeDate, chargeDate, statement, due };
}

/** The hour of the charge-day reminder, local time (decided 2026-09-22). */
export const CREDIT_REMINDER_HOUR = 9;

/** Where a card may be charged (§6.22): live accounts that hold money, never a card, never itself. */
export function paymentAccountCandidates<T extends Pick<AccountRef, 'id' | 'type' | 'archivedAt'>>(
  accounts: readonly T[],
  cardId: string | null,
): T[] {
  return accounts.filter(
    (account) =>
      account.type !== 'credit_card' && account.archivedAt === null && account.id !== cardId,
  );
}

/** What "Salda carta" fills the transfer sheet with. The user still edits it and saves it. */
export interface CreditSettlementDraft {
  /** The card's payment account, or null when it has none or it is no longer offered. */
  fromAccountId: string | null;
  toAccountId: string;
  /** The closed statement still due; null when the card has no close day. */
  statementAmount: MinorUnits | null;
  /** Everything the card owes today. */
  balanceAmount: MinorUnits;
  /** The default: the statement while one is due, else the whole balance. */
  amount: MinorUnits;
  /** The statement's charge date, or today once it has passed or when nothing is due. */
  date: LocalDate;
  /** The day whose month the default description names. */
  statementDate: LocalDate;
}

export function creditSettlementDraft(
  card: AccountRef & Pick<Account, 'creditPaymentAccountId'>,
  accounts: readonly Pick<AccountRef, 'id' | 'type' | 'archivedAt'>[],
  txs: readonly LedgerTx[],
  today: LocalDate,
): CreditSettlementDraft {
  const statement = creditStatementDue(card, txs, today);
  const balanceAmount = creditCardDue(accountBalances([card], txs, today).get(card.id) ?? 0);
  const due = statement?.due ?? 0;
  const chargeDate = statement?.chargeDate ?? null;
  const date = due > 0 && chargeDate !== null && chargeDate > today ? chargeDate : today;
  const from = paymentAccountCandidates(accounts, card.id).find(
    (account) => account.id === card.creditPaymentAccountId,
  );
  return {
    fromAccountId: from?.id ?? null,
    toAccountId: card.id,
    statementAmount: statement === null ? null : statement.due,
    balanceAmount,
    amount: due > 0 ? due : balanceAmount,
    date,
    statementDate: statement?.closeDate ?? date,
  };
}

/** One local notification to schedule: a card's statement, due on its charge day. */
export interface CreditChargeReminder {
  accountId: string;
  date: LocalDate;
  amount: MinorUnits;
}

/**
 * The charge-day reminders that should exist now: one per live card whose closed statement is
 * still due on a charge day from today on. A card with no charge day, a paid statement or a
 * charge day already past gets none.
 */
export function creditChargeReminders(
  accounts: readonly AccountRef[],
  txs: readonly LedgerTx[],
  today: LocalDate,
): CreditChargeReminder[] {
  const out: CreditChargeReminder[] = [];
  for (const account of accounts) {
    if (account.archivedAt !== null) continue;
    const statement = creditStatementDue(account, txs, today);
    if (statement === null || statement.chargeDate === null) continue;
    if (statement.due <= 0 || statement.chargeDate < today) continue;
    out.push({ accountId: account.id, date: statement.chargeDate, amount: statement.due });
  }
  return out;
}

/** A transfer the form is holding but has not written yet (§6.16). */
export interface TransferDraft {
  /** The id the row has or will have, so re-editing a transfer does not count the saved one twice. */
  id: string;
  amount: MinorUnits;
  date: LocalDate;
  fromAccountId: string | null;
  toAccountId: string | null;
}

/** An account's balance as it stands, and as a draft would leave it. */
export interface BalancePreview {
  now: MinorUnits;
  after: MinorUnits;
}

/**
 * What the two accounts of a transfer hold now, and what they would hold once it is saved (§6.16).
 *
 * "Have I got the money there" is the question a transfer form asks and never answered: the
 * balances live one screen away, and the amount is typed before the accounts are picked. Both
 * sides are `null` until an account is chosen, and `now === after` whenever the draft moves
 * nothing yet — an incomplete pair, a zero amount, a date still in the future — so the screen can
 * print one figure instead of an arrow between two identical ones.
 *
 * The draft is run through `accountBalances` rather than added by hand, so the future-dated and
 * archived-account rules stay in one place.
 */
export function transferBalancePreview(
  accounts: readonly AccountRef[],
  txs: readonly LedgerTx[],
  today: LocalDate,
  draft: TransferDraft,
): { from: BalancePreview | null; to: BalancePreview | null } {
  const now = accountBalances(accounts, txs, today);
  const pending = txs.filter((tx) => tx.id !== draft.id);
  if (draft.fromAccountId !== null && draft.toAccountId !== null && draft.amount > 0) {
    pending.push({
      id: draft.id,
      kind: 'transfer',
      amount: draft.amount,
      date: draft.date,
      accountId: draft.fromAccountId,
      toAccountId: draft.toAccountId,
      categoryId: null,
      tagIds: [],
      excludeFromTotals: false,
      recurrenceId: null,
      description: '',
    });
  }
  const after = accountBalances(accounts, pending, today);
  const preview = (accountId: string | null): BalancePreview | null => {
    if (accountId === null) return null;
    const current = now.get(accountId);
    if (current === undefined) return null;
    return { now: current, after: after.get(accountId) ?? current };
  };
  return { from: preview(draft.fromAccountId), to: preview(draft.toAccountId) };
}

/**
 * Whether a transfer takes out more than the source account holds.
 *
 * Spec §6.16 lists what blocks save and says nothing about funds; this is the rule the app adds on
 * top, so the three cases it deliberately lets through are worth naming:
 *
 * - **A credit card holds debt, not money.** Its balance is negative by design (§5.3), so "more
 *   than there is" means nothing on one, and money leaving a card is a cash advance — a real thing
 *   to record. Cards are exempt.
 * - **A transfer that changes nothing cannot overdraw anything.** A future-dated one is not in the
 *   balance yet (`after === now`), and an account that is already in the red stays saveable for
 *   anything that does not deepen it.
 * - **The destination is never checked.** Money arriving cannot overdraw an account.
 */
export function transferOverdrawsSource(
  source: Pick<AccountRef, 'type'> | undefined,
  preview: BalancePreview | null,
): boolean {
  if (source === undefined || preview === null) return false;
  if (source.type === 'credit_card') return false;
  return preview.after < 0 && preview.after < preview.now;
}

/**
 * The mirror of `transferOverdrawsSource` at the other end: a transfer that pays a card past zero.
 * A refund or an overpayment really does put a card in credit, so this only warns; it never
 * blocks save. Same "moves nothing, says nothing" rule as the funds check.
 */
export function transferOverpaysCard(
  destination: Pick<AccountRef, 'type'> | undefined,
  preview: BalancePreview | null,
): boolean {
  if (destination === undefined || preview === null) return false;
  if (destination.type !== 'credit_card') return false;
  return preview.after > 0 && preview.after > preview.now;
}
