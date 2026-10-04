/**
 * §17.4.2: 120 requests per minute per token, in memory and per process like Better Auth's limiter
 * (§18: a second replica multiplies it). The key is the token's hash, never the token.
 */
export type LimitVerdict = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export interface FixedWindowLimiter {
  allow(key: string, nowMs: number): LimitVerdict;
  size(): number;
  reset(): void;
}

interface Window {
  startedAt: number;
  count: number;
}

export function createFixedWindowLimiter(options: {
  max: number;
  windowMs: number;
  maxKeys?: number;
}): FixedWindowLimiter {
  const maxKeys = options.maxKeys ?? 10_000;
  const windows = new Map<string, Window>();

  function sweep(nowMs: number): void {
    for (const [key, window] of windows) {
      if (nowMs - window.startedAt >= options.windowMs) windows.delete(key);
    }
    while (windows.size >= maxKeys) {
      const oldest = windows.keys().next();
      if (oldest.done === true) break;
      windows.delete(oldest.value);
    }
  }

  return {
    allow(key, nowMs) {
      const current = windows.get(key);
      if (current === undefined || nowMs - current.startedAt >= options.windowMs) {
        if (current === undefined && windows.size >= maxKeys) sweep(nowMs);
        windows.delete(key);
        windows.set(key, { startedAt: nowMs, count: 1 });
        return { allowed: true };
      }
      if (current.count < options.max) {
        current.count += 1;
        return { allowed: true };
      }
      const waitMs = options.windowMs - (nowMs - current.startedAt);
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(waitMs / 1000)) };
    },
    size: () => windows.size,
    reset() {
      windows.clear();
    },
  };
}

export const MCP_REQUESTS_PER_MINUTE = 120;

/** The process's one `/mcp` limiter. */
export const mcpRequestLimiter: FixedWindowLimiter = createFixedWindowLimiter({
  max: MCP_REQUESTS_PER_MINUTE,
  windowMs: 60_000,
});
