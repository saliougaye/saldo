import type { SyncChangeEnvelope } from '@saldo/core';
import { and, asc, eq, lte } from 'drizzle-orm';
import { deletedBlobs } from '../db/schema';
import type { ServerDatabase } from '../db/types';
import type { AttachmentStore } from '../storage';
import { objectKey } from '../storage';

/** How long a deleted attachment's bytes are kept, so slower devices can still converge (§10). */
export const BLOB_GRACE_DAYS = 7;

/** How many objects one push deletes. The work is spread rather than done in one burst. */
export const MAX_DELETIONS_PER_PUSH = 20;

/**
 * Records the attachments a push has just tombstoned, so their bytes can be dropped later (§10).
 * Queued rather than scanned: a tombstone is permanent, so "every attachment deleted more than a
 * week ago" is a set that only grows, and re-deleting it on every push would be one network call
 * per row forever.
 */
export async function enqueueDeletedBlobs(
  db: ServerDatabase,
  userId: string,
  changes: readonly SyncChangeEnvelope[],
  now: Date,
): Promise<void> {
  const tombstoned = changes.filter(
    (change) => change.entity === 'attachment' && change.deletedAt !== null,
  );
  if (tombstoned.length === 0) return;
  await db
    .insert(deletedBlobs)
    .values(
      tombstoned.map((change) => ({
        userId,
        attachmentId: change.id,
        tombstonedAt: now,
      })),
    )
    // A row deleted on two devices arrives twice; the first timestamp is the one that counts.
    .onConflictDoNothing();
}

/**
 * Deletes the bytes of attachments tombstoned more than `BLOB_GRACE_DAYS` ago, and forgets them.
 * Returns how many objects went.
 */
export async function drainDeletedBlobs(
  db: ServerDatabase,
  store: AttachmentStore,
  now: Date,
): Promise<number> {
  const due = new Date(now.getTime() - BLOB_GRACE_DAYS * 24 * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(deletedBlobs)
    .where(lte(deletedBlobs.tombstonedAt, due))
    .orderBy(asc(deletedBlobs.tombstonedAt))
    .limit(MAX_DELETIONS_PER_PUSH);

  let deleted = 0;
  for (const row of rows) {
    // The queue entry goes whether or not the object was there: a blob that never arrived leaves
    // nothing to delete, and keeping the entry would retry it forever.
    await store.delete(objectKey(row.userId, row.attachmentId)).catch(() => undefined);
    await db
      .delete(deletedBlobs)
      .where(
        and(eq(deletedBlobs.userId, row.userId), eq(deletedBlobs.attachmentId, row.attachmentId)),
      );
    deleted += 1;
  }
  return deleted;
}
