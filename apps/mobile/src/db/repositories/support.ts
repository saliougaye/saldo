import type { HlcString } from '@saldo/core';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type { Clock } from '../clock';
import type { schema } from '../schema';

/** `sync_state` values (§7). */
export const SYNCED = 0;
export const PENDING = 1;

/**
 * Driver-agnostic Drizzle handle. Repositories run against `expo-sqlite` on device and
 * `better-sqlite3` in tests; the two drivers differ only in their `run()` result type, so this is
 * their common supertype rather than either concrete one.
 */
export type RepositoryDatabase = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

export interface RepositoryContext {
  db: RepositoryDatabase;
  clock: Clock;
  /** Overridable so tests get deterministic `createdAt` stamps. */
  nowIso?: () => string;
}

export interface InsertStamp {
  createdAt: string;
  updatedAt: HlcString;
  deletedAt: null;
  syncState: typeof PENDING;
}

export interface UpdateStamp {
  updatedAt: HlcString;
  syncState: typeof PENDING;
}

export function isoNow(): string {
  return new Date().toISOString();
}

/** Fields stamped on insert: creation time, a fresh HLC, and pending so the scheduler pushes it. */
export function insertStamp(context: RepositoryContext): InsertStamp {
  return {
    createdAt: (context.nowIso ?? isoNow)(),
    updatedAt: context.clock.now(),
    deletedAt: null,
    syncState: PENDING,
  };
}

/** Fields stamped on every write after insert. `createdAt` is never touched again. */
export function updateStamp(context: RepositoryContext): UpdateStamp {
  return { updatedAt: context.clock.now(), syncState: PENDING };
}

/** Drops the device-only `syncState` column so `@saldo/core` only ever sees entity fields. */
export function toEntity<T>(row: T & { syncState: number }): T {
  const { syncState: _ignored, ...entity } = row;
  return entity as T;
}
