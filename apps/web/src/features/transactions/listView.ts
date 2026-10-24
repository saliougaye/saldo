import {
  childCategories,
  type FilterLookup,
  filterTransactions,
  groupByDay,
  hasActiveFilters,
  type ListTotals,
  type LocalDate,
  newestFirst,
  type PeriodSummary,
  type PeriodView,
  splitUpcoming,
  summarizePeriod,
  type Transaction,
  type TransactionFilters,
  type TransactionKind,
  type TransactionRow,
  type TransactionRowDeps,
  topLevelCategories,
  totalsOf,
  transactionRow,
  type UserData,
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
  /** The names of its tags, in the phone's order: the pills a wide row shows. */
  tagNames: string[];
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
  /**
   * How many transfers «Solo uscite»/«Solo entrate» are hiding, so the page can say so rather than
   * look as if it lost them (§5.12). Zero for «all» and for «Solo trasferimenti».
   */
  hiddenTransfers: number;
  /** What the rows on screen add up to, excluded ones included (`totalsOf`, §5.12). */
  totals: ListTotals;
  /** The summary block (W5): the period's figures over the rows the filters keep. */
  summary: PeriodSummary;
  filtered: boolean;
}

export interface ListViewInput {
  data: UserData;
  filters: TransactionFilters;
  today: LocalDate;
  period: PeriodView;
  /** `t('kinds.<kind>')`, injected so this stays pure; the page passes its translator. */
  kindLabel?: (kind: TransactionKind) => string;
}

/** What `filterTransactions` reads to match a search against names: the list and W11's other periods share it. */
export function filterLookup(data: UserData): FilterLookup {
  const categories = new Map(data.categories.map((category) => [category.id, category]));
  const accounts = new Map(data.accounts.map((account) => [account.id, account]));
  return {
    accountName: (id) => accounts.get(id)?.name ?? '',
    categoryName: (id) => categories.get(id)?.name ?? '',
    categoryParentId: (id) => categories.get(id)?.parentId ?? null,
  };
}

/**
 * The list of §5.12: the period's rows, filtered by core, split into what has happened and what is
 * dated ahead, then grouped by day. The rows are `transactionRow`'s, so the phone and the web title
 * and colour a transfer, a recurrence and an excluded row identically.
 */
export function listView({ data, filters, today, period, kindLabel }: ListViewInput): ListView {
  // Both ends are bounded by the period: an unbounded upper end would show a closed September
  // rows dated in October, and «In arrivo» holds what is dated ahead *inside* the period (§6.15).
  const end = period.range.end;
  // The order the phone's query returns, byte for byte (see `newestFirst`).
  const inRange = data.transactions
    .filter((tx) => tx.date >= period.range.start && tx.date <= end)
    .sort(newestFirst);

  const categories = new Map(data.categories.map((category) => [category.id, category]));
  const lookup = filterLookup(data);
  const filtered = filterTransactions(inRange, filters, lookup);
  const split = splitUpcoming(filtered, today);

  const deps: TransactionRowDeps = {
    category: (id) => categories.get(id),
    accountName: lookup.accountName,
    kindLabel: kindLabel ?? ((kind) => kind),
    // The account the list is read from, which is what gives a transfer a direction here (§5.3).
    viewpointAccountId: filters.accountId,
  };
  // The phone's `useTags` order (name, byte for byte), which is the order a row lists its tags in.
  const tagsByName = [...data.tags].sort((a, b) => binary(a.name, b.name));
  const tagged = filters.tagIds.length > 0;
  /** With a tag filter on, a row says which tags it carries instead of its category (§5.12). */
  const leadOf = (tx: Transaction, fallback: string): string => {
    if (!tagged) return fallback;
    const names = tagsByName.filter((tag) => tx.tagIds.includes(tag.id)).map((tag) => tag.name);
    return names.length === 0 ? fallback : names.join(' · ');
  };
  /**
   * W5, figure 3: «Category · Account». `transactionRow` gives the category only, as the phone's
   * row wants it, so the web adds the account here. A list filtered to one account leaves it out:
   * every row is on it. A transfer names its accounts in its title already.
   */
  const subtitleOf = (tx: Transaction, fallback: string): string => {
    const lead = leadOf(tx, fallback);
    if (tx.kind === 'transfer' || tx.accountId === filters.accountId) return lead;
    const account = lookup.accountName(tx.accountId);
    return account === '' ? lead : `${lead} · ${account}`;
  };
  const toDays = (txs: readonly Transaction[]): DayView[] =>
    groupByDay(txs).map((group) => ({
      date: group.date,
      expenseTotal: group.expenseTotal,
      rows: group.items.map((tx) => {
        const row = transactionRow(tx, deps);
        return {
          ...row,
          subtitle: subtitleOf(tx, row.subtitle),
          id: tx.id,
          date: tx.date,
          recurring: tx.recurrenceId !== null,
          tagNames: tagsByName.filter((tag) => tx.tagIds.includes(tag.id)).map((tag) => tag.name),
        };
      }),
    }));

  // The phone counts over the same range with the direction lifted and every other filter kept.
  const hiddenTransfers =
    filters.direction === 'all' || filters.direction === 'transfer'
      ? 0
      : filterTransactions(inRange, { ...filters, direction: 'all' }, lookup).filter(
          (tx) => tx.kind === 'transfer',
        ).length;

  return {
    days: toDays(split.settled),
    upcomingDays: toDays(split.upcoming),
    upcoming: { count: split.upcoming.length, net: split.upcomingNet },
    hiddenTransfers,
    totals: totalsOf(split.settled),
    summary: summarizePeriod(filtered, period.range, today),
    filtered: hasActiveFilters(filters),
  };
}

/** Plain code-unit order: what SQLite's BINARY collation gives the phone's `ORDER BY name`. */
function binary(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export interface FilterChoices {
  /** Every account, archived ones too and marked — the phone's `AccountFilterSheet`. */
  accounts: { id: string; name: string; archived: boolean }[];
  /** Every tag, the most used first — the phone's `TagFilterSheet` (§6.23). */
  tags: { id: string; name: string }[];
  /** Live categories, expenses then income, each parent followed by its children (§5.11). */
  categories: { id: string; name: string; child: boolean }[];
}

/**
 * What the chips offer. The phone reaches both through a sheet; the web has no sheet in 0.3d, so
 * the same lists become chips, in the same order.
 */
export function filterChoices(data: UserData): FilterChoices {
  const accounts = [...data.accounts]
    .sort((a, b) => a.sortOrder - b.sortOrder || binary(a.name, b.name))
    .map((account) => ({
      id: account.id,
      name: account.name,
      archived: account.archivedAt !== null,
    }));

  // Usage over the whole history, as the sheet counts it; a stable sort keeps name order on a tie.
  const usage = new Map<string, number>();
  for (const tx of data.transactions) {
    for (const id of tx.tagIds) usage.set(id, (usage.get(id) ?? 0) + 1);
  }
  const tags = [...data.tags]
    .sort((a, b) => binary(a.name, b.name))
    .sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0))
    .map((tag) => ({ id: tag.id, name: tag.name }));

  const categories = (['expense', 'income'] as const).flatMap((direction) =>
    topLevelCategories(data.categories, direction).flatMap((parent) => [
      { id: parent.id, name: parent.name, child: false },
      ...childCategories(data.categories, parent.id).map((child) => ({
        id: child.id,
        name: child.name,
        child: true,
      })),
    ]),
  );

  return { accounts, tags, categories };
}
