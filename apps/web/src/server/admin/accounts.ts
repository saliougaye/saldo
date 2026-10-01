import { and, eq } from 'drizzle-orm';
import { deleteConfirmationMatches } from '../../features/admin/accountsView';
import { accountDetail, deleteUser, promoteUser, restoreUser, revokeUser } from '../auth/admin';
import { deletedBlobs, syncRows } from '../db/schema';
import type { ServerDatabase } from '../db/types';
import { log, shortId } from '../log';
import { type AttachmentStore, objectKey } from '../storage';

/**
 * §17.1.7. What the admin panel's Server Actions call: each wraps the function `auth/admin.ts`
 * already has (the CLI calls the same ones) and adds the two things the CLI does not need — the
 * refusals that keep an admin from locking themselves out, and the attachment bytes.
 *
 * Refusals are results, never throws (§17.1.3): the panel says what happened in its own words.
 */
export type AccountResult<E extends string = never> = { ok: true } | { ok: false; error: E };

const NOT_FOUND = { ok: false, error: 'notFound' } as const;
const SELF = { ok: false, error: 'self' } as const;

/** No demotion: the spec offers none, and the CLI has none. */
export async function promoteAccount(
  db: ServerDatabase,
  actorId: string,
  targetId: string,
): Promise<AccountResult<'notFound'>> {
  if (!(await promoteUser(db, targetId))) return NOT_FOUND;
  log('admin', 'account promoted', { by: shortId(actorId), account: shortId(targetId) });
  return { ok: true };
}

/**
 * Refuses one's own account. Only an admin reaches this, so it is also what guarantees the
 * instance never loses its last admin from the panel.
 */
export async function revokeAccount(
  db: ServerDatabase,
  actorId: string,
  targetId: string,
  now: Date,
): Promise<AccountResult<'self' | 'notFound'>> {
  if (actorId === targetId) return SELF;
  if (!(await revokeUser(db, targetId, null, now))) return NOT_FOUND;
  log('admin', 'account revoked', { by: shortId(actorId), account: shortId(targetId) });
  return { ok: true };
}

export async function restoreAccount(
  db: ServerDatabase,
  actorId: string,
  targetId: string,
): Promise<AccountResult<'notFound'>> {
  if (!(await restoreUser(db, targetId))) return NOT_FOUND;
  log('admin', 'account restored', { by: shortId(actorId), account: shortId(targetId) });
  return { ok: true };
}

/**
 * The ids of every attachment the account may have bytes for: the rows it syncs (tombstones too,
 * whose bytes stay for the grace period) and the queue of blobs waiting to be dropped. Both are
 * read because `deleteUser` cascades both away, and with them the only record of what is in the store.
 */
async function attachmentIds(db: ServerDatabase, userId: string): Promise<string[]> {
  const live = await db
    .select({ id: syncRows.id })
    .from(syncRows)
    .where(and(eq(syncRows.userId, userId), eq(syncRows.entity, 'attachment')));
  const queued = await db
    .select({ id: deletedBlobs.attachmentId })
    .from(deletedBlobs)
    .where(eq(deletedBlobs.userId, userId));
  return [...new Set([...live, ...queued].map((row) => row.id))];
}

/**
 * Irreversible. The typed confirmation is checked here with the same predicate the dialog uses to
 * enable its button, because a Server Action is a public endpoint whatever the page shows.
 *
 * The bytes go **before** the rows: once the account is deleted nothing says which objects were
 * its. Best effort — an unreachable bucket is logged and must not stop somebody being deleted —
 * and skipped when the server has no store.
 */
export async function deleteAccount(
  db: ServerDatabase,
  store: AttachmentStore | null,
  actorId: string,
  input: { id: string; confirmation: string },
): Promise<AccountResult<'self' | 'notFound' | 'emailMismatch'>> {
  if (actorId === input.id) return SELF;
  const account = await accountDetail(db, input.id);
  if (account === null) return NOT_FOUND;
  if (!deleteConfirmationMatches(input.confirmation, account)) {
    return { ok: false, error: 'emailMismatch' };
  }

  if (store !== null) {
    for (const id of await attachmentIds(db, input.id)) {
      await store.delete(objectKey(input.id, id)).catch((error: unknown) => {
        log('admin', 'attachment bytes not deleted', {
          account: shortId(input.id),
          attachment: shortId(id),
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }

  if (!(await deleteUser(db, input.id))) return NOT_FOUND;
  log('admin', 'account deleted', { by: shortId(actorId), account: shortId(input.id) });
  return { ok: true };
}
