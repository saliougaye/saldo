import { describe, expect, it } from 'vitest';
import { createMailThrottle } from './throttle';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const T0 = Date.UTC(2026, 8, 30, 12, 0, 0);

describe('mail throttle', () => {
  it('lets the first message through and holds a second of the same kind for a minute', () => {
    const throttle = createMailThrottle();
    expect(throttle.allow('recovery', 'ada@example.com', T0)).toBe(true);
    expect(throttle.allow('recovery', 'ada@example.com', T0 + 59_999)).toBe(false);
    expect(throttle.allow('recovery', 'ada@example.com', T0 + MINUTE)).toBe(true);
  });

  it('counts each kind on its own for the minute', () => {
    const throttle = createMailThrottle();
    expect(throttle.allow('recovery', 'ada@example.com', T0)).toBe(true);
    expect(throttle.allow('verification', 'ada@example.com', T0 + 1)).toBe(true);
  });

  it('counts each address on its own', () => {
    const throttle = createMailThrottle();
    expect(throttle.allow('recovery', 'ada@example.com', T0)).toBe(true);
    expect(throttle.allow('recovery', 'bob@example.com', T0)).toBe(true);
  });

  it('reads the same address however it was typed', () => {
    const throttle = createMailThrottle();
    expect(throttle.allow('recovery', 'ada@example.com', T0)).toBe(true);
    expect(throttle.allow('recovery', '  Ada@Example.COM ', T0 + 1)).toBe(false);
  });

  it('allows five an hour to one address, across kinds, then holds the sixth', () => {
    const throttle = createMailThrottle();
    const kinds = ['recovery', 'verification'] as const;
    for (let i = 0; i < 5; i += 1) {
      const kind = kinds[i % 2] ?? 'recovery';
      expect(throttle.allow(kind, 'ada@example.com', T0 + i * 2 * MINUTE)).toBe(true);
    }
    expect(throttle.allow('recovery', 'ada@example.com', T0 + 50 * MINUTE)).toBe(false);
    // The first one leaves the window an hour after it was sent.
    expect(throttle.allow('recovery', 'ada@example.com', T0 + HOUR)).toBe(true);
  });

  it('does not count a refused attempt against the address', () => {
    const throttle = createMailThrottle();
    throttle.allow('recovery', 'ada@example.com', T0);
    for (let i = 1; i < 50; i += 1) {
      expect(throttle.allow('recovery', 'ada@example.com', T0 + i)).toBe(false);
    }
    expect(throttle.allow('recovery', 'ada@example.com', T0 + MINUTE)).toBe(true);
  });

  it('forgets addresses whose last message is more than an hour old', () => {
    const throttle = createMailThrottle();
    for (let i = 0; i < 100; i += 1) throttle.allow('recovery', `u${i}@example.com`, T0);
    expect(throttle.size()).toBe(100);
    // Any later call sweeps, at most once a minute.
    throttle.allow('recovery', 'late@example.com', T0 + HOUR + MINUTE);
    expect(throttle.size()).toBe(1);
  });

  it('keeps a bounded number of addresses however many ask', () => {
    const throttle = createMailThrottle({ maxAddresses: 50 });
    for (let i = 0; i < 500; i += 1) throttle.allow('recovery', `u${i}@example.com`, T0 + i);
    expect(throttle.size()).toBeLessThanOrEqual(50);
    // The newest are the ones still held.
    expect(throttle.allow('recovery', 'u499@example.com', T0 + 500)).toBe(false);
  });

  it('can be emptied', () => {
    const throttle = createMailThrottle();
    throttle.allow('recovery', 'ada@example.com', T0);
    throttle.reset();
    expect(throttle.size()).toBe(0);
    expect(throttle.allow('recovery', 'ada@example.com', T0 + 1)).toBe(true);
  });
});
