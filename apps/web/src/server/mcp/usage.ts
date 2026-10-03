import { sql } from 'drizzle-orm';
import { inBackground } from '../background';
import { getDb } from '../db/client';
import { mcpUsage } from '../db/schema';

/** §17.4.3: `mcp_usage` is written at most once a minute per (user, client). */
export const USAGE_WRITE_INTERVAL_MS = 60_000;

interface PairState {
  lastWriteAt: number;
  /** Calls counted since the last write. */
  pending: number;
}

/**
 * Per process, like the rate limiters (§18): a second replica keeps its own counts and writes its own
 * minute. Counts not yet written are lost when the process stops — at most one minute of «calls» per
 * pair; usage is best effort (§17.4.3, decided 2026-10-03). Bounded by the number of (user, client)
 * pairs that ever called, which is small.
 */
const pairs = new Map<string, PairState>();
const pairKey = (userId: string, clientId: string) => `${userId}\u0000${clientId}`;

/**
 * Counts one `/mcp` request. The first request of a pair writes at once; the next ones inside the
 * minute only count; the first one after the minute writes everything counted since, in one upsert.
 * The write runs in the background and never holds the response.
 */
export function recordMcpUsage(userId: string, clientId: string, now: Date): void {
  const key = pairKey(userId, clientId);
  const state = pairs.get(key) ?? { lastWriteAt: Number.NEGATIVE_INFINITY, pending: 0 };
  state.pending += 1;
  pairs.set(key, state);
  if (now.getTime() - state.lastWriteAt < USAGE_WRITE_INTERVAL_MS) return;
  const calls = state.pending;
  state.pending = 0;
  state.lastWriteAt = now.getTime();
  inBackground(async () => {
    await getDb()
      .insert(mcpUsage)
      .values({ userId, clientId, lastUsedAt: now, calls })
      .onConflictDoUpdate({
        target: [mcpUsage.userId, mcpUsage.clientId],
        set: { calls: sql`${mcpUsage.calls} + ${calls}`, lastUsedAt: now },
      });
  });
}

/** On revocation: the pair starts again from nothing. */
export function forgetMcpUsage(userId: string, clientId: string): void {
  pairs.delete(pairKey(userId, clientId));
}

export function resetMcpUsageForTests(): void {
  pairs.clear();
}
