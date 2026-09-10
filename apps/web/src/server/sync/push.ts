import {
  isHlc,
  type PushRequest,
  type PushResult,
  parseHlc,
  type SyncChangeEnvelope,
  syncChangeSchema,
} from '@saldo/core';
import { sql } from 'drizzle-orm';
import { syncRows } from '../db/schema';
import { nextSeq } from '../db/syncSequence';
import type { ServerDatabase } from '../db/types';

/** §8.2: a device whose clock is further ahead than this cannot park rows in everyone's future. */
const MAX_CLOCK_SKEW_MS = 24 * 3600 * 1000;

function validate(change: SyncChangeEnvelope, now: Date): string | null {
  const parsed = syncChangeSchema.safeParse(change);
  if (!parsed.success) {
    return parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
  }
  if (!isHlc(change.updatedAt)) return 'updatedAt: not an HLC';
  if (parseHlc(change.updatedAt).wallMs - now.getTime() > MAX_CLOCK_SKEW_MS) {
    return 'updatedAt: device clock is more than 24h ahead of the server';
  }
  return null;
}

/**
 * §8.3. One row at a time, each with its own verdict: `applied`, `stale` (the server already has a
 * newer row — the client will receive it on the next pull) or `invalid`.
 *
 * The upsert carries its own `setWhere`, so two concurrent pushes of the same row cannot lose the
 * newer one: whichever commits second only wins if its HLC is greater.
 */
export async function applyPush(
  db: ServerDatabase,
  userId: string,
  request: PushRequest,
  now: Date,
): Promise<PushResult[]> {
  const results: PushResult[] = [];
  for (const change of request.changes) {
    const error = validate(change, now);
    if (error !== null) {
      results.push({ entity: change.entity, id: change.id, status: 'invalid', error });
      continue;
    }
    const seq = await nextSeq(db);
    const applied = await db
      .insert(syncRows)
      .values({
        userId,
        entity: change.entity,
        id: change.id,
        updatedAt: change.updatedAt,
        deletedAt: change.deletedAt === null ? null : new Date(change.deletedAt),
        data: change.data,
        seq,
      })
      .onConflictDoUpdate({
        target: [syncRows.userId, syncRows.entity, syncRows.id],
        set: {
          updatedAt: sql`excluded.updated_at`,
          deletedAt: sql`excluded.deleted_at`,
          data: sql`excluded.data`,
          seq: sql`excluded.seq`,
        },
        setWhere: sql`${syncRows.updatedAt} < excluded.updated_at`,
      })
      .returning({ id: syncRows.id });
    results.push({
      entity: change.entity,
      id: change.id,
      status: applied.length > 0 ? 'applied' : 'stale',
    });
  }
  return results;
}
