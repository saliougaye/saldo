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

/**
 * The amount as a row should render it, signed from the viewpoint of one account.
 *
 * A transfer has no sign of its own: it moves money between the user's own accounts and §5.3 keeps
 * it out of every total, so a global list that prints "−50,00" claims an expense that never
 * happened. Read from one of its two accounts it does have a direction, and `null` says the caller
 * should render the figure unsigned.
 */
export function signedAmount(
  tx: Pick<LedgerTx, 'kind' | 'amount' | 'accountId' | 'toAccountId'>,
  viewpointAccountId: string | null,
): MinorUnits | null {
  if (tx.kind === 'income') return tx.amount;
  if (tx.kind === 'expense') return -tx.amount;
  if (viewpointAccountId === null) return null;
  if (tx.toAccountId === viewpointAccountId) return tx.amount;
  if (tx.accountId === viewpointAccountId) return -tx.amount;
  return null;
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

export interface TagTotal {
  tagId: string;
  /** Counted expenses carrying the tag. */
  expense: MinorUnits;
  /** Counted income carrying the tag: the refund of a trip, the reimbursement being chased. */
  income: MinorUnits;
  /** How many counted transactions carry the tag, both directions. */
  count: number;
}

export interface TagTotals {
  /**
   * Counted amounts per tag, by expense descending, then income descending, ties broken on the id
   * so the order never depends on the order the rows arrived in.
   */
  tags: TagTotal[];
  /** Counted spend of the rows carrying no tag at all. */
  untagged: MinorUnits;
  untaggedCount: number;
}

/**
 * Counted expenses and income per tag (§5.7, §5.10).
 *
 * Tags are neither exclusive nor exhaustive: a transaction can carry several, and most carry none.
 * A row with two tags is therefore counted in both, and `tags` overshoots the period's spend while
 * missing everything in `untagged`. That is why this returns a **ranking** and why nothing built on
 * it may draw a share of a whole — a split bar or a pie over these numbers would be arithmetically
 * false. `untagged` travels with the ranking so the screen can say what it leaves out.
 *
 * The two directions stay apart and are never netted: a refund on a trip is the tag the app itself
 * advertises, but a tag used for two unrelated things would net them against each other, and a
 * net would no longer match the category split, which can only split expenses. Transfers count on
 * neither side.
 */
export function tagTotals(txs: readonly LedgerTx[], range: DateRange, today: LocalDate): TagTotals {
  const totals = new Map<string, TagTotal>();
  let untagged = 0;
  let untaggedCount = 0;
  for (const tx of txs) {
    if (!isWithin(range, tx.date) || !countsInTotals(tx, today)) continue;
    const expense = tx.kind === 'expense' ? tx.amount : 0;
    const income = tx.kind === 'income' ? tx.amount : 0;
    if (tx.tagIds.length === 0) {
      if (tx.kind !== 'expense') continue;
      untagged += tx.amount;
      untaggedCount += 1;
      continue;
    }
    for (const tagId of new Set(tx.tagIds)) {
      const current = totals.get(tagId) ?? { tagId, expense: 0, income: 0, count: 0 };
      totals.set(tagId, {
        tagId,
        expense: current.expense + expense,
        income: current.income + income,
        count: current.count + 1,
      });
    }
  }
  const tags = [...totals.values()].sort(
    (a, b) => b.expense - a.expense || b.income - a.income || a.tagId.localeCompare(b.tagId),
  );
  return { tags, untagged, untaggedCount };
}

/**
 * How many transactions carry each tag, whatever their date (§5.10).
 *
 * A tag spans every date, and a merge or a delete rewrites every transaction that carries it,
 * scheduled ones included. So this is the one count that the tags list, the tag screen and its
 * Merge and Delete sheets show. It is not `TagTotal.count`, which counts only the rows in a total.
 * Callers pass live rows only.
 */
export function tagUsage(txs: readonly Pick<LedgerTx, 'tagIds'>[]): Map<string, number> {
  const usage = new Map<string, number>();
  for (const tx of txs) {
    for (const tagId of new Set(tx.tagIds)) usage.set(tagId, (usage.get(tagId) ?? 0) + 1);
  }
  return usage;
}

/**
 * The transactions that carry `tagId`, whatever their date, oldest first: the tag screen's list
 * (§5.10). Its length is `tagUsage(txs).get(tagId)`.
 */
export function transactionsWithTag<T extends Pick<LedgerTx, 'tagIds' | 'date'>>(
  txs: readonly T[],
  tagId: string,
): T[] {
  return txs.filter((tx) => tx.tagIds.includes(tagId)).sort((a, b) => a.date.localeCompare(b.date));
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

export interface ListTotals {
  expense: MinorUnits;
  income: MinorUnits;
  /** Every row handed in, transfers included. */
  count: number;
}

/**
 * What a list of rows adds up to, for the line above a filtered transaction list.
 *
 * Unlike `summarizePeriod` this counts rows flagged `excludeFromTotals`: the list is showing them
 * because someone asked for them — the "Solo escluse" filter exists — and a total that answers 0
 * for the rows on screen reads as a bug. Transfers move money rather than spend it, so they land
 * in neither side while still being counted.
 */
export function totalsOf(txs: readonly LedgerTx[]): ListTotals {
  let expense = 0;
  let income = 0;
  for (const tx of txs) {
    if (tx.kind === 'income') income += tx.amount;
    else if (tx.kind === 'expense') expense += tx.amount;
  }
  return { expense, income, count: txs.length };
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
