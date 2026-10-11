import { describe, expect, it } from 'vitest';
import { minuteOf, timeZoneRows, zoneTimes } from './timeZoneRows';

// 2026-03-29 00:30 UTC: Rome is still on winter time (01:30), London too (00:30). One hour later
// both have moved to summer time.
const BEFORE = new Date(Date.UTC(2026, 2, 29, 0, 30));
const AFTER = new Date(Date.UTC(2026, 2, 29, 1, 30));

describe('timeZoneRows', () => {
  it('gives every zone with its city and its name, sorted by city in the language', () => {
    const rows = timeZoneRows('it', null);
    const rome = rows.find((row) => row.zone === 'Europe/Rome');
    expect(rome).toEqual({ zone: 'Europe/Rome', city: 'Roma', name: 'Ora dell’Europa centrale' });
    const cities = rows.map((row) => row.city);
    expect(cities).toEqual([...cities].sort(new Intl.Collator('it').compare));
    expect(timeZoneRows('en', null).find((row) => row.zone === 'Europe/Rome')?.city).toBe('Rome');
  });

  it('adds the saved zone when the table does not list it, under its CLDR id', () => {
    expect(timeZoneRows('en', null).some((row) => row.zone === 'Etc/GMT+5')).toBe(false);
    const rows = timeZoneRows('en', 'Etc/GMT+5');
    expect(rows.find((row) => row.zone === 'Etc/GMT+5')).toEqual({
      zone: 'Etc/GMT+5',
      city: 'GMT+5',
      name: undefined,
    });
    // An alias is not a new row: Asia/Kolkata is listed as Asia/Calcutta.
    expect(timeZoneRows('en', 'Asia/Kolkata').length).toBe(timeZoneRows('en', null).length);
  });
});

describe('zoneTimes', () => {
  it('gives the wall time of each zone at the instant, 24-hour, across a change of DST', () => {
    expect(zoneTimes(['Europe/Rome', 'Europe/London'], BEFORE)).toEqual(
      new Map([
        ['Europe/Rome', '01:30'],
        ['Europe/London', '00:30'],
      ]),
    );
    expect(zoneTimes(['Europe/Rome', 'Europe/London'], AFTER)).toEqual(
      new Map([
        ['Europe/Rome', '03:30'],
        ['Europe/London', '02:30'],
      ]),
    );
  });

  it('leaves out a zone that Intl does not know', () => {
    expect(zoneTimes(['Mars/Olympus'], BEFORE).has('Mars/Olympus')).toBe(false);
  });

  it('reads the same hours at the first instant of the minute as at any other', () => {
    const late = new Date(Date.UTC(2026, 2, 29, 1, 30, 59, 999));
    const first = new Date(minuteOf(late) * 60_000);
    expect(zoneTimes(['Asia/Kathmandu'], first)).toEqual(zoneTimes(['Asia/Kathmandu'], late));
  });
});
