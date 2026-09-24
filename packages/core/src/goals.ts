import { cycleLength, elapsedDays } from './cycle';
import { diffDays, type LocalDate } from './dates';
import type { LedgerTx } from './ledger';
import type { MinorUnits } from './money';
import { type PeriodDef, periodContaining, shiftPeriod } from './period';

/** The pocket fields a goal is measured with (§5.14). */
export interface GoalAccount {
  id: string;
  openingBalance: MinorUnits;
  goalTarget: MinorUnits;
  goalDeadline: LocalDate | null;
  goalStartDate: LocalDate;
}

/** `open` = no deadline, so no pace; `onTrack` = at or ahead of the pace. */
export type GoalState = 'reached' | 'expired' | 'behind' | 'onTrack' | 'open';

export interface GoalProgress {
  saved: MinorUnits;
  target: MinorUnits;
  /** saved / target, clamped to 0..1. */
  ratio: number;
  missing: MinorUnits;
  state: GoalState;
  /** First day of the latest run at or above the target; null unless reached. */
  reachedOn: LocalDate | null;
  /** elapsed / length from the start to the deadline; null without a deadline. */
  pace: number | null;
  /** saved − expected, rounded; negative = behind. Null without a deadline. */
  gap: MinorUnits | null;
  /** App periods from today's to the deadline's, both included. */
  periodsLeft: number | null;
  /** ⌈missing / periodsLeft⌉. */
  perPeriod: MinorUnits | null;
  /** Days from today to the deadline. */
  daysLeft: number | null;
}

/** The pocket's own movements up to today, as signed amounts per date, in date order. */
function movements(goalId: string, txs: readonly LedgerTx[], today: LocalDate) {
  const byDate = new Map<LocalDate, MinorUnits>();
  for (const tx of txs) {
    if (tx.date > today) continue;
    let delta = 0;
    if (tx.accountId === goalId) delta += tx.kind === 'income' ? tx.amount : -tx.amount;
    if (tx.kind === 'transfer' && tx.toAccountId === goalId) delta += tx.amount;
    if (delta !== 0) byDate.set(tx.date, (byDate.get(tx.date) ?? 0) + delta);
  }
  return [...byDate.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Where a goal stands today (§5.14). Pure: `today` and the period definition are injected.
 */
export function goalProgress(
  goal: GoalAccount,
  txs: readonly LedgerTx[],
  today: LocalDate,
  def: PeriodDef,
): GoalProgress {
  const target = goal.goalTarget;
  let saved = goal.openingBalance;
  let startSaved = goal.openingBalance;
  let runStart: LocalDate | null = saved >= target ? goal.goalStartDate : null;
  for (const [date, delta] of movements(goal.id, txs, today)) {
    saved += delta;
    if (date <= goal.goalStartDate) startSaved = saved;
    if (saved >= target) runStart ??= date;
    else runStart = null;
  }

  const missing = Math.max(0, target - saved);
  const ratio = target > 0 ? Math.min(1, Math.max(0, saved / target)) : 0;
  const deadline = goal.goalDeadline;
  const reached = saved >= target;

  let pace: number | null = null;
  let gap: MinorUnits | null = null;
  let periodsLeft: number | null = null;
  let perPeriod: MinorUnits | null = null;
  let daysLeft: number | null = null;
  if (deadline !== null) {
    const range = { start: goal.goalStartDate, end: deadline };
    const length = cycleLength(range);
    pace = length === 0 ? 1 : elapsedDays(range, today) / length;
    gap = Math.round(saved - (startSaved + (target - startSaved) * pace));
    daysLeft = Math.max(0, diffDays(today, deadline));
    let period = periodContaining(def, today);
    periodsLeft = 1;
    while (period.end < deadline) {
      period = shiftPeriod(def, period, 1);
      periodsLeft += 1;
    }
    perPeriod = Math.ceil(missing / periodsLeft);
  }

  const state: GoalState = reached
    ? 'reached'
    : deadline === null
      ? 'open'
      : deadline < today
        ? 'expired'
        : gap !== null && gap < 0
          ? 'behind'
          : 'onTrack';

  return {
    saved,
    target,
    ratio,
    missing,
    state,
    reachedOn: reached ? runStart : null,
    pace,
    gap,
    periodsLeft,
    perPeriod,
    daysLeft,
  };
}
