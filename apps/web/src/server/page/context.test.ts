import { emptyUserData, type Settings } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { narrowParams, pageState } from './context';

const data = emptyUserData();
const now = new Date('2026-09-28T09:00:00Z');

/** A complete, obviously-fake settings row: `UserData.settings` is the whole entity or null. */
function settingsRow(overrides: Partial<Settings>): Settings {
  return {
    id: 'settings',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '000000000000001-0000-dev',
    deletedAt: null,
    periodKind: 'month',
    cycleStartDay: 27,
    currency: 'EUR',
    language: 'system',
    theme: 'system',
    onboardingCompletedAt: '2026-09-01T10:00:00.000Z',
    timeZone: null,
    ...overrides,
  };
}

describe('pageState', () => {
  it('reads the period from the URL and describes it against today', () => {
    const state = pageState({
      data: { ...data, settings: null },
      now,
      fallbackTimeZone: 'Europe/Rome',
      params: { p: '2026-07-14' },
    });
    expect(state.today).toBe('2026-09-28');
    expect(state.period.range).toEqual({ start: '2026-07-01', end: '2026-07-31' });
    expect(state.period.isCurrent).toBe(false);
  });

  it('uses the account’s own settings for the period, the currency and the zone', () => {
    const state = pageState({
      data: {
        ...data,
        settings: settingsRow({
          periodKind: 'cycle',
          cycleStartDay: 27,
          currency: 'SEK',
          language: 'sv',
          theme: 'dark',
          timeZone: 'Europe/Stockholm',
        }),
      },
      now,
      fallbackTimeZone: 'UTC',
      params: {},
    });
    expect(state.def).toEqual({ kind: 'cycle', startDay: 27 });
    expect(state.currency).toBe('SEK');
    expect(state.timeZone).toBe('Europe/Stockholm');
  });

  it('says when the account has never onboarded, instead of inventing settings', () => {
    const state = pageState({
      data: { ...data, settings: null },
      now,
      fallbackTimeZone: 'Europe/Rome',
      params: {},
    });
    expect(state.onboarded).toBe(false);
    // The defaults still make the page renderable rather than blank.
    expect(state.currency).toBe('EUR');
    expect(state.def).toEqual({ kind: 'month', startDay: 27 });
  });
});

describe('narrowParams', () => {
  it('keeps the first value of a repeated parameter, and leaves a missing one undefined', () => {
    expect(narrowParams({ t: ['expense', 'income'], q: 'bar' })).toEqual({
      t: 'expense',
      q: 'bar',
    });
    expect(narrowParams({ q: undefined, t: [] }).q).toBeUndefined();
    expect(narrowParams({ t: [] }).t).toBeUndefined();
    expect(narrowParams({}).direction).toBeUndefined();
  });
});
