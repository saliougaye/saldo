import type { RepositoryDatabase } from './repositories/support';
import { schema, syncedTables } from './schema';

/**
 * Returns the device to the state a fresh install is in: every synced entity gone, and every
 * device-local key with them.
 *
 * `kv` is emptied on purpose, not spared. It holds `deviceId`, which is the HLC tiebreaker, and
 * `syncCursor`, which says how much of an account's history this phone has already seen — keeping
 * either would let the next account that signs in inherit the identity and the reading position of
 * the one before it, which is the whole thing a reset is undoing. `deviceId()` mints a new id the
 * next time anything asks for one.
 *
 * It deliberately iterates `schema` rather than listing tables: a table added later is included
 * without anybody remembering to come back here.
 *
 * The attachment *files* are not its business — they live on the filesystem, not in SQLite, and
 * are removed by `deleteAllAttachmentFiles`. Both are needed to leave nothing behind.
 */
/**
 * Whether this phone is holding anything at all. Used before signing an account in: a device with
 * no rows has nothing that could belong to somebody else, and nothing worth asking about.
 *
 * `kv` is not counted. It holds the device's own identity, which every install has and which says
 * nothing about whose data this is.
 */
export function hasLocalData(db: RepositoryDatabase): boolean {
  return Object.values(syncedTables).some(
    (table) => db.select().from(table).limit(1).all().length > 0,
  );
}

export function wipeDevice(db: RepositoryDatabase): void {
  db.transaction((tx) => {
    for (const table of Object.values(schema)) tx.delete(table).run();
  });
}
