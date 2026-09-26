import { describe, expect, it } from 'vitest';
import { SUPPORTED_LOCALES } from './format';
import { CITY_NAMES } from './timeZoneCities';
import {
  canonicalTimeZone,
  formatWallTime,
  isTimeZone,
  localDateOf,
  systemTimeZone,
  TIME_ZONES,
  timeZoneCity,
  timeZoneName,
  wallClock,
} from './timeZones';
import { TIME_ZONE_ALIASES, TIME_ZONE_GENERIC_NAMES } from './timeZones.generated';

describe('time-zone data', () => {
  it('lists the zones people use, and UTC', () => {
    for (const zone of ['Europe/Rome', 'America/New_York', 'Asia/Tokyo', 'UTC']) {
      expect(TIME_ZONES).toContain(zone);
    }
  });

  it.each(SUPPORTED_LOCALES)('%s names every zone', (locale) => {
    const table = TIME_ZONE_GENERIC_NAMES[locale];
    expect(table.of).toHaveLength(TIME_ZONES.length);
    for (const index of table.of) expect(table.names[index]).toBeTruthy();
  });

  it.each(SUPPORTED_LOCALES)('%s translates only cities that exist', (locale) => {
    for (const zone of Object.keys(CITY_NAMES[locale])) expect(TIME_ZONES, zone).toContain(zone);
  });
});

describe('canonicalTimeZone', () => {
  it('maps a current name to the id the list holds, and leaves listed ids alone', () => {
    expect(canonicalTimeZone('Asia/Kolkata')).toBe('Asia/Calcutta');
    expect(canonicalTimeZone('Europe/Kyiv')).toBe('Europe/Kiev');
    expect(canonicalTimeZone('Etc/UTC')).toBe('UTC');
    expect(canonicalTimeZone('Europe/Rome')).toBe('Europe/Rome');
  });

  it('only aliases names the list lacks, onto ids it has', () => {
    for (const [name, target] of Object.entries(TIME_ZONE_ALIASES)) {
      expect(TIME_ZONES, name).not.toContain(name);
      expect(TIME_ZONES, name).toContain(target);
    }
  });
});

describe('timeZoneCity', () => {
  it('shows the current name of a renamed city, in every language', () => {
    expect(timeZoneCity('Asia/Calcutta', 'it')).toBe('Kolkata');
    expect(timeZoneCity('Asia/Kolkata', 'de')).toBe('Kolkata');
    expect(timeZoneCity('Europe/Kyiv', 'fr')).toBe('Kyiv');
    expect(timeZoneName('Asia/Kolkata', 'en')).toBe(timeZoneName('Asia/Calcutta', 'en'));
  });

  it('translates a common city and falls back to IANA’s English', () => {
    expect(timeZoneCity('Europe/Rome', 'it')).toBe('Roma');
    expect(timeZoneCity('Europe/Rome', 'en')).toBe('Rome');
    expect(timeZoneCity('America/Los_Angeles', 'it')).toBe('Los Angeles');
    expect(timeZoneCity('UTC', 'de')).toBe('UTC');
  });
});

describe('timeZoneName', () => {
  it('names the zone in the app’s language, and knows nothing of an unknown id', () => {
    expect(timeZoneName('Europe/Rome', 'it')).toBe('Ora dell’Europa centrale');
    expect(timeZoneName('Europe/Rome', 'en')).toBe('Central European Time');
    expect(timeZoneName('Not/AZone', 'it')).toBeUndefined();
  });
});

describe('wallClock', () => {
  it('reads the date and time in a zone, across midnight and daylight saving', () => {
    // 22:30 UTC on 26 September is already the 27th in Rome (CEST, +2) and in Tokyo (+9).
    const at = new Date('2026-09-26T22:30:00.000Z');
    expect(wallClock('Europe/Rome', at)).toEqual({
      year: 2026,
      month: 9,
      day: 27,
      hour: 0,
      minute: 30,
    });
    expect(wallClock('Asia/Tokyo', at)).toEqual({
      year: 2026,
      month: 9,
      day: 27,
      hour: 7,
      minute: 30,
    });
    expect(wallClock('America/New_York', at)).toEqual({
      year: 2026,
      month: 9,
      day: 26,
      hour: 18,
      minute: 30,
    });
    // January: Rome is +1.
    expect(wallClock('Europe/Rome', new Date('2026-01-15T23:30:00.000Z'))?.day).toBe(16);
  });

  it('returns null for a name Intl does not know', () => {
    expect(wallClock('Europe/Atlantis', new Date())).toBeNull();
    expect(isTimeZone('Europe/Atlantis')).toBe(false);
    expect(isTimeZone('Europe/Rome')).toBe(true);
    expect(isTimeZone('')).toBe(false);
  });
});

describe('localDateOf and formatWallTime', () => {
  it('turn a wall clock into a LocalDate and an HH:MM', () => {
    const clock = { year: 2026, month: 3, day: 5, hour: 7, minute: 4 };
    expect(localDateOf(clock)).toBe('2026-03-05');
    expect(formatWallTime(clock)).toBe('07:04');
  });
});

describe('systemTimeZone', () => {
  it('returns a zone Intl knows', () => {
    expect(isTimeZone(systemTimeZone())).toBe(true);
  });
});
