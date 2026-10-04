import { describe, expect, it } from 'vitest';
import { emptyUserData } from '../../userData';
import { CONTEXT, cycleData, fixtureData } from '../__fixtures__/userData';
import { getPreferencesTool } from './getPreferences';

describe('get_preferences', () => {
  it('tells today, the zone, the currency and the period bounds', () => {
    expect(getPreferencesTool.run(fixtureData(), CONTEXT, {})).toEqual({
      today: '2026-09-15',
      timeZone: 'Europe/Rome',
      onboarded: true,
      language: 'it',
      currency: 'EUR',
      currencyMinorDigits: 2,
      period: {
        kind: 'month',
        cycleStartDay: null,
        current: { start: '2026-09-01', end: '2026-09-30' },
        previous: { start: '2026-08-01', end: '2026-08-31' },
      },
      webApp: null,
    });
  });

  it('passes on the web app links the server knows, so a model can link a row', () => {
    const webApp = {
      url: 'https://saldo.example',
      transaction: 'https://saldo.example/transactions?t={id}',
      account: 'https://saldo.example/accounts?a={id}',
      goal: 'https://saldo.example/accounts?g={id}',
      budget: 'https://saldo.example/profile/budgets?b={id}',
      category: 'https://saldo.example/profile/categories?c={id}',
      tag: 'https://saldo.example/profile/tags?tag={id}',
    };
    const result = getPreferencesTool.run(fixtureData(), { ...CONTEXT, webApp }, {});
    expect(result.webApp).toEqual(webApp);
    expect(getPreferencesTool.output.parse(result).webApp).toEqual(webApp);
  });

  it('names the cycle day only for a pay cycle', () => {
    const result = getPreferencesTool.run(cycleData(), CONTEXT, {});
    expect(result.period).toEqual({
      kind: 'cycle',
      cycleStartDay: 27,
      current: { start: '2026-08-27', end: '2026-09-26' },
      previous: { start: '2026-07-27', end: '2026-08-26' },
    });
  });

  it('says when the user has not onboarded, with the defaults standing in', () => {
    const result = getPreferencesTool.run(emptyUserData(), CONTEXT, {});
    expect(result.onboarded).toBe(false);
    expect(result.currency).toBe('EUR');
    expect(result.language).toBe('system');
  });
});
