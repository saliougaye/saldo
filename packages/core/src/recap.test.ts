import { describe, expect, it } from 'vitest';
import type { PeriodDef } from './period';
import { recapPeriod } from './recap';

describe('recapPeriod', () => {
  it('is the period before the one containing today, for every kind', () => {
    const month: PeriodDef = { kind: 'month', startDay: 1 };
    const week: PeriodDef = { kind: 'week', startDay: 1 };
    const cycle: PeriodDef = { kind: 'cycle', startDay: 27 };
    const year: PeriodDef = { kind: 'year', startDay: 1 };
    expect(recapPeriod(month, '2026-10-01')).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(recapPeriod(month, '2026-10-19')).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(recapPeriod(week, '2026-10-05')).toEqual({ start: '2026-09-28', end: '2026-10-04' });
    expect(recapPeriod(cycle, '2026-04-27')).toEqual({ start: '2026-03-27', end: '2026-04-26' });
    expect(recapPeriod(year, '2027-01-01')).toEqual({ start: '2026-01-01', end: '2026-12-31' });
  });
});
