import {
  entitySchemas,
  type PullChange,
  type SyncChangeEnvelope,
  shouldApplyRemote,
} from '@saldo/core';
import { and, eq, sql } from 'drizzle-orm';
import type { Clock } from '../db/clock';
import type { KvStore } from '../db/kv';
import { PENDING, type RepositoryDatabase, SYNC_ERROR, SYNCED } from '../db/repositories/support';
import {
  isSyncedEntity,
  LOCAL_ONLY_COLUMNS,
  SYNCED_ENTITY_NAMES,
  SYNCED_TABLES,
  type SyncedEntityName,
} from './entities';

interface SyncRow {
  id: string;
  updatedAt: string;
  deletedAt: string | null;
  syncState: number;
}

/**
 * Everything written locally and not yet acknowledged, as wire envelopes. This deliberately does
 * not go through the repositories: they hide tombstones, and a tombstone is exactly what the other
 * device needs to hear about.
 */
export function pendingChanges(db: RepositoryDatabase, limit: number): SyncChangeEnvelope[] {
  const changes: SyncChangeEnvelope[] = [];
  for (const entity of SYNCED_ENTITY_NAMES) {
    if (changes.length >= limit) break;
    const table = SYNCED_TABLES[entity];
    const rows = db
      .select()
      .from(table)
      .where(eq(table.syncState, PENDING))
      .limit(limit - changes.length)
      .all() as (SyncRow & Record<string, unknown>)[];
    for (const row of rows) {
      const { syncState: _ignored, ...data } = row;
      for (const column of LOCAL_ONLY_COLUMNS[entity] ?? []) delete data[column];
      changes.push({
        entity,
        id: row.id,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
        data,
      });
    }
  }
  return changes;
}

function countWhere(db: RepositoryDatabase, state: number): number {
  let total = 0;
  for (const entity of SYNCED_ENTITY_NAMES) {
    const table = SYNCED_TABLES[entity];
    const [row] = db
      .select({ count: sql<number>`count(*)` })
      .from(table)
      .where(eq(table.syncState, state))
      .all();
    total += row?.count ?? 0;
  }
  return total;
}

/** What §6.30 shows as "changes waiting to sync". */
export function pendingCount(db: RepositoryDatabase): number {
  return countWhere(db, PENDING);
}

/** What §6.30 shows as rows the server rejected. */
export function errorCount(db: RepositoryDatabase): number {
  return countWhere(db, SYNC_ERROR);
}

/**
 * §8.3: clear the pending flag **only if** the row still carries the timestamp that was pushed. A
 * write that landed while the request was in flight has to stay pending, or it would never be sent.
 */
export function markPushed(
  db: RepositoryDatabase,
  entity: SyncedEntityName,
  id: string,
  pushedUpdatedAt: string,
): void {
  const table = SYNCED_TABLES[entity];
  db.update(table)
    .set({ syncState: SYNCED })
    .where(and(eq(table.id, id), eq(table.updatedAt, pushedUpdatedAt)))
    .run();
}

export function markInvalid(db: RepositoryDatabase, entity: SyncedEntityName, id: string): void {
  const table = SYNCED_TABLES[entity];
  db.update(table).set({ syncState: SYNC_ERROR }).where(eq(table.id, id)).run();
}

export interface ApplyPullInput {
  db: RepositoryDatabase;
  kv: KvStore;
  clock: Clock;
  changes: readonly PullChange[];
  nextSince: number;
}

export interface ApplyPullOutcome {
  applied: number;
  skipped: number;
  errors: number;
}

/**
 * §8.3: applies a page and stores the cursor **in the same transaction as the rows**, so a crash
 * mid-page cannot leave the cursor ahead of the data it stands for.
 */
export function applyPull(input: ApplyPullInput): ApplyPullOutcome {
  const { db, kv, clock, changes, nextSince } = input;
  const outcome: ApplyPullOutcome = { applied: 0, skipped: 0, errors: 0 };
  db.transaction((tx) => {
    for (const change of changes) {
      // Every timestamp seen moves the local clock forward, applied or not: otherwise the next
      // local write could sort before a row this device has already accepted.
      clock.receive(change.updatedAt);
      if (!isSyncedEntity(change.entity)) {
        outcome.skipped += 1;
        continue;
      }
      const entity = change.entity;
      const parsed = entitySchemas[entity].safeParse(change.data);
      if (!parsed.success) {
        outcome.errors += 1;
        continue;
      }
      const table = SYNCED_TABLES[entity];
      const [local] = tx
        .select({ updatedAt: table.updatedAt })
        .from(table)
        .where(eq(table.id, change.id))
        .all();
      if (!shouldApplyRemote(change.updatedAt, local?.updatedAt ?? null)) {
        outcome.skipped += 1;
        continue;
      }
      const values = { ...parsed.data, syncState: SYNCED };
      tx.insert(table).values(values).onConflictDoUpdate({ target: table.id, set: values }).run();
      outcome.applied += 1;
    }
    kv.set('syncCursor', String(nextSince));
  });
  return outcome;
}
