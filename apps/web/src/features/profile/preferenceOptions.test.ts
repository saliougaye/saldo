import { CURRENCY_CODES, LANGUAGE_PREFERENCES } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import {
  currencyOptions,
  languageOptions,
  themeOptions,
  timeZoneOptions,
} from './preferenceOptions';

describe('languageOptions', () => {
  it('is Sistema, the two first languages, then the rest by their own names', () => {
    expect(languageOptions('Sistema')).toEqual([
      { value: 'system', label: 'Sistema' },
      { value: 'it', label: 'Italiano' },
      { value: 'en', label: 'English' },
      { value: 'de', label: 'Deutsch' },
      { value: 'es', label: 'Español' },
      { value: 'fr', label: 'Français' },
      { value: 'pt', label: 'Português' },
      { value: 'sv', label: 'Svenska' },
    ]);
  });

  it('offers every language the settings can hold', () => {
    expect(
      languageOptions('x')
        .map((option) => option.value)
        .sort(),
    ).toEqual([...LANGUAGE_PREFERENCES].sort());
  });
});

describe('themeOptions', () => {
  it('is Sistema, Scuro, Chiaro, as the phone lists them', () => {
    expect(themeOptions((key) => key)).toEqual([
      { value: 'system', label: 'profile.system' },
      { value: 'dark', label: 'profile.dark' },
      { value: 'light', label: 'profile.light' },
    ]);
  });
});

describe('currencyOptions', () => {
  const options = currencyOptions('it');

  it('holds every currency once', () => {
    expect(options.map((option) => option.code).sort()).toEqual([...CURRENCY_CODES].sort());
  });

  it('names a currency in the app’s language and shows zero as its amounts will look', () => {
    const yen = options.find((option) => option.code === 'JPY');
    expect(yen?.name.toLowerCase()).toContain('yen');
    expect(yen?.sample).toMatch(/0/);
    expect(yen?.sample).not.toMatch(/0[,.]0/);
    expect(options.find((option) => option.code === 'EUR')?.sample).toMatch(/0,00/);
  });
});

describe('timeZoneOptions', () => {
  const now = new Date('2026-09-30T10:00:00.000Z');
  const { zones, aliases } = timeZoneOptions('it', now, 'Europe/Rome');

  it('names each zone by its city, with the time there now', () => {
    expect(zones.find((zone) => zone.zone === 'Europe/Rome')).toMatchObject({
      city: 'Roma',
      time: '12:00',
    });
    expect(zones.find((zone) => zone.zone === 'Asia/Tokyo')?.time).toBe('19:00');
  });

  it('is sorted by city in the app’s language', () => {
    const cities = zones.map((zone) => zone.city);
    expect(cities).toEqual([...cities].sort((a, b) => a.localeCompare(b, 'it')));
  });

  it('carries the names a browser reports a listed zone under', () => {
    expect(aliases['Asia/Kolkata']).toBe('Asia/Calcutta');
    expect(zones.some((zone) => zone.zone === 'Asia/Calcutta')).toBe(true);
  });

  it('lists a saved zone the table does not hold, so it can be shown selected', () => {
    const odd = timeZoneOptions('it', now, 'Etc/GMT+5');
    expect(odd.zones.filter((zone) => zone.zone === 'Etc/GMT+5')).toHaveLength(1);
    expect(timeZoneOptions('it', now, null).zones).toHaveLength(zones.length);
  });
});
