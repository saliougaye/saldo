import type { GoalProgress } from './goals';
import { FEATURE_MARGIN, MAX_TARGET_EVENTS, type RankedTarget } from './targets';

/** A goal as the target card sees it (§5.13). */
export interface GoalTargetInput {
  id: string;
  progress: GoalProgress;
}

const dateScore = (date: string | null): number =>
  date === null ? 0 : Number(date.replaceAll('-', ''));

/**
 * Expired (missing, money) → behind (−gap ÷ target) → on track (least ahead first) → no deadline
 * (lowest ratio first) → reached (most recently reached first).
 */
export function rankGoal({ id, progress }: GoalTargetInput): RankedTarget {
  const target = Math.max(1, progress.target);
  const gap = progress.gap ?? 0;
  switch (progress.state) {
    case 'expired':
      return { id, tier: 4, score: progress.missing, margin: FEATURE_MARGIN * progress.target };
    case 'behind':
      return { id, tier: 3, score: -gap / target, margin: FEATURE_MARGIN };
    case 'onTrack':
      return { id, tier: 2, score: -gap / target, margin: FEATURE_MARGIN };
    case 'open':
      return { id, tier: 1, score: -progress.ratio, margin: FEATURE_MARGIN };
    case 'reached':
      return { id, tier: 0, score: dateScore(progress.reachedOn), margin: 0 };
  }
}

/** The exceptions that get a row: expired (most missing first), then reached (newest first). */
export function goalEventIds(
  items: readonly GoalTargetInput[],
  featuredId: string | null,
): string[] {
  const others = items.filter((item) => item.id !== featuredId);
  const expired = others
    .filter((item) => item.progress.state === 'expired')
    .sort((a, b) => b.progress.missing - a.progress.missing);
  const reached = others
    .filter((item) => item.progress.state === 'reached')
    .sort((a, b) => dateScore(b.progress.reachedOn) - dateScore(a.progress.reachedOn));
  return [...expired, ...reached].slice(0, MAX_TARGET_EVENTS).map((item) => item.id);
}

export interface GoalCardStatus {
  expired: number;
  behind: number;
  reached: number;
}

export function goalCardStatus(items: readonly GoalTargetInput[]): GoalCardStatus {
  const count = (state: GoalProgress['state']) =>
    items.filter((item) => item.progress.state === state).length;
  return { expired: count('expired'), behind: count('behind'), reached: count('reached') };
}

export type GoalAdvice =
  | { kind: 'perPeriod'; perPeriod: number; gap: number; behind: boolean }
  | { kind: 'lastPeriod'; missing: number; days: number }
  | { kind: 'noDeadline'; missing: number }
  | { kind: 'expired'; missing: number }
  | { kind: 'reached'; target: number };

/** What the goal's sentence says (§5.14). */
export function goalAdvice(progress: GoalProgress): GoalAdvice {
  switch (progress.state) {
    case 'reached':
      return { kind: 'reached', target: progress.target };
    case 'expired':
      return { kind: 'expired', missing: progress.missing };
    case 'open':
      return { kind: 'noDeadline', missing: progress.missing };
    default:
      if (progress.periodsLeft === null || progress.periodsLeft <= 1) {
        return { kind: 'lastPeriod', missing: progress.missing, days: progress.daysLeft ?? 0 };
      }
      return {
        kind: 'perPeriod',
        perPeriod: progress.perPeriod ?? progress.missing,
        gap: Math.abs(progress.gap ?? 0),
        behind: progress.state === 'behind',
      };
  }
}
