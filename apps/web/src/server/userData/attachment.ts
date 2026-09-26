import { type Attachment, attachmentSchema } from '@saldo/core';
import { and, eq, isNull } from 'drizzle-orm';
import { syncRows } from '../db/schema';
import type { ServerDatabase } from '../db/types';

export type AttachmentLookup =
  | { status: 'found'; attachment: Attachment }
  | { status: 'missing' }
  | { status: 'invalid' };

/**
 * One attachment row, for the upload and download endpoints (§10). Part of the projection
 * (§17.1.2) rather than a query of its own: loading the whole `UserData` to check one blob would be
 * absurd, but reading a row's contents still happens here and nowhere else.
 */
export async function loadAttachment(
  db: ServerDatabase,
  userId: string,
  id: string,
): Promise<AttachmentLookup> {
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
  if (row === undefined) return { status: 'missing' };
  const parsed = attachmentSchema.safeParse(row.data);
  return parsed.success ? { status: 'found', attachment: parsed.data } : { status: 'invalid' };
}
