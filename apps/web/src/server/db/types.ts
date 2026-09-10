import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { schema } from './schema';

/**
 * The common base of `NodePgDatabase` (production, `pg`) and `PgliteDatabase` (tests): services
 * take this so the same code runs against both, exactly as the mobile repositories take
 * `BaseSQLiteDatabase` to run against `expo-sqlite` on device and `better-sqlite3` in tests.
 */
export type ServerDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;
