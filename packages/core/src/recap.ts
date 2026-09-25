import type { AccountRef } from './accounts';
import { expandCategoryIds } from './budgets';
import { type DateRange, isWithin } from './cycle';
import { type LocalDate, parseLocalDate } from './dates';
import type { Budget } from './entities';
import { categorySpendHistory, type PeriodHistoryEntry, periodHistory } from './history';
import {
  type CategoryRef,
  type LedgerTx,
  rollupToParents,
  spendingByCategory,
  summarizePeriod,
} from './ledger';
import type { MinorUnits } from './money';
import {
  isoWeekRange,
  monthRangeOf,
  type PeriodDef,
  periodContaining,
  shiftPeriod,
  yearRange,
} from './period';
import { effectiveLimit } from './rollover';
import { deltaPercent, median } from './stats';

/** The budget fields a recap reads. */
export type RecapBudgetRef = Pick<
  Budget,
  'id' | 'name' | 'categoryIds' | 'amount' | 'period' | 'rollover' | 'createdAt'
>;

export interface PeriodRecapInput {
  def: PeriodDef;
  /** The closed period, from {@link recapPeriod}. */
  period: DateRange;
  today: LocalDate;
  /**
   * Every live row dated up to `period.end`. The history window, the rollover chain and the
   * balances all read further back than the period itself.
   */
  transactions: readonly LedgerTx[];
  categories: readonly CategoryRef[];
  budgets: readonly RecapBudgetRef[];
  accounts: readonly AccountRef[];
}

export interface RecapCategory {
  /** Parent-level category id. */
  categoryId: string;
  amount: MinorUnits;
  /** % above the category's own median (§5.5), on the one category that moved most; else null. */
  aboveUsual: number | null;
}

export interface RecapBudgetLine {
  budgetId: string;
  name: string;
  spent: MinorUnits;
  /** The limit the period measured against, carry included (§5.8). */
  limit: MinorUnits;
  over: boolean;
  /** What rolls into the next period; 0 without rollover. */
  carry: MinorUnits;
}

export interface RecapExpense {
  transactionId: string;
  description: string;
  categoryId: string | null;
  date: LocalDate;
  amount: MinorUnits;
}

export interface PeriodRecap {
  period: DateRange;
  income: MinorUnits;
  spent: MinorUnits;
  net: MinorUnits;
  /** Net of the period before; null when it has no transaction. */
  previousNet: MinorUnits | null;
  /** Median net over the §5.5 window; null without history. */
  usualNet: MinorUnits | null;
  incomeDelta: number | null;
  spentDelta: number | null;
  categories: RecapCategory[];
  otherCategories: { count: number; amount: MinorUnits };
  budgets: RecapBudgetLine[];
  biggestExpense: RecapExpense | null;
  netWorthChange: MinorUnits;
}

/** How many categories the recap lists before folding the rest into «Altre N categorie». */
export const RECAP_TOP_CATEGORIES = 5;

/**
 * The top categories at parent level, and the one that grew most against its own median (§5.5).
 * The tag is looked for among the listed ones only: a tag on a folded category cannot be seen.
 * A category with no history has a zero or missing median, so `deltaPercent` gives null.
 */
function recapCategories(
  inPeriod: readonly LedgerTx[],
  period: DateRange,
  today: LocalDate,
  categories: readonly CategoryRef[],
  history: readonly PeriodHistoryEntry[],
): Pick<PeriodRecap, 'categories' | 'otherCategories'> {
  const totals = rollupToParents(spendingByCategory(inPeriod, period, today), categories);
  const ranked = [...totals.entries()]
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = ranked.slice(0, RECAP_TOP_CATEGORIES);
  const rest = ranked.slice(RECAP_TOP_CATEGORIES);

  const past = categorySpendHistory(history, categories, today);
  let mover: { categoryId: string; delta: number } | null = null;
  for (const [categoryId, amount] of top) {
    const usual = median(past.map((amounts) => amounts.get(categoryId) ?? 0));
    const delta = deltaPercent(amount, usual);
    if (delta !== null && delta > 0 && (mover === null || delta > mover.delta)) {
      mover = { categoryId, delta };
    }
  }

  return {
    categories: top.map(([categoryId, amount]) => ({
      categoryId,
      amount,
      aboveUsual: mover?.categoryId === categoryId ? mover.delta : null,
    })),
    otherCategories: {
      count: rest.length,
      amount: rest.reduce((sum, [, amount]) => sum + amount, 0),
    },
  };
}

