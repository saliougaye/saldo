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
 *
 * `basis` is the `updatedAt` of the row the write was decided from — what `build` read — or `null`
 * for a row `build` is creating. It is checked once the row is locked (see `writeInTransaction`):
 * a row that moved since, or a "new" row that now exists, refuses the batch as a `conflict`. Left
 * out, the write is blind and LWW alone decides, as for the seed rows onboarding converges on.
 */
export interface EntityWrite {
  entity: EntityName;
  id: string;
  data: Record<string, unknown> & { deletedAt: string | null };
  basis?: string | null;
}

/**
 * A batch the server did not write; it rolls the whole batch back: half a write is worse than none.
 * `reason` is `invalid` when a row failed its schema (a bug in the caller, not a race) and
 * `conflict` when the row moved under the write (stale, or changed since `build` read it).
 */
export class WriteRefused extends Error {
  readonly reason: 'invalid' | 'conflict';

  constructor(readonly results: readonly PushResult[]) {
    super(
      `write refused: ${results
        .filter((result) => result.status !== 'applied')
        .map((result) => `${result.entity}/${result.id} ${result.status} ${result.error ?? ''}`)
        .join('; ')}`,
    );
    this.reason = results.some((result) => result.status === 'invalid') ? 'invalid' : 'conflict';
  }
}

/**
 * The order the rows of a batch are locked in: by entity, then id. Two writes that touch the same
 * rows then always lock them in the same order and cannot deadlock each other.
 */
export function lockOrder<W extends Pick<EntityWrite, 'entity' | 'id'>>(writes: readonly W[]): W[] {
  const key = (write: W) => `${write.entity}\u0000${write.id}`;
  return [...writes].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}

async function stampAndApply(
  tx: ServerDatabase,
  userId: string,
  unordered: readonly EntityWrite[],
  now: Date,
): Promise<void> {
  if (unordered.length === 0) return;
  const writes = lockOrder(unordered);
  // Lock order (§17.1.3, I4): epoch (the caller already holds it), then the clock, then each
  // target row by (entity, id). Once a row is locked nothing else can change its `updated_at`
  // until this commits; whether it changed *before* the lock — after `build` read it — is what
  // `basis` tells.
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
    const current = row?.updatedAt ?? null;
    if (write.basis !== undefined && write.basis !== current) {
      throw new WriteRefused([
        {
          entity: write.entity,
          id: write.id,
          status: 'stale',
          error: write.basis === null ? 'row created since read' : 'row changed since read',
        },
      ]);
    }
    seen.push(current);
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
 * same transaction — then stamps and applies `build`'s writes exactly as `writeChanges` does. A
 * `build` that decides not to write returns `writes: []` and nothing is stamped or applied.
 *
 * The epoch lock is a **share** lock, so a phone's push can still commit a row between `build`'s
 * read and the moment `stampAndApply` locks that row `FOR UPDATE`. That is why each write carries
 * its `basis`, the `updatedAt` `build` saw: once the row is locked, a different one refuses the
 * batch (`WriteRefused`, `conflict`), and the user retries on data that includes the phone's edit
 * instead of silently overwriting it.
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

/**
 * §17.4.2: whether a row moved since the version a caller read it at. An MCP client reads a row
 * and writes it seconds or minutes later; the write function reads the row again inside its own
 * transaction, so `basis` only covers the gap after that second read. `expected` covers the one
 * before it: a phone's edit in between leaves a different stamp, and the write answers `conflict`
 * instead of building on top of an edit the client never saw. `undefined` checks nothing.
 */
export function movedSince(row: { updatedAt: string }, expected: string | undefined): boolean {
  return expected !== undefined && row.updatedAt !== expected;
}
