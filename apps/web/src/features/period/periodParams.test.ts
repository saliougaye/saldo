import type { PeriodDef } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { periodFromParam, periodHref, periodSteps } from './periodParams';

const def: PeriodDef = { kind: 'month', startDay: 1 };
const today = '2026-09-28';

describe('periodFromParam', () => {
  it('is the period containing today when the URL says nothing', () => {
    expect(periodFromParam(def, today, undefined).range).toEqual({
      start: '2026-09-01',
      end: '2026-09-30',
    });
  });

  it('is the period containing the date in the URL, not the date itself', () => {
    // A link built from a row's date lands on that row's period.
    expect(periodFromParam(def, today, '2026-07-14').range).toEqual({
      start: '2026-07-01',
      end: '2026-07-31',
    });
  });

  it('ignores a parameter that is not a date, rather than throwing on a hand-typed URL', () => {
    expect(periodFromParam(def, today, 'last-month').range.start).toBe('2026-09-01');
    expect(periodFromParam(def, today, '2026-13-99').range.start).toBe('2026-09-01');
  });

  it('describes a closed period as closed, and the running one as current', () => {
    expect(periodFromParam(def, today, '2026-07-14').isCurrent).toBe(false);
    expect(periodFromParam(def, today, undefined).isCurrent).toBe(true);
  });

  it('refuses a period after the current one, as the phone’s navigation does', () => {
    expect(periodFromParam(def, today, '2026-11-02').range.start).toBe('2026-09-01');
  });
});

describe('periodSteps', () => {
  it('always offers the period before', () => {
    const steps = periodSteps(def, periodFromParam(def, today, undefined).range, today, '/home');
    expect(steps.previous).toBe('/home?p=2026-08-01');
  });

  it('offers no period after the current one', () => {
    const steps = periodSteps(def, periodFromParam(def, today, undefined).range, today, '/home');
    expect(steps.next).toBeNull();
  });

  it('offers the next period while reading a closed one', () => {
    const steps = periodSteps(def, { start: '2026-07-01', end: '2026-07-31' }, today, '/home');
    expect(steps.next).toBe('/home?p=2026-08-01');
    expect(steps.previous).toBe('/home?p=2026-06-01');
  });

  it('keeps the other parameters of the page it is on', () => {
    const steps = periodSteps(
      def,
      { start: '2026-07-01', end: '2026-07-31' },
      today,
      '/transactions',
      {
        direction: 'expense',
        q: 'bar',
      },
    );
    expect(steps.next).toBe('/transactions?direction=expense&q=bar&p=2026-08-01');
  });
});

describe('periodHref', () => {
  it('drops the parameter for the current period, so the plain URL is the live one', () => {
    expect(periodHref('/home', { start: '2026-09-01', end: '2026-09-30' }, def, today)).toBe(
      '/home',
    );
  });

  it('names the start of any other period', () => {
    expect(periodHref('/home', { start: '2026-07-01', end: '2026-07-31' }, def, today)).toBe(
      '/home?p=2026-07-01',
    );
  });
});
