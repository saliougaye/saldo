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
import { lockClock, mintStamps, saveClock } from './clock';

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

async function stampAndApply(
  tx: ServerDatabase,
  userId: string,
  writes: readonly EntityWrite[],
  now: Date,
): Promise<void> {
  if (writes.length === 0) return;
  // Lock order (§17.1.3, I4): epoch (the caller already holds it), then the clock, then each
  // target row — in that order, so a concurrent write can never change a row's `updated_at`
  // between the moment this reads it and the moment it mints a stamp from it.
  const clockState = await lockClock(tx);
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
      .for('update');
    seen.push(row?.updatedAt ?? null);
  }
  const { state: nextState, stamps } = mintStamps(clockState, now, seen);
  await saveClock(tx, nextState);
  const changes: SyncChangeEnvelope[] = writes.map((write, index) => {
    const stamp = stamps[index];
    if (stamp === undefined) throw new Error('mintStamps returned too few stamps');
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
}

/**
 * §17.1.3: **the one way the server writes a row**, for a caller that also needs to read the
 * account's data to decide what to write. Opens the transaction, takes the epoch lock `applyPush`
 * takes, runs `build(tx)` — every `readUserData`/`loadRow` a write needs happens in here, on the
 * same transaction, so nothing else can change the account's data between the read and the write —
 * then stamps and applies `build`'s writes exactly as `writeChanges` does. A `build` that decides
 * not to write returns `writes: []` and nothing is stamped or applied.
 */
export async function writeInTransaction<R>(
  db: ServerDatabase,
  userId: string,
  now: Date,
  build: (tx: ServerDatabase) => Promise<{ writes: readonly EntityWrite[]; result: R }>,
): Promise<R> {
  return db.transaction(async (tx) => {
    await lockEpoch(tx, userId);
    const { writes, result } = await build(tx);
    await stampAndApply(tx, userId, writes, now);
    return result;
  });
}

/**
 * `writeInTransaction` for a caller with no reads to make first: the writes are already decided.
 */
export async function writeChanges(
  db: ServerDatabase,
  userId: string,
  writes: readonly EntityWrite[],
  now: Date,
): Promise<void> {
  if (writes.length === 0) return;
  await writeInTransaction(db, userId, now, async () => ({ writes, result: undefined }));
}
