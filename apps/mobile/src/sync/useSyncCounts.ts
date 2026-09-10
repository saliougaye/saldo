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
  const { updatedAt } = useLiveQuery(
    db.select({ id: transactions.id }).from(transactions).limit(1),
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: updatedAt is the change signal.
  return { pending: pendingCount(db), errors: errorCount(db) };
}
