import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../http/errors';
import { clientIp, enforceRateLimit, resetRateLimits } from './rateLimit';

const at = (ms: number) => new Date(ms);

beforeEach(() => {
  resetRateLimits();
});

describe('enforceRateLimit', () => {
  it('allows the first ten requests in a window and rejects the eleventh', () => {
    for (let i = 0; i < 10; i += 1) {
      expect(() => enforceRateLimit('1.2.3.4', at(1000 + i))).not.toThrow();
    }
    expect(() => enforceRateLimit('1.2.3.4', at(1100))).toThrow(ApiError);
    try {
      enforceRateLimit('1.2.3.4', at(1100));
      expect.unreachable('the bucket is empty');
    } catch (error) {
      expect(error).toMatchObject({ status: 429, code: 'rate_limited' });
    }
  });

  it('refills over time', () => {
    for (let i = 0; i < 10; i += 1) enforceRateLimit('1.2.3.4', at(0));
    expect(() => enforceRateLimit('1.2.3.4', at(5_000))).toThrow(ApiError);
    // One token per 6s at 10/min; after 6s exactly one request gets through.
    expect(() => enforceRateLimit('1.2.3.4', at(6_000))).not.toThrow();
    expect(() => enforceRateLimit('1.2.3.4', at(6_001))).toThrow(ApiError);
  });

  it('keeps buckets per client', () => {
    for (let i = 0; i < 10; i += 1) enforceRateLimit('1.2.3.4', at(0));
    expect(() => enforceRateLimit('5.6.7.8', at(0))).not.toThrow();
  });
});

describe('clientIp', () => {
  const request = (headers: Record<string, string>) =>
    new Request('http://localhost/api/x', { headers });

  it('takes the last hop of x-forwarded-for, else x-real-ip, else a constant', () => {
    expect(clientIp(request({ 'x-forwarded-for': '9.9.9.9' }))).toBe('9.9.9.9');
    expect(clientIp(request({ 'x-real-ip': '9.9.9.9' }))).toBe('9.9.9.9');
    expect(clientIp(request({}))).toBe('unknown');
  });

  it('ignores hops the caller supplied itself', () => {
    // A proxy appends what it saw, so 10.0.0.1 is the real peer and the rest is the caller's own
    // header. Bucketing on the first hop would let it reset its bucket at will.
    expect(clientIp(request({ 'x-forwarded-for': 'spoofed, 10.0.0.1' }))).toBe('10.0.0.1');
    expect(clientIp(request({ 'x-forwarded-for': ' , 10.0.0.1 ' }))).toBe('10.0.0.1');
  });

  it('cannot be reset by rotating the header', () => {
    for (let i = 0; i < 10; i += 1) {
      enforceRateLimit(clientIp(request({ 'x-forwarded-for': `spoof-${i}, 10.0.0.1` })), at(0));
    }
    expect(() =>
      enforceRateLimit(clientIp(request({ 'x-forwarded-for': 'spoof-11, 10.0.0.1' })), at(0)),
    ).toThrow(ApiError);
  });
});
