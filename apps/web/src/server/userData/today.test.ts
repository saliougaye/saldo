import { describe, expect, it } from 'vitest';
import { resolveTimeZone, todayFor } from './today';

describe('resolveTimeZone', () => {
  it('uses the user’s zone, and the fallback when it is missing or unknown', () => {
    expect(resolveTimeZone('Europe/Rome', 'UTC')).toBe('Europe/Rome');
    expect(resolveTimeZone(null, 'Europe/Zurich')).toBe('Europe/Zurich');
    expect(resolveTimeZone(undefined, 'Europe/Zurich')).toBe('Europe/Zurich');
    // A renamed zone or a hand edit never breaks a page.
    expect(resolveTimeZone('Europe/Atlantis', 'UTC')).toBe('UTC');
  });
});

describe('todayFor', () => {
  // 00:30 on 1 October in Rome, still 30 September in UTC and in New York.
  const now = new Date('2026-09-30T22:30:00.000Z');

  it('is the date in the user’s zone, not the server’s', () => {
    expect(todayFor({ timeZone: 'Europe/Rome' }, 'UTC', now)).toEqual({
      today: '2026-10-01',
      timeZone: 'Europe/Rome',
    });
    expect(todayFor({ timeZone: 'America/New_York' }, 'UTC', now).today).toBe('2026-09-30');
  });

  it('falls back for a user with no settings or no zone', () => {
    expect(todayFor(null, 'UTC', now)).toEqual({ today: '2026-09-30', timeZone: 'UTC' });
    expect(todayFor({ timeZone: null }, 'Europe/Rome', now).today).toBe('2026-10-01');
  });
});
