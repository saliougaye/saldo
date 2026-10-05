import { describe, expect, it } from 'vitest';
import { tx } from './__tests__/fixtures';
import { type GoalAccount, goalProgress, goalRatio } from './goals';
import type { PeriodDef } from './period';

const MONTH: PeriodDef = { kind: 'month', startDay: 1 };

const goal = (overrides: Partial<GoalAccount> = {}): GoalAccount => ({
  id: 'goal',
  openingBalance: 0,
  goalTarget: 1_300_000,
  goalDeadline: '2026-12-31',
  goalStartDate: '2026-01-01',
  ...overrides,
});

const into = (date: string, amount: number) =>
  tx({
    date,
    amount,
    kind: 'transfer',
    accountId: 'checking',
    toAccountId: 'goal',
    categoryId: null,
  });
const out = (date: string, amount: number) =>
  tx({
    date,
    amount,
    kind: 'transfer',
    accountId: 'goal',
    toAccountId: 'checking',
    categoryId: null,
  });

describe('goalProgress', () => {
  it('saves what went in, minus what went out and what was spent, up to today', () => {
    const progress = goalProgress(
      goal(),
      [
        into('2026-01-01', 100_000),
        into('2026-03-01', 500_000),
        out('2026-04-01', 20_000),
        tx({ date: '2026-05-01', amount: 30_000, accountId: 'goal', categoryId: 'cat-home' }),
        into('2026-08-01', 99_000),
      ],
      '2026-07-02',
      MONTH,
    );
    expect(progress.saved).toBe(550_000);
    expect(progress.missing).toBe(750_000);
  });

  it('measures the pace from what was already aside on the first day', () => {
    // Day 183 of 365; 100 000 aside at the start, 1 300 000 by the end: 701 643.8 expected.
    const progress = goalProgress(
      goal(),
      [into('2026-01-01', 100_000), into('2026-03-01', 500_000)],
      '2026-07-02',
      MONTH,
    );
    expect(progress.pace).toBeCloseTo(183 / 365, 10);
    expect(progress.gap).toBe(-101_644);
    expect(progress.state).toBe('behind');
  });

  it('does not read a goal created with money already aside as far ahead', () => {
    const progress = goalProgress(
      goal({ goalStartDate: '2026-07-01', goalTarget: 1_200_000 }),
      [into('2026-07-01', 600_000)],
      '2026-07-02',
      MONTH,
    );
    // Day 2 of 184 from 600 000 towards 1 200 000.
    expect(progress.gap).toBe(-6_522);
  });

  it('is not behind on its first day, nor until it misses more than one period’s share', () => {
    const created = goalProgress(
      goal({ goalStartDate: '2026-07-01', goalTarget: 1_200_000 }),
      [into('2026-07-01', 600_000)],
      '2026-07-01',
      MONTH,
    );
    expect(created.state).toBe('onTrack');
    // Six months to go: one period's share is 100 000. 6 522 behind the pace is still on track.
    const nextDay = goalProgress(
      goal({ goalStartDate: '2026-07-01', goalTarget: 1_200_000 }),
      [into('2026-07-01', 600_000)],
      '2026-07-02',
      MONTH,
    );
    expect(nextDay.state).toBe('onTrack');
  });

  it('asks for the rest spread over the periods left, current one included, rounding up', () => {
    const progress = goalProgress(
      goal(),
      [into('2026-01-01', 100_000), into('2026-03-01', 500_000)],
      '2026-07-02',
      MONTH,
    );
    expect(progress.periodsLeft).toBe(6);
    expect(progress.perPeriod).toBe(116_667);
  });

  it('counts days instead once the deadline is in the current period', () => {
    const progress = goalProgress(
      goal({ goalDeadline: '2026-07-20' }),
      [into('2026-01-01', 100_000)],
      '2026-07-02',
      MONTH,
    );
    expect(progress.periodsLeft).toBe(1);
    // Today and the deadline both count, as a budget's days do.
    expect(progress.daysLeft).toBe(19);
  });

  it('has no pace and no advice per period without a deadline', () => {
    const progress = goalProgress(
      goal({ goalDeadline: null }),
      [into('2026-01-01', 100_000)],
      '2026-07-02',
      MONTH,
    );
    expect(progress.state).toBe('open');
    expect(progress.pace).toBeNull();
    expect(progress.gap).toBeNull();
    expect(progress.perPeriod).toBeNull();
  });

  it('expires a goal past its deadline that is not reached', () => {
    const progress = goalProgress(
      goal({ goalDeadline: '2026-06-30' }),
      [into('2026-01-01', 100_000)],
      '2026-07-02',
      MONTH,
    );
    expect(progress.state).toBe('expired');
  });

  it('dates the reach to the first day of the latest run at or above the target', () => {
    const progress = goalProgress(
      goal({ goalTarget: 300_000 }),
      [into('2026-03-10', 300_000), out('2026-04-01', 50_000), into('2026-05-05', 60_000)],
      '2026-07-02',
      MONTH,
    );
    expect(progress.state).toBe('reached');
    expect(progress.reachedOn).toBe('2026-05-05');
    expect(progress.ratio).toBe(1);
  });
});

describe('goalRatio', () => {
  it('never leaves 0..1: a goal past its target is full, a negative balance empty', () => {
    expect(goalRatio(150000, 100000)).toBe(1);
    expect(goalRatio(-2000, 100000)).toBe(0);
  });

  it('is 0 for a pocket with no target, rather than dividing by zero', () => {
    expect(goalRatio(25000, 0)).toBe(0);
  });
});
