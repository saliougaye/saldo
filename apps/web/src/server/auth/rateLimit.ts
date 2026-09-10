import { ApiError } from '../http/errors';

/** §9.3: 10 requests per minute per IP on the auth endpoints. */
const CAPACITY = 10;
const WINDOW_MS = 60_000;
/** Buckets idle for longer than this are dropped, so a long-running process cannot grow forever. */
const IDLE_EVICTION_MS = 10 * WINDOW_MS;

interface Bucket {
  tokens: number;
  updatedAt: number;
}

/**
 * In-memory token bucket. **Single-instance only** by design (§9.3): behind more than one replica
 * each process limits its own share, which for a self-hosted server is an acceptable trade against
 * requiring Redis. Replace this module to change that.
 */
const buckets = new Map<string, Bucket>();

/**
 * The key the limiter buckets on. It reads the **last** entry of `X-Forwarded-For`, not the first:
 * a reverse proxy appends the peer it saw, so the last hop is the only value the client could not
 * choose. Taking the first hop — the usual reading — would let anyone rotate a header and reset
 * their own bucket, which is a rate limit in name only.
 *
 * Behind two or more proxies the last hop is the inner proxy's address and every caller shares one
 * bucket: that over-limits rather than under-limits, which is the safe direction to be wrong in.
 */
export function clientIp(request: Request): string {
  const hops =
    request.headers
      .get('x-forwarded-for')
      ?.split(',')
      .map((hop) => hop.trim())
      .filter((hop) => hop.length > 0) ?? [];
  const last = hops.at(-1);
  if (last !== undefined) return last;
  const real = request.headers.get('x-real-ip')?.trim();
  if (real !== undefined && real.length > 0) return real;
  return 'unknown';
}

export function enforceRateLimit(key: string, now: Date): void {
  const at = now.getTime();
  for (const [existing, bucket] of buckets) {
    if (at - bucket.updatedAt > IDLE_EVICTION_MS) buckets.delete(existing);
  }
  const bucket = buckets.get(key) ?? { tokens: CAPACITY, updatedAt: at };
  // Multiply before dividing, and keep the anchor of the last *granted* request: refilling from a
  // fixed anchor in one step avoids the rounding drift that accumulates when each rejected request
  // re-anchors the bucket, which is enough to lose a whole token over a minute.
  const refilled = Math.min(
    CAPACITY,
    bucket.tokens + ((at - bucket.updatedAt) * CAPACITY) / WINDOW_MS,
  );
  if (refilled < 1) {
    throw new ApiError(429, 'rate_limited', 'Too many requests, try again in a minute');
  }
  buckets.set(key, { tokens: refilled - 1, updatedAt: at });
}

export function resetRateLimits(): void {
  buckets.clear();
}
