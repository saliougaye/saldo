import { describe, expect, it } from 'vitest';
import { minuteOf, zoneTimes } from './timeZoneRows';
import { cachedZoneTimes } from './zoneCache';

const ZONES = ['Europe/Rome', 'Asia/Kathmandu', 'Mars/Olympus'];

describe('cachedZoneTimes', () => {
  it('gives the hours of the minute it is asked for, also after a part of them was made', () => {
    const first = minuteOf(new Date(Date.UTC(2026, 2, 29, 0, 59)));
    // The warm-up makes the hours in parts: the rest comes when the panel asks for all of them.
    cachedZoneTimes(ZONES.slice(0, 1), first);
    expect(cachedZoneTimes(ZONES, first)).toEqual(zoneTimes(ZONES, new Date(first * 60_000)));

    // A new minute — here across the change to summer time in Rome — is not the old hours.
    const next = first + 1;
    expect(cachedZoneTimes(ZONES, next)).toEqual(zoneTimes(ZONES, new Date(next * 60_000)));
    expect(cachedZoneTimes(ZONES, next).get('Europe/Rome')).toBe('03:00');
  });
});
