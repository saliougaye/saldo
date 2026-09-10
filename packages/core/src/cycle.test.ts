import { describe, expect, it } from 'vitest';
import {
  assertCycleStartDay,
  cycleContaining,
  cycleLength,
  elapsedDays,
  isWithin,
  previousCycles,
  shiftCycle,
} from './cycle';

const APRIL = { start: '2026-03-27', end: '2026-04-26' };

describe('cycleContaining', () => {
  it('starts in the previous month when the date is before the start day', () => {
    expect(cycleContaining('2026-04-18', 27)).toEqual(APRIL);
  });

  it('starts in the same month on or after the start day', () => {
    expect(cycleContaining('2026-04-27', 27)).toEqual({ start: '2026-04-27', end: '2026-05-26' });
  });

  it('matches calendar months when the start day is 1', () => {
    expect(cycleContaining('2026-04-18', 1)).toEqual({ start: '2026-04-01', end: '2026-04-30' });
  });

  it('crosses the year boundary', () => {
    expect(cycleContaining('2026-01-05', 27)).toEqual({ start: '2025-12-27', end: '2026-01-26' });
  });

  it('clamps the start day to short months', () => {
    expect(cycleContaining('2026-03-30', 31)).toEqual({ start: '2026-02-28', end: '2026-03-30' });
    expect(cycleContaining('2026-03-31', 31)).toEqual({ start: '2026-03-31', end: '2026-04-29' });
    expect(cycleContaining('2026-04-30', 31)).toEqual({ start: '2026-04-30', end: '2026-05-30' });
  });

  it('rejects invalid start days', () => {
    expect(() => cycleContaining('2026-04-18', 0)).toThrow(RangeError);
    expect(() => assertCycleStartDay(32)).toThrow(RangeError);
    expect(() => assertCycleStartDay(2.5)).toThrow(RangeError);
  });
});

describe('shiftCycle / previousCycles', () => {
  it('moves back and forward by whole cycles', () => {
    expect(shiftCycle(APRIL, 27, -1)).toEqual({ start: '2026-02-27', end: '2026-03-26' });
    expect(shiftCycle(APRIL, 27, 1)).toEqual({ start: '2026-04-27', end: '2026-05-26' });
    expect(shiftCycle(APRIL, 27, 0)).toEqual(APRIL);
  });

  it('keeps clamped cycles consistent', () => {
    const feb = cycleContaining('2026-03-01', 31);
    expect(feb).toEqual({ start: '2026-02-28', end: '2026-03-30' });
    expect(shiftCycle(feb, 31, 1)).toEqual({ start: '2026-03-31', end: '2026-04-29' });
  });

  it('lists previous cycles most recent first', () => {
    expect(previousCycles(APRIL, 27, 2)).toEqual([
      { start: '2026-02-27', end: '2026-03-26' },
      { start: '2026-01-27', end: '2026-02-26' },
    ]);
  });
});

describe('cycleLength / elapsedDays / isWithin', () => {
  it('computes length and elapsed days', () => {
    expect(cycleLength(APRIL)).toBe(31);
    expect(elapsedDays(APRIL, '2026-04-18')).toBe(23);
    expect(elapsedDays(APRIL, '2026-03-27')).toBe(1);
    expect(elapsedDays(APRIL, '2026-03-20')).toBe(0);
    expect(elapsedDays(APRIL, '2026-05-01')).toBe(31);
  });

  it('checks inclusive bounds', () => {
    expect(isWithin(APRIL, '2026-03-27')).toBe(true);
    expect(isWithin(APRIL, '2026-04-26')).toBe(true);
    expect(isWithin(APRIL, '2026-04-27')).toBe(false);
  });
});
