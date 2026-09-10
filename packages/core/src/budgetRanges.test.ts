import { describe, expect, it } from 'vitest';
import { budgetRange } from './budgetRanges';
import { isoWeekRange, yearRange } from './period';

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
  it('is the selected period for a budget that follows it', () => {
    expect(budgetRange('period', APRIL, '2026-04-18')).toEqual(APRIL);
  });

  it('is the calendar month around the reference day for a month budget', () => {
    // The period is a pay cycle straddling two months; the budget still measures April.
    expect(budgetRange('month', APRIL, '2026-04-18')).toEqual({
      start: '2026-04-01',
      end: '2026-04-30',
    });
    // Browsing a closed period: the month of its end, and not clipped to the period.
    expect(budgetRange('month', APRIL, '2026-06-01')).toEqual({
      start: '2026-04-01',
      end: '2026-04-30',
    });
  });

  it('is the week containing today when the period is the current one', () => {
    expect(budgetRange('week', APRIL, '2026-04-18')).toEqual({
      start: '2026-04-13',
      end: '2026-04-19',
    });
  });

  it('is the last week of a closed period, clipped to it', () => {
    // §5.8: for a closed period, the week budget shows that period's last week.
    expect(budgetRange('week', APRIL, '2026-06-01')).toEqual({
      start: '2026-04-20',
      end: '2026-04-26',
    });
  });

  it('is the calendar year around the reference day for a year budget', () => {
    expect(budgetRange('year', APRIL, '2026-04-18')).toEqual({
      start: '2026-01-01',
      end: '2026-12-31',
    });
    expect(budgetRange('year', { start: '2025-12-27', end: '2026-01-26' }, '2026-01-05')).toEqual({
      start: '2026-01-01',
      end: '2026-12-31',
    });
  });

  it('measures a period budget over a month period, and a week budget inside it', () => {
    const september = { start: '2026-09-01', end: '2026-09-30' };
    expect(budgetRange('period', september, '2026-09-10')).toEqual(september);
    // 2026-09-10 is a Thursday; its week runs Mon 7th to Sun 13th, inside September.
    expect(budgetRange('week', september, '2026-09-10')).toEqual({
      start: '2026-09-07',
      end: '2026-09-13',
    });
  });

  it('does not shrink a year budget to the period being browsed', () => {
    const september = { start: '2026-09-01', end: '2026-09-30' };
    // The whole point of an absolute window: browsing one month still measures the year.
    expect(budgetRange('year', september, '2026-09-10')).toEqual({
      start: '2026-01-01',
      end: '2026-12-31',
    });
  });

  it('keeps a week budget inside a closed week period', () => {
    const week = { start: '2026-08-31', end: '2026-09-06' };
    expect(budgetRange('week', week, '2026-09-10')).toEqual(week);
  });
});
