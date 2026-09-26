import type { Attachment } from '@saldo/core';
import type { ServerDatabase } from '../db/types';
import { ApiError } from '../http/errors';
import { loadAttachment } from '../userData/attachment';

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
  const lookup = await loadAttachment(db, userId, id);
  if (lookup.status === 'missing') {
    throw new ApiError(404, 'not_found', 'No such attachment');
  }
  if (lookup.status === 'invalid') {
    throw new ApiError(422, 'invalid_row', 'The stored attachment row is not readable');
  }
  return lookup.attachment;
}
