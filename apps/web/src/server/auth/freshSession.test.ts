import { describe, expect, it } from 'vitest';
import { FRESH_SESSION_SECONDS, isFreshSession } from './freshSession';

describe('isFreshSession', () => {
  const now = new Date('2026-10-24T12:00:00Z');
  const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000);

  it('accepts a session up to the window, inclusive', () => {
    expect(isFreshSession(ago(FRESH_SESSION_SECONDS - 1), now)).toBe(true);
    expect(isFreshSession(ago(FRESH_SESSION_SECONDS), now)).toBe(true);
  });

  it('refuses a session older than the window', () => {
    expect(isFreshSession(ago(FRESH_SESSION_SECONDS + 1), now)).toBe(false);
  });

  it('refuses a creation time in the future: a clock fault does not open the door', () => {
    expect(isFreshSession(ago(-1), now)).toBe(false);
  });
});
