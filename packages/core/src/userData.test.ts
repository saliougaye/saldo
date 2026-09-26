import { describe, expect, it } from 'vitest';
import { entitySchemas } from './entities';
import { isHlc } from './sync/hlc';
import {
  emptyUserData,
  readSettings,
  SETTINGS_DEFAULTS,
  USER_DATA_COLLECTIONS,
  userDataSchema,
} from './userData';

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

describe('USER_DATA_COLLECTIONS', () => {
  it('names a collection for every synced entity but the settings singleton', () => {
    expect(Object.keys(USER_DATA_COLLECTIONS).sort()).toEqual(
      Object.keys(entitySchemas)
        .filter((entity) => entity !== 'settings')
        .sort(),
    );
  });
});

describe('userDataSchema', () => {
  it('accepts an account that has not onboarded yet', () => {
    expect(userDataSchema.safeParse(emptyUserData()).success).toBe(true);
  });
});

describe('readSettings', () => {
  it('returns a valid row as it is', () => {
    expect(readSettings(settings)).toEqual(settings);
  });

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
