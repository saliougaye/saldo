import {
  type EntityName,
  type PushResult,
  SYNC_SCHEMA_VERSION,
  type SyncChangeEnvelope,
} from '@saldo/core';
import { and, eq } from 'drizzle-orm';
import { syncRows } from '../db/schema';
import type { ServerDatabase } from '../db/types';
import { lockEpoch } from '../sync/epoch';
import { applyPush } from '../sync/push';
import { advanceClock } from './clock';

/**
 * One row the server writes: every field of the entity **except** `updatedAt`, which the clock
 * stamps. `deletedAt` set to an instant makes it a tombstone (§7).
 */
export interface EntityWrite {
  entity: EntityName;
  id: string;
  data: Record<string, unknown> & { deletedAt: string | null };
}

/** A write the upsert did not apply. It rolls the whole batch back: half a write is worse than none. */
export class WriteRefused extends Error {
  constructor(readonly results: readonly PushResult[]) {
    super(
      `write refused: ${results
        .filter((result) => result.status !== 'applied')
        .map((result) => `${result.entity}/${result.id} ${result.status} ${result.error ?? ''}`)
        .join('; ')}`,
    );
  }
}

/**
 * §17.1.3: **the one way the server writes a row.** The web writes as a sync client: every row gets
 * a stamp from the instance's clock and goes through `applyPush`, the same upsert and validation as
 * `POST /api/sync/push`, under the same epoch share lock — so a deletion of the account's data can
 * never interleave with a web write, and a phone receives the row on its next pull like any other.
 */
export async function writeChanges(
  db: ServerDatabase,
  userId: string,
  writes: readonly EntityWrite[],
  now: Date,
): Promise<void> {
  if (writes.length === 0) return;
  await db.transaction(async (tx) => {
    await lockEpoch(tx, userId);
    const seen: (string | null)[] = [];
    for (const write of writes) {
      const [row] = await tx
        .select({ updatedAt: syncRows.updatedAt })
        .from(syncRows)
        .where(
          and(
            eq(syncRows.userId, userId),
            eq(syncRows.entity, write.entity),
            eq(syncRows.id, write.id),
          ),
        )
        .limit(1);
      seen.push(row?.updatedAt ?? null);
    }
    const stamps = await advanceClock(tx, now, seen);
    const changes: SyncChangeEnvelope[] = writes.map((write, index) => {
      const stamp = stamps[index];
      if (stamp === undefined) throw new Error('advanceClock returned too few stamps');
      return {
        entity: write.entity,
        id: write.id,
        updatedAt: stamp,
        deletedAt: write.data.deletedAt,
        data: { ...write.data, id: write.id, updatedAt: stamp },
      };
    });
    const results = await applyPush(
      tx,
      userId,
      { schemaVersion: SYNC_SCHEMA_VERSION, deviceId: 'server', changes },
      now,
    );
    if (results.some((result) => result.status !== 'applied')) throw new WriteRefused(results);
  });
}
