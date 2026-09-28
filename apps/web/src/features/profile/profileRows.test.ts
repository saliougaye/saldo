// apps/web/src/features/profile/profileRows.test.ts
import { readSettings, SETTINGS_DEFAULTS } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { preferenceRows } from './profileRows';

describe('preferenceRows', () => {
  const settings = readSettings({
    ...SETTINGS_DEFAULTS,
    id: 'settings',
    currency: 'SEK',
    language: 'sv',
    theme: 'dark',
    cycleStartDay: 27,
    timeZone: 'Europe/Stockholm',
  });

  it('is the phone’s preferences, in the phone’s order', () => {
    expect(preferenceRows(settings, 'sv').map((row) => row.key)).toEqual([
      'cycle',
      'currency',
      'language',
      'theme',
      'timeZone',
    ]);
  });

  it('shows the currency as its symbol and its code', () => {
    expect(preferenceRows(settings, 'sv').find((row) => row.key === 'currency')?.value).toContain(
      'SEK',
    );
  });

  it('names the language rather than its tag', () => {
    expect(preferenceRows(settings, 'sv').find((row) => row.key === 'language')?.value).toBe(
      'Svenska',
    );
  });

  it('shows the time zone as its city', () => {
    expect(preferenceRows(settings, 'sv').find((row) => row.key === 'timeZone')?.value).toContain(
      'Stockholm',
    );
  });

  it('marks every row read-only until the forms of 0.3e', () => {
    expect(preferenceRows(settings, 'sv').every((row) => row.editable === false)).toBe(true);
  });
});
