import type { RepositoryDatabase } from './repositories/support';
import { schema } from './schema';

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
export function wipeDevice(db: RepositoryDatabase): void {
  db.transaction((tx) => {
    for (const table of Object.values(schema)) tx.delete(table).run();
  });
}
