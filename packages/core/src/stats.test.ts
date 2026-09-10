import { describe, expect, it } from 'vitest';
import { APRIL_CYCLE, aprilTransactions, TODAY } from './__tests__/fixtures';
import {
  averageSeries,
  committedSpend,
  dailyCumulative,
  deltaPercent,
  mean,
  median,
  projectEndOfCycle,
  resampleSeries,
  upcomingExpenses,
} from './stats';

describe('median', () => {
  it('handles odd, even and empty inputs', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe('mean', () => {
  it('rounds the arithmetic mean and rejects an empty series', () => {
    expect(mean([100, 200, 301])).toBe(200);
    expect(mean([1, 2])).toBe(2);
    expect(mean([])).toBeNull();
  });
});

describe('deltaPercent', () => {
  it('returns rounded change or null without baseline', () => {
    expect(deltaPercent(110, 100)).toBe(10);
    expect(deltaPercent(90, 100)).toBe(-10);
    expect(deltaPercent(5, null)).toBeNull();
    expect(deltaPercent(5, 0)).toBeNull();
  });
});

describe('dailyCumulative', () => {
  it('accumulates counted expenses for each elapsed day', () => {
    const series = dailyCumulative(aprilTransactions(), APRIL_CYCLE, TODAY);
    expect(series).toHaveLength(23);
    expect(series[0]).toBe(84240);
    expect(series[5]).toBe(84240);
    expect(series[6]).toBe(86240);
    expect(series[22]).toBe(86240);
  });
});

describe('resampleSeries / averageSeries', () => {
  it('resamples by nearest index', () => {
    expect(resampleSeries([0, 10, 20], 5)).toEqual([0, 10, 10, 20, 20]);
    expect(resampleSeries([7], 3)).toEqual([7, 7, 7]);
    expect(resampleSeries([1, 2, 3], 1)).toEqual([3]);
    expect(resampleSeries([], 2)).toEqual([0, 0]);
    expect(resampleSeries([1], 0)).toEqual([]);
  });

  it('averages resampled series', () => {
    expect(
      averageSeries(
        [
          [0, 10, 20],
          [0, 20, 40],
        ],
        3,
      ),
    ).toEqual([0, 15, 30]);
    expect(averageSeries([], 2)).toEqual([0, 0]);
  });
});

describe('committedSpend / upcomingExpenses / projectEndOfCycle', () => {
  it('computes committed and upcoming amounts', () => {
    expect(committedSpend(aprilTransactions(), APRIL_CYCLE, TODAY)).toBe(78000);
    expect(upcomingExpenses(aprilTransactions(), APRIL_CYCLE, TODAY)).toBe(7800);
  });

  it('projects the end of cycle from the discretionary pace', () => {
    expect(
      projectEndOfCycle({
        spent: 86240,
        committed: 78000,
        elapsed: 23,
        length: 31,
        upcoming: 7800,
      }),
    ).toBe(96906);
  });

  it('does not divide by zero before the cycle starts', () => {
    expect(
      projectEndOfCycle({ spent: 0, committed: 0, elapsed: 0, length: 31, upcoming: 500 }),
    ).toBe(500);
  });
});
