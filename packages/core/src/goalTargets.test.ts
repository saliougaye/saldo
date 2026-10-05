import { describe, expect, it } from 'vitest';
import type { GoalProgress } from './goals';
import { rankGoal } from './goalTargets';

function progress(overrides: Partial<GoalProgress>): GoalProgress {
  return {
    saved: 0,
    target: 100_000,
    ratio: 0,
    missing: 100_000,
    state: 'onTrack',
    reachedOn: null,
    pace: 0.5,
    gap: 0,
    periodsLeft: 6,
    perPeriod: 16_667,
    daysLeft: 180,
    ...overrides,
  };
}

const item = (id: string, overrides: Partial<GoalProgress>) => ({
  id,
  progress: progress(overrides),
});

describe('rankGoal', () => {
  it('puts an expired goal on top, by what is missing', () => {
    expect(rankGoal(item('a', { state: 'expired', missing: 11_000 }))).toEqual({
      id: 'a',
      tier: 4,
      score: 11_000,
      margin: 5_000,
    });
  });

  it('then the goals behind, furthest behind first', () => {
    const ranked = rankGoal(item('b', { state: 'behind', gap: -20_000 }));
    expect(ranked.tier).toBe(3);
    expect(ranked.score).toBeCloseTo(0.2, 10);
  });

  it('then those on track, least ahead first, then those without a deadline, lowest first', () => {
    expect(rankGoal(item('c', { state: 'onTrack', gap: 10_000 }))).toMatchObject({
      tier: 2,
      score: -0.1,
    });
    expect(rankGoal(item('d', { state: 'open', ratio: 0.3 }))).toMatchObject({
      tier: 1,
      score: -0.3,
    });
  });

  it('keeps the reached ones last, the most recent first', () => {
    expect(rankGoal(item('e', { state: 'reached', reachedOn: '2026-09-20' }))).toMatchObject({
      tier: 0,
      score: 20260920,
    });
  });
});
