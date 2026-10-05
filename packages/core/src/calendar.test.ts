import { describe, expect, it } from 'vitest';
import { monthGrid } from './calendar';

describe('monthGrid', () => {
  it('starts on the first day of the week containing the 1st', () => {
    // 1 September 2026 is a Tuesday, so a Monday-first grid opens on 31 August.
    expect(monthGrid({ year: 2026, month: 9 }, 'monday')[0]?.[0]).toEqual({
      date: '2026-08-31',
      inMonth: false,
    });
    expect(monthGrid({ year: 2026, month: 9 }, 'sunday')[0]?.[0]).toEqual({
      date: '2026-08-30',
      inMonth: false,
    });
  });

  it('marks exactly the days of the month as in-month, and runs unbroken', () => {
    const days = monthGrid({ year: 2026, month: 2 }, 'monday').flat();
    expect(days.filter((day) => day.inMonth).map((day) => day.date)).toEqual(
      Array.from({ length: 28 }, (_, index) => `2026-02-${String(index + 1).padStart(2, '0')}`),
    );
    for (let index = 1; index < days.length; index += 1) {
      const previous = days[index - 1]?.date ?? '';
      const current = days[index]?.date ?? '';
      expect(previous < current).toBe(true);
    }
  });

  it('crosses a year boundary without losing a day', () => {
    const days = monthGrid({ year: 2025, month: 12 }, 'monday').flat();
    expect(days[0]?.date).toBe('2025-12-01');
    expect(days.at(-1)?.date).toBe('2026-01-11');
  });
});
