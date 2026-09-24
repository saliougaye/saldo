import { describe, expect, it } from 'vitest';
import type { GoalProgress } from './goals';
import { goalAdvice, goalCardStatus, goalEventIds, rankGoal } from './goalTargets';

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

describe('goalEventIds', () => {
  it('lists expired goals, then reached ones, most recent first, featured left out, three at most', () => {
    const items = [
      item('exp1', { state: 'expired', missing: 5_000 }),
      item('exp2', { state: 'expired', missing: 9_000 }),
      item('old', { state: 'reached', reachedOn: '2026-09-02' }),
      item('new', { state: 'reached', reachedOn: '2026-09-20' }),
      item('behind', { state: 'behind', gap: -1 }),
    ];
    expect(goalEventIds(items, 'exp2')).toEqual(['exp1', 'new', 'old']);
    expect(goalEventIds(items, null)).toEqual(['exp2', 'exp1', 'new']);
  });
});

describe('goalCardStatus', () => {
  it('counts expired, behind and reached goals', () => {
    expect(
      goalCardStatus([
        item('a', { state: 'expired' }),
        item('b', { state: 'behind' }),
        item('c', { state: 'reached' }),
        item('d', { state: 'onTrack' }),
      ]),
    ).toEqual({ expired: 1, behind: 1, reached: 1 });
  });
});

describe('goalAdvice', () => {
  it('asks for an amount per period while there are several left', () => {
    expect(goalAdvice(progress({ state: 'behind', gap: -43_600, perPeriod: 73_100 }))).toEqual({
      kind: 'perPeriod',
      perPeriod: 73_100,
      gap: 43_600,
      behind: true,
    });
  });

  it('counts days on the last period', () => {
    expect(goalAdvice(progress({ periodsLeft: 1, missing: 25_000, daysLeft: 21 }))).toEqual({
      kind: 'lastPeriod',
      missing: 25_000,
      days: 21,
    });
  });

  it('only says what is missing without a deadline', () => {
    expect(goalAdvice(progress({ state: 'open', missing: 350_000 }))).toEqual({
      kind: 'noDeadline',
      missing: 350_000,
    });
  });

  it('says what is missing past the deadline, and what was reached', () => {
    expect(goalAdvice(progress({ state: 'expired', missing: 11_000 }))).toEqual({
      kind: 'expired',
      missing: 11_000,
    });
    expect(goalAdvice(progress({ state: 'reached', target: 120_000 }))).toEqual({
      kind: 'reached',
      target: 120_000,
    });
  });
});
