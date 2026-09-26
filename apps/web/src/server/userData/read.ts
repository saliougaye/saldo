import {
  type EntityName,
  emptyUserData,
  entitySchemas,
  readSettings,
  USER_DATA_COLLECTIONS,
  type UserData,
} from '@saldo/core';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { syncRows } from '../db/schema';
import type { ServerDatabase } from '../db/types';
import { log, shortId } from '../log';

const isEntityName = (value: string): value is EntityName => Object.hasOwn(entitySchemas, value);

/**
 * The projection (§17.1.2): a user's live rows from `sync_rows`, each parsed with its entity
 * schema, as one typed `UserData`. **The only way server code reads a row's contents**; push and
 * pull move envelopes without looking inside.
 *
 * A row that fails its schema is skipped and logged, never fatal: push already refuses such rows,
 * so a stored one fails only when the schema changed under it (a server rolled back, a field added
 * without `.optional()`, a hand edit). `settings` is the exception, read with defaults by
 * `readSettings`, because skipping it would send the user to onboarding over their real settings.
 *
 * Loads everything, every time, as the phone does from SQLite. A known limit, not an oversight; see
 * §17.1.2 for what to do when it starts to show.
 */
export async function readUserData(db: ServerDatabase, userId: string): Promise<UserData> {
  const rows = await db
    .select({ entity: syncRows.entity, id: syncRows.id, data: syncRows.data })
    .from(syncRows)
    .where(and(eq(syncRows.userId, userId), isNull(syncRows.deletedAt)))
    .orderBy(asc(syncRows.entity), asc(syncRows.id));

  const data = emptyUserData();
  let skipped = 0;
  for (const row of rows) {
    if (!isEntityName(row.entity)) {
      skipped += 1;
      log('userData', 'skipped a row of an unknown entity', {
        user: shortId(userId),
        entity: row.entity,
      });
      continue;
    }
    if (row.entity === 'settings') {
      data.settings = readSettings(row.data);
      continue;
    }
    const parsed = entitySchemas[row.entity].safeParse(row.data);
    if (!parsed.success) {
      skipped += 1;
      log('userData', 'skipped a row that does not parse', {
        user: shortId(userId),
        entity: row.entity,
        id: shortId(row.id),
        issues: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      });
      continue;
    }
    // `entitySchemas[row.entity]` and `USER_DATA_COLLECTIONS[row.entity]` are keyed by the same
    // entity, but TypeScript cannot correlate the two lookups through a union.
    (data[USER_DATA_COLLECTIONS[row.entity]] as unknown[]).push(parsed.data);
  }
  if (skipped > 0)
    log('userData', `loaded with ${skipped} rows skipped`, { user: shortId(userId) });
  return data;
}