/**
 * The calendar window a budget measures when its period closes with `period` (§5.15). Not
 * `budgetRange`: that one clips a closed period's week to the period, which would put every weekly
 * budget in every monthly recap. Here a weekly budget belongs to a recap only when its whole ISO
 * week ends on the period's last day.
 */
function ownRange(kind: RecapBudgetRef['period'], period: DateRange): DateRange {
  switch (kind) {
    case 'period':
      return period;
    case 'week':
      return isoWeekRange(period.end);
    case 'month': {
      const { year, month } = parseLocalDate(period.end);
      return monthRangeOf({ year, month });
    }
    case 'year':
      return yearRange(period.end);
  }
}

/** The budgets that closed with the period, measured as closed (§5.8), in the caller's order. */
function recapBudgets(input: PeriodRecapInput): RecapBudgetLine[] {
  const { def, period, today, transactions, categories, budgets } = input;
  const lines: RecapBudgetLine[] = [];
  for (const budget of budgets) {
    const createdOn = budget.createdAt.slice(0, 10);
    if (createdOn > period.end) continue;
    const range = ownRange(budget.period, period);
    if (range.end !== period.end) continue;

    const ids = expandCategoryIds(budget.categoryIds, categories);
    const spentIn = (target: DateRange): MinorUnits => {
      const amounts = spendingByCategory(transactions, target, today);
      let total = 0;
      for (const id of ids) total += amounts.get(id) ?? 0;
      return total;
    };
    const spent = spentIn(range);
    // Rollover exists for budgets that follow the app's period only (§5.8).
    const rolls = budget.period === 'period';
    const limit = rolls
      ? effectiveLimit({
          amount: budget.amount,
          createdAtPeriodStart: periodContaining(def, createdOn).start,
          period,
          def,
          spentInPeriod: spentIn,
          rollover: budget.rollover,
        })
      : budget.amount;
    lines.push({
      budgetId: budget.id,
      name: budget.name,
      spent,
      limit,
      over: spent > limit,
      carry: rolls && budget.rollover ? Math.max(0, limit - spent) : 0,
    });
  }
  return lines;
}

/**
 * The period a recap is about (§5.15): the one immediately before the period containing today,
 * under the kind in force. Only that one — after weeks away there is still a single recap.
 */
export function recapPeriod(def: PeriodDef, today: LocalDate): DateRange {
  return shiftPeriod(def, periodContaining(def, today), -1);
}

/**
 * Everything the recap sheet shows (§5.15), computed from the ledger and never stored: a row
 * entered late for the closed period changes the recap as it changes the stats. Null when the
 * period has no transaction at all — the same emptiness rule as the history window.
 */
export function periodRecap(input: PeriodRecapInput): PeriodRecap | null {
  const { def, period, today, transactions } = input;
  const inPeriod = transactions.filter((row) => isWithin(period, row.date));
  if (inPeriod.length === 0) return null;

  const summary = summarizePeriod(inPeriod, period, today);
  const previous = shiftPeriod(def, period, -1);
  const inPrevious = transactions.filter((row) => isWithin(previous, row.date));
  const before = inPrevious.length === 0 ? null : summarizePeriod(inPrevious, previous, today);

  const history = periodHistory(transactions, def, period);
  const usual = median(
    history.map((entry) => {
      const past = summarizePeriod(entry.txs, entry.period, today);
      return past.income - past.spent;
    }),
  );

  return {
    period,
    income: summary.income,
    spent: summary.spent,
    net: summary.income - summary.spent,
    previousNet: before === null ? null : before.income - before.spent,
    usualNet: usual === null ? null : Math.round(usual),
    incomeDelta: deltaPercent(summary.income, before?.income ?? null),
    spentDelta: deltaPercent(summary.spent, before?.spent ?? null),
    ...recapCategories(inPeriod, period, today, input.categories, history),
    budgets: recapBudgets(input),
    biggestExpense: null,
    netWorthChange: 0,
  };
}
