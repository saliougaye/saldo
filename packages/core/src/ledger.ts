import { cycleLength, type DateRange, elapsedDays, isWithin } from './cycle';
import type { LocalDate } from './dates';
import type { Category, Transaction } from './entities';
import type { MinorUnits } from './money';

/** The transaction fields that calculations need. */
export type LedgerTx = Pick<
  Transaction,
  | 'id'
  | 'kind'
  | 'amount'
  | 'date'
  | 'accountId'
  | 'toAccountId'
  | 'categoryId'
  | 'tagIds'
  | 'excludeFromTotals'
  | 'recurrenceId'
  | 'description'
>;

export type CategoryRef = Pick<Category, 'id' | 'parentId'>;

export const UNCATEGORIZED = 'uncategorized';

/** Scheduled occurrences are dated in the future. */
export function isUpcoming(tx: Pick<LedgerTx, 'date'>, today: LocalDate): boolean {
  return tx.date > today;
}

/** Whether a transaction counts in income/expense totals, stats and budgets. */
export function countsInTotals(
  tx: Pick<LedgerTx, 'kind' | 'excludeFromTotals' | 'date'>,
  today: LocalDate,
): boolean {
  return tx.kind !== 'transfer' && !tx.excludeFromTotals && !isUpcoming(tx, today);
}

export interface PeriodSummary {
  income: number;
  spent: number;
  remaining: number;
  length: number;
  elapsed: number;
  /** elapsed / length, 0..1 */
  pace: number;
  /** spent / income, 0 when there is no income */
  ratio: number;
  overPace: boolean;
}

export function summarizePeriod(
  txs: readonly LedgerTx[],
  range: DateRange,
  today: LocalDate,
): PeriodSummary {
  let income = 0;
  let spent = 0;
  for (const tx of txs) {
    if (!isWithin(range, tx.date) || !countsInTotals(tx, today)) continue;
    if (tx.kind === 'income') income += tx.amount;
    else spent += tx.amount;
  }
  const length = cycleLength(range);
  const elapsed = elapsedDays(range, today);
  const pace = elapsed / length;
  const ratio = income > 0 ? spent / income : 0;
  return {
    income,
    spent,
    remaining: income - spent,
    length,
    elapsed,
    pace,
    ratio,
    overPace: ratio > pace,
  };
}

/** Counted amounts per category id (leaf level). */
export function spendingByCategory(
  txs: readonly LedgerTx[],
  range: DateRange,
  today: LocalDate,
  kind: 'expense' | 'income' = 'expense',
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const tx of txs) {
    if (tx.kind !== kind || !isWithin(range, tx.date) || !countsInTotals(tx, today)) continue;
    const key = tx.categoryId ?? UNCATEGORIZED;
    totals.set(key, (totals.get(key) ?? 0) + tx.amount);
  }
  return totals;
}

/** Merges child category amounts into their parent. Categories are one level deep (§4). */
export function rollupToParents(
  amounts: ReadonlyMap<string, number>,
  categories: readonly CategoryRef[],
): Map<string, number> {
  const parentOf = new Map(categories.map((category) => [category.id, category.parentId]));
  const totals = new Map<string, number>();
  for (const [categoryId, amount] of amounts) {
    const key = parentOf.get(categoryId) ?? categoryId;
    totals.set(key, (totals.get(key) ?? 0) + amount);
  }
  return totals;
}

export interface UpcomingSplit<T> {
  /** Dated after `today`: scheduled, not yet history. */
  upcoming: T[];
  /** Today or earlier: what actually happened. */
  settled: T[];
  /** Signed sum of the upcoming rows, income positive and everything else negative. */
  upcomingNet: MinorUnits;
}

/**
 * Splits a period's rows into what has happened and what is still to come (§5.12).
 *
 * The transaction list shows the settled ones and folds the rest behind a single row: a list that
 * opens on next week's rent reads as a list of things you did, which is what makes a materialised
 * recurrence look like a mistake. The sum travels with the split because the row that stands in
 * for them has to say how much they are worth.
 */
export function splitUpcoming<T extends Pick<LedgerTx, 'date' | 'kind' | 'amount'>>(
  txs: readonly T[],
  today: LocalDate,
): UpcomingSplit<T> {
  const upcoming: T[] = [];
  const settled: T[] = [];
  for (const tx of txs) {
    if (isUpcoming(tx, today)) upcoming.push(tx);
    else settled.push(tx);
  }
  const upcomingNet = upcoming.reduce(
    (sum, tx) => sum + (tx.kind === 'income' ? tx.amount : -tx.amount),
    0,
  );
  return { upcoming, settled, upcomingNet };
}
