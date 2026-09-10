import { type EntityName, MAX_CHANGES_PER_PULL, type PullChange } from '@saldo/core';
import { and, asc, eq, gt } from 'drizzle-orm';
import { syncRows } from '../db/schema';
import type { ServerDatabase } from '../db/types';

export interface PullPage {
  changes: PullChange[];
  nextSince: number;
  hasMore: boolean;
}

/**
 * §8.3. Ordered by `seq`, which is the only ordering a cursor can page over safely: HLCs are
 * assigned by devices and can arrive out of order, `seq` is assigned by the server as it applies.
 *
 * One row over the limit is fetched to answer `hasMore` without a second count query.
 */
export async function readPull(
  db: ServerDatabase,
  userId: string,
  options: { since: number; limit: number },
): Promise<PullPage> {
  const limit = Math.min(Math.max(1, options.limit), MAX_CHANGES_PER_PULL);
  const rows = await db
    .select()
    .from(syncRows)
    .where(and(eq(syncRows.userId, userId), gt(syncRows.seq, options.since)))
    .orderBy(asc(syncRows.seq))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const changes: PullChange[] = page.map((row) => ({
    entity: row.entity as EntityName,
    id: row.id,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt === null ? null : row.deletedAt.toISOString(),
    data: row.data,
    seq: row.seq,
  }));
  return {
    changes,
    nextSince: page.at(-1)?.seq ?? options.since,
    hasMore: rows.length > limit,
  };
}
