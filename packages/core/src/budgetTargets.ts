import type { BudgetProgress } from './budgets';
import { FEATURE_MARGIN, MAX_TARGET_EVENTS, type RankedTarget } from './targets';

/** A budget as the target card sees it (§5.13). */
export interface BudgetTargetInput {
  id: string;
  progress: Pick<BudgetProgress, 'spent' | 'limit' | 'ratio' | 'overPace' | 'overLimit'>;
  /** elapsed / length of the budget's own range. */
  pace: number;
}

/** Over limit (money) → over pace (points past the pace) → the rest (closest to pace first). */
export function rankBudget({ id, progress, pace }: BudgetTargetInput): RankedTarget {
  if (progress.overLimit) {
    return {
      id,
      tier: 2,
      score: progress.spent - progress.limit,
      margin: FEATURE_MARGIN * progress.limit,
    };
  }
  if (progress.overPace) {
    return { id, tier: 1, score: progress.ratio - pace, margin: FEATURE_MARGIN };
  }
  return {
    id,
    tier: 0,
    score: pace > 0 ? progress.ratio / pace : progress.ratio,
    margin: FEATURE_MARGIN,
  };
}

const overrun = (item: BudgetTargetInput): number => item.progress.spent - item.progress.limit;

/** The exceptions that get a row: over the limit, largest overrun first, at most three. */
export function budgetEventIds(
  items: readonly BudgetTargetInput[],
  featuredId: string | null,
): string[] {
  return items
    .filter((item) => item.id !== featuredId && item.progress.overLimit)
    .sort((a, b) => overrun(b) - overrun(a))
    .slice(0, MAX_TARGET_EVENTS)
    .map((item) => item.id);
}

export type BudgetCardStatus =
  | { kind: 'overLimit'; count: number }
  | { kind: 'overPace'; count: number }
  | { kind: 'withinLimits' };

/** The header's status line: over the limit beats over pace, which beats "within limits". */
export function budgetCardStatus(items: readonly BudgetTargetInput[]): BudgetCardStatus {
  const overLimit = items.filter((item) => item.progress.overLimit).length;
  if (overLimit > 0) return { kind: 'overLimit', count: overLimit };
  const overPace = items.filter((item) => item.progress.overPace).length;
  if (overPace > 0) return { kind: 'overPace', count: overPace };
  return { kind: 'withinLimits' };
}

export type BudgetAdvice =
  /** `perDay` is rounded down: it is a ceiling. `gap` is |spent − limit × pace|. */
  | { kind: 'perDay'; perDay: number; gap: number; overPace: boolean }
  | { kind: 'overLimit'; overrun: number }
  | { kind: 'closed'; percent: number };

/**
 * What the featured budget's sentence says (§5.13).
 *
 * @param open whether the range still contains today
 * @param daysToSpend days left in the range, today and the last day included
 */
export function budgetAdvice(
  progress: Pick<BudgetProgress, 'spent' | 'limit' | 'ratio'>,
  pace: number,
  open: boolean,
  daysToSpend: number,
): BudgetAdvice {
  if (progress.spent > progress.limit) {
    return { kind: 'overLimit', overrun: progress.spent - progress.limit };
  }
  if (!open) return { kind: 'closed', percent: Math.round(progress.ratio * 100) };
  const gap = Math.round(progress.spent - progress.limit * pace);
  return {
    kind: 'perDay',
    perDay: Math.floor((progress.limit - progress.spent) / Math.max(1, daysToSpend)),
    gap: Math.abs(gap),
    overPace: gap > 0,
  };
}
