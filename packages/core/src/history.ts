import { type Cycle, isWithin } from './cycle';
import type { LocalDate } from './dates';
import {
  type CategoryRef,
  type LedgerTx,
  rollupToParents,
  spendingByCategory,
  summarizePeriod,
} from './ledger';
import type { MinorUnits } from './money';
import { type PeriodDef, previousPeriods } from './period';

/** How many periods of history the baselines of §5.5 look at. */
export const HISTORY_WINDOW = 6;

export interface PeriodHistoryEntry {
  /** The period this entry covers. Still called `cycle` nowhere: a period is any kind now. */
  period: Cycle;
  txs: LedgerTx[];
}

/**
 * The `count` periods before `period` that the user actually used, most recent first (§5.5).
 *
 * Periods with no transaction **at all** are dropped rather than contributing a zero, which would
 * drag every median down for anyone who has not used the app for a whole period. The window is
 * still bounded to the `count` calendar periods before the selected one, so the search never walks
 * back indefinitely looking for used ones.
 *
 * Emptiness is measured on rows, not on counted amounts: a period holding only a transfer or only
 * excluded transactions was used, and its zero spend is a real zero.
 */
export function periodHistory(
  txs: readonly LedgerTx[],
  def: PeriodDef,
  period: Cycle,
  count: number = HISTORY_WINDOW,
): PeriodHistoryEntry[] {
  const history: PeriodHistoryEntry[] = [];
  for (const previous of previousPeriods(def, period, count)) {
    const inPeriod = txs.filter((tx) => isWithin(previous, tx.date));
    if (inPeriod.length > 0) history.push({ period: previous, txs: inPeriod });
  }
  return history;
}

/** Counted spend of each period in the window, for the median of §5.5. */
export function periodSpendHistory(
  history: readonly PeriodHistoryEntry[],
  today: LocalDate,
): MinorUnits[] {
  return history.map((entry) => summarizePeriod(entry.txs, entry.period, today).spent);
}

/**
 * Parent-level spend per category for each period in the window, for the category median and the
 * budget amount suggestion of §5.5.
 */
export function categorySpendHistory(
  history: readonly PeriodHistoryEntry[],
  categories: readonly CategoryRef[],
  today: LocalDate,
): Map<string, MinorUnits>[] {
  return history.map((entry) =>
    rollupToParents(spendingByCategory(entry.txs, entry.period, today), categories),
  );
}
