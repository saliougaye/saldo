import { emptyUserData, type Settings, type UserData } from '@saldo/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { narrowParams, pageState, readPage } from './context';

// `readPage` is the request's own code (a session, a database, Next's `redirect`): these stand in
// for them, so the one thing under test is what it does with a projection that has no settings.
const loaded = vi.hoisted(() => ({ data: null as UserData | null }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));
vi.mock('../auth/currentUser', () => ({
  requireWebUser: async () => ({ id: 'user-1', displayName: 'Ada', email: 'ada@example.com' }),
}));
vi.mock('../userData/load', () => ({
  loadUserData: async () => loaded.data,
}));
vi.mock('../../i18n/server', () => ({
  userI18n: async () => ({ locale: 'it', t: (key: string) => key }),
}));
vi.mock('../env', () => ({ env: () => ({ defaultTimeZone: 'Europe/Rome' }) }));

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

describe('readPage', () => {
  beforeEach(() => {
    loaded.data = null;
  });

  it('sends an account that has never onboarded to /onboarding (§17.1.2)', async () => {
    loaded.data = { ...data, settings: null };
    await expect(readPage(Promise.resolve({}))).rejects.toThrow('redirect:/onboarding');
  });

  it('renders an onboarded account', async () => {
    loaded.data = { ...data, settings: settingsRow({ currency: 'SEK' }) };
    const page = await readPage(Promise.resolve({ q: ['bar', 'baz'] }));
    expect(page.onboarded).toBe(true);
    expect(page.currency).toBe('SEK');
    expect(page.params.q).toBe('bar');
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
