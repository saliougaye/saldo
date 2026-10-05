import { describe, expect, it } from 'vitest';
import { isHlc } from './sync/hlc';
import { readSettings, SETTINGS_DEFAULTS } from './userData';

const settings = {
  id: 'settings',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '000000000000001-0000-dev',
  deletedAt: null,
  periodKind: 'cycle',
  cycleStartDay: 15,
  currency: 'CHF',
  language: 'de',
  theme: 'dark',
  onboardingCompletedAt: '2026-09-01T10:00:00.000Z',
  timeZone: 'Europe/Zurich',
};

describe('readSettings', () => {
  it('fills a field the row was written without', () => {
    const { timeZone: _dropped, cycleStartDay: _alsoDropped, ...older } = settings;
    const read = readSettings(older);
    expect(read.cycleStartDay).toBe(SETTINGS_DEFAULTS.cycleStartDay);
    expect(read.timeZone ?? null).toBeNull();
    expect(read.currency).toBe('CHF');
  });

  it('replaces only the fields this build cannot read', () => {
    // A server rolled back to a release that does not know this language, or a hand edit.
    const read = readSettings({ ...settings, language: 'pl', theme: 42, currency: 'XYZ' });
    expect(read).toMatchObject({
      language: SETTINGS_DEFAULTS.language,
      theme: SETTINGS_DEFAULTS.theme,
      currency: SETTINGS_DEFAULTS.currency,
      periodKind: 'cycle',
      cycleStartDay: 15,
      timeZone: 'Europe/Zurich',
    });
  });

  it('never throws, even on something that is not a row at all', () => {
    for (const junk of [null, 'settings', 7, [], undefined]) {
      const read = readSettings(junk);
      expect(read).toMatchObject({ id: 'settings', ...SETTINGS_DEFAULTS });
      expect(isHlc(read.updatedAt)).toBe(true);
    }
  });
});
