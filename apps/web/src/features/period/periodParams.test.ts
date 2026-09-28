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

  it('says how far ahead a period is: never, by default', () => {
    expect(periodFromParam(def, today, undefined).ahead).toBe(0);
    expect(periodFromParam(def, today, '2026-07-14').ahead).toBe(0);
    expect(periodFromParam(def, today, '2026-10-02').ahead).toBe(0);
  });

  it('reaches as many periods ahead as it is allowed, and says which one it is', () => {
    const october = periodFromParam(def, today, '2026-10-02', 3);
    expect(october.range.start).toBe('2026-10-01');
    expect(october.ahead).toBe(1);
    // A future period is not a closed one: `isCurrent` alone would say it is.
    expect(october.isCurrent).toBe(false);
    expect(periodFromParam(def, today, '2026-12-31', 3).ahead).toBe(3);
  });

  it('falls back to the current period past the periods it may reach', () => {
    const tooFar = periodFromParam(def, today, '2027-01-05', 3);
    expect(tooFar.range.start).toBe('2026-09-01');
    expect(tooFar.ahead).toBe(0);
    // No forecast (too little history) means nothing ahead to reach.
    expect(periodFromParam(def, today, '2026-10-02', 0).range.start).toBe('2026-09-01');
  });

  it('still reads the past with a reach ahead', () => {
    const july = periodFromParam(def, today, '2026-07-14', 3);
    expect(july.range.start).toBe('2026-07-01');
    expect(july.ahead).toBe(0);
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

  it('steps into the periods ahead as far as it is allowed, and no further', () => {
    const current = periodFromParam(def, today, undefined).range;
    expect(periodSteps(def, current, today, '/stats', {}, 3).next).toBe('/stats?p=2026-10-01');
    const december = { start: '2026-12-01', end: '2026-12-31' };
    expect(periodSteps(def, december, today, '/stats', {}, 3).next).toBeNull();
    const november = { start: '2026-11-01', end: '2026-11-30' };
    expect(periodSteps(def, november, today, '/stats', {}, 3).next).toBe('/stats?p=2026-12-01');
    expect(periodSteps(def, november, today, '/stats', {}, 3).previous).toBe('/stats?p=2026-10-01');
  });

  it('agrees with `periodFromParam` on every period it links to', () => {
    // The › and a click on a column must reach the same periods: each `next` must read back as
    // itself, and the last one reachable must offer no `next`.
    let range = periodFromParam(def, today, undefined).range;
    for (let step = 0; step < 3; step += 1) {
      const next = periodSteps(def, range, today, '/stats', {}, 3).next;
      expect(next).not.toBeNull();
      const param = new URL(next ?? '', 'http://x').searchParams.get('p') ?? undefined;
      const read = periodFromParam(def, today, param, 3);
      expect(read.ahead).toBe(step + 1);
      range = read.range;
    }
    expect(periodSteps(def, range, today, '/stats', {}, 3).next).toBeNull();
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
