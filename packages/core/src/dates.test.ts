import { describe, expect, it } from 'vitest';
import { addDays, addMonths, daysInMonth, diffDays, isLocalDate, todayLocal } from './dates';

describe('daysInMonth', () => {
  it('handles 28, 29, 30 and 31 day months', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });
});

describe('isLocalDate / parseLocalDate / makeLocalDate', () => {
  it('accepts real dates and rejects impossible ones', () => {
    expect(isLocalDate('2026-04-18')).toBe(true);
    expect(isLocalDate('2026-02-29')).toBe(false);
    expect(isLocalDate('2026-02-30')).toBe(false);
    expect(isLocalDate('2026-4-18')).toBe(false);
    expect(isLocalDate('2026-13-01')).toBe(false);
    expect(isLocalDate('yesterday')).toBe(false);
  });
});

describe('addDays / diffDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-03-31', 1)).toBe('2026-04-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('counts days between dates', () => {
    expect(diffDays('2026-03-27', '2026-04-26')).toBe(30);
    expect(diffDays('2026-04-26', '2026-03-27')).toBe(-30);
    expect(diffDays('2026-04-18', '2026-04-18')).toBe(0);
  });
});

describe('addMonths', () => {
  it('wraps years in both directions', () => {
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(addMonths({ year: 2025, month: 12 }, 1)).toEqual({ year: 2026, month: 1 });
    expect(addMonths({ year: 2026, month: 3 }, -14)).toEqual({ year: 2025, month: 1 });
  });
});

describe('todayLocal', () => {
  it('uses the local calendar day of the given instant', () => {
    expect(todayLocal(new Date(2026, 3, 18, 23, 59))).toBe('2026-04-18');
    expect(todayLocal(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });
});
