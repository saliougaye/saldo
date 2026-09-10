import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { schema } from './schema';

export const DATABASE_NAME = 'saldo.db';

/**
 * The Expo-backed handle. `enableChangeListener` is what makes `useLiveQuery` re-run after a
 * write (§7), so it must stay on.
 */
export const sqlite: SQLiteDatabase = openDatabaseSync(DATABASE_NAME, {
  enableChangeListener: true,
});

export const db = drizzle(sqlite, { schema });
