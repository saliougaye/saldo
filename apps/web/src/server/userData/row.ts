import { type EntityName, entitySchemas } from '@saldo/core';
import { and, eq } from 'drizzle-orm';
import type { z } from 'zod';
import { syncRows } from '../db/schema';
import type { ServerDatabase } from '../db/types';

export type RowLookup<E extends EntityName> =
  | { status: 'found'; row: z.infer<(typeof entitySchemas)[E]>; deleted: boolean }
  | { status: 'missing' }
  | { status: 'invalid' };

/**
 * One row, **tombstones included**, for the one thing the projection cannot answer: «Annulla» after
 * a delete (§5.12), which must write back the row as it was. Part of the projection (§17.1.2), as
 * `loadAttachment` is: a row's contents are read here and nowhere else.
 */
export async function loadRow<E extends EntityName>(
  db: ServerDatabase,
  userId: string,
  entity: E,
  id: string,
): Promise<RowLookup<E>> {
  const [row] = await db
    .select({ data: syncRows.data, deletedAt: syncRows.deletedAt })
    .from(syncRows)
    .where(and(eq(syncRows.userId, userId), eq(syncRows.entity, entity), eq(syncRows.id, id)))
    .limit(1);
  if (row === undefined) return { status: 'missing' };
  const parsed = entitySchemas[entity].safeParse(row.data);
  if (!parsed.success) return { status: 'invalid' };
  return {
    status: 'found',
    row: parsed.data as z.infer<(typeof entitySchemas)[E]>,
    deleted: row.deletedAt !== null,
  };
}
