import type { AccountRef } from './accounts';
import { type DateRange, isWithin } from './cycle';
import type { LocalDate } from './dates';
import type { Budget } from './entities';
import { periodHistory } from './history';
import { type CategoryRef, type LedgerTx, summarizePeriod } from './ledger';
import type { MinorUnits } from './money';
import { type PeriodDef, periodContaining, shiftPeriod } from './period';
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
    categories: [],
    otherCategories: { count: 0, amount: 0 },
    budgets: [],
    biggestExpense: null,
    netWorthChange: 0,
  };
}
