import { type Attachment, attachmentSchema } from '@saldo/core';
import { and, eq, isNull } from 'drizzle-orm';
import { syncRows } from '../db/schema';
import type { ServerDatabase } from '../db/types';
import { ApiError } from '../http/errors';

/**
 * The attachment row this upload or download is about (§10). Its absence is what enforces the
 * ordering the sync needs: **the row is pushed before its bytes**, so blobs can never arrive for
 * something the server has never heard of — and a row belonging to somebody else is simply not
 * found, rather than refused in a way that would confirm it exists.
 */
export async function requireAttachment(
  db: ServerDatabase,
  userId: string,
  id: string,
): Promise<Attachment> {
  const [row] = await db
    .select({ data: syncRows.data })
    .from(syncRows)
    .where(
      and(
        eq(syncRows.userId, userId),
        eq(syncRows.entity, 'attachment'),
        eq(syncRows.id, id),
        isNull(syncRows.deletedAt),
      ),
    )
    .limit(1);
  if (row === undefined) {
    throw new ApiError(404, 'not_found', 'No such attachment');
  }
  const parsed = attachmentSchema.safeParse(row.data);
  if (!parsed.success) {
    throw new ApiError(422, 'invalid_row', 'The stored attachment row is not readable');
  }
  return parsed.data;
}
