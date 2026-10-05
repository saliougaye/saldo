import { describe, expect, it } from 'vitest';
import { wallClock } from './timeZones';

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
});
