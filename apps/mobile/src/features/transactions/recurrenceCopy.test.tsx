import type { i18n as I18nInstance } from 'i18next';
import { createI18n } from '../../i18n';
import { cadenceLabel, endLabel, presetOf, ruleForPreset } from './recurrenceCopy';

let it_: I18nInstance;
let en: I18nInstance;

beforeAll(async () => {
  it_ = await createI18n('it', []);
  en = await createI18n('en', []);
});

describe('cadenceLabel', () => {
  it('names the cadence and its anchor', () => {
    expect(cadenceLabel({ frequency: 'monthly', interval: 1 }, '2026-09-18', it_.t, 'it')).toBe(
      'Ogni mese, il 18',
    );
    expect(cadenceLabel({ frequency: 'monthly', interval: 3 }, '2026-09-18', en.t, 'en')).toBe(
      'Every 3 months, on the 18',
    );
    expect(cadenceLabel({ frequency: 'weekly', interval: 2 }, '2026-09-18', it_.t, 'it')).toBe(
      'Ogni 2 settimane, il venerdì',
    );
    expect(cadenceLabel({ frequency: 'yearly', interval: 1 }, '2026-09-18', it_.t, 'it')).toBe(
      'Ogni anno, il 18 settembre',
    );
    expect(cadenceLabel({ frequency: 'daily', interval: 1 }, '2026-09-18', it_.t, 'it')).toBe(
      'Ogni giorno',
    );
  });
});

describe('endLabel', () => {
  it('says how the series ends', () => {
    expect(endLabel(null, it_.t, 'it')).toBe('senza fine');
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
