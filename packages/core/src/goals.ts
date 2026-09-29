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

/**
 * How full a goal or a pocket is: saved over target, clamped to 0..1, and 0 for a pocket with no
 * target. The one place that answer is written — `goalProgress` returns it as `ratio`, and the two
 * lists of pockets (the phone's Conti tab, the web's `accountsView`) call it with the balances they
 * already hold rather than running the whole of `goalProgress` for a ring.
 */
export function goalRatio(saved: MinorUnits, target: MinorUnits): number {
  return target > 0 ? Math.min(1, Math.max(0, saved / target)) : 0;
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
  /** Days left to the deadline, today and the deadline included (as a budget's). */
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

/** App periods from the one containing `from` to the one containing `to`, both included. */
function periodsBetween(def: PeriodDef, from: LocalDate, to: LocalDate): number {
  let period = periodContaining(def, from);
  let count = 1;
  while (period.end < to) {
    period = shiftPeriod(def, period, 1);
    count += 1;
  }
  return count;
}

/**
 * Where a goal stands today (§5.14). «Behind» means more than one period's share of the plan
 * behind the pace: a goal is never behind the day it is created, nor between two monthly
 * contributions (decided 2026-09-24). Pure: `today` and the period definition are injected.
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
  const ratio = goalRatio(saved, target);
  const deadline = goal.goalDeadline;
  const reached = saved >= target;

  let pace: number | null = null;
  let gap: MinorUnits | null = null;
  let periodsLeft: number | null = null;
  let perPeriod: MinorUnits | null = null;
  let daysLeft: number | null = null;
  /** One period's share of the plan: how far behind the pace still counts as on track. */
  let allowance = 0;
  if (deadline !== null) {
    const range = { start: goal.goalStartDate, end: deadline };
    const length = cycleLength(range);
    pace = length === 0 ? 1 : elapsedDays(range, today) / length;
    gap = Math.round(saved - (startSaved + (target - startSaved) * pace));
    daysLeft = Math.max(0, diffDays(today, deadline) + 1);
    periodsLeft = periodsBetween(def, today, deadline);
    perPeriod = Math.ceil(missing / periodsLeft);
    allowance = (target - startSaved) / periodsBetween(def, goal.goalStartDate, deadline);
  }

  const state: GoalState = reached
    ? 'reached'
    : deadline === null
      ? 'open'
      : deadline < today
        ? 'expired'
        : gap !== null && gap < -allowance
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
