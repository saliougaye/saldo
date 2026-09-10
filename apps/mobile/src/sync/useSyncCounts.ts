import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { db } from '../db/client';
import { transactions } from '../db/schema';
import { errorCount, pendingCount } from './localStore';

export interface SyncCounts {
  pending: number;
  errors: number;
}

/**
 * The two numbers §6.30 shows. `useLiveQuery` is used only as a change signal — the counts
 * themselves span seven tables, so they are read after every reported change rather than expressed
 * as one query.
 */
export function useSyncCounts(): SyncCounts {
  // Subscribed for the re-render, not for the rows: `useLiveQuery` re-renders this component on
  // any reported change, and the counts are then read across all seven tables.
  useLiveQuery(db.select({ id: transactions.id }).from(transactions).limit(1));
  return { pending: pendingCount(db), errors: errorCount(db) };
}
