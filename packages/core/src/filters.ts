import type { LocalDate } from './dates';
import type { LedgerTx } from './ledger';

export interface TransactionFilters {
  query: string;
  accountId: string | null;
  /** Matches the category itself or its children. */
  categoryId: string | null;
  /** "Solo uscite" / "Solo entrate". Transfers are neither, so both hide them. */
  direction: 'all' | 'expense' | 'income';
  /** Matches transactions having any of these tags. */
  tagIds: readonly string[];
  onlyExcluded: boolean;
}

export const EMPTY_FILTERS: TransactionFilters = {
  query: '',
  accountId: null,
  categoryId: null,
  direction: 'all',
  tagIds: [],
  onlyExcluded: false,
};

/** Route params that link into the transaction list, as the router hands them over: strings. */
export interface FilterParams {
  accountId?: string | undefined;
  direction?: string | undefined;
  onlyExcluded?: string | undefined;
}

/**
 * The filters a link into the transaction list asks for (§5.7, and "Ultime transazioni" on an
 * account).
 *
 * Anything unrecognised is dropped rather than guessed: a stale or hand-edited link should open the
 * whole list, never a silently wrong slice of it that reads like the full picture.
 */
export function filtersFromParams(params: FilterParams): TransactionFilters {
  return {
    ...EMPTY_FILTERS,
    ...(params.accountId ? { accountId: params.accountId } : {}),
    ...(params.direction === 'expense' || params.direction === 'income'
      ? { direction: params.direction }
      : {}),
    onlyExcluded: params.onlyExcluded === '1',
  };
}

export interface FilterLookup {
  accountName(accountId: string): string;
  categoryName(categoryId: string): string;
  categoryParentId(categoryId: string): string | null;
}

/** Lowercase, accent-stripped, whitespace-collapsed text for matching. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function hasActiveFilters(filters: TransactionFilters): boolean {
  return (
    filters.query.trim().length > 0 ||
    filters.accountId !== null ||
    filters.categoryId !== null ||
    filters.direction !== 'all' ||
    filters.tagIds.length > 0 ||
    filters.onlyExcluded
  );
}

export function filterTransactions<T extends LedgerTx>(
  txs: readonly T[],
  filters: TransactionFilters,
  lookup: FilterLookup,
): T[] {
  const query = normalizeText(filters.query);
  return txs.filter((tx) => {
    if (filters.direction !== 'all' && tx.kind !== filters.direction) return false;
    if (
      filters.accountId !== null &&
      tx.accountId !== filters.accountId &&
      tx.toAccountId !== filters.accountId
    ) {
      return false;
    }
    if (filters.categoryId !== null) {
      if (tx.categoryId === null) return false;
      const matchesCategory =
        tx.categoryId === filters.categoryId ||
        lookup.categoryParentId(tx.categoryId) === filters.categoryId;
      if (!matchesCategory) return false;
    }
    if (filters.onlyExcluded && !tx.excludeFromTotals) return false;
    if (filters.tagIds.length > 0 && !filters.tagIds.some((tagId) => tx.tagIds.includes(tagId))) {
      return false;
    }
    if (query.length > 0) {
      const haystack = normalizeText(
        [
          tx.description,
          tx.categoryId === null ? '' : lookup.categoryName(tx.categoryId),
          lookup.accountName(tx.accountId),
          // A transfer is usually remembered by where the money landed, not where it left.
          tx.toAccountId === null ? '' : lookup.accountName(tx.toAccountId),
        ].join(' '),
      );
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export interface DayGroup<T> {
  date: LocalDate;
  items: T[];
  /** Expenses of the day that count in totals (not excluded). */
  expenseTotal: number;
}

/** Groups by date, newest day first; keeps input order inside a day. */
export function groupByDay<T extends LedgerTx>(txs: readonly T[]): DayGroup<T>[] {
  const groups = new Map<LocalDate, DayGroup<T>>();
  for (const tx of txs) {
    let group = groups.get(tx.date);
    if (!group) {
      group = { date: tx.date, items: [], expenseTotal: 0 };
      groups.set(tx.date, group);
    }
    group.items.push(tx);
    if (tx.kind === 'expense' && !tx.excludeFromTotals) group.expenseTotal += tx.amount;
  }
  return [...groups.values()].sort((a, b) => b.date.localeCompare(a.date));
}
