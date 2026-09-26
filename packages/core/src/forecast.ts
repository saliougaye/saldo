import { type DateRange, isWithin } from './cycle';
import type { LocalDate } from './dates';
import type { Recurrence } from './entities';
import { periodHistory } from './history';
import { countsInTotals, type LedgerTx, summarizePeriod } from './ledger';
import type { MinorUnits } from './money';
import { type PeriodDef, shiftPeriod } from './period';
import { occurrenceDates, recurrenceHorizonEnd } from './recurrence';
import { committedSpend, median, projectEndOfCycle, upcomingExpenses } from './stats';

/** How many periods the forecast looks ahead (§5.17): a median degrades fast, three stays credible. */
export const FORECAST_PERIODS = 3;
/** Below this many used periods in the §5.5 window there is no forecast at all. */
export const MIN_FORECAST_HISTORY = 3;

/** The recurrence fields the forecast reads. */
export type ForecastRecurrence = Pick<
  Recurrence,
  'id' | 'frequency' | 'interval' | 'startDate' | 'endDate' | 'deletedAt' | 'template'
>;

export interface ForecastInput {
  /** Ledger rows from the start of the history window through the end of the last forecast period. */
  txs: readonly LedgerTx[];
  recurrences: readonly ForecastRecurrence[];
  def: PeriodDef;
  /** The current period: the one containing `today`. */
  period: DateRange;
  today: LocalDate;
  /** Patrimonio complessivo today (§5.3), where the balance chain starts. */
  balance: MinorUnits;
}

export interface ForecastPeriod {
  range: DateRange;
  income: MinorUnits;
  expenses: MinorUnits;
  /** Expenses with the lightest discretionary period of the window instead of the median. */
  expensesMin: MinorUnits;
  /** …and with the heaviest. */
  expensesMax: MinorUnits;
  /** Projected Patrimonio complessivo at the end of the period. */
  balance: MinorUnits;
}

interface Flows {
  income: MinorUnits;
  expense: MinorUnits;
}

/** What would count in the totals of `range` once it happened: not a transfer, not excluded. */
function countable(tx: Pick<LedgerTx, 'kind' | 'excludeFromTotals'>): boolean {
  return tx.kind !== 'transfer' && !tx.excludeFromTotals;
}

/**
 * Scheduled income and expenses of a future `range` (§5.17): the rows already dated in it, plus
 * the occurrences the materialiser has not written yet because they fall past its horizon. Before
 * the horizon a missing occurrence was deleted by the user, so it is not brought back.
 */
function scheduledFlows(
  range: DateRange,
  txs: readonly LedgerTx[],
  recurrences: readonly ForecastRecurrence[],
  horizon: LocalDate,
): Flows {
  const flows: Flows = { income: 0, expense: 0 };
  const add = (kind: LedgerTx['kind'], amount: MinorUnits) => {
    if (kind === 'income') flows.income += amount;
    else flows.expense += amount;
  };
  for (const tx of txs) {
    if (isWithin(range, tx.date) && countable(tx)) add(tx.kind, tx.amount);
  }
  for (const recurrence of recurrences) {
    if (recurrence.deletedAt !== null || !countable(recurrence.template)) continue;
    for (const date of occurrenceDates(recurrence, range.end)) {
      if (date >= range.start && date > horizon) {
        add(recurrence.template.kind, recurrence.template.amount);
      }
    }
  }
  return flows;
}

/** Counted income that no recurrence produced: a bonus, a refund, a sale. */
function oneOffIncome(txs: readonly LedgerTx[], range: DateRange, today: LocalDate): MinorUnits {
  let total = 0;
  for (const tx of txs) {
    if (tx.kind !== 'income' || tx.recurrenceId !== null) continue;
    if (isWithin(range, tx.date) && countsInTotals(tx, today)) total += tx.amount;
  }
  return total;
}

function rounded(value: number | null): MinorUnits {
  return Math.round(value ?? 0);
}

/**
 * The next three periods from what already repeats (§5.17): scheduled amounts plus the usual
 * discretionary spend and one-off income of the §5.5 window, and the balance chained from today.
 * `null` when the window holds fewer than three used periods: one month of data would only fake
 * confidence.
 */
export function forecastPeriods(input: ForecastInput): ForecastPeriod[] | null {
  const { txs, recurrences, def, period, today, balance } = input;
  const history = periodHistory(txs, def, period);
  if (history.length < MIN_FORECAST_HISTORY) return null;

  const discretionary = history.map((entry) => {
    const { spent } = summarizePeriod(entry.txs, entry.period, today);
    return Math.max(0, spent - committedSpend(entry.txs, entry.period, today));
  });
  const usualSpend = rounded(median(discretionary));
  const lightest = Math.min(...discretionary);
  const heaviest = Math.max(...discretionary);
  const usualIncome = rounded(
    median(history.map((entry) => oneOffIncome(entry.txs, entry.period, today))),
  );

  // The rest of the current period: its scheduled income, and the §5.7 projection's remaining spend.
  const summary = summarizePeriod(txs, period, today);
  const projected = projectEndOfCycle({
    spent: summary.spent,
    committed: committedSpend(txs, period, today),
    elapsed: summary.elapsed,
    length: summary.length,
    upcoming: upcomingExpenses(txs, period, today),
  });
  let running = balance - (projected - summary.spent);
  for (const tx of txs) {
    if (
      tx.kind === 'income' &&
      !tx.excludeFromTotals &&
      tx.date > today &&
      isWithin(period, tx.date)
    ) {
      running += tx.amount;
    }
  }

  const horizon = recurrenceHorizonEnd(def, today);
  const forecast: ForecastPeriod[] = [];
  for (let ahead = 1; ahead <= FORECAST_PERIODS; ahead += 1) {
    const range = shiftPeriod(def, period, ahead);
    const scheduled = scheduledFlows(range, txs, recurrences, horizon);
    const income = scheduled.income + usualIncome;
    const expenses = scheduled.expense + usualSpend;
    running += income - expenses;
    forecast.push({
      range,
      income,
      expenses,
      expensesMin: scheduled.expense + lightest,
      expensesMax: scheduled.expense + heaviest,
      balance: running,
    });
  }
  return forecast;
}
