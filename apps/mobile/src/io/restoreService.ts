import type { Backup, BackupData } from '@saldo/core';
import { and, eq, isNull, notInArray } from 'drizzle-orm';
import type { Clock } from '../db/clock';
import type { RepositoryDatabase } from '../db/repositories/support';
import { PENDING } from '../db/repositories/support';
import { SYNCED_TABLES, type SyncedEntityName } from '../sync/entities';

export interface RestoreOutcome {
  /** Rows written from the backup. */
  restored: number;
  /** Rows that existed here, are not in the backup, and were tombstoned. */
  removed: number;
}

type BackupRow =
  | BackupData['settings']
  | BackupData['accounts'][number]
  | BackupData['categories'][number]
  | BackupData['tags'][number]
  | BackupData['recurrences'][number]
  | BackupData['transactions'][number]
  | BackupData['budgets'][number];

/**
 * Which collection of the backup feeds which table, in an order that keeps a parent ahead of its
 * children. The local schema declares no foreign keys, so this is for readability rather than for
 * SQLite — but a restore that wrote a transaction before its account would still be wrong to read
 * halfway through.
 */
const ORDER: { entity: SyncedEntityName; rows: (data: BackupData) => BackupRow[] }[] = [
  { entity: 'settings', rows: (data) => [data.settings] },
  { entity: 'account', rows: (data) => [...data.accounts] },
  { entity: 'category', rows: (data) => [...data.categories] },
  { entity: 'tag', rows: (data) => [...data.tags] },
  { entity: 'recurrence', rows: (data) => [...data.recurrences] },
  { entity: 'transaction', rows: (data) => [...data.transactions] },
  { entity: 'budget', rows: (data) => [...data.budgets] },
];

/**
 * §11.1 "Sostituisce tutti i dati su questo telefono". One transaction: every row of the backup is
 * written with a **fresh HLC**, so it beats whatever the server still holds, and everything else
 * that is still alive here is tombstoned — a restore is a replacement, not a merge.
 *
 * Rows keep their own ids. Restoring onto the same account must converge on the rows that were
 * exported, not duplicate them under new ids.
 *
 * `createdAt` is kept as the backup recorded it: it is the row's history, not this write's.
 */
export function applyRestore(input: {
  db: RepositoryDatabase;
  clock: Clock;
  backup: Backup;
  now: string;
}): RestoreOutcome {
  const { db, clock, backup, now } = input;
  const outcome: RestoreOutcome = { restored: 0, removed: 0 };

  db.transaction((tx) => {
    for (const { entity, rows } of ORDER) {
      const table = SYNCED_TABLES[entity];
      const incoming = rows(backup.data);
      for (const row of incoming) {
        const values = { ...row, updatedAt: clock.now(), deletedAt: null, syncState: PENDING };
        tx.insert(table).values(values).onConflictDoUpdate({ target: table.id, set: values }).run();
        outcome.restored += 1;
      }

      const ids = incoming.map((row) => row.id);
      // Whatever is still alive here and absent from the backup goes away — tombstoned rather
      // than deleted, so the other devices converge on the same replacement.
      const survivors = tx
        .select({ id: table.id })
        .from(table)
        .where(
          ids.length === 0
            ? isNull(table.deletedAt)
            : and(isNull(table.deletedAt), notInArray(table.id, ids)),
        )
        .all();
      for (const survivor of survivors) {
        tx.update(table)
          .set({ deletedAt: now, updatedAt: clock.now(), syncState: PENDING })
          .where(eq(table.id, survivor.id))
          .run();
        outcome.removed += 1;
      }
    }
  });

  return outcome;
}
