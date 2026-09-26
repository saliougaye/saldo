import { describe, expect, it } from 'vitest';
import {
  canShiftPeriod,
  currentPeriod,
  describePeriod,
  isPeriodKind,
  PERIOD_KINDS,
  type PeriodDef,
  periodContaining,
  periodLength,
  previousPeriods,
  shiftPeriod,
} from './period';

const month: PeriodDef = { kind: 'month', startDay: 1 };
const week: PeriodDef = { kind: 'week', startDay: 1 };
const cycle: PeriodDef = { kind: 'cycle', startDay: 27 };
const year: PeriodDef = { kind: 'year', startDay: 1 };

describe('periodContaining', () => {
  it('spans the calendar month', () => {
    expect(periodContaining(month, '2026-09-10')).toEqual({
      start: '2026-09-01',
      end: '2026-09-30',
    });
    // February in a leap year, because that is where off-by-one lives.
    expect(periodContaining(month, '2028-02-15')).toEqual({
      start: '2028-02-01',
      end: '2028-02-29',
    });
  });

  it('spans the ISO week, Monday to Sunday', () => {
    // 2026-09-10 is a Thursday.
    expect(periodContaining(week, '2026-09-10')).toEqual({
      start: '2026-09-07',
      end: '2026-09-13',
    });
    // A Sunday belongs to the week that started six days earlier, not the next one.
    expect(periodContaining(week, '2026-09-13')).toEqual({
      start: '2026-09-07',
      end: '2026-09-13',
    });
  });

  it('spans the pay cycle from its start day', () => {
    expect(periodContaining(cycle, '2026-09-10')).toEqual({
      start: '2026-08-27',
      end: '2026-09-26',
    });
    expect(periodContaining(cycle, '2026-09-27')).toEqual({
      start: '2026-09-27',
      end: '2026-10-26',
    });
  });

  it('spans the calendar year', () => {
    expect(periodContaining(year, '2026-09-10')).toEqual({
      start: '2026-01-01',
      end: '2026-12-31',
    });
  });
});

describe('shiftPeriod', () => {
  it('steps a month at a time, keeping month boundaries', () => {
    const september = periodContaining(month, '2026-09-10');
    expect(shiftPeriod(month, september, -1)).toEqual({ start: '2026-08-01', end: '2026-08-31' });
    expect(shiftPeriod(month, september, 1)).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    // Two steps back from March lands on January, not on "60 days earlier".
    const march = periodContaining(month, '2026-03-15');
    expect(shiftPeriod(month, march, -2)).toEqual({ start: '2026-01-01', end: '2026-01-31' });
  });

  it('steps a week at a time', () => {
    const current = periodContaining(week, '2026-09-10');
    expect(shiftPeriod(week, current, -1)).toEqual({ start: '2026-08-31', end: '2026-09-06' });
    expect(shiftPeriod(week, current, 2)).toEqual({ start: '2026-09-21', end: '2026-09-27' });
  });

  it('steps a cycle at a time, from the cycle the day actually falls in', () => {
    const def: PeriodDef = { kind: 'cycle', startDay: 28 };
    // 15 March is inside the cycle that opened on 28 February, not the one opening 28 March.
    expect(periodContaining(def, '2026-03-15')).toEqual({
      start: '2026-02-28',
      end: '2026-03-27',
    });
    const current = periodContaining(def, '2026-03-15');
    expect(shiftPeriod(def, current, -1).start).toBe('2026-01-28');
    expect(shiftPeriod(def, current, 1)).toEqual({ start: '2026-03-28', end: '2026-04-27' });
  });

  it('steps a year at a time', () => {
    const current = periodContaining(year, '2026-09-10');
    expect(shiftPeriod(year, current, -1)).toEqual({ start: '2025-01-01', end: '2025-12-31' });
  });

  it('is reversible for every kind', () => {
    for (const def of [month, week, cycle, year]) {
      const current = periodContaining(def, '2026-09-10');
      expect(shiftPeriod(def, shiftPeriod(def, current, -3), 3)).toEqual(current);
    }
  });
});

describe('previousPeriods', () => {
  it('walks back one step at a time, newest first', () => {
    const current = periodContaining(month, '2026-09-10');
    expect(previousPeriods(month, current, 3).map((range) => range.start)).toEqual([
      '2026-08-01',
      '2026-07-01',
      '2026-06-01',
    ]);
  });

  it('returns nothing for a count of zero', () => {
    expect(previousPeriods(month, periodContaining(month, '2026-09-10'), 0)).toEqual([]);
  });
});

describe('periodLength', () => {
  it('counts the days a range covers, inclusive', () => {
    expect(periodLength(periodContaining(month, '2026-09-10'))).toBe(30);
    expect(periodLength(periodContaining(week, '2026-09-10'))).toBe(7);
    expect(periodLength(periodContaining(cycle, '2026-09-10'))).toBe(31);
    expect(periodLength(periodContaining(year, '2026-09-10'))).toBe(365);
    expect(periodLength(periodContaining(year, '2028-06-01'))).toBe(366);
  });
});

describe('currentPeriod and describePeriod', () => {
  it('describes the period around a day', () => {
    const current = currentPeriod(cycle, '2026-09-10');
    expect(current).toMatchObject({ isCurrent: true, elapsed: 15, length: 31 });
    expect(current.range).toEqual({ start: '2026-08-27', end: '2026-09-26' });
  });

  it('reports a closed period as fully elapsed', () => {
    const previous = shiftPeriod(month, periodContaining(month, '2026-09-10'), -1);
    const described = describePeriod(previous, '2026-09-10');
    expect(described).toMatchObject({ isCurrent: false, elapsed: 31, length: 31 });
  });

  it('reports a future period as not current', () => {
    const next = shiftPeriod(month, periodContaining(month, '2026-09-10'), 1);
    expect(describePeriod(next, '2026-09-10').isCurrent).toBe(false);
  });
});

describe('isPeriodKind', () => {
  it('guards a value read back from the database', () => {
    expect([...PERIOD_KINDS]).toEqual(['month', 'week', 'cycle', 'year']);
    expect(isPeriodKind('month')).toBe(true);
    expect(isPeriodKind('fortnight')).toBe(false);
  });
});

describe('canShiftPeriod', () => {
  const cycle: PeriodDef = { kind: 'cycle', startDay: 27 };
  const today = '2026-09-11';
  const current = periodContaining(cycle, today);

  it('always allows going back: that is history, and it happened', () => {
    expect(canShiftPeriod(cycle, current, -1, today)).toBe(true);
    expect(canShiftPeriod(cycle, shiftPeriod(cycle, current, -12), -1, today)).toBe(true);
  });

  it('stops at the current period: what comes next is «In arrivo» and the forecast', () => {
    expect(canShiftPeriod(cycle, current, 1, today)).toBe(false);
    expect(canShiftPeriod(cycle, current, 2, today)).toBe(false);
  });

  it('lets a browse from the past walk forward to that same limit', () => {
    const past = shiftPeriod(cycle, current, -6);
    expect(canShiftPeriod(cycle, past, 1, today)).toBe(true);
    expect(canShiftPeriod(cycle, past, 6, today)).toBe(true);
    expect(canShiftPeriod(cycle, past, 7, today)).toBe(false);
  });

  it('holds for every period kind', () => {
    for (const kind of ['month', 'week', 'year'] as const) {
      const def: PeriodDef = { kind, startDay: 1 };
      const now = periodContaining(def, today);
      expect(canShiftPeriod(def, shiftPeriod(def, now, -1), 1, today)).toBe(true);
      expect(canShiftPeriod(def, now, 1, today)).toBe(false);
    }
  });
});
