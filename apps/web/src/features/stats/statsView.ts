import {
  averageSeries,
  type Category,
  categorySpendHistory,
  committedSpend,
  cycleLength,
  type DateRange,
  dailyCumulative,
  deltaPercent,
  elapsedDays,
  isWithin,
  type LocalDate,
  median,
  type PeriodDef,
  type PeriodView,
  periodHistory,
  periodSpendHistory,
  projectEndOfCycle,
  rollupToParents,
  sharePercent,
  spendingByCategory,
  summarizePeriod,
  type TagTotals,
  tagTotals,
  type UserData,
  upcomingExpenses,
} from '@saldo/core';

// The phone's constants (`apps/mobile/app/(tabs)/stats.tsx`), kept identical so both read the same
// history (§17.1.2). The web's six closed columns are the navigator's (`WEB_CLOSED_COLUMNS`): they
// change how many columns there are, never these windows.
/** §5.7: the window of the cycle median and of Ripartizione's deltas. */
const CASHFLOW_CYCLES = 6;
/** §5.6: «Il solito» on the trend is the average of this many previous periods. */
const USUAL_CYCLES = 3;
/** §5.7: the projection is only offered with at least this many days left. */
const MIN_DAYS_LEFT = 3;

/**
 * §5.7: the end-of-period projection of the period `range`, or `null` — the phone's
 * `showProjection`: a running period, at least `MIN_DAYS_LEFT` days left, and a median of the
 * previous periods to read it against. Statistics also draws it on the running bar of its chart,
 * whatever period is selected (W6).
 */
export function periodProjection(input: {
  txs: UserData['transactions'];
  def: PeriodDef;
  range: DateRange;
  today: LocalDate;
}): number | null {
  const { txs, def, range, today } = input;
  if (!isWithin(range, today)) return null;
  const length = cycleLength(range);
  const elapsed = elapsedDays(range, today);
  if (length - elapsed < MIN_DAYS_LEFT) return null;
  const cycleMedian = median(
    periodSpendHistory(periodHistory(txs, def, range, CASHFLOW_CYCLES), today),
  );
  if (cycleMedian === null) return null;
  return projectEndOfCycle({
    spent: summarizePeriod(txs, range, today).spent,
    committed: committedSpend(txs, range, today),
    elapsed,
    length,
    upcoming: upcomingExpenses(txs, range, today),
  });
}

export interface StatsFigures {
  kind: 'current' | 'closed';
  income: number;
  spent: number;
  net: number;
  /**
   * A running period with at least `MIN_DAYS_LEFT` days left and a median to read it against
   * (the phone's `showProjection`); `null` otherwise.
   */
  projection: number | null;
  /** The median spend of the previous periods: «sopra/sotto il solito» beside the projection. */
  median: number | null;
}

/** Quota impegnata (§5.7): the key figure of a closed period, and the card under the trend. */
export interface StatsCommitted {
  amount: number;
  discretionary: number;
  /** Percent of the spend, 0 when nothing was spent. */
  share: number;
}

export interface SplitRow {
  categoryId: string;
  /** `undefined` for an id the categories no longer hold; the phone renders it as «—». */
  category: Category | undefined;
  amount: number;
  share: number;
  /** Against the median of the periods the category was spent in; `null` with no baseline. */
  delta: number | null;
  /**
   * The category's spend in each used previous period, oldest first, then this period's: the
   * sparkline of its panel (D8). A used period with no spend in the category is a real zero.
   */
  history: number[];
}

export interface StatsSplit {
  total: number;
  rows: SplitRow[];
  /** «N transazioni escluse dai totali» (§5.7), and what they add up to. */
  excluded: { count: number; amount: number };
}

export interface StatsView {
  figures: StatsFigures;
  committed: StatsCommitted;
  split: StatsSplit;
  tags: TagTotals;
  trend: { current: number[]; usual: number[] };
}

/**
 * Everything under the navigator, for a current or closed period (§17.1.7). Each figure is the
 * phone's own call with the phone's own arguments: the acceptance is «to the cent» against it, so
 * nothing here is computed that the phone's screen does not compute the same way.
 */
export function statsView(input: {
  data: UserData;
  def: PeriodDef;
  today: LocalDate;
  period: PeriodView;
  direction: 'expense' | 'income';
}): StatsView {
  const { data, def, today, period, direction } = input;
  const txs = data.transactions;
  const summary = summarizePeriod(txs, period.range, today);

  // §5.6: the trend, and «il solito» over three periods — its own `periodHistory` call, as on the
  // phone, not a slice of the six-period one.
  const current = dailyCumulative(txs, period.range, today);
  const usual = averageSeries(
    periodHistory(txs, def, period.range, USUAL_CYCLES).map((entry) =>
      dailyCumulative(entry.txs, entry.period, today),
    ),
    Math.max(1, current.length),
  );

  const committed = committedSpend(txs, period.range, today);
  const cycleMedian = median(
    periodSpendHistory(periodHistory(txs, def, period.range, CASHFLOW_CYCLES), today),
  );

  const amounts = rollupToParents(
    spendingByCategory(txs, period.range, today, direction),
    data.categories,
  );
  // As on the phone, the history is the **expense** one whatever the direction:
  // `categorySpendHistory` reads `spendingByCategory` with its default kind.
  const history = categorySpendHistory(
    periodHistory(txs, def, period.range, CASHFLOW_CYCLES),
    data.categories,
    today,
  );
  const total = [...amounts.values()].reduce((sum, value) => sum + value, 0);
  const categories = new Map(data.categories.map((category) => [category.id, category]));
  const rows: SplitRow[] = [...amounts.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([categoryId, amount]) => {
      // A period the category was not spent in is not a zero baseline: dropped, as on the phone.
      const past = history.map((cycle) => cycle.get(categoryId) ?? 0).filter((value) => value > 0);
      return {
        categoryId,
        category: categories.get(categoryId),
        amount,
        share: sharePercent(amount, total),
        delta: deltaPercent(amount, median(past)),
        // `history` is most recent first (`periodHistory`); the chart reads left to right.
        history: [...history.map((cycle) => cycle.get(categoryId) ?? 0).reverse(), amount],
      };
    });

  // In range, already happened, and flagged out — the phone's filter, which core has no name for.
  const excluded = txs.filter(
    (tx) =>
      tx.excludeFromTotals &&
      tx.kind === direction &&
      isWithin(period.range, tx.date) &&
      tx.date <= today,
  );

  return {
    figures: {
      kind: period.isCurrent ? 'current' : 'closed',
      income: summary.income,
      spent: summary.spent,
      net: summary.remaining,
      projection: periodProjection({ txs, def, range: period.range, today }),
      median: cycleMedian,
    },
    committed: {
      amount: committed,
      discretionary: Math.max(0, summary.spent - committed),
      share: sharePercent(committed, summary.spent),
    },
    split: {
      total,
      rows,
      excluded: {
        count: excluded.length,
        amount: excluded.reduce((sum, tx) => sum + tx.amount, 0),
      },
    },
    tags: tagTotals(txs, period.range, today),
    trend: { current, usual },
  };
}
