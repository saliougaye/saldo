import { DATA_RESET_CODE } from '@saldo/core';
import { eq, sql } from 'drizzle-orm';
import { BLOB_GRACE_DAYS } from '../attachments/cleanup';
import { dataEpochs, syncRows } from '../db/schema';
import type { ServerDatabase } from '../db/types';
import { ApiError } from '../http/errors';

/** §8.6. The generation the account's data is on; 0 for an account that never deleted it. */
export async function readEpoch(db: ServerDatabase, userId: string): Promise<number> {
  const [row] = await db
    .select({ epoch: dataEpochs.epoch })
    .from(dataEpochs)
    .where(eq(dataEpochs.userId, userId))
    .limit(1);
  return row?.epoch ?? 0;
}

/**
 * The epoch, read under a share lock that holds until the surrounding transaction ends. A push
 * takes it before writing, and `deleteAccountData` needs the row lock to bump the epoch, so the
 * two cannot interleave: a push either lands before the deletion, and is deleted with the rest, or
 * waits for it and is refused.
 *
 * The row is created first because `FOR SHARE` on a row that does not exist locks nothing.
 */
export async function lockEpoch(tx: ServerDatabase, userId: string): Promise<number> {
  await tx.insert(dataEpochs).values({ userId }).onConflictDoNothing();
  const [row] = await tx
    .select({ epoch: dataEpochs.epoch })
    .from(dataEpochs)
    .where(eq(dataEpochs.userId, userId))
    .for('share');
  return row?.epoch ?? 0;
}

/**
 * Refuses a device holding an earlier generation. `undefined` is a device that has not said which
 * one it holds — a request from before §8.6 — and is let through.
 */
export function assertEpoch(expected: number | undefined, current: number): void {
  if (expected === undefined || expected === current) return;
  throw new ApiError(
    409,
    DATA_RESET_CODE,
    `This device holds generation ${expected} of the account's data; the server is on ${current}.`,
  );
}

/**
 * §8.6. Deletes every synced row of the account and moves its epoch up by one, in one transaction.
 * Returns the new epoch.
 *
 * The attachment bytes are queued rather than deleted here: the store may be slow or remote, and a
 * failure there must not keep the rows. They are queued as already past the grace period of §10,
 * which exists so other devices can converge — and after this there is nothing left to converge on.
 */
export async function deleteAccountData(
  db: ServerDatabase,
  userId: string,
  now: Date,
): Promise<number> {
  const due = new Date(now.getTime() - BLOB_GRACE_DAYS * 24 * 60 * 60 * 1000);
  return db.transaction(async (tx) => {
    const [bumped] = await tx
      .insert(dataEpochs)
      .values({ userId, epoch: 1, resetAt: now })
      .onConflictDoUpdate({
        target: dataEpochs.userId,
        set: { epoch: sql`${dataEpochs.epoch} + 1`, resetAt: now },
      })
      .returning({ epoch: dataEpochs.epoch });
    if (bumped === undefined) throw new Error('data_epochs upsert returned no row');

    // One statement, not a values list: an account may hold more attachments than a single
    // statement can take parameters.
    await tx.execute(sql`
      insert into deleted_blobs (user_id, attachment_id, tombstoned_at)
      select user_id, id, ${due.toISOString()}::timestamptz
      from sync_rows
      where user_id = ${userId} and entity = 'attachment'
      on conflict (user_id, attachment_id) do update set tombstoned_at = excluded.tombstoned_at
    `);
    await tx.delete(syncRows).where(eq(syncRows.userId, userId));
    return bumped.epoch;
  });
}
