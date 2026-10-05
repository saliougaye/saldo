import { describe, expect, it } from 'vitest';
import { createFixedWindowLimiter } from './rateLimit';

describe('createFixedWindowLimiter', () => {
  it('lets max requests through per window, then answers how long to wait', () => {
    const limiter = createFixedWindowLimiter({ max: 3, windowMs: 60_000 });
    expect(limiter.allow('a', 0)).toEqual({ allowed: true });
    expect(limiter.allow('a', 1_000)).toEqual({ allowed: true });
    expect(limiter.allow('a', 2_000)).toEqual({ allowed: true });
    expect(limiter.allow('a', 30_000)).toEqual({ allowed: false, retryAfterSeconds: 30 });
    expect(limiter.allow('a', 60_000)).toEqual({ allowed: true });
  });

  it('forgets expired windows, and the oldest keys past maxKeys', () => {
    const limiter = createFixedWindowLimiter({ max: 1, windowMs: 1_000, maxKeys: 2 });
    limiter.allow('a', 0);
    limiter.allow('b', 0);
    limiter.allow('c', 10);
    expect(limiter.size()).toBeLessThanOrEqual(2);
    limiter.allow('d', 5_000);
    expect(limiter.size()).toBe(1);
  });
});
