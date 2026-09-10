import { type Cycle, isWithin, previousCycles } from './cycle';
import type { LocalDate } from './dates';
import {
  type CategoryRef,
  type LedgerTx,
  rollupToParents,
  spendingByCategory,
  summarizePeriod,
} from './ledger';
import type { MinorUnits } from './money';

/** How many cycles of history the baselines of §5.5 look at. */
export const HISTORY_WINDOW = 6;

export interface CycleHistoryEntry {
  cycle: Cycle;
  txs: LedgerTx[];
}

/**
 * The `count` cycles before `cycle` that the user actually used, most recent first (§5.5).
 *
 * Cycles with no transaction **at all** are dropped rather than contributing a zero, which would
 * drag every median down for anyone who has not used the app for a whole cycle. The window is
 * still bounded to the `count` calendar cycles before the selected one, so the search never walks
 * back indefinitely looking for used cycles.
 *
 * Emptiness is measured on rows, not on counted amounts: a cycle holding only a transfer or only
 * excluded transactions was used, and its zero spend is a real zero.
 */
export function cycleHistory(
  txs: readonly LedgerTx[],
  cycle: Cycle,
  cycleStartDay: number,
  count: number = HISTORY_WINDOW,
): CycleHistoryEntry[] {
  const history: CycleHistoryEntry[] = [];
  for (const previous of previousCycles(cycle, cycleStartDay, count)) {
    const inCycle = txs.filter((tx) => isWithin(previous, tx.date));
    if (inCycle.length > 0) history.push({ cycle: previous, txs: inCycle });
  }
  return history;
}

/** Counted spend of each cycle in the window, for the cycle median of §5.5. */
export function cycleSpendHistory(
  history: readonly CycleHistoryEntry[],
  today: LocalDate,
): MinorUnits[] {
  return history.map((entry) => summarizePeriod(entry.txs, entry.cycle, today).spent);
}

/**
 * Parent-level spend per category for each cycle in the window, for the category median and the
 * budget amount suggestion of §5.5.
 */
export function categorySpendHistory(
  history: readonly CycleHistoryEntry[],
  categories: readonly CategoryRef[],
  today: LocalDate,
): Map<string, MinorUnits>[] {
  return history.map((entry) =>
    rollupToParents(spendingByCategory(entry.txs, entry.cycle, today), categories),
  );
}
