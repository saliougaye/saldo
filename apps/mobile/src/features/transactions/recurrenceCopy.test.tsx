import { cadenceLabel, endLabel } from '@saldo/i18n';
import type { i18n as I18nInstance } from 'i18next';
import { createI18n } from '../../i18n';
import { presetOf, ruleForPreset } from './recurrenceCopy';

let it_: I18nInstance;

beforeAll(async () => {
  it_ = await createI18n('it', []);
});

// The strings themselves are tested in `@saldo/i18n`; this proves i18next's `t` drives them the same.
describe('cadenceLabel and endLabel under i18next', () => {
  it('read as they do under the web translator', () => {
    expect(cadenceLabel({ frequency: 'weekly', interval: 2 }, '2026-09-18', it_.t, 'it')).toBe(
      'Ogni 2 settimane, il venerdì',
    );
    expect(endLabel('2026-12-18', it_.t, 'it')).toBe('fino al 18 dic');
  });
});

describe('presets', () => {
  it('recognises the chip and sheet presets', () => {
    expect(presetOf(null)).toBe('never');
    expect(presetOf({ frequency: 'monthly', interval: 1, endDate: null })).toBe('monthly');
    expect(presetOf({ frequency: 'monthly', interval: 1, endDate: '2026-12-18' })).toBe('monthly');
    expect(presetOf({ frequency: 'weekly', interval: 1, endDate: null })).toBe('weekly');
    expect(presetOf({ frequency: 'weekly', interval: 2, endDate: null })).toBe('biweekly');
    expect(presetOf({ frequency: 'yearly', interval: 1, endDate: null })).toBe('yearly');
    expect(presetOf({ frequency: 'monthly', interval: 2, endDate: null })).toBe('custom');
    expect(presetOf({ frequency: 'daily', interval: 1, endDate: null })).toBe('custom');
  });

  it('builds a rule from a preset, keeping the end', () => {
    expect(ruleForPreset('biweekly', '2026-12-18')).toEqual({
      frequency: 'weekly',
      interval: 2,
      endDate: '2026-12-18',
    });
    expect(ruleForPreset('never', null)).toBeNull();
  });
});
