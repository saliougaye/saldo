import { describe, expect, it } from 'vitest';
import { emptyUserData } from '../userData';
import { CONTEXT, cycleData, fixtureData } from './__fixtures__/userData';
import { isWholePeriod, resolveToolPeriod, toolPeriodInput } from './period';

const MONTH = { kind: 'month', startDay: 27 } as const;

describe('toolPeriodInput', () => {
  it.each([
    {},
    { period: 'current' },
    { period: 'previous' },
    { period: '2026-03-10' },
    { from: '2026-09-01', to: '2026-09-10' },
    { from: '2026-09-01', to: '2026-09-01' },
  ])('accepts %j', (value) => {
    expect(toolPeriodInput.safeParse(value).success).toBe(true);
  });

  it.each([
    { period: 'last' },
    { period: '2026-02-30' },
    { from: '2026-09-01' },
    { to: '2026-09-01' },
    { period: 'current', from: '2026-09-01', to: '2026-09-10' },
    { from: '2026-09-10', to: '2026-09-01' },
  ])('refuses %j', (value) => {
    expect(toolPeriodInput.safeParse(value).success).toBe(false);
  });
});

describe('resolveToolPeriod', () => {
  it('reads the current period by default', () => {
    expect(resolveToolPeriod({}, fixtureData(), CONTEXT)).toEqual({
      start: '2026-09-01',
      end: '2026-09-30',
    });
  });

  it('steps back one period for "previous"', () => {
    expect(resolveToolPeriod({ period: 'previous' }, fixtureData(), CONTEXT)).toEqual({
      start: '2026-08-01',
      end: '2026-08-31',
    });
  });

  it('reads the period around a date, as `?p=` does', () => {
    expect(resolveToolPeriod({ period: '2026-03-10' }, fixtureData(), CONTEXT)).toEqual({
      start: '2026-03-01',
      end: '2026-03-31',
    });
  });

  it('does not clamp a date ahead of today: scheduled rows live there', () => {
    expect(resolveToolPeriod({ period: '2026-10-20' }, fixtureData(), CONTEXT)).toEqual({
      start: '2026-10-01',
      end: '2026-10-31',
    });
  });

  it('takes an explicit range as it is', () => {
    expect(
      resolveToolPeriod({ from: '2026-09-01', to: '2026-09-10' }, fixtureData(), CONTEXT),
    ).toEqual({ start: '2026-09-01', end: '2026-09-10' });
  });

  it('moves with the cycle day', () => {
    const data = cycleData();
    expect(resolveToolPeriod({}, data, CONTEXT)).toEqual({
      start: '2026-08-27',
      end: '2026-09-26',
    });
    expect(resolveToolPeriod({ period: 'previous' }, data, CONTEXT)).toEqual({
      start: '2026-07-27',
      end: '2026-08-26',
    });
    expect(resolveToolPeriod({ period: '2026-09-30' }, data, CONTEXT)).toEqual({
      start: '2026-09-27',
      end: '2026-10-26',
    });
  });

  it('falls back to calendar months before onboarding', () => {
    expect(resolveToolPeriod({}, emptyUserData(), CONTEXT)).toEqual({
      start: '2026-09-01',
      end: '2026-09-30',
    });
  });
});

describe('isWholePeriod', () => {
  it('knows an app period from an arbitrary range', () => {
    expect(isWholePeriod(MONTH, { start: '2026-09-01', end: '2026-09-30' })).toBe(true);
    expect(isWholePeriod(MONTH, { start: '2026-09-01', end: '2026-09-10' })).toBe(false);
    expect(isWholePeriod(MONTH, { start: '2026-09-02', end: '2026-10-01' })).toBe(false);
  });
});
