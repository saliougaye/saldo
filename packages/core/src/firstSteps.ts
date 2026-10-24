import { type BudgetRef, suggestBudgetAmount, takenCategoryIds } from './budgets';
import type { DateRange } from './cycle';
import type { LocalDate } from './dates';
import type { Category } from './entities';
import { type FilterLookup, filterTransactions, type TransactionFilters } from './filters';
import { categorySpendHistory, HISTORY_WINDOW, periodHistory, periodSpendHistory } from './history';
import { type CategoryRef, countsInTotals, type LedgerTx } from './ledger';
import type { MinorUnits } from './money';
import { type PeriodDef, periodContaining } from './period';
import { median } from './stats';

/** How many months of spend the emergency fund covers (W11). */
export const EMERGENCY_FUND_MONTHS = 3;

export interface BudgetSuggestion {
  categoryId: string;
  /** The median spend of the category in one of the user's periods: what §5.5 suggests. */
  amount: MinorUnits;
  /** How many counted expenses of the category (its children too) the window holds. */
  txCount: number;
}

/** What a suggestion reads of a category: a budget's form offers only live top-level expense ones. */
type SuggestableCategory = CategoryRef & Pick<Category, 'direction' | 'archivedAt'>;

/**
 * W11, Profile · Budgets: «Where you spend most» — the categories with the largest median spend of
 * the last periods, at the parent level, without the ones a budget already covers. The amount is
 * `suggestBudgetAmount`, the same figure the budget form offers. A category with a median of 0 (spent
 * in fewer than half the periods) suggests nothing, and so does one the form cannot take: archived,
 * or not an expense category (the spend of an archived child still rolls up to its live parent).
 */
export function budgetSuggestions(input: {
  txs: readonly LedgerTx[];
  categories: readonly SuggestableCategory[];
  budgets: readonly BudgetRef[];
  def: PeriodDef;
  /** The period the page shows: the budget form reads its history from the same one. */
  period: DateRange;
  today: LocalDate;
  count?: number;
}): BudgetSuggestion[] {
  const { txs, categories, budgets, def, period, today, count = 3 } = input;
  const used = periodHistory(txs, def, period, HISTORY_WINDOW);
  const history = categorySpendHistory(used, categories, today);
  const parentOf = new Map(categories.map((category) => [category.id, category.parentId]));
  const txCounts = new Map<string, number>();
  for (const entry of used) {
    for (const tx of entry.txs) {
      if (tx.kind !== 'expense' || tx.categoryId === null || !countsInTotals(tx, today)) continue;
      const id = parentOf.get(tx.categoryId) ?? tx.categoryId;
      txCounts.set(id, (txCounts.get(id) ?? 0) + 1);
    }
  }
  const taken = takenCategoryIds(budgets, categories);
  const known = new Set(
    categories
      .filter((category) => category.direction === 'expense' && category.archivedAt === null)
      .map((category) => category.id),
  );
  const ids = new Set(history.flatMap((amounts) => [...amounts.keys()]));
  return [...ids]
    .filter((id) => known.has(id) && !taken.has(id))
    .map((categoryId) => ({
      categoryId,
      amount: suggestBudgetAmount(history, [categoryId], categories) ?? 0,
      txCount: txCounts.get(categoryId) ?? 0,
    }))
    .filter((suggestion) => suggestion.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.categoryId.localeCompare(b.categoryId))
    .slice(0, count);
}

export interface PeriodMatches<T extends LedgerTx = LedgerTx> {
  range: ReturnType<typeof periodContaining>;
  /** Every match of the period, also the ones past `rowLimit`. */
  count: number;
  /** The newest matches of the period, newest first: at most `rowLimit`. */
  rows: T[];
}

/**
 * W11, Transactions · no results: the periods other than `exclude` where the same filters find rows,
 * newest first, with how many rows each one holds and its newest `rowLimit` rows.
 */
export function matchesInOtherPeriods<T extends LedgerTx>(input: {
  txs: readonly T[];
  filters: TransactionFilters;
  lookup: FilterLookup;
  def: PeriodDef;
  exclude: { start: LocalDate };
  limit?: number;
  rowLimit?: number;
}): PeriodMatches<T>[] {
  const { def, exclude, limit = 3, rowLimit = 3 } = input;
  const byStart = new Map<string, PeriodMatches<T>>();
  for (const tx of filterTransactions(input.txs, input.filters, input.lookup)) {
    const range = periodContaining(def, tx.date);
    if (range.start === exclude.start) continue;
    const entry = byStart.get(range.start);
    if (entry === undefined) byStart.set(range.start, { range, count: 1, rows: [tx] });
    else {
      entry.count += 1;
      entry.rows.push(tx);
    }
  }
  return [...byStart.values()]
    .sort((a, b) => b.range.start.localeCompare(a.range.start))
    .slice(0, limit)
    .map((entry) => ({
      ...entry,
      rows: [...entry.rows]
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
        .slice(0, rowLimit),
    }));
}

/**
 * W11, Goals · none: the target the «Emergency fund» preset offers — `EMERGENCY_FUND_MONTHS` times
 * the median spend of the last used months. A month or a cycle is a month; a user who tracks weeks
 * or years is measured in calendar months, so the fund stays three months of spend.
 * `null` with no history: the preset then has no amount.
 */
export function emergencyFundTarget(input: {
  txs: readonly LedgerTx[];
  def: PeriodDef;
  today: LocalDate;
}): MinorUnits | null {
  const { txs, today } = input;
  const def: PeriodDef =
    input.def.kind === 'month' || input.def.kind === 'cycle'
      ? input.def
      : { kind: 'month', startDay: 1 };
  const middle = median(
    periodSpendHistory(
      periodHistory(txs, def, periodContaining(def, today), HISTORY_WINDOW),
      today,
    ),
  );
  return middle === null ? null : Math.round(middle * EMERGENCY_FUND_MONTHS);
}

/**
 * W11, Statistics · an empty period: the period the «Go to …» link opens. The closest one that holds
 * a row — the latest before `period`, or, when `period` comes before every row, the first after it.
 * `null` with no row outside `period`.
 */
export function nearestPeriodWithData(input: {
  txs: readonly LedgerTx[];
  def: PeriodDef;
  period: { start: LocalDate; end: LocalDate };
}): ReturnType<typeof periodContaining> | null {
  const { txs, def, period } = input;
  let before: LocalDate | null = null;
  let after: LocalDate | null = null;
  for (const tx of txs) {
    if (tx.date < period.start) {
      if (before === null || tx.date > before) before = tx.date;
    } else if (tx.date > period.end) {
      if (after === null || tx.date < after) after = tx.date;
    }
  }
  const date = before ?? after;
  return date === null ? null : periodContaining(def, date);
}
