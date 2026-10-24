import {
  type DateRange,
  type LocalDate,
  matchesInOtherPeriods,
  type PeriodDef,
  type TransactionFilters,
  type TransactionKind,
  type TransactionRow,
  transactionRow,
  type UserData,
} from '@saldo/core';
import { filterLookup } from './listView';

/** How many other periods the «no results» state lists, and how many rows under each one. */
export const OTHER_PERIODS_LIMIT = 3;
export const OTHER_PERIOD_ROWS = 3;

export interface OtherPeriodRow extends TransactionRow {
  id: string;
  date: LocalDate;
}

export interface OtherPeriodView {
  range: DateRange;
  /** Every match of the period: the rows below stop at `OTHER_PERIOD_ROWS`. */
  count: number;
  rows: OtherPeriodRow[];
}

/**
 * W11, Transactions · no results: the matches of the same search in the other periods, newest
 * period first, each period with its newest rows. Core finds them (`matchesInOtherPeriods`); the
 * rows are `transactionRow`'s, as in the list, so a transfer or an excluded row reads the same.
 */
export function otherPeriodsView(input: {
  data: UserData;
  filters: TransactionFilters;
  def: PeriodDef;
  exclude: DateRange;
  kindLabel: (kind: TransactionKind) => string;
}): OtherPeriodView[] {
  const { data, filters, def, exclude, kindLabel } = input;
  const lookup = filterLookup(data);
  const categories = new Map(data.categories.map((category) => [category.id, category]));
  const matches = matchesInOtherPeriods({
    txs: data.transactions,
    filters,
    lookup,
    def,
    exclude,
    limit: OTHER_PERIODS_LIMIT,
    rowLimit: OTHER_PERIOD_ROWS,
  });
  return matches.map((entry) => ({
    range: entry.range,
    count: entry.count,
    rows: entry.rows.map((tx) => ({
      ...transactionRow(tx, {
        category: (id) => categories.get(id),
        accountName: lookup.accountName,
        kindLabel,
        viewpointAccountId: filters.accountId,
      }),
      id: tx.id,
      date: tx.date,
    })),
  }));
}
