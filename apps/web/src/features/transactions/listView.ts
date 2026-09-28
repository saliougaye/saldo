import {
  type FilterLookup,
  filterTransactions,
  groupByDay,
  hasActiveFilters,
  type ListTotals,
  type LocalDate,
  newestFirst,
  type PeriodDef,
  type PeriodView,
  splitUpcoming,
  type Transaction,
  type TransactionFilters,
  type TransactionKind,
  type TransactionRow,
  type TransactionRowDeps,
  totalsOf,
  transactionRow,
  type UserData,
  upcomingUntil,
} from '@saldo/core';

export interface ListRowView extends TransactionRow {
  id: string;
  date: LocalDate;
  /**
   * The ↻ badge: `transactionRow` returns title, subtitle, icon, colorIndex and amount and **no
   * badge**, because the screens read it from `recurrenceId` themselves (§5.9). Both apps decide it
   * the same way, so it is carried here rather than recomputed in the page.
   */
  recurring: boolean;
}

export interface DayView {
  date: LocalDate;
  /** Expenses only, excluded rows left out — the phone's day header (§5.12). */
  expenseTotal: number;
  rows: ListRowView[];
}

export interface ListView {
  days: DayView[];
  /** The rows behind the «In arrivo» fold, grouped the same way. */
  upcomingDays: DayView[];
  upcoming: { count: number; net: number };
  /** What the rows on screen add up to, excluded ones included (`totalsOf`, §5.12). */
  totals: ListTotals;
  filtered: boolean;
}

export interface ListViewInput {
  data: UserData;
  filters: TransactionFilters;
  today: LocalDate;
  def: PeriodDef;
  period: PeriodView;
  /** `t('kinds.<kind>')`, injected so this stays pure; the page passes its translator. */
  kindLabel?: (kind: TransactionKind) => string;
}

/**
 * The list of §5.12: the period's rows, filtered by core, split into what has happened and what is
 * dated ahead, then grouped by day. The rows are `transactionRow`'s, so the phone and the web title
 * and colour a transfer, a recurrence and an excluded row identically.
 */
export function listView({
  data,
  filters,
  today,
  def,
  period,
  kindLabel,
}: ListViewInput): ListView {
  // Both ends are bounded. The start is the period's, and the end is the «In arrivo» horizon: the
  // end of the next period while this one is current, and the period's own end once it is closed —
  // where an unbounded upper end would show a closed September rows dated in October (§6.15).
  const end = upcomingUntil(def, period.range, today);
  // The order the phone's query returns, byte for byte (see `newestFirst`).
  const inRange = data.transactions
    .filter((tx) => tx.date >= period.range.start && tx.date <= end)
    .sort(newestFirst);

  const categories = new Map(data.categories.map((category) => [category.id, category]));
  const accounts = new Map(data.accounts.map((account) => [account.id, account]));
  const lookup: FilterLookup = {
    accountName: (id) => accounts.get(id)?.name ?? '',
    categoryName: (id) => categories.get(id)?.name ?? '',
    categoryParentId: (id) => categories.get(id)?.parentId ?? null,
  };
  const filtered = filterTransactions(inRange, filters, lookup);
  const split = splitUpcoming(filtered, today);

  const deps: TransactionRowDeps = {
    category: (id) => categories.get(id),
    accountName: lookup.accountName,
    kindLabel: kindLabel ?? ((kind) => kind),
    // The account the list is read from, which is what gives a transfer a direction here (§5.3).
    viewpointAccountId: filters.accountId,
  };
  const toDays = (txs: readonly Transaction[]): DayView[] =>
    groupByDay(txs).map((group) => ({
      date: group.date,
      expenseTotal: group.expenseTotal,
      rows: group.items.map((tx) => ({
        ...transactionRow(tx, deps),
        id: tx.id,
        date: tx.date,
        recurring: tx.recurrenceId !== null,
      })),
    }));

  return {
    days: toDays(split.settled),
    upcomingDays: toDays(split.upcoming),
    upcoming: { count: split.upcoming.length, net: split.upcomingNet },
    totals: totalsOf(split.settled),
    filtered: hasActiveFilters(filters),
  };
}
