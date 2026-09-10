import { describe, expect, it } from 'vitest';
import { budgetRange, isoWeekRange, yearRange } from './budgetRanges';

const APRIL = { start: '2026-03-27', end: '2026-04-26' };

describe('isoWeekRange', () => {
  it('runs Monday to Sunday around the given date', () => {
    // 2026-04-18 is a Saturday.
    expect(isoWeekRange('2026-04-18')).toEqual({ start: '2026-04-13', end: '2026-04-19' });
  });

  it('keeps a Monday and a Sunday inside their own week', () => {
    expect(isoWeekRange('2026-04-13')).toEqual({ start: '2026-04-13', end: '2026-04-19' });
    expect(isoWeekRange('2026-04-19')).toEqual({ start: '2026-04-13', end: '2026-04-19' });
  });

  it('crosses months and years', () => {
    expect(isoWeekRange('2026-01-01')).toEqual({ start: '2025-12-29', end: '2026-01-04' });
  });
});

describe('yearRange', () => {
  it('is the calendar year of the date', () => {
    expect(yearRange('2026-04-18')).toEqual({ start: '2026-01-01', end: '2026-12-31' });
  });
});

describe('budgetRange', () => {
  it('is the selected cycle for a cycle budget', () => {
    expect(budgetRange('cycle', APRIL, '2026-04-18')).toEqual(APRIL);
  });

  it('is the week containing today when the cycle is the current one', () => {
    expect(budgetRange('week', APRIL, '2026-04-18')).toEqual({
      start: '2026-04-13',
      end: '2026-04-19',
    });
  });

  it('is the last week of a past cycle, clipped to the cycle', () => {
    // §5.8: for past cycles, the week budget shows that cycle's last week.
    expect(budgetRange('week', APRIL, '2026-06-01')).toEqual({
      start: '2026-04-20',
      end: '2026-04-26',
    });
  });

  it('is the calendar year of the cycle end for a year budget', () => {
    expect(budgetRange('year', APRIL, '2026-04-18')).toEqual({
      start: '2026-01-01',
      end: '2026-12-31',
    });
    expect(budgetRange('year', { start: '2025-12-27', end: '2026-01-26' }, '2026-01-05')).toEqual({
      start: '2026-01-01',
      end: '2026-12-31',
    });
  });
});
